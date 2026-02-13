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
POKER_GAME_ADDRESS = os.getenv("POKER_GAME_ADDRESS", "")
AUCTION_GAME_ADDRESS = os.getenv("AUCTION_GAME_ADDRESS", "")
TOURNAMENT_ADDRESS = os.getenv("TOURNAMENT_ADDRESS", "")
PREDICTION_MARKET_ADDRESS = os.getenv("PREDICTION_MARKET_ADDRESS", "")
TOURNAMENT_V2_ADDRESS = os.getenv("TOURNAMENT_V2_ADDRESS", "")

# ─── ERC-8004 Registry Addresses (deployed singletons on Monad Testnet) ─────

ERC8004_IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e"
ERC8004_REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713"

# ─── Monad Testnet Config ────────────────────────────────────────────────────

MONAD_RPC_URL = os.getenv("MONAD_RPC_URL", "https://monad-testnet.g.alchemy.com/v2/uMvEY1mdMyM8svqTZD-p3")
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

# ─── Poker Game Constants ────────────────────────────────────────────────────

# Poker game phases matching PokerGame.sol
class PokerPhase(IntEnum):
    COMMIT = 0
    BETTING_ROUND1 = 1
    BETTING_ROUND2 = 2
    SHOWDOWN = 3
    COMPLETE = 4

# Poker actions matching PokerGame.sol
class PokerAction(IntEnum):
    NONE = 0
    CHECK = 1
    BET = 2
    RAISE = 3
    CALL = 4
    FOLD = 5

# Auction game phases matching AuctionGame.sol
class AuctionPhase(IntEnum):
    COMMIT = 0
    REVEAL = 1
    COMPLETE = 2

# Tournament status matching Tournament.sol
class TournamentStatus(IntEnum):
    REGISTRATION = 0
    ACTIVE = 1
    COMPLETE = 2
    CANCELLED = 3

# TournamentV2 format matching TournamentV2.sol
class TournamentV2Format(IntEnum):
    ROUND_ROBIN = 0
    DOUBLE_ELIM = 1

# TournamentV2 status matching TournamentV2.sol (same values as v1)
class TournamentV2Status(IntEnum):
    REGISTRATION = 0
    ACTIVE = 1
    COMPLETE = 2
    CANCELLED = 3

# ─── ABI Loading ──────────────────────────────────────────────────────────────

# Lazy-load ABIs (available after forge build)
AGENT_REGISTRY_ABI = None
ESCROW_ABI = None
RPS_GAME_ABI = None
POKER_GAME_ABI = None
AUCTION_GAME_ABI = None
TOURNAMENT_ABI = None
PREDICTION_MARKET_ABI = None
TOURNAMENT_V2_ABI = None
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
    global AGENT_REGISTRY_ABI, ESCROW_ABI, RPS_GAME_ABI, POKER_GAME_ABI, AUCTION_GAME_ABI, TOURNAMENT_ABI, PREDICTION_MARKET_ABI, TOURNAMENT_V2_ABI, _abis_loaded
    if _abis_loaded:
        return
    AGENT_REGISTRY_ABI = _load_abi("AgentRegistry")
    ESCROW_ABI = _load_abi("Escrow")
    RPS_GAME_ABI = _load_abi("RPSGame")
    POKER_GAME_ABI = _load_abi("PokerGameV2")
    AUCTION_GAME_ABI = _load_abi("AuctionGame")
    TOURNAMENT_ABI = _load_abi("Tournament")
    PREDICTION_MARKET_ABI = _load_abi("PredictionMarket")
    TOURNAMENT_V2_ABI = _load_abi("TournamentV2")
    _abis_loaded = True

# ─── Lazy Web3 + Account Init ────────────────────────────────────────────────

_w3 = None
_account = None

def get_w3() -> Web3:
    """Get or create Web3 instance connected to Monad RPC."""
    global _w3
    if _w3 is None:
        _w3 = Web3(Web3.HTTPProvider(MONAD_RPC_URL, request_kwargs={"timeout": 30}))
    return _w3


