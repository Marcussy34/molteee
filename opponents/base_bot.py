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
POKER_GAME_ADDRESS = os.getenv("POKER_GAME_ADDRESS", "")
AUCTION_GAME_ADDRESS = os.getenv("AUCTION_GAME_ADDRESS", "")

POLL_INTERVAL = 5  # seconds between match scans

# Game constants (matching Solidity enums)
GAME_TYPE_RPS = 0
GAME_TYPE_POKER = 1
GAME_TYPE_AUCTION = 2
ROCK, PAPER, SCISSORS = 1, 2, 3
MOVE_NAMES = {1: "Rock", 2: "Paper", 3: "Scissors"}

# Match/game status
MATCH_CREATED, MATCH_ACTIVE, MATCH_SETTLED, MATCH_CANCELLED = 0, 1, 2, 3

# RPS phases
PHASE_COMMIT, PHASE_REVEAL, PHASE_COMPLETE = 0, 1, 2

# Poker phases + actions
POKER_COMMIT, POKER_BETTING1, POKER_BETTING2, POKER_SHOWDOWN, POKER_COMPLETE = 0, 1, 2, 3, 4
POKER_CHECK, POKER_BET, POKER_RAISE, POKER_CALL, POKER_FOLD = 1, 2, 3, 4, 5

