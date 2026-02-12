"""
opponent_model.py — Opponent profiling with JSON persistence.

Tracks per-opponent move frequencies, Markov transitions, match results,
and cumulative round history across all games. Persisted to disk as JSON.
"""
import json
import os
import time
from collections import Counter
from pathlib import Path

# Default data directory for opponent models
DATA_DIR = Path(__file__).resolve().parent.parent / "data"


class OpponentModel:
    """
    Statistical model for a single opponent address.

    Stores:
    - move_counts: {1: N, 2: N, 3: N} — total move frequencies
    - transitions: {from_move: {to_move: count}} — Markov transition counts
    - match_results: [(won: bool, my_score, opp_score, timestamp), ...]
    - round_history: [(my_move, opp_move), ...] — cumulative across all games
    - last_updated: timestamp of last update
    """

    def __init__(self, opponent_addr: str):
        self.opponent_addr = opponent_addr.lower()
        self.move_counts = Counter()       # opponent move frequencies
        self.transitions = {}              # {str(from): {str(to): count}}
        self.match_results = []            # list of match result dicts
        self.round_history = []            # cumulative (my_move, opp_move) list
        self.last_updated = 0
        # Adaptive learning fields
        self.strategy_performance = {}     # {strategy_name: {wins, losses, draws}}
        self.poker_stats = {}              # {hands_seen, fold_rate, bluff_rate, aggression, avg_bet_size}
        self.auction_stats = {}            # {bids: [(bid, wager, won)], avg_shade_pct}
        self.strategy_cooldowns = {}       # {strategy_name: rounds_remaining}

    def update(self, game_round_history: list[tuple[int, int]], won: bool = None,
               my_score: int = 0, opp_score: int = 0):
        """
        Update model from a completed game's round history.

        Args:
            game_round_history: [(my_move, opp_move), ...] for this game
            won: True if we won, False if lost, None if unknown
            my_score: our final score
            opp_score: opponent's final score
        """
        if not game_round_history:
            # Still record match result even if no round data (e.g. poker/auction)
            if won is not None:
                self.match_results.append({
                    "won": won,
                    "my_score": my_score,
                    "opp_score": opp_score,
                    "timestamp": int(time.time()),
                })
                self.last_updated = int(time.time())
            return

        # Filter out invalid moves — only RPS moves 1-3 are valid.
        # Poker hand values and auction bids are large ints that would corrupt the model.
        VALID_MOVES = {1, 2, 3}
        valid_rounds = [(m, o) for m, o in game_round_history
                        if m in VALID_MOVES and o in VALID_MOVES]
        if not valid_rounds:
            # No valid RPS rounds — still record match result
            if won is not None:
                self.match_results.append({
                    "won": won,
                    "my_score": my_score,
                    "opp_score": opp_score,
                    "timestamp": int(time.time()),
                })
                self.last_updated = int(time.time())
            return

        # Update move counts
        for _, opp_move in valid_rounds:
            self.move_counts[opp_move] += 1

        # Update transitions (opponent's move-to-move patterns)
        opp_moves = [opp for _, opp in valid_rounds]
        for i in range(len(opp_moves) - 1):
            from_m = str(opp_moves[i])
            to_m = str(opp_moves[i + 1])
            if from_m not in self.transitions:
                self.transitions[from_m] = Counter()
            self.transitions[from_m][to_m] += 1

        # Append to cumulative history (only valid RPS rounds)
        self.round_history.extend(valid_rounds)

        # Record match result
        if won is not None:
            self.match_results.append({
                "won": won,
                "my_score": my_score,
                "opp_score": opp_score,
                "timestamp": int(time.time()),
            })

        self.last_updated = int(time.time())

    def get_all_round_history(self) -> list[tuple[int, int]]:
        """Return cumulative round history across all games vs this opponent."""
        return list(self.round_history)

    def get_win_rate(self) -> float:
        """Calculate win rate from match results. Returns 0.5 if no data."""
        if not self.match_results:
            return 0.5
        wins = sum(1 for r in self.match_results if r["won"])
        return wins / len(self.match_results)

    def get_total_games(self) -> int:
        """Total number of games played against this opponent."""
        return len(self.match_results)

    # ── Adaptive learning methods ──────────────────────────────────────────────

    def record_rps_strategy(self, strategy_name: str, result: str):
        """Record win/loss/draw for a strategy used in an RPS round."""
        if strategy_name not in self.strategy_performance:
            self.strategy_performance[strategy_name] = {"wins": 0, "losses": 0, "draws": 0}
        if result in ("wins", "losses", "draws"):
            self.strategy_performance[strategy_name][result] += 1

    def get_strategy_accuracy(self, strategy_name: str) -> float:
        """Win rate for a specific strategy vs this opponent. Returns 0.5 if no data."""
        perf = self.strategy_performance.get(strategy_name)
        if not perf:
            return 0.5
        total = perf["wins"] + perf["losses"] + perf["draws"]
        if total == 0:
            return 0.5
        return (perf["wins"] + perf["draws"] * 0.5) / total

    def update_poker_stats(self, opp_hand: int, opp_extra_bets: int,
                           folded: bool, won: bool, wager: int):
        """Profile poker opponent from game outcome data."""
        if not self.poker_stats:
            self.poker_stats = {
                "hands_seen": [], "fold_count": 0, "game_count": 0,
                "total_extra_bets": 0, "aggression": 0.0, "fold_rate": 0.0,
            }
        stats = self.poker_stats
        stats["game_count"] = stats.get("game_count", 0) + 1
        if opp_hand > 0:
            stats["hands_seen"].append(opp_hand)
        if folded:
            stats["fold_count"] = stats.get("fold_count", 0) + 1
        stats["total_extra_bets"] = stats.get("total_extra_bets", 0) + opp_extra_bets
        # Recalculate derived stats
        gc = stats["game_count"]
        stats["fold_rate"] = stats.get("fold_count", 0) / gc if gc > 0 else 0.0
        # Aggression = average extra bets relative to wager
        if gc > 0 and wager > 0:
            stats["aggression"] = stats["total_extra_bets"] / (gc * wager)
        self.last_updated = int(time.time())

    def update_auction_stats(self, opp_bid: int, wager: int, won: bool):
        """Profile auction opponent from revealed bid."""
        if not self.auction_stats:
            self.auction_stats = {"bids": [], "avg_shade_pct": 0.0}
        shade_pct = (opp_bid / wager * 100) if wager > 0 else 50.0
        self.auction_stats["bids"].append({
            "shade_pct": shade_pct, "won": won,
        })
        # Recalculate average shade percentage
        all_pcts = [b["shade_pct"] for b in self.auction_stats["bids"]]
        self.auction_stats["avg_shade_pct"] = sum(all_pcts) / len(all_pcts)
        self.last_updated = int(time.time())

    def to_dict(self) -> dict:
        """Serialize to JSON-compatible dict."""
        return {
            "opponent_addr": self.opponent_addr,
            "move_counts": dict(self.move_counts),
            "transitions": {k: dict(v) for k, v in self.transitions.items()},
            "match_results": self.match_results,
            "round_history": self.round_history,
            "last_updated": self.last_updated,
            "strategy_performance": self.strategy_performance,
            "poker_stats": self.poker_stats,
            "auction_stats": self.auction_stats,
            "strategy_cooldowns": self.strategy_cooldowns,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "OpponentModel":
        """Deserialize from JSON dict."""
        model = cls(data["opponent_addr"])
        model.move_counts = Counter({int(k): v for k, v in data.get("move_counts", {}).items()})
        model.transitions = {
            k: Counter({kk: vv for kk, vv in v.items()})
            for k, v in data.get("transitions", {}).items()
        }
        model.match_results = data.get("match_results", [])
        # round_history stored as list of [my, opp] pairs in JSON
        model.round_history = [tuple(r) for r in data.get("round_history", [])]
        model.last_updated = data.get("last_updated", 0)
        # Adaptive learning fields (backward-compatible defaults)
        model.strategy_performance = data.get("strategy_performance", {})
        model.poker_stats = data.get("poker_stats", {})
        model.auction_stats = data.get("auction_stats", {})
        model.strategy_cooldowns = data.get("strategy_cooldowns", {})
        return model

    def save(self, path: str = None):
        """Save model to JSON file. Default path: data/{address}.json"""
        if path is None:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            path = str(DATA_DIR / f"{self.opponent_addr}.json")
        with open(path, "w") as f:
            json.dump(self.to_dict(), f, indent=2)

    @classmethod
    def load(cls, opponent_addr: str, path: str = None) -> "OpponentModel":
        """Load model from JSON file. Returns empty model if file doesn't exist."""
        addr = opponent_addr.lower()
        if path is None:
            path = str(DATA_DIR / f"{addr}.json")
        if not os.path.exists(path):
            return cls(addr)
        with open(path) as f:
            return cls.from_dict(json.load(f))


class OpponentModelStore:
    """
    Manages loading and saving all opponent models.
    Models are cached in memory after first load.
    """

    def __init__(self, data_dir: str = None):
        self.data_dir = Path(data_dir) if data_dir else DATA_DIR
        self._cache = {}  # {lowercase_addr: OpponentModel}

    def get(self, opponent_addr: str) -> OpponentModel:
        """Get or load an opponent model. Returns empty model for unknown opponents."""
        addr = opponent_addr.lower()
        if addr not in self._cache:
            path = str(self.data_dir / f"{addr}.json")
            self._cache[addr] = OpponentModel.load(addr, path)
        return self._cache[addr]

    def save(self, opponent_addr: str):
        """Save a specific opponent's model to disk."""
        addr = opponent_addr.lower()
        if addr in self._cache:
            self.data_dir.mkdir(parents=True, exist_ok=True)
            path = str(self.data_dir / f"{addr}.json")
            self._cache[addr].save(path)

    def save_all(self):
        """Save all cached models to disk."""
        for addr in self._cache:
            self.save(addr)