def reconnect_w3() -> Web3:
    """Force reconnect to Monad RPC. Call this after RPC errors."""
    global _w3
    _clear_contract_cache()
    _w3 = Web3(Web3.HTTPProvider(MONAD_RPC_URL, request_kwargs={"timeout": 30}))
    return _w3


def _clear_contract_cache():
    """Clear cached contract instances so they're rebuilt with fresh w3."""
    global _registry_contract, _escrow_contract, _rps_contract
    global _poker_contract, _auction_contract, _tournament_contract
    global _prediction_market_contract, _tournament_v2_contract
    _registry_contract = None
    _escrow_contract = None
    _rps_contract = None
    _poker_contract = None
    _auction_contract = None
    _tournament_contract = None
    _prediction_market_contract = None
    _tournament_v2_contract = None

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
_poker_contract = None
_auction_contract = None
_tournament_contract = None
_prediction_market_contract = None
_tournament_v2_contract = None

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

def get_poker_game():
    """Get PokerGame contract instance. Lazy-initialized."""
    global _poker_contract
    if _poker_contract is None:
        load_abis()
        addr = Web3.to_checksum_address(POKER_GAME_ADDRESS)
        _poker_contract = get_w3().eth.contract(address=addr, abi=POKER_GAME_ABI)
    return _poker_contract

def get_auction_game():
    """Get AuctionGame contract instance. Lazy-initialized."""
    global _auction_contract
    if _auction_contract is None:
        load_abis()
        addr = Web3.to_checksum_address(AUCTION_GAME_ADDRESS)
        _auction_contract = get_w3().eth.contract(address=addr, abi=AUCTION_GAME_ABI)
    return _auction_contract

def get_tournament():
    """Get Tournament contract instance. Lazy-initialized."""
    global _tournament_contract
    if _tournament_contract is None:
        load_abis()
        addr = Web3.to_checksum_address(TOURNAMENT_ADDRESS)
        _tournament_contract = get_w3().eth.contract(address=addr, abi=TOURNAMENT_ABI)
    return _tournament_contract

def get_prediction_market():
    """Get PredictionMarket contract instance. Lazy-initialized."""
    global _prediction_market_contract
    if _prediction_market_contract is None:
        load_abis()
        addr = Web3.to_checksum_address(PREDICTION_MARKET_ADDRESS)
        _prediction_market_contract = get_w3().eth.contract(address=addr, abi=PREDICTION_MARKET_ABI)
    return _prediction_market_contract

def get_tournament_v2():
    """Get TournamentV2 contract instance. Lazy-initialized."""
    global _tournament_v2_contract
    if _tournament_v2_contract is None:
        load_abis()
        addr = Web3.to_checksum_address(TOURNAMENT_V2_ADDRESS)
        _tournament_v2_contract = get_w3().eth.contract(address=addr, abi=TOURNAMENT_V2_ABI)
    return _tournament_v2_contract

# ─── Transaction Helper ──────────────────────────────────────────────────────

def send_tx(func, value=0, retries=3):
    """
    Build, sign, send, and wait for a contract function call.
    Retries on transient RPC errors (429, timeouts).

    Args:
        func: A web3 contract function call (e.g. contract.functions.register(...))
        value: Wei to send with the transaction (for payable functions)
        retries: Number of retry attempts for transient RPC errors

    Returns:
        Transaction receipt

    Raises:
        Exception: If transaction reverts, includes tx hash and revert reason
    """
    import time as _time

    for attempt in range(retries):
        try:
            return _send_tx_once(func, value)
        except Exception as e:
            err_str = str(e)
            # Retry on rate limits (429) and transient network errors
            is_transient = ("429" in err_str or "Too Many Requests" in err_str
                          or "timeout" in err_str.lower()
                          or "connection" in err_str.lower())
            if is_transient and attempt < retries - 1:
                wait = 2 ** (attempt + 1)  # 2, 4, 8 seconds
                print(f"    [retry] RPC error ({err_str[:60]}...), waiting {wait}s...")
                _time.sleep(wait)
                # Force reconnect on connection errors
                if "connection" in err_str.lower():
                    reconnect_w3()
                continue
            raise  # Re-raise on non-transient errors or final attempt


