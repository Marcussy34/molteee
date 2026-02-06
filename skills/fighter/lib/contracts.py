"""
Contract ABIs and deployed addresses for the Gaming Arena on Monad testnet.

ABIs are loaded from Foundry build artifacts (contracts/out/).
Addresses are loaded from .env or can be overridden directly.
"""
import json
import os
from pathlib import Path

# ─── Paths ────────────────────────────────────────────────────────────────────

# Project root (two levels up from this file: lib/ → fighter/ → skills/ → root)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
CONTRACTS_OUT = PROJECT_ROOT / "contracts" / "out"

# ─── ABI Loading ──────────────────────────────────────────────────────────────

def _load_abi(contract_name: str) -> list:
    """Load ABI from Foundry build artifact."""
    artifact_path = CONTRACTS_OUT / f"{contract_name}.sol" / f"{contract_name}.json"
    if not artifact_path.exists():
        raise FileNotFoundError(
            f"ABI not found at {artifact_path}. Run 'forge build' first."
        )
    with open(artifact_path) as f:
        return json.load(f)["abi"]

# Lazy-load ABIs (available after forge build)
AGENT_REGISTRY_ABI = None
ESCROW_ABI = None
RPS_GAME_ABI = None

def load_abis():
    """Load all contract ABIs. Call after forge build."""
    global AGENT_REGISTRY_ABI, ESCROW_ABI, RPS_GAME_ABI
    AGENT_REGISTRY_ABI = _load_abi("AgentRegistry")
    ESCROW_ABI = _load_abi("Escrow")
    RPS_GAME_ABI = _load_abi("RPSGame")

# ─── Deployed Addresses ──────────────────────────────────────────────────────
# These get filled in after deployment (from .env or manually)

AGENT_REGISTRY_ADDRESS = os.getenv("AGENT_REGISTRY_ADDRESS", "")
ESCROW_ADDRESS = os.getenv("ESCROW_ADDRESS", "")
RPS_GAME_ADDRESS = os.getenv("RPS_GAME_ADDRESS", "")

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

# GameType enum values matching AgentRegistry.sol
class GameType:
    RPS = 0
    POKER = 1
    AUCTION = 2
