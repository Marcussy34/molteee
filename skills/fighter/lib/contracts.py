"""
Contract ABIs, deployed addresses, and web3 wrappers for the Gaming Arena on Monad testnet.

ABIs are loaded from Foundry build artifacts (contracts/out/).
Addresses are loaded from .env.
All on-chain interactions go through typed wrapper functions.
"""
import json
import os
import secrets
import time
from enum import IntEnum
from pathlib import Path

from dotenv import load_dotenv
from web3 import Web3

# ─── Paths ────────────────────────────────────────────────────────────────────

# Project root (two levels up from this file: lib/ → fighter/ → skills/ → root)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
CONTRACTS_OUT = PROJECT_ROOT / "contracts" / "out"

# Load .env BEFORE reading env vars — fixes empty addresses at runtime
load_dotenv(PROJECT_ROOT / ".env")

# ─── Deployed Addresses ──────────────────────────────────────────────────────

AGENT_REGISTRY_ADDRESS = os.getenv("AGENT_REGISTRY_ADDRESS", "")
ESCROW_ADDRESS = os.getenv("ESCROW_ADDRESS", "")
RPS_GAME_ADDRESS = os.getenv("RPS_GAME_ADDRESS", "")

# ─── ERC-8004 Registry Addresses (deployed singletons on Monad Testnet) ─────

ERC8004_IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e"
ERC8004_REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713"

# ─── Monad Testnet Config ────────────────────────────────────────────────────

MONAD_RPC_URL = os.getenv("MONAD_RPC_URL", "https://testnet-rpc.monad.xyz")
MONAD_CHAIN_ID = 10143

# ─── Game Constants ──────────────────────────────────────────────────────────

# Move enum values matching RPSGame.sol
class Move:
    NONE = 0
    ROCK = 1
    PAPER = 2
    SCISSORS = 3

MOVE_NAMES = {Move.NONE: "None", Move.ROCK: "Rock", Move.PAPER: "Paper", Move.SCISSORS: "Scissors"}

# GameType enum values matching AgentRegistry.sol
class GameType:
    RPS = 0
    POKER = 1
    AUCTION = 2

# Escrow match status matching Escrow.sol
class MatchStatus(IntEnum):
    CREATED = 0
    ACTIVE = 1
    SETTLED = 2
    CANCELLED = 3

# RPS game phase matching RPSGame.sol
class GamePhase(IntEnum):
    COMMIT = 0
    REVEAL = 1
    COMPLETE = 2

# ─── ABI Loading ──────────────────────────────────────────────────────────────

# Lazy-load ABIs (available after forge build)
AGENT_REGISTRY_ABI = None
ESCROW_ABI = None
RPS_GAME_ABI = None
_abis_loaded = False

def _load_abi(contract_name: str) -> list:
    """Load ABI from Foundry build artifact."""
    artifact_path = CONTRACTS_OUT / f"{contract_name}.sol" / f"{contract_name}.json"
    if not artifact_path.exists():
        raise FileNotFoundError(
            f"ABI not found at {artifact_path}. Run 'forge build' first."
        )
    with open(artifact_path) as f:
        return json.load(f)["abi"]

def load_abis():
    """Load all contract ABIs. Call after forge build. Idempotent."""
    global AGENT_REGISTRY_ABI, ESCROW_ABI, RPS_GAME_ABI, _abis_loaded
    if _abis_loaded:
        return
    AGENT_REGISTRY_ABI = _load_abi("AgentRegistry")
    ESCROW_ABI = _load_abi("Escrow")
    RPS_GAME_ABI = _load_abi("RPSGame")
    _abis_loaded = True

# ─── Lazy Web3 + Account Init ────────────────────────────────────────────────

_w3 = None
_account = None

def get_w3() -> Web3:
    """Get Web3 instance connected to Monad RPC. Lazy-initialized."""
    global _w3
    if _w3 is None:
        _w3 = Web3(Web3.HTTPProvider(MONAD_RPC_URL))
        if not _w3.is_connected():
            raise ConnectionError(f"Cannot connect to Monad RPC at {MONAD_RPC_URL}")
    return _w3

def get_account():
    """Get Account from DEPLOYER_PRIVATE_KEY. Lazy-initialized."""
    global _account
    if _account is None:
        pk = os.getenv("DEPLOYER_PRIVATE_KEY", "")
        if not pk:
            raise ValueError("DEPLOYER_PRIVATE_KEY not set in .env")
        _account = get_w3().eth.account.from_key(pk)
    return _account

def get_address() -> str:
    """Get the checksummed address of the fighter agent wallet."""
    return get_account().address

# ─── Contract Instance Getters ────────────────────────────────────────────────

