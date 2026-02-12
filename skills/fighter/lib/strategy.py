"""
strategy.py — Multi-signal strategy engine for RPS, Poker, and Auction games.

RPS: Frequency analysis, Markov chains, sequence detection, anti-exploitation.
Poker: Hand evaluation, bluff/fold decisions, value betting.
Auction: Bid shading, opponent bid modeling.

Inputs vary per game. Outputs are (decision, strategy_name, confidence) tuples.
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

            if opp_won_last and opp_last in COUNTER:
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

                # Filter out invalid moves (0 = None from unrevealed rounds)
                switch_targets = Counter({k: v for k, v in switch_targets.items() if k in COUNTER})
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

    # Try all strategies on the full history
    seq_move, seq_conf = sequence_predict(all_history)
    mkv_move, mkv_conf = markov_predict(all_history)
    freq_move, freq_conf = frequency_predict(all_history)

    candidates = [
        (seq_move, seq_conf, "sequence"),
        (mkv_move, mkv_conf, "markov"),
        (freq_move, freq_conf, "frequency"),
    ]

    # Weight each strategy's confidence by its historical accuracy vs this opponent
    # and filter out strategies on cooldown
    cooldowns = model.strategy_cooldowns if model else {}
    weighted = []
    for move_val, raw_conf, name in candidates:
        # Skip strategies on cooldown
        if cooldowns.get(name, 0) > 0:
            continue
        # Boost/penalize by historical accuracy (0.5 = neutral default)
        accuracy = model.get_strategy_accuracy(name) if model else 0.5
        weighted_conf = raw_conf * (0.5 + accuracy)
        weighted.append((move_val, weighted_conf, name))

    # Anti-exploitation: if losing badly, try next-best strategy instead of random
    if len(round_history) > 5 and recent_win_rate(round_history) < 0.35:
        # Sort by weighted confidence descending, pick second-best if available
        if len(weighted) >= 2:
            weighted.sort(key=lambda x: x[1], reverse=True)
            return (weighted[1][0], weighted[1][2], weighted[1][1])
        # Last resort: random
        move = random.choice([ROCK, PAPER, SCISSORS])
        return (move, "anti-exploit", 0.0)

    if not weighted:
        move = random.choice([ROCK, PAPER, SCISSORS])
        return (move, "random", 0.0)

    # Pick highest weighted confidence (lower threshold since weighting can reduce it)
    best = max(weighted, key=lambda x: x[1])

    if best[1] >= 0.3:
        return (best[0], best[2], best[1])

    # No strong signal — fall back to random
    move = random.choice([ROCK, PAPER, SCISSORS])
    return (move, "random", 0.0)


# ═══════════════════════════════════════════════════════════════════════════════
# Poker Strategy
# ═══════════════════════════════════════════════════════════════════════════════

# Hand strength categories for 1-100 hand values
HAND_WEAK = 30       # Hands 1-30: weak
HAND_MEDIUM = 60     # Hands 31-60: medium
HAND_STRONG = 80     # Hands 61-80: strong
                     # Hands 81-100: premium


def choose_hand_value(
    budget: int = 150,
    current_round: int = 0,
    total_rounds: int = 3,
    my_score: int = 0,
    opp_score: int = 0,
) -> int:
    """
    Choose a hand value (1-100) for Budget Poker V2.

    Budget constraint: hand_value ≤ budget - (rounds_remaining_after_this - 1 per future round).
    The contract enforces this on reveal: _handValue <= myBudget - roundsAfter.

    Strategy:
    - Divide remaining budget across remaining rounds as baseline.
    - If behind on score, commit higher to try to win (aggressive).
    - If ahead, commit conservatively to save budget for later rounds.
    - Add ±20% jitter to prevent predictability.
    """
    rounds_left = total_rounds - current_round
    rounds_after = rounds_left - 1

    # Max hand we can commit (contract enforces: hand ≤ budget - roundsAfter)
    max_hand = min(100, budget - rounds_after)
    # Must commit at least 1
    min_hand = 1

    if max_hand < min_hand:
        return min_hand  # Budget exhausted — commit minimum

    # Baseline: divide budget evenly across remaining rounds
    avg_per_round = budget // rounds_left

    # Score-based aggression: behind → spend more, ahead → spend less
    score_diff = my_score - opp_score
    if score_diff < 0:
        # Behind — be aggressive, spend ~30% more than average
        target = int(avg_per_round * 1.3)
    elif score_diff > 0:
        # Ahead — be conservative, spend ~30% less than average
        target = int(avg_per_round * 0.7)
    else:
        # Even — play balanced
        target = avg_per_round

    # Add ±20% jitter to prevent predictability
    jitter = int(target * 0.4 * (random.random() - 0.5))
    hand_value = target + jitter

    # Clamp to valid range
    hand_value = max(min_hand, min(max_hand, hand_value))

    return hand_value


def categorize_hand(hand_value: int) -> str:
    """Categorize a hand value into strength tier."""
    if hand_value <= HAND_WEAK:
        return "weak"
    elif hand_value <= HAND_MEDIUM:
        return "medium"
    elif hand_value <= HAND_STRONG:
        return "strong"
    else:
        return "premium"


def choose_poker_action(
    hand_value: int,
    phase: str,
    current_bet: int,
    pot: int,
    wager: int,
    opponent_addr: str = "",
    model=None,
) -> tuple:
    """
    Choose a poker betting action based on hand strength and game state.

    Args:
        hand_value: Our committed hand value (1-100)
        phase: "round1" or "round2"
        current_bet: Current bet to match (0 if no active bet)
        pot: Current pot size in wei
        wager: Original escrow wager in wei
        opponent_addr: Opponent address for profiling
        model: OpponentModel for historical data

    Returns:
        (action, amount_wei, strategy_name, confidence)
        action: "check", "bet", "raise", "call", "fold"
        amount_wei: ETH to send (0 for check/fold)
    """
    category = categorize_hand(hand_value)

    # Calculate bluff probability and bet sizing based on opponent profile
    bluff_chance = 0.15  # Default 15% bluff rate
    bet_multiplier = 1.0  # Scales value bet sizes
    if model is not None and hasattr(model, 'poker_stats') and model.poker_stats:
        # Use detailed poker stats when available
        ps = model.poker_stats
        fold_rate = ps.get("fold_rate", 0.0)
        aggression = ps.get("aggression", 0.0)
        if fold_rate > 0.4:
            bluff_chance = 0.35  # High fold rate — bluff aggressively
        elif aggression > 0.3:
            bluff_chance = 0.05  # Aggressive opponent — don't bluff, value bet bigger
            bet_multiplier = 1.3
        elif aggression < 0.1 and fold_rate < 0.2:
            bluff_chance = 0.08  # Passive caller — small bets, low bluff
            bet_multiplier = 0.7
    elif model is not None and model.get_total_games() >= 3:
        # Fall back to win_rate-based logic if no poker stats
        win_rate = model.get_win_rate()
        if win_rate < 0.4:
            bluff_chance = 0.25  # They're winning — try to bluff them
        elif win_rate > 0.6:
            bluff_chance = 0.05  # We're winning — play straight

    # No active bet — decide whether to check or bet
    if current_bet == 0:
        if category == "premium":
            # Value bet with strong hands (scaled by opponent profile)
            bet_size = int(wager * 0.5 * bet_multiplier)
            return ("bet", bet_size, "value_bet", 0.85)
        elif category == "strong":
            bet_size = int(wager * 0.3 * bet_multiplier)
            return ("bet", bet_size, "value_bet", 0.7)
        elif category == "weak" and random.random() < bluff_chance:
            # Bluff with weak hands occasionally
            bet_size = int(wager * 0.4)  # Bluff bet
            return ("bet", bet_size, "bluff", 0.3)
        else:
            return ("check", 0, "check_behind", 0.5)

    # There's an active bet — decide call, raise, or fold
    pot_odds = current_bet / (pot + current_bet) if (pot + current_bet) > 0 else 0.5

    if category == "premium":
        # Always raise with premium hands
        raise_amount = min(int(current_bet * 2), int(wager * 2))
        return ("raise", raise_amount, "value_raise", 0.9)
    elif category == "strong":
        # Usually call, sometimes raise
        if random.random() < 0.3:
            raise_amount = min(int(current_bet * 1.5), int(wager * 2))
            return ("raise", raise_amount, "semi_bluff_raise", 0.6)
        return ("call", current_bet, "call_strong", 0.7)
    elif category == "medium":
        # Call if pot odds are favorable, else fold
        implied_equity = hand_value / 100.0
        if implied_equity > pot_odds:
            return ("call", current_bet, "call_odds", 0.5)
        else:
            return ("fold", 0, "fold_bad_odds", 0.4)
    else:  # weak
        # Almost always fold to a bet, rare bluff raise
        if random.random() < bluff_chance * 0.5:
            raise_amount = min(int(current_bet * 2), int(wager * 2))
            return ("raise", raise_amount, "bluff_raise", 0.2)
        return ("fold", 0, "fold_weak", 0.6)


# ═══════════════════════════════════════════════════════════════════════════════
# Auction Strategy
# ═══════════════════════════════════════════════════════════════════════════════

def choose_auction_bid(
    wager_wei: int,
    opponent_addr: str = "",
    model=None,
) -> tuple:
    """
    Choose a bid amount for a sealed-bid auction.

    Strategy: bid shading — bid less than the full value to maximize profit.
    Optimal bid in a first-price sealed-bid auction with uniform valuations
    is approximately (n-1)/n of your valuation, where n=2 players → bid ~50%.

    We add variance and adjust based on opponent modeling.

    Args:
        wager_wei: The escrow wager (max possible bid)
        opponent_addr: Opponent address for profiling
        model: OpponentModel for historical data

    Returns:
        (bid_wei, strategy_name, confidence)
    """
    # Base bid: 50-60% of wager (optimal for 2-player sealed bid)
    base_fraction = 0.55

    # Adjust based on opponent history — prefer detailed auction stats
    if model is not None and hasattr(model, 'auction_stats') and model.auction_stats:
        avg_shade = model.auction_stats.get("avg_shade_pct", 55.0)
        if avg_shade >= 70:
            # Opponent bids high — bid slightly above their average to win
            base_fraction = min(0.95, avg_shade / 100 + 0.03)
        elif avg_shade <= 50:
            # Opponent bids low — bid just above to win cheaply
            base_fraction = avg_shade / 100 + 0.03
        else:
            # Mid range — bid 3% above their average
            base_fraction = avg_shade / 100 + 0.03
    elif model is not None and model.get_total_games() >= 3:
        # Fall back to win_rate-based logic
        win_rate = model.get_win_rate()
        if win_rate < 0.4:
            # Losing to this opponent — bid higher to try to win
            base_fraction = 0.70
        elif win_rate > 0.7:
            # Dominating — can afford to bid conservatively
            base_fraction = 0.45

    # Add randomness: ±10% variation to prevent exploitation
    variation = random.uniform(-0.10, 0.10)
    fraction = max(0.01, min(0.95, base_fraction + variation))

    bid_wei = max(1, int(wager_wei * fraction))

    # Determine strategy name based on bid fraction
    if fraction > 0.70:
        strategy_name = "aggressive_bid"
    elif fraction > 0.50:
        strategy_name = "balanced_bid"
    else:
        strategy_name = "conservative_bid"

    confidence = 0.5 + abs(fraction - 0.5)  # Higher confidence at extremes

    return (bid_wei, strategy_name, confidence)