def _send_tx_once(func, value=0):
    """Internal: single-attempt send_tx."""
    w3 = get_w3()
    account = get_account()

    # Build the transaction
    tx = func.build_transaction({
        "from": account.address,
        "value": value,
        "nonce": w3.eth.get_transaction_count(account.address),
        "chainId": MONAD_CHAIN_ID,
    })

    # Estimate gas with 1.2x buffer — fail fast if call would revert
    try:
        estimated = w3.eth.estimate_gas(tx)
        tx["gas"] = int(estimated * 1.2)
    except Exception as e:
        err_msg = str(e)
        # If estimate_gas reverts, the tx WILL revert on-chain — fail early
        if "revert" in err_msg.lower() or "execution reverted" in err_msg.lower():
            raise Exception(f"Transaction would revert (estimate_gas): {err_msg}")
        # Non-revert errors (RPC timeout, etc.) — use fallback gas
        print(f"    [warn] Gas estimation failed ({err_msg[:100]}), using 500k fallback")
        tx["gas"] = 500000

    # Sign and send
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)

    # Wait for receipt with retry on 429
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

    # Check for revert — try to decode reason
    if receipt["status"] == 0:
        reason = ""
        try:
            w3.eth.call(tx, block_identifier=receipt["blockNumber"])
        except Exception as call_err:
            reason = str(call_err)[:200]
        raise Exception(f"Transaction reverted: {tx_hash.hex()} — {reason}")

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


# ─── PokerGame Wrappers ─────────────────────────────────────────────────────

def create_poker_game(escrow_match_id: int):
    """Create a new poker game linked to an escrow match. Returns receipt."""
    return send_tx(
        get_poker_game().functions.createGame(escrow_match_id)
    )

def commit_poker_hand(game_id: int, hand_hash: bytes):
    """Commit a hashed hand value. Returns receipt."""
    return send_tx(
        get_poker_game().functions.commitHand(game_id, hand_hash)
    )

def poker_take_action(game_id: int, action: int, value_wei: int = 0):
    """
    Take a betting action in a poker game. Returns receipt.
    action: PokerAction enum value (1=Check, 2=Bet, 3=Raise, 4=Call, 5=Fold)
    value_wei: ETH to send with bet/raise (0 for check/fold)
    """
    return send_tx(
        get_poker_game().functions.takeAction(game_id, action),
        value=value_wei,
    )

def reveal_poker_hand(game_id: int, hand_value: int, salt: bytes):
    """Reveal hand value and salt. Returns receipt."""
    return send_tx(
        get_poker_game().functions.revealHand(game_id, hand_value, salt)
    )

def get_poker_game_state(game_id: int) -> dict:
    """
    Get PokerGameV2 (Budget Poker) state. Returns dict with keys matching
    the GameView struct: escrowMatchId, player1, player2, totalRounds,
    currentRound, p1Score, p2Score, startingBudget, p1Budget, p2Budget,
    p1ExtraBets, p2ExtraBets, phase, phaseDeadline, settled,
    currentBet, currentTurn, p1Committed, p2Committed, p1Revealed, p2Revealed
    """
    result = get_poker_game().functions.getGame(game_id).call()
    # PokerGameV2 GameView struct — 21 fields in order
    return {
        "escrowMatchId": result[0],
        "player1": result[1],
        "player2": result[2],
        "totalRounds": result[3],
        "currentRound": result[4],
        "p1Score": result[5],
        "p2Score": result[6],
        "startingBudget": result[7],
        "p1Budget": result[8],
        "p2Budget": result[9],
        "p1ExtraBets": result[10],
        "p2ExtraBets": result[11],
        "phase": int(result[12]),
        "phaseDeadline": result[13],
        "settled": result[14],
        "currentBet": result[15],
        "currentTurn": result[16],
        "p1Committed": result[17],
        "p2Committed": result[18],
        "p1Revealed": result[19],
        "p2Revealed": result[20],
    }

def get_next_poker_game_id() -> int:
    """Get the next poker game ID."""
    return get_poker_game().functions.nextGameId().call()