_registry_contract = None
_escrow_contract = None
_rps_contract = None

def get_registry():
    """Get AgentRegistry contract instance. Lazy-initialized."""
    global _registry_contract
    if _registry_contract is None:
        load_abis()
        addr = Web3.to_checksum_address(AGENT_REGISTRY_ADDRESS)
        _registry_contract = get_w3().eth.contract(address=addr, abi=AGENT_REGISTRY_ABI)
    return _registry_contract

def get_escrow():
    """Get Escrow contract instance. Lazy-initialized."""
    global _escrow_contract
    if _escrow_contract is None:
        load_abis()
        addr = Web3.to_checksum_address(ESCROW_ADDRESS)
        _escrow_contract = get_w3().eth.contract(address=addr, abi=ESCROW_ABI)
    return _escrow_contract

def get_rps_game():
    """Get RPSGame contract instance. Lazy-initialized."""
    global _rps_contract
    if _rps_contract is None:
        load_abis()
        addr = Web3.to_checksum_address(RPS_GAME_ADDRESS)
        _rps_contract = get_w3().eth.contract(address=addr, abi=RPS_GAME_ABI)
    return _rps_contract

# ─── Transaction Helper ──────────────────────────────────────────────────────

def send_tx(func, value=0):
    """
    Build, sign, send, and wait for a contract function call.

    Args:
        func: A web3 contract function call (e.g. contract.functions.register(...))
        value: Wei to send with the transaction (for payable functions)

    Returns:
        Transaction receipt

    Raises:
        Exception: If transaction reverts, includes tx hash for debugging
    """
    w3 = get_w3()
    account = get_account()

    # Build the transaction
    tx = func.build_transaction({
        "from": account.address,
        "value": value,
        "nonce": w3.eth.get_transaction_count(account.address),
        "chainId": MONAD_CHAIN_ID,
    })

    # Estimate gas with 1.2x buffer, fallback to 500000
    try:
        estimated = w3.eth.estimate_gas(tx)
        tx["gas"] = int(estimated * 1.2)
    except Exception:
        tx["gas"] = 500000

    # Sign and send
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)

    # Wait for receipt
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

    # Check for revert
    if receipt["status"] == 0:
        raise Exception(f"Transaction reverted: {tx_hash.hex()}")

    return receipt

# ─── AgentRegistry Wrappers ──────────────────────────────────────────────────

def register_agent(game_types: list[int], min_wager: int, max_wager: int):
    """Register this agent in AgentRegistry. Returns receipt."""
    return send_tx(
        get_registry().functions.register(game_types, min_wager, max_wager)
    )

def get_agent_info(address: str) -> dict:
    """
    Get agent info from AgentRegistry. Returns dict with keys:
    wallet, gameTypes, minWager, maxWager, isOpen, exists
    """
    addr = Web3.to_checksum_address(address)
    result = get_registry().functions.getAgent(addr).call()
    # web3.py returns struct as tuple: (wallet, gameTypes[], minWager, maxWager, isOpen, exists)
    return {
        "wallet": result[0],
        "gameTypes": result[1],
        "minWager": result[2],
        "maxWager": result[3],
        "isOpen": result[4],
        "exists": result[5],
    }

def get_open_agents(game_type: int = GameType.RPS) -> list[str]:
    """Get list of open agent addresses for a game type."""
    return get_registry().functions.getOpenAgents(game_type).call()

def get_elo(address: str, game_type: int = GameType.RPS) -> int:
    """Get ELO rating for an agent in a game type."""
    addr = Web3.to_checksum_address(address)
    return get_registry().functions.elo(addr, game_type).call()

def get_match_history(address: str) -> list:
    """Get match history for an agent. Returns list of tuples (opponent, gameType, won, wager, timestamp)."""
    addr = Web3.to_checksum_address(address)
    return get_registry().functions.getMatchHistory(addr).call()

def get_match_count(address: str) -> int:
    """Get total match count for an agent."""
    addr = Web3.to_checksum_address(address)
    return get_registry().functions.getMatchCount(addr).call()

# ─── Escrow Wrappers ─────────────────────────────────────────────────────────

def create_escrow_match(opponent: str, game_contract: str, wager_wei: int):
    """
    Create an escrow match, locking the challenger's wager.
    Returns receipt (extract matchId from MatchCreated event).
    """
    return send_tx(
        get_escrow().functions.createMatch(
            Web3.to_checksum_address(opponent),
            Web3.to_checksum_address(game_contract),
        ),
        value=wager_wei,
    )

def accept_escrow_match(match_id: int, wager_wei: int):
    """Accept an escrow match by locking the opponent's matching wager. Returns receipt."""
    return send_tx(
        get_escrow().functions.acceptMatch(match_id),
        value=wager_wei,
    )

