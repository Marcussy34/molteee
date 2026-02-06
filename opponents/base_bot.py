#!/usr/bin/env python3.13
"""
base_bot.py — Reusable base class for opponent bots.

Extracted from simple_bot.py. Handles web3 setup, registration, match scanning,
accept/play lifecycle. Subclasses override choose_move() for strategy.

Usage: Subclass BaseBot and implement choose_move().
"""
import argparse
import json
import os
import random
import secrets
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from web3 import Web3

# ─── Paths & Env ─────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONTRACTS_OUT = PROJECT_ROOT / "contracts" / "out"

load_dotenv(PROJECT_ROOT / ".env")

# ─── Config ───────────────────────────────────────────────────────────────────

MONAD_RPC_URL = os.getenv("MONAD_RPC_URL", "https://testnet-rpc.monad.xyz")
MONAD_CHAIN_ID = 10143

AGENT_REGISTRY_ADDRESS = os.getenv("AGENT_REGISTRY_ADDRESS", "")
ESCROW_ADDRESS = os.getenv("ESCROW_ADDRESS", "")
RPS_GAME_ADDRESS = os.getenv("RPS_GAME_ADDRESS", "")

POLL_INTERVAL = 5  # seconds between match scans

# Game constants (matching Solidity enums)
GAME_TYPE_RPS = 0
ROCK, PAPER, SCISSORS = 1, 2, 3
MOVE_NAMES = {1: "Rock", 2: "Paper", 3: "Scissors"}

# Match/game status
MATCH_CREATED, MATCH_ACTIVE, MATCH_SETTLED, MATCH_CANCELLED = 0, 1, 2, 3
PHASE_COMMIT, PHASE_REVEAL, PHASE_COMPLETE = 0, 1, 2


# ─── ABI Loading ──────────────────────────────────────────────────────────────

def load_abi(name: str) -> list:
    """Load ABI from Foundry build artifact."""
    path = CONTRACTS_OUT / f"{name}.sol" / f"{name}.json"
    with open(path) as f:
        return json.load(f)["abi"]


# ═══════════════════════════════════════════════════════════════════════════════
# BaseBot — reusable opponent bot with pluggable strategy
# ═══════════════════════════════════════════════════════════════════════════════

