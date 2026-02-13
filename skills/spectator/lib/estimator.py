"""
estimator.py — ELO-based outcome estimation for match prediction.

Uses the standard ELO probability formula to estimate win probabilities,
then compares with prediction market prices to find betting edges.
"""
import math


def estimate_win_probability(elo_a: int, elo_b: int) -> float:
    """
    Estimate player A's win probability using the standard ELO formula.

    P(A wins) = 1 / (1 + 10^((ELO_B - ELO_A) / 400))

    Args:
        elo_a: Player A's ELO rating
        elo_b: Player B's ELO rating

    Returns:
        Probability of player A winning (0.0 to 1.0)
    """
    exponent = (elo_b - elo_a) / 400.0
    return 1.0 / (1.0 + math.pow(10, exponent))


def get_recommendation(
    elo_p1: int,
    elo_p2: int,
    yes_price: int,
    no_price: int,
    min_edge: float = 0.05,
) -> dict:
    """
    Get a betting recommendation by comparing ELO probability with market price.

    YES = player1 wins, NO = player2 wins.
    Prices are scaled to 1e18 (so 0.5e18 = 50%).

    Args:
        elo_p1: Player 1's ELO rating
        elo_p2: Player 2's ELO rating
        yes_price: Current YES token price (scaled 1e18)
        no_price: Current NO token price (scaled 1e18)
        min_edge: Minimum edge required to recommend a bet (default 5%)

    Returns:
        dict with keys: recommend (bool), side ("yes"/"no"/None),
        elo_prob (float), market_prob (float), edge (float), reason (str)
    """
    # ELO-based probability that player1 wins
    p1_win_prob = estimate_win_probability(elo_p1, elo_p2)

    # Market-implied probability (YES price / total)
    total_price = yes_price + no_price
    if total_price == 0:
        return {
            "recommend": False,
            "side": None,
            "elo_prob": p1_win_prob,
            "market_prob": 0.5,
            "edge": 0.0,
            "reason": "Market has no liquidity",
        }

    market_p1_prob = yes_price / total_price

    # Calculate edge on each side
    yes_edge = p1_win_prob - market_p1_prob       # Edge on YES (p1 wins)
    no_edge = (1 - p1_win_prob) - (1 - market_p1_prob)  # Edge on NO = -(yes_edge)

    # Determine if there's a profitable bet
    if yes_edge >= min_edge:
        return {
            "recommend": True,
            "side": "yes",
            "elo_prob": p1_win_prob,
            "market_prob": market_p1_prob,
            "edge": yes_edge,
            "reason": f"Player1 underpriced by {yes_edge:.1%} — buy YES",
        }
    elif -yes_edge >= min_edge:
        return {
            "recommend": True,
            "side": "no",
            "elo_prob": p1_win_prob,
            "market_prob": market_p1_prob,
            "edge": -yes_edge,
            "reason": f"Player2 underpriced by {-yes_edge:.1%} — buy NO",
        }
    else:
        return {
            "recommend": False,
            "side": None,
            "elo_prob": p1_win_prob,
            "market_prob": market_p1_prob,
            "edge": max(abs(yes_edge), abs(no_edge)),
            "reason": f"No significant edge (max {max(abs(yes_edge), abs(no_edge)):.1%})",
        }
