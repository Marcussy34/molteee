"""
strategy.py — Multi-signal RPS strategy engine.

Combines frequency analysis, Markov chains, sequence detection,
and anti-exploitation logic to predict opponent moves and counter them.

Input: opponent address, round history [(my_move, opp_move), ...], opponent model
Output: (move, strategy_name, confidence) tuple
"""
import random
from collections import Counter

# Move constants (matching contracts.py)
ROCK, PAPER, SCISSORS = 1, 2, 3
MOVE_NAMES = {1: "Rock", 2: "Paper", 3: "Scissors"}

# Map a move to the move that beats it
COUNTER = {ROCK: PAPER, PAPER: SCISSORS, SCISSORS: ROCK}


# ═══════════════════════════════════════════════════════════════════════════════
# Strategy Modules
# ═══════════════════════════════════════════════════════════════════════════════

def frequency_predict(history: list[tuple[int, int]]) -> tuple[int, float]:
    """
    Frequency analysis — counter the opponent's most common move.

    Counts opponent move distribution. If one move appears >40% of the time,
    counter it. Confidence = frequency of the most common move.

    Returns (counter_move, confidence). confidence=0 if no data.
    """
    if not history:
        return (random.choice([ROCK, PAPER, SCISSORS]), 0.0)

    # Count opponent moves only
    opp_moves = [opp for _, opp in history]
    freq = Counter(opp_moves)
    total = len(opp_moves)

    most_common_move, most_common_count = freq.most_common(1)[0]
    confidence = most_common_count / total

    # Counter the most frequent move
    return (COUNTER[most_common_move], confidence)


def markov_predict(history: list[tuple[int, int]]) -> tuple[int, float]:
    """
    1st-order Markov chain — predict next move from transition probabilities.

    Builds P(next_move | last_move) from opponent's move history.
    Looks up opponent's last move, predicts most likely next, counters it.
    Needs 5+ rounds for meaningful data.

    Returns (counter_move, confidence). confidence=0 if insufficient data.
    """
    if len(history) < 5:
        return (random.choice([ROCK, PAPER, SCISSORS]), 0.0)

    # Build transition matrix from opponent moves
    opp_moves = [opp for _, opp in history]
    transitions = {}  # {from_move: Counter({to_move: count})}

    for i in range(len(opp_moves) - 1):
        from_move = opp_moves[i]
        to_move = opp_moves[i + 1]
        if from_move not in transitions:
            transitions[from_move] = Counter()
        transitions[from_move][to_move] += 1

    # Predict from opponent's last move
    last_opp_move = opp_moves[-1]
    if last_opp_move not in transitions:
        return (random.choice([ROCK, PAPER, SCISSORS]), 0.0)

    trans_counts = transitions[last_opp_move]
    total = sum(trans_counts.values())
    predicted_move, predicted_count = trans_counts.most_common(1)[0]
    confidence = predicted_count / total

    return (COUNTER[predicted_move], confidence)