def claim_poker_timeout(game_id: int):
    """Claim timeout in a poker game. Returns receipt."""
    return send_tx(
        get_poker_game().functions.claimTimeout(game_id)
    )

def parse_poker_game_id_from_receipt(receipt) -> int:
    """Extract gameId from PokerGame GameCreated event."""
    poker = get_poker_game()
    logs = poker.events.GameCreated().process_receipt(receipt)
    if not logs:
        raise ValueError("No GameCreated event found in poker receipt")
    return logs[0]["args"]["gameId"]

def make_poker_hand_hash(hand_value: int, salt_bytes32: bytes) -> bytes:
    """Compute hand value commit hash matching PokerGame.sol."""
    return Web3.solidity_keccak(["uint8", "bytes32"], [hand_value, salt_bytes32])


# ─── AuctionGame Wrappers ───────────────────────────────────────────────────

def create_auction_game(escrow_match_id: int):
    """Create a new auction game linked to an escrow match. Returns receipt."""
    return send_tx(
        get_auction_game().functions.createGame(escrow_match_id)
    )

def commit_auction_bid(game_id: int, bid_hash: bytes):
    """Commit a hashed bid. Returns receipt."""
    return send_tx(
        get_auction_game().functions.commitBid(game_id, bid_hash)
    )

def reveal_auction_bid(game_id: int, bid: int, salt: bytes):
    """Reveal bid amount and salt. Returns receipt."""
    return send_tx(
        get_auction_game().functions.revealBid(game_id, bid, salt)
    )

def get_auction_game_state(game_id: int) -> dict:
    """
    Get auction game state. Returns dict with keys:
    escrowMatchId, player1, player2, prize, p1Bid, p2Bid,
    p1Committed, p2Committed, p1Revealed, p2Revealed,
    phase, phaseDeadline, settled
    """
    result = get_auction_game().functions.getGame(game_id).call()
    return {
        "escrowMatchId": result[0],
        "player1": result[1],
        "player2": result[2],
        "prize": result[3],
        "p1Bid": result[4],
        "p2Bid": result[5],
        "p1Committed": result[6],
        "p2Committed": result[7],
        "p1Revealed": result[8],
        "p2Revealed": result[9],
        "phase": int(result[10]),
        "phaseDeadline": result[11],
        "settled": result[12],
    }

def get_next_auction_game_id() -> int:
    """Get the next auction game ID."""
    return get_auction_game().functions.nextGameId().call()

def claim_auction_timeout(game_id: int):
    """Claim timeout in an auction game. Returns receipt."""
    return send_tx(
        get_auction_game().functions.claimTimeout(game_id)
    )

def parse_auction_game_id_from_receipt(receipt) -> int:
    """Extract gameId from AuctionGame GameCreated event."""
    auc = get_auction_game()
    logs = auc.events.GameCreated().process_receipt(receipt)
    if not logs:
        raise ValueError("No GameCreated event found in auction receipt")
    return logs[0]["args"]["gameId"]

def make_auction_bid_hash(bid_wei: int, salt_bytes32: bytes) -> bytes:
    """Compute bid commit hash matching AuctionGame.sol."""
    return Web3.solidity_keccak(["uint256", "bytes32"], [bid_wei, salt_bytes32])


# ─── Tournament Wrappers ──────────────────────────────────────────────────

def create_tournament(entry_fee_wei: int, base_wager_wei: int, max_players: int):
    """Create a new tournament. Returns receipt."""
    return send_tx(
        get_tournament().functions.createTournament(entry_fee_wei, base_wager_wei, max_players)
    )

def register_tournament(tournament_id: int, entry_fee_wei: int):
    """Register for a tournament, locking entry fee. Returns receipt."""
    return send_tx(
        get_tournament().functions.register(tournament_id),
        value=entry_fee_wei,
    )

def generate_bracket(tournament_id: int):
    """Generate bracket once tournament is full. Returns receipt."""
    return send_tx(
        get_tournament().functions.generateBracket(tournament_id)
    )

