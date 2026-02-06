"""
bankroll.py — Kelly criterion wager sizing for the Gaming Arena.

Calculates optimal wager size based on estimated win probability,
current bankroll, and half-Kelly safety margin.
"""


def recommend_wager(
    balance_wei: int,
    win_prob: float,
    min_wager_wei: int,
    max_wager_wei: int,
) -> int:
    """
    Kelly criterion wager sizing with half-Kelly safety margin.

    For even-money bets (RPS: win = +wager, lose = -wager):
      f* = (b*p - q) / b  where b=1 (even odds), p=win_prob, q=1-p
      f* = 2*p - 1  (simplified for even-money)

    We use half-Kelly (f*/2) for safety, capped at 5% of bankroll.

    Args:
        balance_wei: Current balance in wei
        win_prob: Estimated probability of winning (0.0 to 1.0)
        min_wager_wei: Minimum wager (contract/opponent constraint)
        max_wager_wei: Maximum wager (contract/opponent constraint)

    Returns:
        Recommended wager in wei, clamped to [min_wager, max_wager]
    """
    # No edge or negative edge — bet minimum
    edge = 2 * win_prob - 1
    if edge <= 0:
        return min_wager_wei

    # Half-Kelly for safety
    kelly_fraction = edge
    safe_fraction = kelly_fraction / 2

    # Cap at 5% of bankroll
    max_fraction = 0.05
    fraction = min(safe_fraction, max_fraction)

    # Calculate wager in wei
    wager = int(balance_wei * fraction)

    # Clamp to min/max range
    wager = max(min_wager_wei, min(wager, max_wager_wei))

    # Floor: if balance is very low, just use minimum
    min_viable_balance = min_wager_wei * 10  # need at least 10x min wager
    if balance_wei < min_viable_balance:
        return min_wager_wei

    return wager


def estimate_win_prob(opponent_addr: str, model_store) -> float:
    """
    Estimate win probability against a specific opponent.

    Uses historical match data from the opponent model store.
    Returns 0.5 for unknown opponents (no edge assumed).

    Args:
        opponent_addr: Opponent's address
        model_store: OpponentModelStore instance

    Returns:
        Estimated win probability (0.0 to 1.0)
    """
    model = model_store.get(opponent_addr)

    # No history — assume 50/50
    if model.get_total_games() == 0:
        return 0.5

    # Use historical win rate, but regress toward 0.5 with few games
    # (Bayesian-ish: more games = more trust in observed rate)
    games = model.get_total_games()
    observed_rate = model.get_win_rate()

    # Regress toward 0.5: weight = games / (games + 5)
    # With 0 games: 0.5, with 5 games: 50% observed + 50% prior,
    # with 20 games: 80% observed + 20% prior
    weight = games / (games + 5)
    estimated = weight * observed_rate + (1 - weight) * 0.5

    return estimated


def format_recommendation(
    balance_wei: int,
    win_prob: float,
    wager_wei: int,
) -> str:
    """
    Format a human-readable wager recommendation string.

    Args:
        balance_wei: Current balance in wei
        win_prob: Estimated win probability
        wager_wei: Recommended wager in wei

    Returns:
        Formatted recommendation string
    """
    balance_mon = balance_wei / 10**18
    wager_mon = wager_wei / 10**18
    edge = 2 * win_prob - 1
    ev_mon = edge * wager_mon

    lines = [
        f"Balance:    {balance_mon:.6f} MON",
        f"Win Prob:   {win_prob:.1%}",
        f"Edge:       {edge:.1%}",
        f"Wager:      {wager_mon:.6f} MON ({wager_wei / balance_wei * 100:.2f}% of bankroll)" if balance_wei > 0 else f"Wager:      {wager_mon:.6f} MON",
        f"EV:         {ev_mon:+.6f} MON per match",
    ]

    if win_prob <= 0.5:
        lines.append("Warning:    No edge detected — using minimum wager")

    return "\n".join(lines)
