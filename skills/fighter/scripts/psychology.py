#!/usr/bin/env python3.13
"""
psychology.py — Psychological tactics module for the Gaming Arena Fighter Agent.

Provides four tactical functions:
1. Commit timing delays (fast, slow, erratic, escalating) to disrupt opponent rhythm
2. Pattern seeding — play a deliberate pattern early, then exploit opponent's counter
3. Tilt challenge — after a win, recommend re-challenging at 2x wager
4. ELO pumping targets — find weak opponents to farm rating

These are integrated into arena.py's game loop for RPS matches.
"""
import json
import random
import time
from pathlib import Path

# ─── Config loading ──────────────────────────────────────────────────────────
# Load timing/seeding config from JSON file; fall back to defaults if missing

_CONFIG_PATH = Path(__file__).resolve().parent.parent / "data" / "psychology_config.json"

_DEFAULT_CONFIG = {
    "timing": {
        "fast_delay": 0.5,
        "slow_delay_min": 3.0,
        "slow_delay_max": 8.0,
        "erratic_delay_min": 0.5,
        "erratic_delay_max": 5.0,
        "escalating_base": 0.5,
        "escalating_increment": 0.7,
    },
    "seeding": {
        "seed_fraction": 0.35,
        "seed_move": 1,
    },
    "tilt": {
        "wager_multiplier": 2.0,
        "max_bankroll_fraction": 0.10,
    },
    "pumping": {
        "min_elo_gap": 50,
    },
}


def _load_config() -> dict:
    """Load psychology config from JSON file, merging with defaults."""
    config = dict(_DEFAULT_CONFIG)
    try:
        with open(_CONFIG_PATH) as f:
            file_config = json.load(f)
        # Merge top-level keys
        for section in config:
            if section in file_config and isinstance(file_config[section], dict):
                config[section].update(file_config[section])
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    return config


# Module-level config loaded once at import time
_config = _load_config()


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Commit Timing Delays
# ═══════════════════════════════════════════════════════════════════════════════

# Available timing modes
TIMING_MODES = ("fast", "slow", "erratic", "escalating")


def get_commit_delay(round_num: int, total_rounds: int, state: dict) -> float:
    """
    Calculate how many seconds to wait before committing a move.

    The delay varies by timing mode to disrupt the opponent's ability to
    read our tempo. Mode is auto-selected per game and stored in `state`.

    Args:
        round_num:    Current round number (0-indexed)
        total_rounds: Total rounds in the game
        state:        Mutable dict for tracking timing state across rounds.
                      Keys used: "mode" (str), "round_count" (int)

    Returns:
        Seconds to sleep before committing
    """
    tc = _config["timing"]

    # Pick a mode once per game (stored in state)
    if "mode" not in state:
        state["mode"] = random.choice(TIMING_MODES)
        state["round_count"] = 0

    mode = state["mode"]
    state["round_count"] = round_num

    if mode == "fast":
        # Constant short delay — pressure the opponent
        return tc["fast_delay"]

    elif mode == "slow":
        # Constant long delay — make opponent anxious / second-guess
        return random.uniform(tc["slow_delay_min"], tc["slow_delay_max"])

    elif mode == "erratic":
        # Random delay each round — unpredictable rhythm
        return random.uniform(tc["erratic_delay_min"], tc["erratic_delay_max"])

    elif mode == "escalating":
        # Start fast, get progressively slower each round
        base = tc["escalating_base"]
        increment = tc["escalating_increment"]
        return base + (round_num * increment)

    # Fallback — should not reach here
    return 1.0


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Pattern Seeding & Exploitation
# ═══════════════════════════════════════════════════════════════════════════════

# Move constants (matching strategy.py / contracts.py)
ROCK, PAPER, SCISSORS = 1, 2, 3
COUNTER = {ROCK: PAPER, PAPER: SCISSORS, SCISSORS: ROCK}


def should_seed_pattern(round_num: int, total_rounds: int) -> bool:
    """
    Should we seed a deliberate pattern this round?

    Returns True for the first ~35% of rounds. During this phase the agent
    plays a predictable move (e.g., Rock) to bait the opponent into
    committing to a counter-strategy.

    Args:
        round_num:    Current round (0-indexed)
        total_rounds: Total rounds in the game

    Returns:
        True if we should seed, False if we should exploit
    """
    seed_fraction = _config["seeding"]["seed_fraction"]
    seed_cutoff = int(total_rounds * seed_fraction)
    # Always seed at least the first round in games with >= 3 rounds
    seed_cutoff = max(seed_cutoff, 1) if total_rounds >= 3 else 0
    return round_num < seed_cutoff


def get_seeded_move() -> int:
    """
    Return the deliberate move we play during the seeding phase.

    We consistently play the configured seed move (default: Rock) so the
    opponent sees an obvious pattern and adjusts their strategy to counter it.
    """
    return _config["seeding"]["seed_move"]