def report_tournament_result(tournament_id: int, round_idx: int, match_index: int,
                              escrow_match_id: int, winner: str):
    """Report a match result to the tournament. Returns receipt."""
    return send_tx(
        get_tournament().functions.reportResult(
            tournament_id, round_idx, match_index,
            escrow_match_id, Web3.to_checksum_address(winner)
        )
    )

def distribute_prizes(tournament_id: int):
    """Distribute prizes after tournament completes. Returns receipt."""
    return send_tx(
        get_tournament().functions.distributePrizes(tournament_id)
    )

def cancel_tournament(tournament_id: int):
    """Cancel a tournament during registration, refunding entry fees. Returns receipt."""
    return send_tx(
        get_tournament().functions.cancelTournament(tournament_id)
    )

def get_tournament_info(tournament_id: int) -> dict:
    """
    Get tournament info. Returns dict with keys:
    entryFee, baseWager, maxPlayers, playerCount, prizePool,
    currentRound, totalRounds, status, creator, winner, runnerUp
    """
    result = get_tournament().functions.getTournament(tournament_id).call()
    return {
        "entryFee": result[0],
        "baseWager": result[1],
        "maxPlayers": result[2],
        "playerCount": result[3],
        "prizePool": result[4],
        "currentRound": result[5],
        "totalRounds": result[6],
        "status": int(result[7]),
        "creator": result[8],
        "winner": result[9],
        "runnerUp": result[10],
    }

def get_tournament_participants(tournament_id: int) -> list[str]:
    """Get list of participant addresses for a tournament."""
    return get_tournament().functions.getParticipants(tournament_id).call()

def get_bracket_match(tournament_id: int, round_idx: int, match_index: int) -> dict:
    """
    Get a bracket match. Returns dict with keys:
    player1, player2, winner, escrowMatchId, reported
    """
    result = get_tournament().functions.getBracketMatch(tournament_id, round_idx, match_index).call()
    return {
        "player1": result[0],
        "player2": result[1],
        "winner": result[2],
        "escrowMatchId": result[3],
        "reported": result[4],
    }

def get_round_wager(tournament_id: int, round_idx: int) -> int:
    """Get the wager for a specific round (baseWager * 2^round)."""
    return get_tournament().functions.getRoundWager(tournament_id, round_idx).call()

def get_tournament_game_type_for_round(round_idx: int) -> str:
    """Get the game contract address for a given round (rotation: 0=RPS, 1=Poker, 2=Auction)."""
    return get_tournament().functions.getGameTypeForRound(round_idx).call()

def get_match_count_for_round(tournament_id: int, round_idx: int) -> int:
    """Get the number of matches in a given round."""
    return get_tournament().functions.getMatchCountForRound(tournament_id, round_idx).call()

def get_next_tournament_id() -> int:
    """Get the next tournament ID that will be assigned."""
    return get_tournament().functions.nextTournamentId().call()

def parse_tournament_id_from_receipt(receipt) -> int:
    """Extract tournamentId from TournamentCreated event in receipt."""
    t = get_tournament()
    logs = t.events.TournamentCreated().process_receipt(receipt)
    if not logs:
        raise ValueError("No TournamentCreated event found in receipt")
    return logs[0]["args"]["tournamentId"]


# ─── PredictionMarket Wrappers ──────────────────────────────────────────

def create_prediction_market(match_id: int, seed_wei: int):
    """Create a prediction market for an active escrow match. Seeds both sides with equal liquidity. Returns receipt."""
    return send_tx(
        get_prediction_market().functions.createMarket(match_id),
        value=seed_wei,
    )

def buy_yes(market_id: int, amount_wei: int):
    """Buy YES tokens (betting on player1 winning). Returns receipt."""
    return send_tx(
        get_prediction_market().functions.buyYES(market_id),
        value=amount_wei,
    )

def buy_no(market_id: int, amount_wei: int):
    """Buy NO tokens (betting on player2 winning). Returns receipt."""
    return send_tx(
        get_prediction_market().functions.buyNO(market_id),
        value=amount_wei,
    )

def sell_yes(market_id: int, amount: int):
    """Sell YES tokens back to the pool. Returns receipt."""
    return send_tx(
        get_prediction_market().functions.sellYES(market_id, amount)
    )