# Auction phases
AUCTION_COMMIT, AUCTION_REVEAL, AUCTION_COMPLETE = 0, 1, 2


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
        # Poker + Auction contracts (only load if addresses are set)
        self.poker_game = None
        if POKER_GAME_ADDRESS:
            self.poker_game = self.w3.eth.contract(
                address=Web3.to_checksum_address(POKER_GAME_ADDRESS),
                abi=load_abi("PokerGame"),
            )
        self.auction_game = None
        if AUCTION_GAME_ADDRESS:
            self.auction_game = self.w3.eth.contract(
                address=Web3.to_checksum_address(AUCTION_GAME_ADDRESS),
                abi=load_abi("AuctionGame"),
            )

        # Track known match IDs to avoid re-processing
        self.known_match_ids = set()
        # Track active games: game_id -> {moves, salts, acted, round_history}
        self.active_games = {}
        # Track active poker/auction games separately
        self.active_poker_games = {}   # game_id -> {hand_value, salt, acted}
        self.active_auction_games = {} # game_id -> {bid, salt, acted}

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
        """Register if not already registered. Registers for all available game types."""
        try:
            info = self.registry.functions.getAgent(self.address).call()
            if info[5]:  # exists field
                elo = self.registry.functions.elo(self.address, GAME_TYPE_RPS).call()
                print(f"  Already registered. RPS ELO: {elo}")
                return
        except Exception:
            pass

        # Register for all available game types
        game_types = [GAME_TYPE_RPS]
        type_names = ["RPS"]
        if self.poker_game:
            game_types.append(GAME_TYPE_POKER)
            type_names.append("Poker")
        if self.auction_game:
            game_types.append(GAME_TYPE_AUCTION)
            type_names.append("Auction")

        min_w = int(self.MIN_WAGER_MON * 10**18)
        max_w = int(self.MAX_WAGER_MON * 10**18)
        print(f"  Registering for {', '.join(type_names)} (wager {self.MIN_WAGER_MON} - {self.MAX_WAGER_MON} MON)...")
        receipt = self.send_tx(
            self.registry.functions.register(game_types, min_w, max_w)
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

    # ─── Poker Strategy (override in subclass) ─────────────────────────

    def choose_hand_value(self) -> int:
        """Pick a hand value (1-100) for poker. Override for custom strategy."""
        return random.randint(1, 100)

    def choose_poker_action(self, hand_value: int, phase: str,
                            current_bet: int, pot: int, wager: int) -> tuple:
        """
        Choose a poker action. Override for custom strategy.

        Returns (action_str, send_value_wei):
            action_str: "check", "bet", "raise", "call", "fold"
            send_value_wei: wei to send with bet/raise (0 for check/fold)
        """
        # Default: check if no bet, call if there's a bet (simple passive play)
        if current_bet == 0:
            return ("check", 0)
        else:
            return ("call", current_bet)

    # ─── Auction Strategy (override in subclass) ─────────────────────

    def choose_auction_bid(self, wager_wei: int) -> int:
        """
        Choose a bid amount (in wei) for a sealed-bid auction.
        Override for custom strategy. Must be between 1 and wager_wei.

        Returns bid in wei.
        """
        # Default: bid 50% of wager
        return max(1, wager_wei // 2)

    # ─── Poker Game Management ───────────────────────────────────────

    def _determine_game_contract(self, match_data):
        """Determine which game contract a match uses based on gameContract address."""
        game_contract = match_data[3].lower()
        if game_contract == RPS_GAME_ADDRESS.lower():
            return "rps"
        elif POKER_GAME_ADDRESS and game_contract == POKER_GAME_ADDRESS.lower():
            return "poker"
        elif AUCTION_GAME_ADDRESS and game_contract == AUCTION_GAME_ADDRESS.lower():
            return "auction"
        return "rps"  # fallback

    def find_poker_game_for_match(self, match_id: int) -> int | None:
        """Find a poker game ID linked to an escrow match."""
        if not self.poker_game:
            return None
        next_game = self.poker_game.functions.nextGameId().call()
        for gid in range(next_game):
            try:
                g = self.poker_game.functions.getGame(gid).call()
                if g[0] == match_id:  # escrowMatchId
                    return gid
            except Exception:
                continue
        return None

    def find_auction_game_for_match(self, match_id: int) -> int | None:
        """Find an auction game ID linked to an escrow match."""
        if not self.auction_game:
            return None
        next_game = self.auction_game.functions.nextGameId().call()
        for gid in range(next_game):
            try:
                g = self.auction_game.functions.getGame(gid).call()
                if g[0] == match_id:  # escrowMatchId
                    return gid
            except Exception:
                continue
        return None

    def wait_for_poker_game_or_create(self, match_id: int) -> int:
        """Wait for challenger to create poker game, or create it ourselves."""
        waited = 0
        while waited < 10:
            gid = self.find_poker_game_for_match(match_id)
            if gid is not None:
                return gid
            time.sleep(2)
            waited += 2

        print(f"  Creating Poker game for match {match_id}...")
        receipt = self.send_tx(
            self.poker_game.functions.createGame(match_id)
        )
        logs = self.poker_game.events.GameCreated().process_receipt(receipt)
        game_id = logs[0]["args"]["gameId"]
        print(f"  Poker Game {game_id} created! TX: {receipt['transactionHash'].hex()}")
        return game_id

    def wait_for_auction_game_or_create(self, match_id: int) -> int:
        """Wait for challenger to create auction game, or create it ourselves."""
        waited = 0
        while waited < 10:
            gid = self.find_auction_game_for_match(match_id)
            if gid is not None:
                return gid
            time.sleep(2)
            waited += 2

        print(f"  Creating Auction game for match {match_id}...")
        receipt = self.send_tx(
            self.auction_game.functions.createGame(match_id)
        )
        logs = self.auction_game.events.GameCreated().process_receipt(receipt)
        game_id = logs[0]["args"]["gameId"]
        print(f"  Auction Game {game_id} created! TX: {receipt['transactionHash'].hex()}")
        return game_id

    # ─── Poker Game Play ──────────────────────────────────────────────

    def play_poker_tick(self, game_id: int) -> bool:
        """
        Process one tick of poker play. Returns True if game is still active.
        """
        game = self.poker_game.functions.getGame(game_id).call()
        # GameView struct: escrowMatchId, player1, player2, pot, currentBet,
        #   currentTurn, phase, phaseDeadline, settled, p1HandValue, p2HandValue,
        #   p1Committed, p2Committed, p1Revealed, p2Revealed, p1ExtraBets, p2ExtraBets

        if game[8]:  # settled
            self._print_poker_result(game_id, game)
            return False

        phase = game[6]
        deadline = game[7]
        now = int(time.time())
        i_am_p1 = game[1].lower() == self.address.lower()

        # Initialize tracking if needed
        if game_id not in self.active_poker_games:
            hand_val = self.choose_hand_value()
            salt = secrets.token_bytes(32)
            self.active_poker_games[game_id] = {
                "hand_value": hand_val,
                "salt": salt,
                "acted": set(),
                "wager": 0,  # filled on first tick from escrow match
            }
            # Get wager from escrow match
            match_id = game[0]
            m = self.escrow.functions.getMatch(match_id).call()
            self.active_poker_games[game_id]["wager"] = m[2]

        gdata = self.active_poker_games[game_id]
        action_key = f"{phase}"

        # ── Commit phase ──
        if phase == POKER_COMMIT and action_key not in gdata["acted"]:
            my_committed = game[11] if i_am_p1 else game[12]
            if not my_committed:
                hand_hash = Web3.solidity_keccak(
                    ["uint8", "bytes32"],
                    [gdata["hand_value"], gdata["salt"]]
                )
                print(f"    Poker Game {game_id}: [{self.BOT_NAME}] Committing hand (val={gdata['hand_value']})...")
                self.send_tx(self.poker_game.functions.commitHand(game_id, hand_hash))
                gdata["acted"].add(action_key)

        # ── Betting rounds ──
        elif phase in (POKER_BETTING1, POKER_BETTING2):
            # Only act if it's our turn
            current_turn = game[5]
            if current_turn.lower() == self.address.lower():
                bet_key = f"bet_{phase}_{game[4]}"  # unique per bet level
                if bet_key not in gdata["acted"]:
                    round_name = "Round 1" if phase == POKER_BETTING1 else "Round 2"
                    action_str, send_val = self.choose_poker_action(
                        hand_value=gdata["hand_value"],
                        phase=("round1" if phase == POKER_BETTING1 else "round2"),
                        current_bet=game[4],  # currentBet
                        pot=game[3],           # pot
                        wager=gdata["wager"],
                    )
                    # Map action string to contract enum
                    action_map = {
                        "check": POKER_CHECK,
                        "bet": POKER_BET,
                        "raise": POKER_RAISE,
                        "call": POKER_CALL,
                        "fold": POKER_FOLD,
                    }
                    action_int = action_map.get(action_str, POKER_CHECK)
                    print(f"    Poker Game {game_id} {round_name}: [{self.BOT_NAME}] {action_str.upper()}"
                          + (f" ({send_val / 10**18:.6f} MON)" if send_val > 0 else ""))
                    self.send_tx(
                        self.poker_game.functions.takeAction(game_id, action_int),
                        value=send_val,
                    )
                    gdata["acted"].add(bet_key)

        # ── Showdown — reveal hand ──
        elif phase == POKER_SHOWDOWN and action_key not in gdata["acted"]:
            my_revealed = game[13] if i_am_p1 else game[14]
            if not my_revealed:
                print(f"    Poker Game {game_id}: [{self.BOT_NAME}] Revealing hand (val={gdata['hand_value']})...")
                self.send_tx(
                    self.poker_game.functions.revealHand(
                        game_id, gdata["hand_value"], gdata["salt"]
                    )
                )
                gdata["acted"].add(action_key)

        return True

    def _print_poker_result(self, game_id: int, game: tuple):
        """Print poker game result."""
        i_am_p1 = game[1].lower() == self.address.lower()
        my_hand = game[9] if i_am_p1 else game[10]
        opp_hand = game[10] if i_am_p1 else game[9]
        if my_hand > opp_hand:
            result = "WIN"
        elif opp_hand > my_hand:
            result = "LOSS"
        else:
            result = "DRAW"
        print(f"    Poker Game {game_id} complete! [{self.BOT_NAME}] Hand: {my_hand} vs {opp_hand} ({result})")
        self.active_poker_games.pop(game_id, None)

    # ─── Auction Game Play ────────────────────────────────────────────

    def play_auction_tick(self, game_id: int) -> bool:
        """
        Process one tick of auction play. Returns True if game is still active.
        """
        game = self.auction_game.functions.getGame(game_id).call()
        # GameView struct: escrowMatchId, player1, player2, prize, p1Bid, p2Bid,
        #   p1Committed, p2Committed, p1Revealed, p2Revealed, phase, phaseDeadline, settled

        if game[12]:  # settled
            self._print_auction_result(game_id, game)
            return False

        phase = game[10]
        i_am_p1 = game[1].lower() == self.address.lower()

        # Initialize tracking if needed
        if game_id not in self.active_auction_games:
            # Get wager from escrow match
            match_id = game[0]
            m = self.escrow.functions.getMatch(match_id).call()
            wager_wei = m[2]

            bid_wei = self.choose_auction_bid(wager_wei)
            salt = secrets.token_bytes(32)
            self.active_auction_games[game_id] = {
                "bid": bid_wei,
                "salt": salt,
                "acted": set(),
            }

        gdata = self.active_auction_games[game_id]
        action_key = f"{phase}"

        # ── Commit phase ──
        if phase == AUCTION_COMMIT and action_key not in gdata["acted"]:
            my_committed = game[6] if i_am_p1 else game[7]
            if not my_committed:
                bid_hash = Web3.solidity_keccak(
                    ["uint256", "bytes32"],
                    [gdata["bid"], gdata["salt"]]
                )
                bid_mon = gdata["bid"] / 10**18
                print(f"    Auction Game {game_id}: [{self.BOT_NAME}] Committing bid ({bid_mon:.6f} MON)...")
                self.send_tx(self.auction_game.functions.commitBid(game_id, bid_hash))
                gdata["acted"].add(action_key)

        # ── Reveal phase ──
        elif phase == AUCTION_REVEAL and action_key not in gdata["acted"]:
            my_revealed = game[8] if i_am_p1 else game[9]
            if not my_revealed:
                bid_mon = gdata["bid"] / 10**18
                print(f"    Auction Game {game_id}: [{self.BOT_NAME}] Revealing bid ({bid_mon:.6f} MON)...")
                self.send_tx(
                    self.auction_game.functions.revealBid(
                        game_id, gdata["bid"], gdata["salt"]
                    )
                )
                gdata["acted"].add(action_key)

        return True

    def _print_auction_result(self, game_id: int, game: tuple):
        """Print auction game result."""
        i_am_p1 = game[1].lower() == self.address.lower()
        my_bid = game[4] if i_am_p1 else game[5]
        opp_bid = game[5] if i_am_p1 else game[4]
        if my_bid > opp_bid:
            result = "WIN"
        elif opp_bid > my_bid:
            result = "LOSS"
        else:
            result = "DRAW"
        my_mon = my_bid / 10**18
        opp_mon = opp_bid / 10**18
        print(f"    Auction Game {game_id} complete! [{self.BOT_NAME}] Bid: {my_mon:.6f} vs {opp_mon:.6f} ({result})")
        self.active_auction_games.pop(game_id, None)

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

        # Track active game IDs by type
        playing_rps = set()
        playing_poker = set()
        playing_auction = set()

        print(f"[{self.BOT_NAME}] Polling for challenges... (Ctrl+C to stop)\n")
        while True:
            try:
                # 1. Scan for new challenges
                challenges = self.scan_for_challenges()
                for match_id, match_data in challenges:
                    try:
                        game_type = self._determine_game_contract(match_data)
                        self.accept_challenge(match_id, match_data)

                        if game_type == "poker" and self.poker_game:
                            game_id = self.wait_for_poker_game_or_create(match_id)
                            playing_poker.add(game_id)
                        elif game_type == "auction" and self.auction_game:
                            game_id = self.wait_for_auction_game_or_create(match_id)
                            playing_auction.add(game_id)
                        else:
                            game_id = self.wait_for_game_or_create(match_id)
                            playing_rps.add(game_id)
                    except Exception as e:
                        print(f"  Error accepting match {match_id}: {e}")

                # 2. Check for games on already-accepted matches
                next_match = self.escrow.functions.nextMatchId().call()
                for mid in range(next_match):
                    try:
                        m = self.escrow.functions.getMatch(mid).call()
                        if (m[1].lower() == self.address.lower()
                                and m[4] == MATCH_ACTIVE):
                            game_type = self._determine_game_contract(m)
                            if game_type == "poker" and self.poker_game:
                                gid = self.find_poker_game_for_match(mid)
                                if gid is not None and gid not in playing_poker:
                                    g = self.poker_game.functions.getGame(gid).call()
                                    if not g[8]:  # not settled
                                        playing_poker.add(gid)
                            elif game_type == "auction" and self.auction_game:
                                gid = self.find_auction_game_for_match(mid)
                                if gid is not None and gid not in playing_auction:
                                    g = self.auction_game.functions.getGame(gid).call()
                                    if not g[12]:  # not settled
                                        playing_auction.add(gid)
                            else:
                                gid = self.find_game_for_match(mid)
                                if gid is not None and gid not in playing_rps:
                                    g = self.rps_game.functions.getGame(gid).call()
                                    if not g[9]:  # not settled
                                        playing_rps.add(gid)
                    except Exception:
                        continue

                # 3. Play active RPS games
                finished = set()
                for gid in playing_rps:
                    try:
                        if not self.play_game_tick(gid):
                            finished.add(gid)
                    except Exception as e:
                        print(f"  Error playing RPS game {gid}: {e}")
                playing_rps -= finished

                # 4. Play active Poker games
                finished = set()
                for gid in playing_poker:
                    try:
                        if not self.play_poker_tick(gid):
                            finished.add(gid)
                    except Exception as e:
                        print(f"  Error playing Poker game {gid}: {e}")
                playing_poker -= finished

                # 5. Play active Auction games
                finished = set()
                for gid in playing_auction:
                    try:
                        if not self.play_auction_tick(gid):
                            finished.add(gid)
                    except Exception as e:
                        print(f"  Error playing Auction game {gid}: {e}")
                playing_auction -= finished

                time.sleep(POLL_INTERVAL)

            except KeyboardInterrupt:
                print(f"\n[{self.BOT_NAME}] Shutting down...")
                break
            except Exception as e:
                print(f"Error in main loop: {e}")
                time.sleep(POLL_INTERVAL)