def sequence_predict(history: list[tuple[int, int]]) -> tuple[int, float]:
    """
    Sequence detection — detect repeating cycles and win-stay/lose-shift.

    1. Checks for repeating cycles (e.g. R→P→S→R) with window sizes 2-4.
    2. Checks for win-stay/lose-shift pattern.

    Returns (counter_move, confidence). confidence=0 if no pattern found.
    """
    if len(history) < 4:
        return (random.choice([ROCK, PAPER, SCISSORS]), 0.0)

    opp_moves = [opp for _, opp in history]

    # --- Check for repeating cycles (window size 2, 3, 4) ---
    best_cycle_move = None
    best_cycle_conf = 0.0

    for window in [2, 3, 4]:
        if len(opp_moves) < window * 2:
            continue

        # Check if last N moves match the N before that
        recent = opp_moves[-window:]
        prior = opp_moves[-window * 2:-window]

        if recent == prior:
            # Cycle detected — predict next move in cycle
            predicted = opp_moves[-window]  # first move of the cycle repeats
            # Confidence based on how many full cycles we see
            matches = 0
            for offset in range(0, len(opp_moves) - window, window):
                chunk = opp_moves[offset:offset + window]
                if chunk == recent:
                    matches += 1
            confidence = min(0.9, 0.5 + matches * 0.1)
            if confidence > best_cycle_conf:
                best_cycle_conf = confidence
                best_cycle_move = COUNTER[predicted]

    # --- Check for win-stay/lose-shift pattern ---
    ws_ls_conf = 0.0
    ws_ls_move = None

    if len(history) >= 4:
        correct = 0
        total_checked = 0

        for i in range(1, len(history)):
            my_prev, opp_prev = history[i - 1]
            _, opp_curr = history[i]

            # Determine if opponent won previous round
            opp_won = (
                (opp_prev == ROCK and my_prev == SCISSORS) or
                (opp_prev == PAPER and my_prev == ROCK) or
                (opp_prev == SCISSORS and my_prev == PAPER)
            )
            opp_lost = (
                (my_prev == ROCK and opp_prev == SCISSORS) or
                (my_prev == PAPER and opp_prev == ROCK) or
                (my_prev == SCISSORS and opp_prev == PAPER)
            )

            if opp_won:
                # Win-stay: opponent should repeat their move
                if opp_curr == opp_prev:
                    correct += 1
                total_checked += 1
            elif opp_lost:
                # Lose-shift: opponent should change their move
                if opp_curr != opp_prev:
                    correct += 1
                total_checked += 1

        if total_checked >= 3:
            ws_ls_conf = correct / total_checked

            # Predict based on last round outcome
            my_last, opp_last = history[-1]
            opp_won_last = (
                (opp_last == ROCK and my_last == SCISSORS) or
                (opp_last == PAPER and my_last == ROCK) or
                (opp_last == SCISSORS and my_last == PAPER)
            )

            if opp_won_last:
                # Win-stay: opponent likely repeats
                ws_ls_move = COUNTER[opp_last]
            else:
                # Lose-shift: opponent likely switches — counter their most common switch target
                # Use the most common move they switch TO after losses
                switch_targets = Counter()
                for i in range(1, len(history)):
                    my_prev, opp_prev = history[i - 1]
                    _, opp_curr = history[i]
                    opp_lost_prev = (
                        (my_prev == ROCK and opp_prev == SCISSORS) or
                        (my_prev == PAPER and opp_prev == ROCK) or
                        (my_prev == SCISSORS and opp_prev == PAPER)
                    )
                    if opp_lost_prev and opp_curr != opp_prev:
                        switch_targets[opp_curr] += 1

                if switch_targets:
                    predicted = switch_targets.most_common(1)[0][0]
                    ws_ls_move = COUNTER[predicted]

    # Return best of cycle detection vs win-stay/lose-shift
    if best_cycle_conf > ws_ls_conf and best_cycle_move is not None:
        return (best_cycle_move, best_cycle_conf)
    elif ws_ls_move is not None and ws_ls_conf > 0.0:
        return (ws_ls_move, ws_ls_conf)

    return (random.choice([ROCK, PAPER, SCISSORS]), 0.0)


# ═══════════════════════════════════════════════════════════════════════════════
# Anti-Exploitation
# ═══════════════════════════════════════════════════════════════════════════════

def recent_win_rate(history: list[tuple[int, int]], window: int = 5) -> float:
    """
    Calculate win rate over the last `window` rounds.
    Returns float 0.0-1.0. Returns 0.5 if no data.
    """
    if not history:
        return 0.5

    recent = history[-window:]
    wins = 0
    for my_move, opp_move in recent:
        if COUNTER[opp_move] == my_move:
            wins += 1
    return wins / len(recent)


# ═══════════════════════════════════════════════════════════════════════════════
# Combined Strategy Selector
# ═══════════════════════════════════════════════════════════════════════════════

def choose_move(
    opponent_addr: str,
    round_history: list[tuple[int, int]],
    model=None,
) -> tuple[int, str, float]:
    """
    Main entry point — pick the best move using all available signals.

    Uses cumulative history (from opponent model) if available,
    otherwise just the current game's round history.

    Returns (move_int, strategy_name, confidence).
    """
    # Merge current game history with historical data from opponent model
    all_history = []
    if model is not None:
        all_history = model.get_all_round_history()
    # Append current game history (may overlap with model, but that's fine —
    # more recent data is weighted by being at the end)
    all_history = all_history + round_history

    # Anti-exploitation check: if we're losing badly, go random
    if len(round_history) > 5 and recent_win_rate(round_history) < 0.35:
        move = random.choice([ROCK, PAPER, SCISSORS])
        return (move, "anti-exploit", 0.0)

    # Try all strategies on the full history
    seq_move, seq_conf = sequence_predict(all_history)
    mkv_move, mkv_conf = markov_predict(all_history)
    freq_move, freq_conf = frequency_predict(all_history)

    candidates = [
        (seq_move, seq_conf, "sequence"),
        (mkv_move, mkv_conf, "markov"),
        (freq_move, freq_conf, "frequency"),
    ]

    # Pick highest confidence strategy (minimum threshold 0.4)
    best = max(candidates, key=lambda x: x[1])

    if best[1] >= 0.4:
        return (best[0], best[2], best[1])

    # No strong signal — fall back to random
    move = random.choice([ROCK, PAPER, SCISSORS])
    return (move, "random", 0.0)