def sell_no(market_id: int, amount: int):
    """Sell NO tokens back to the pool. Returns receipt."""
    return send_tx(
        get_prediction_market().functions.sellNO(market_id, amount)
    )

def resolve_prediction_market(market_id: int):
    """Resolve a prediction market after the linked match is settled. Returns receipt."""
    return send_tx(
        get_prediction_market().functions.resolve(market_id)
    )

def resolve_prediction_market_as_draw(market_id: int):
    """Resolve a prediction market as a draw (refunds proportionally). Returns receipt."""
    return send_tx(
        get_prediction_market().functions.resolveAsDraw(market_id)
    )

def redeem_prediction_market(market_id: int):
    """Redeem winning tokens for MON after market resolution. Returns receipt."""
    return send_tx(
        get_prediction_market().functions.redeem(market_id)
    )

def get_market_price(market_id: int) -> dict:
    """
    Get current YES/NO prices (scaled to 1e18 = 1.0).
    Returns dict with keys: yesPrice, noPrice
    """
    result = get_prediction_market().functions.getPrice(market_id).call()
    return {
        "yesPrice": result[0],
        "noPrice": result[1],
    }

def get_market(market_id: int) -> dict:
    """
    Get full market data. Returns dict with keys:
    matchId, reserveYES, reserveNO, seedLiquidity, player1, player2, resolved, winner
    """
    result = get_prediction_market().functions.getMarket(market_id).call()
    # Market struct fields in order
    return {
        "matchId": result[0],
        "reserveYES": result[1],
        "reserveNO": result[2],
        "seedLiquidity": result[3],
        "player1": result[4],
        "player2": result[5],
        "resolved": result[6],
        "winner": result[7],
    }

def get_user_market_balances(market_id: int, user_address: str) -> dict:
    """
    Get user's token balances for a market.
    Returns dict with keys: yes, no
    """
    addr = Web3.to_checksum_address(user_address)
    result = get_prediction_market().functions.getUserBalances(market_id, addr).call()
    return {
        "yes": result[0],
        "no": result[1],
    }

def get_next_market_id() -> int:
    """Get the next market ID that will be assigned."""
    return get_prediction_market().functions.nextMarketId().call()

def parse_market_id_from_receipt(receipt) -> int:
    """Extract marketId from MarketCreated event in receipt."""
    pm = get_prediction_market()
    logs = pm.events.MarketCreated().process_receipt(receipt)
    if not logs:
        raise ValueError("No MarketCreated event found in receipt")
    return logs[0]["args"]["marketId"]


# ─── TournamentV2 Wrappers ──────────────────────────────────────────────

def create_tournament_v2(format_type: int, entry_fee_wei: int, base_wager_wei: int, max_players: int):
    """Create a TournamentV2 with specified format (0=RoundRobin, 1=DoubleElim). Returns receipt."""
    return send_tx(
        get_tournament_v2().functions.createTournament(format_type, entry_fee_wei, base_wager_wei, max_players)
    )

def register_tournament_v2(tournament_id: int, entry_fee_wei: int):
    """Register for a TournamentV2, locking entry fee. Returns receipt."""
    return send_tx(
        get_tournament_v2().functions.register(tournament_id),
        value=entry_fee_wei,
    )

def generate_schedule_v2(tournament_id: int):
    """Generate match schedule once TournamentV2 is full. Returns receipt."""
    return send_tx(
        get_tournament_v2().functions.generateSchedule(tournament_id)
    )

def report_rr_result(tournament_id: int, match_index: int, escrow_match_id: int):
    """Report a round-robin match result (winner read trustlessly from Escrow). Returns receipt."""
    return send_tx(
        get_tournament_v2().functions.reportRRResult(tournament_id, match_index, escrow_match_id)
    )

def report_de_result(tournament_id: int, bracket: int, round_idx: int,
                     match_index: int, escrow_match_id: int):
    """
    Report a double-elimination match result. Returns receipt.
    bracket: 0=winners, 1=losers, 2=grand final
    """
    return send_tx(
        get_tournament_v2().functions.reportDEResult(
            tournament_id, bracket, round_idx, match_index, escrow_match_id
        )
    )

