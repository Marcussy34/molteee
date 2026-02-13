"""
Spectator contract interface — read-only wrappers + prediction market betting.

Loads ABIs from Foundry build artifacts and provides view functions for
Escrow, AgentRegistry, and PredictionMarket contracts on Monad testnet.
"""
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from web3 import Web3

# ─── Paths ────────────────────────────────────────────────────────────────────

# Project root (spectator/lib/ → spectator/ → skills/ → root)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
CONTRACTS_OUT = PROJECT_ROOT / "contracts" / "out"

# Load .env before reading env vars
load_dotenv(PROJECT_ROOT / ".env")

# ─── Deployed Addresses ──────────────────────────────────────────────────────

AGENT_REGISTRY_ADDRESS = os.getenv("AGENT_REGISTRY_ADDRESS", "")
ESCROW_ADDRESS = os.getenv("ESCROW_ADDRESS", "")
PREDICTION_MARKET_ADDRESS = os.getenv("PREDICTION_MARKET_ADDRESS", "")

# ─── Monad Testnet Config ────────────────────────────────────────────────────

MONAD_RPC_URL = os.getenv("MONAD_RPC_URL", "https://monad-testnet.g.alchemy.com/v2/uMvEY1mdMyM8svqTZD-p3")
MONAD_CHAIN_ID = 10143

# ─── Escrow Match Status ─────────────────────────────────────────────────────

class MatchStatus:
    CREATED = 0
    ACTIVE = 1
    SETTLED = 2
    CANCELLED = 3

# ─── Game Type Constants ─────────────────────────────────────────────────────

class GameType:
    RPS = 0
    POKER = 1
    AUCTION = 2

# ─── ABI Loading ─────────────────────────────────────────────────────────────

_abis = {}

def _load_abi(contract_name: str) -> list:
    """Load ABI from Foundry build artifact."""
    if contract_name not in _abis:
        artifact_path = CONTRACTS_OUT / f"{contract_name}.sol" / f"{contract_name}.json"
        if not artifact_path.exists():
            raise FileNotFoundError(f"ABI not found at {artifact_path}. Run 'forge build' first.")
        with open(artifact_path) as f:
            _abis[contract_name] = json.load(f)["abi"]
    return _abis[contract_name]

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
    """Get the checksummed address of the spectator wallet."""
    return get_account().address

# ─── Contract Instance Getters ────────────────────────────────────────────────

_contracts = {}

def _get_contract(name: str, address: str):
    """Lazy-initialize a contract instance."""
    if name not in _contracts:
        abi = _load_abi(name)
        addr = Web3.to_checksum_address(address)
        _contracts[name] = get_w3().eth.contract(address=addr, abi=abi)
    return _contracts[name]

def get_escrow():
    return _get_contract("Escrow", ESCROW_ADDRESS)

def get_registry():
    return _get_contract("AgentRegistry", AGENT_REGISTRY_ADDRESS)

def get_prediction_market():
    return _get_contract("PredictionMarket", PREDICTION_MARKET_ADDRESS)

# ─── Transaction Helper ──────────────────────────────────────────────────────

def send_tx(func, value=0):
    """Build, sign, send, and wait for a contract function call."""
    w3 = get_w3()
    account = get_account()
    tx = func.build_transaction({
        "from": account.address,
        "value": value,
        "nonce": w3.eth.get_transaction_count(account.address),
        "chainId": MONAD_CHAIN_ID,
    })
    try:
        estimated = w3.eth.estimate_gas(tx)
        tx["gas"] = int(estimated * 1.2)
    except Exception:
        tx["gas"] = 500000
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    if receipt["status"] == 0:
        raise Exception(f"Transaction reverted: {tx_hash.hex()}")
    return receipt

# ─── Utility Functions ────────────────────────────────────────────────────────

def wei_to_mon(wei: int) -> float:
    """Convert wei to MON (18 decimals)."""
    return wei / 10**18

def mon_to_wei(mon: float) -> int:
    """Convert MON to wei (18 decimals)."""
    return int(mon * 10**18)

def get_balance(address: str = None) -> int:
    """Get MON balance in wei."""
    if address is None:
        address = get_address()
    return get_w3().eth.get_balance(Web3.to_checksum_address(address))

# ─── Escrow View Functions ────────────────────────────────────────────────────

def get_escrow_match(match_id: int) -> dict:
    """Get escrow match details."""
    result = get_escrow().functions.getMatch(match_id).call()
    return {
        "player1": result[0],
        "player2": result[1],
        "wager": result[2],
        "gameContract": result[3],
        "status": int(result[4]),
        "createdAt": result[5],
    }

def get_next_match_id() -> int:
    """Get the next match ID from Escrow."""
    return get_escrow().functions.nextMatchId().call()

# ─── AgentRegistry View Functions ─────────────────────────────────────────────

def get_agent_info(address: str) -> dict:
    """Get agent info from AgentRegistry."""
    addr = Web3.to_checksum_address(address)
    result = get_registry().functions.getAgent(addr).call()
    return {
        "wallet": result[0],
        "gameTypes": result[1],
        "minWager": result[2],
        "maxWager": result[3],
        "isOpen": result[4],
        "exists": result[5],
    }

def get_elo(address: str, game_type: int = GameType.RPS) -> int:
    """Get ELO rating for an agent."""
    addr = Web3.to_checksum_address(address)
    return get_registry().functions.elo(addr, game_type).call()

# ─── PredictionMarket View Functions ──────────────────────────────────────────

def get_market(market_id: int) -> dict:
    """Get prediction market data."""
    result = get_prediction_market().functions.getMarket(market_id).call()
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

def get_market_price(market_id: int) -> tuple:
    """Get current YES/NO prices (scaled to 1e18 = 1.0)."""
    result = get_prediction_market().functions.getPrice(market_id).call()
    return (result[0], result[1])

def get_user_balances(market_id: int, user: str) -> tuple:
    """Get user's YES/NO token balances for a market."""
    addr = Web3.to_checksum_address(user)
    result = get_prediction_market().functions.getUserBalances(market_id, addr).call()
    return (result[0], result[1])

def get_next_market_id() -> int:
    """Get the next market ID from PredictionMarket."""
    return get_prediction_market().functions.nextMarketId().call()

# ─── PredictionMarket Transaction Functions ───────────────────────────────────

def buy_yes(market_id: int, amount_wei: int):
    """Buy YES tokens on a prediction market."""
    return send_tx(
        get_prediction_market().functions.buyYES(market_id),
        value=amount_wei,
    )

def buy_no(market_id: int, amount_wei: int):
    """Buy NO tokens on a prediction market."""
    return send_tx(
        get_prediction_market().functions.buyNO(market_id),
        value=amount_wei,
    )