def get_escrow_match(match_id: int) -> dict:
    """
    Get escrow match details. Returns dict with keys:
    player1, player2, wager, gameContract, status, createdAt
    """
    result = get_escrow().functions.getMatch(match_id).call()
    # Struct fields: (player1, player2, wager, gameContract, status, createdAt)
    return {
        "player1": result[0],
        "player2": result[1],
        "wager": result[2],
        "gameContract": result[3],
        "status": int(result[4]),
        "createdAt": result[5],
    }

def get_next_match_id() -> int:
    """Get the next match ID that will be assigned by Escrow."""
    return get_escrow().functions.nextMatchId().call()

# ─── RPSGame Wrappers ────────────────────────────────────────────────────────

def create_rps_game(escrow_match_id: int, total_rounds: int):
    """Create a new RPS game linked to an escrow match. Returns receipt."""
    return send_tx(
        get_rps_game().functions.createGame(escrow_match_id, total_rounds)
    )

def commit_move(game_id: int, move_hash: bytes):
    """Commit a hashed move for the current round. Returns receipt."""
    return send_tx(
        get_rps_game().functions.commit(game_id, move_hash)
    )

def reveal_move(game_id: int, move: int, salt: bytes):
    """Reveal the move and salt for the current round. Returns receipt."""
    return send_tx(
        get_rps_game().functions.reveal(game_id, move, salt)
    )

def get_game(game_id: int) -> dict:
    """
    Get RPS game details. Returns dict with keys:
    escrowMatchId, player1, player2, totalRounds, currentRound,
    p1Score, p2Score, phase, phaseDeadline, settled
    """
    result = get_rps_game().functions.getGame(game_id).call()
    return {
        "escrowMatchId": result[0],
        "player1": result[1],
        "player2": result[2],
        "totalRounds": result[3],
        "currentRound": result[4],
        "p1Score": result[5],
        "p2Score": result[6],
        "phase": int(result[7]),
        "phaseDeadline": result[8],
        "settled": result[9],
    }

def get_round(game_id: int, round_index: int) -> dict:
    """
    Get round data. Returns dict with keys:
    p1Commit, p2Commit, p1Move, p2Move, p1Revealed, p2Revealed
    """
    result = get_rps_game().functions.getRound(game_id, round_index).call()
    return {
        "p1Commit": result[0],
        "p2Commit": result[1],
        "p1Move": int(result[2]),
        "p2Move": int(result[3]),
        "p1Revealed": result[4],
        "p2Revealed": result[5],
    }

def get_next_game_id() -> int:
    """Get the next game ID that will be assigned by RPSGame."""
    return get_rps_game().functions.nextGameId().call()

def claim_timeout(game_id: int):
    """Claim timeout if opponent hasn't acted within deadline. Returns receipt."""
    return send_tx(
        get_rps_game().functions.claimTimeout(game_id)
    )

# ─── Utility Functions ────────────────────────────────────────────────────────

def make_commit_hash(move_int: int, salt_bytes32: bytes) -> bytes:
    """
    Compute commit hash matching Solidity's keccak256(abi.encodePacked(uint8(move), bytes32(salt))).
    Returns bytes32 hash.
    """
    return Web3.solidity_keccak(["uint8", "bytes32"], [move_int, salt_bytes32])

def generate_salt() -> bytes:
    """Generate 32 random bytes for commit-reveal salt."""
    return secrets.token_bytes(32)

def get_balance(address: str = None) -> int:
    """Get MON balance in wei. Defaults to fighter agent wallet."""
    if address is None:
        address = get_address()
    return get_w3().eth.get_balance(Web3.to_checksum_address(address))

def wei_to_mon(wei: int) -> float:
    """Convert wei to MON (18 decimals)."""
    return wei / 10**18

def mon_to_wei(mon: float) -> int:
    """Convert MON to wei (18 decimals)."""
    return int(mon * 10**18)

def parse_match_id_from_receipt(receipt) -> int:
    """Extract matchId from MatchCreated event in transaction receipt."""
    escrow = get_escrow()
    logs = escrow.events.MatchCreated().process_receipt(receipt)
    if not logs:
        raise ValueError("No MatchCreated event found in receipt")
    return logs[0]["args"]["matchId"]

def parse_game_id_from_receipt(receipt) -> int:
    """Extract gameId from GameCreated event in transaction receipt."""
    rps = get_rps_game()
    logs = rps.events.GameCreated().process_receipt(receipt)
    if not logs:
        raise ValueError("No GameCreated event found in receipt")
    return logs[0]["args"]["gameId"]