def distribute_prizes_v2(tournament_id: int):
    """Distribute prizes after TournamentV2 completes (70% winner, 30% runner-up). Returns receipt."""
    return send_tx(
        get_tournament_v2().functions.distributePrizes(tournament_id)
    )

def cancel_tournament_v2(tournament_id: int):
    """Cancel a TournamentV2 during registration, refunding entry fees. Returns receipt."""
    return send_tx(
        get_tournament_v2().functions.cancelTournament(tournament_id)
    )

def get_tournament_v2_info(tournament_id: int) -> dict:
    """
    Get TournamentV2 info. Returns dict with keys:
    format, entryFee, baseWager, maxPlayers, playerCount, prizePool, status, creator, winner
    """
    result = get_tournament_v2().functions.getTournament(tournament_id).call()
    # TournamentInfo struct fields in order
    return {
        "format": int(result[0]),
        "entryFee": result[1],
        "baseWager": result[2],
        "maxPlayers": result[3],
        "playerCount": result[4],
        "prizePool": result[5],
        "status": int(result[6]),
        "creator": result[7],
        "winner": result[8],
    }

def get_tournament_v2_participants(tournament_id: int) -> list[str]:
    """Get list of participant addresses for a TournamentV2."""
    return get_tournament_v2().functions.getParticipants(tournament_id).call()

def get_rr_match(tournament_id: int, match_index: int) -> dict:
    """
    Get a round-robin match result. Returns dict with keys:
    player1, player2, winner, escrowMatchId, reported
    """
    result = get_tournament_v2().functions.getRRMatch(tournament_id, match_index).call()
    return {
        "player1": result[0],
        "player2": result[1],
        "winner": result[2],
        "escrowMatchId": result[3],
        "reported": result[4],
    }

def get_de_match(tournament_id: int, bracket: int, round_idx: int, match_index: int) -> dict:
    """
    Get a double-elimination match result. Returns dict with keys:
    player1, player2, winner, escrowMatchId, reported
    bracket: 0=winners, 1=losers, 2=grand final
    """
    result = get_tournament_v2().functions.getDEMatch(tournament_id, bracket, round_idx, match_index).call()
    return {
        "player1": result[0],
        "player2": result[1],
        "winner": result[2],
        "escrowMatchId": result[3],
        "reported": result[4],
    }

def get_player_points(tournament_id: int, player_address: str) -> int:
    """Get round-robin points for a player (3 per win)."""
    addr = Web3.to_checksum_address(player_address)
    return get_tournament_v2().functions.getPlayerPoints(tournament_id, addr).call()

def get_player_losses(tournament_id: int, player_address: str) -> int:
    """Get double-elimination loss count for a player (eliminated at 2)."""
    addr = Web3.to_checksum_address(player_address)
    return get_tournament_v2().functions.getPlayerLosses(tournament_id, addr).call()

def get_game_for_match_v2(match_index: int) -> str:
    """Get game contract address for a match index (rotation: idx % 3 → 0=RPS, 1=Poker, 2=Auction)."""
    return get_tournament_v2().functions.getGameForMatch(match_index).call()

def get_next_tournament_v2_id() -> int:
    """Get the next TournamentV2 ID that will be assigned."""
    return get_tournament_v2().functions.nextTournamentId().call()

def get_rr_total_matches(tournament_id: int) -> int:
    """Get total number of round-robin matches for a tournament."""
    return get_tournament_v2().functions.rrTotalMatches(tournament_id).call()

def get_rr_matches_reported(tournament_id: int) -> int:
    """Get number of round-robin matches reported so far."""
    return get_tournament_v2().functions.rrMatchesReported(tournament_id).call()

def parse_tournament_v2_id_from_receipt(receipt) -> int:
    """Extract tournamentId from TournamentV2 TournamentCreated event in receipt."""
    tv2 = get_tournament_v2()
    logs = tv2.events.TournamentCreated().process_receipt(receipt)
    if not logs:
        raise ValueError("No TournamentCreated event found in TournamentV2 receipt")
    return logs[0]["args"]["tournamentId"]