class BaseBot:
    """
    Base opponent bot with web3 setup, registration, match scanning,
    and commit-reveal gameplay. Subclass and override choose_move().
    """

    # Default wager range — override in subclass
    MIN_WAGER_MON = 0.001
    MAX_WAGER_MON = 0.1
    BOT_NAME = "BaseBot"

    def __init__(self, wallet_num: int, name: str = None):
        self.wallet_num = wallet_num
        if name:
            self.BOT_NAME = name

        # Load wallet from .env
        pk = os.getenv(f"OPPONENT_{wallet_num}_PRIVATE_KEY", "")
        if not pk:
            print(f"Error: OPPONENT_{wallet_num}_PRIVATE_KEY not set in .env")
            sys.exit(1)

        # Web3 connection
        self.w3 = Web3(Web3.HTTPProvider(MONAD_RPC_URL))
        if not self.w3.is_connected():
            print(f"Error: Cannot connect to Monad RPC at {MONAD_RPC_URL}")
            sys.exit(1)

        self.account = self.w3.eth.account.from_key(pk)
        self.address = self.account.address

        # Contract instances
        self.registry = self.w3.eth.contract(
            address=Web3.to_checksum_address(AGENT_REGISTRY_ADDRESS),
            abi=load_abi("AgentRegistry"),
        )
        self.escrow = self.w3.eth.contract(
            address=Web3.to_checksum_address(ESCROW_ADDRESS),
            abi=load_abi("Escrow"),
        )
        self.rps_game = self.w3.eth.contract(
            address=Web3.to_checksum_address(RPS_GAME_ADDRESS),
            abi=load_abi("RPSGame"),
        )

        # Track known match IDs to avoid re-processing
        self.known_match_ids = set()
        # Track active games: game_id -> {moves, salts, acted, round_history}
        self.active_games = {}

    # ─── Abstract Method ──────────────────────────────────────────────────

    def choose_move(self, game_id: int, current_round: int,
                    history: list[tuple[int, int]]) -> int:
        """
        Pick a move for the current round.

        Args:
            game_id: On-chain game ID
            current_round: Current round index (0-based)
            history: List of (my_move, opponent_move) tuples for prior rounds

        Returns:
            Move constant: ROCK (1), PAPER (2), or SCISSORS (3)
        """
        # Default: random (override in subclass)
        return random.choice([ROCK, PAPER, SCISSORS])

    # ─── Transaction Helper ──────────────────────────────────────────────

    def send_tx(self, func, value=0):
        """Build, sign, send, wait for receipt. Raises on revert."""
        tx = func.build_transaction({
            "from": self.address,
            "value": value,
            "nonce": self.w3.eth.get_transaction_count(self.address),
            "chainId": MONAD_CHAIN_ID,
        })
        try:
            estimated = self.w3.eth.estimate_gas(tx)
            tx["gas"] = int(estimated * 1.2)
        except Exception:
            tx["gas"] = 500000

        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        if receipt["status"] == 0:
            raise Exception(f"TX reverted: {tx_hash.hex()}")
        return receipt

    # ─── Registration ────────────────────────────────────────────────────

    def ensure_registered(self):
        """Register if not already registered."""
        try:
            info = self.registry.functions.getAgent(self.address).call()
            if info[5]:  # exists field
                elo = self.registry.functions.elo(self.address, GAME_TYPE_RPS).call()
                print(f"  Already registered. ELO: {elo}")
                return
        except Exception:
            pass

        # Register for RPS with configured wager range
        min_w = int(self.MIN_WAGER_MON * 10**18)
        max_w = int(self.MAX_WAGER_MON * 10**18)
        print(f"  Registering for RPS (wager {self.MIN_WAGER_MON} - {self.MAX_WAGER_MON} MON)...")
        receipt = self.send_tx(
            self.registry.functions.register([GAME_TYPE_RPS], min_w, max_w)
        )
        print(f"  Registered! TX: {receipt['transactionHash'].hex()}")

    # ─── Round History Builder ────────────────────────────────────────────

    def _build_round_history(self, game_id: int, current_round: int,
                             i_am_p1: bool) -> list[tuple[int, int]]:
        """
        Build round history by querying on-chain data for all completed rounds.

        Returns list of (my_move, opponent_move) tuples.
        Only includes rounds where both players have revealed.
        """
        history = []
        for r in range(current_round):
            try:
                rd = self.rps_game.functions.getRound(game_id, r).call()
                p1_move = rd[2]  # p1Move
                p2_move = rd[3]  # p2Move
                p1_revealed = rd[4]
                p2_revealed = rd[5]

                # Only include fully revealed rounds
                if p1_revealed and p2_revealed and p1_move > 0 and p2_move > 0:
                    if i_am_p1:
                        history.append((p1_move, p2_move))
                    else:
                        history.append((p2_move, p1_move))
            except Exception:
                continue
        return history

    # ─── Match Scanning ──────────────────────────────────────────────────

    def scan_for_challenges(self):
        """Scan for escrow matches where we're player2 and status is CREATED."""
        next_id = self.escrow.functions.nextMatchId().call()
        new_challenges = []

        for mid in range(next_id):
            if mid in self.known_match_ids:
                continue
            try:
                m = self.escrow.functions.getMatch(mid).call()
                if m[1].lower() == self.address.lower() and m[4] == MATCH_CREATED:
                    new_challenges.append((mid, m))
                self.known_match_ids.add(mid)
            except Exception:
                self.known_match_ids.add(mid)

        return new_challenges

    def accept_challenge(self, match_id: int, match_data: tuple):
        """Accept an escrow match."""
        wager = match_data[2]
        challenger = match_data[0]
        wager_mon = wager / 10**18
        print(f"  Accepting match {match_id} from {challenger[:10]}... (wager: {wager_mon:.4f} MON)")

        receipt = self.send_tx(
            self.escrow.functions.acceptMatch(match_id),
            value=wager,
        )
        print(f"  Accepted! TX: {receipt['transactionHash'].hex()}")
        return receipt

    # ─── Game Management ─────────────────────────────────────────────────

    def find_game_for_match(self, match_id: int) -> int | None:
        """Find a game ID linked to an escrow match."""
        next_game = self.rps_game.functions.nextGameId().call()
        for gid in range(next_game):
            try:
                g = self.rps_game.functions.getGame(gid).call()
                if g[0] == match_id:
                    return gid
            except Exception:
                continue
        return None

    def wait_for_game_or_create(self, match_id: int, rounds: int = 3) -> int:
        """Wait for challenger to create game, or create it ourselves after 10s."""
        waited = 0
        while waited < 10:
            gid = self.find_game_for_match(match_id)
            if gid is not None:
                return gid
            time.sleep(2)
            waited += 2

        # Create it ourselves
        print(f"  Creating RPS game for match {match_id} ({rounds} rounds)...")
        receipt = self.send_tx(
            self.rps_game.functions.createGame(match_id, rounds)
        )
        logs = self.rps_game.events.GameCreated().process_receipt(receipt)
        game_id = logs[0]["args"]["gameId"]
        print(f"  Game {game_id} created! TX: {receipt['transactionHash'].hex()}")
        return game_id

    # ─── Game Play ───────────────────────────────────────────────────────

    def play_game_tick(self, game_id: int):
        """
        Process one tick of game play. Returns True if game is still active.
        Calls choose_move() for strategy-based move selection.
        """
        game = self.rps_game.functions.getGame(game_id).call()

        if game[9]:  # settled
            self._print_result(game_id, game)
            return False

        current_round = game[4]
        phase = game[7]
        deadline = game[8]
        now = int(time.time())
        i_am_p1 = game[1].lower() == self.address.lower()

        # Initialize game tracking if needed
        if game_id not in self.active_games:
            self.active_games[game_id] = {
                "moves": {}, "salts": {}, "acted": set()
            }

        gdata = self.active_games[game_id]

        # Check timeout
        if now > deadline and phase != PHASE_COMPLETE:
            rd = self.rps_game.functions.getRound(game_id, current_round).call()
            if phase == PHASE_COMMIT:
                my_committed = rd[0] != b'\x00' * 32 if i_am_p1 else rd[1] != b'\x00' * 32
                opp_committed = rd[1] != b'\x00' * 32 if i_am_p1 else rd[0] != b'\x00' * 32
                if my_committed and not opp_committed:
                    print(f"    Round {current_round + 1}: Claiming timeout (opponent didn't commit)")
                    self.send_tx(self.rps_game.functions.claimTimeout(game_id))
                    return True
            elif phase == PHASE_REVEAL:
                my_revealed = rd[4] if i_am_p1 else rd[5]
                opp_revealed = rd[5] if i_am_p1 else rd[4]
                if my_revealed and not opp_revealed:
                    print(f"    Round {current_round + 1}: Claiming timeout (opponent didn't reveal)")
                    self.send_tx(self.rps_game.functions.claimTimeout(game_id))
                    return True

        action_key = f"{current_round}_{phase}"

        # Commit phase — use choose_move() instead of random
        if phase == PHASE_COMMIT and action_key not in gdata["acted"]:
            rd = self.rps_game.functions.getRound(game_id, current_round).call()
            my_committed = rd[0] != b'\x00' * 32 if i_am_p1 else rd[1] != b'\x00' * 32

            if not my_committed:
                # Build round history for strategy
                history = self._build_round_history(game_id, current_round, i_am_p1)
                # Get strategic move
                move = self.choose_move(game_id, current_round, history)
                salt = secrets.token_bytes(32)
                commit_hash = Web3.solidity_keccak(["uint8", "bytes32"], [move, salt])

                gdata["moves"][current_round] = move
                gdata["salts"][current_round] = salt

                print(f"    Round {current_round + 1}/{game[3]}: [{self.BOT_NAME}] Committing {MOVE_NAMES[move]}...")
                self.send_tx(self.rps_game.functions.commit(game_id, commit_hash))
                gdata["acted"].add(action_key)

        # Reveal phase
        elif phase == PHASE_REVEAL and action_key not in gdata["acted"]:
            rd = self.rps_game.functions.getRound(game_id, current_round).call()
            my_revealed = rd[4] if i_am_p1 else rd[5]

            if not my_revealed:
                move = gdata["moves"].get(current_round)
                salt = gdata["salts"].get(current_round)
                if move is None or salt is None:
                    print(f"    Round {current_round + 1}: ERROR — missing saved move/salt!")
                    return False
                print(f"    Round {current_round + 1}/{game[3]}: [{self.BOT_NAME}] Revealing {MOVE_NAMES[move]}...")
                self.send_tx(self.rps_game.functions.reveal(game_id, move, salt))
                gdata["acted"].add(action_key)

        return True

    def _print_result(self, game_id: int, game: tuple):
        """Print game result."""
        i_am_p1 = game[1].lower() == self.address.lower()
        my_score = game[5] if i_am_p1 else game[6]
        opp_score = game[6] if i_am_p1 else game[5]
        if my_score > opp_score:
            result = "WIN"
        elif opp_score > my_score:
            result = "LOSS"
        else:
            result = "DRAW"
        print(f"    Game {game_id} complete! [{self.BOT_NAME}] Score: {my_score}-{opp_score} ({result})")
        self.active_games.pop(game_id, None)

    # ─── Main Loop ───────────────────────────────────────────────────────

    def run(self):
        """Main bot loop: scan for challenges, accept, and play."""
        balance = self.w3.eth.get_balance(self.address)
        balance_mon = balance / 10**18
        print(f"\n{'='*60}")
        print(f"{self.BOT_NAME} (Wallet #{self.wallet_num})")
        print(f"  Address: {self.address}")
        print(f"  Balance: {balance_mon:.6f} MON")
        print(f"{'='*60}\n")

        if balance_mon < 0.001:
            print("WARNING: Very low balance! Need MON for gas + wagers.")
            print(f"  Fund this wallet: {self.address}\n")

        # Register if needed
        self.ensure_registered()

        # Initial scan to mark existing matches as known
        next_id = self.escrow.functions.nextMatchId().call()
        for mid in range(next_id):
            self.known_match_ids.add(mid)
        print(f"  Skipped {next_id} existing matches. Watching for new ones...\n")

        # Track active game IDs
        playing_games = set()

        print(f"[{self.BOT_NAME}] Polling for challenges... (Ctrl+C to stop)\n")
        while True:
            try:
                # 1. Scan for new challenges
                challenges = self.scan_for_challenges()
                for match_id, match_data in challenges:
                    try:
                        self.accept_challenge(match_id, match_data)
                        game_id = self.wait_for_game_or_create(match_id)
                        playing_games.add(game_id)
                    except Exception as e:
                        print(f"  Error accepting match {match_id}: {e}")

                # 2. Check for games on already-accepted matches
                next_match = self.escrow.functions.nextMatchId().call()
                for mid in range(next_match):
                    try:
                        m = self.escrow.functions.getMatch(mid).call()
                        if (m[1].lower() == self.address.lower()
                                and m[4] == MATCH_ACTIVE):
                            gid = self.find_game_for_match(mid)
                            if gid is not None and gid not in playing_games:
                                g = self.rps_game.functions.getGame(gid).call()
                                if not g[9]:
                                    playing_games.add(gid)
                    except Exception:
                        continue

                # 3. Play active games
                finished = set()
                for gid in playing_games:
                    try:
                        still_active = self.play_game_tick(gid)
                        if not still_active:
                            finished.add(gid)
                    except Exception as e:
                        print(f"  Error playing game {gid}: {e}")
                playing_games -= finished

                time.sleep(POLL_INTERVAL)

            except KeyboardInterrupt:
                print(f"\n[{self.BOT_NAME}] Shutting down...")
                break
            except Exception as e:
                print(f"Error in main loop: {e}")
                time.sleep(POLL_INTERVAL)