def get_exploitation_move(model) -> int:
    """
    After seeding, predict what the opponent will play to counter our
    pattern and then counter THAT move.

    Logic:
    - If we seeded Rock, opponent likely switches to Paper.
    - The counter to Paper is Scissors. So we play Scissors.
    - If we have model data, use the opponent's actual observed response
      to our seed move for a more accurate prediction.

    Args:
        model: OpponentModel instance (or None)

    Returns:
        Move integer (1=Rock, 2=Paper, 3=Scissors)
    """
    seed_move = get_seeded_move()

    # If we have model data, check what the opponent actually plays after our seed
    if model is not None:
        history = model.get_all_round_history()
        # Look at rounds where we played the seed move
        opp_responses = [opp for my, opp in history if my == seed_move]
        if len(opp_responses) >= 2:
            # Find opponent's most common response to our seed move
            from collections import Counter
            freq = Counter(opp_responses)
            predicted_opp_move = freq.most_common(1)[0][0]
            return COUNTER[predicted_opp_move]

    # No model data — assume rational opponent counters our seed
    # e.g., seed=Rock(1) → opponent plays Paper(2) → we counter with Scissors(3)
    expected_counter = COUNTER[seed_move]
    return COUNTER[expected_counter]


# ═══════════════════════════════════════════════════════════════════════════════
# 3. Tilt Challenge Recommendation
# ═══════════════════════════════════════════════════════════════════════════════

def should_tilt_challenge(
    opponent_addr: str,
    model,
    our_balance_wei: int,
) -> dict:
    """
    After winning a match, should we immediately re-challenge at higher stakes?

    The theory: a losing opponent may be emotionally tilted and play worse.
    We recommend doubling the wager if the Kelly criterion still supports it.

    Args:
        opponent_addr: Opponent's address
        model:         OpponentModel for this opponent (or None)
        our_balance_wei: Our current balance in wei

    Returns:
        dict with keys:
        - recommend (bool): True if we should tilt-challenge
        - wager_wei (int): Recommended wager for the tilt challenge
        - reason (str): Human-readable explanation
    """
    tc = _config["tilt"]
    multiplier = tc["wager_multiplier"]
    max_fraction = tc["max_bankroll_fraction"]

    # Need model data to evaluate
    if model is None or model.get_total_games() < 1:
        return {
            "recommend": False,
            "wager_wei": 0,
            "reason": "No model data — cannot evaluate tilt opportunity",
        }

    # Check our win rate against this opponent
    win_rate = model.get_win_rate()
    total_games = model.get_total_games()

    # Only tilt-challenge if we just won (last result was a win)
    if not model.match_results or not model.match_results[-1].get("won"):
        return {
            "recommend": False,
            "wager_wei": 0,
            "reason": "Last match was not a win — no tilt opportunity",
        }

    # Estimate wager: double the last match's implied wager (from EV)
    # If we have edge, we can afford to bet more
    if win_rate <= 0.5:
        return {
            "recommend": False,
            "wager_wei": 0,
            "reason": f"No edge (win rate {win_rate:.0%}) — tilt-challenge too risky",
        }

    # Calculate tilt wager: base = fraction * bankroll, capped by Kelly limit
    edge = 2 * win_rate - 1
    kelly_fraction = edge / 2  # Half-Kelly for safety
    safe_wager = int(our_balance_wei * min(kelly_fraction, max_fraction))

    # Apply the tilt multiplier (up to the max_fraction cap)
    tilt_wager = int(safe_wager * multiplier)
    tilt_wager = min(tilt_wager, int(our_balance_wei * max_fraction))

    # Floor: minimum 1 wei
    tilt_wager = max(tilt_wager, 1)

    # Only recommend if wager is meaningful
    if tilt_wager < 1000000000000000:  # < 0.001 MON
        return {
            "recommend": False,
            "wager_wei": tilt_wager,
            "reason": "Tilt wager too small to be meaningful",
        }

    return {
        "recommend": True,
        "wager_wei": tilt_wager,
        "reason": (
            f"Win rate {win_rate:.0%} over {total_games} games — "
            f"opponent likely tilted, recommend {multiplier:.0f}x challenge"
        ),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 4. ELO Pumping Targets
# ═══════════════════════════════════════════════════════════════════════════════

def get_elo_pumping_targets(
    agents_list: list[dict],
    our_elo: int,
) -> list[dict]:
    """
    Filter and rank agents whose ELO is significantly below ours for easy wins.

    "Pumping" = farming rating against weaker opponents. Sorted by largest
    ELO gap (weakest opponents first) so we pick the easiest fights.

    Args:
        agents_list: List of dicts, each with keys:
                     "addr" (str), "elo" (int)
        our_elo:     Our current ELO rating

    Returns:
        List of dicts sorted by ELO gap (descending):
        [{"addr": "0x...", "elo": 950, "gap": 65}, ...]
    """
    min_gap = _config["pumping"]["min_elo_gap"]

    targets = []
    for agent in agents_list:
        addr = agent.get("addr", "")
        elo = agent.get("elo", 0)
        gap = our_elo - elo

        # Only include agents significantly below us
        if gap >= min_gap:
            targets.append({
                "addr": addr,
                "elo": elo,
                "gap": gap,
            })

    # Sort by gap descending — weakest first (easiest wins)
    targets.sort(key=lambda x: x["gap"], reverse=True)
    return targets
