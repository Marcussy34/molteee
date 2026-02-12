"""
output.py — Enhanced ANSI-colored terminal output for the Gaming Arena.

Provides styled output functions for match headers, round results,
match summaries, strategy reasoning, opponent models, market status,
and tournament standings. All functions write to stdout.
"""

# ─── ANSI Color Constants ───────────────────────────────────────────────────

GREEN = "\033[32m"
RED = "\033[31m"
YELLOW = "\033[33m"
CYAN = "\033[36m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"

# Move names for display (mirrors contracts.py Move enum)
_MOVE_NAMES = {0: "None", 1: "Rock", 2: "Paper", 3: "Scissors"}


# ─── Helper ─────────────────────────────────────────────────────────────────

def _truncate_addr(addr: str, length: int = 10) -> str:
    """Truncate an address for display: 0xABCD1234... """
    if len(addr) <= length + 3:
        return addr
    return addr[:length] + "..."


def _bar(fraction: float, width: int = 20) -> str:
    """Render a filled/empty ASCII progress bar."""
    filled = int(fraction * width)
    empty = width - filled
    return "\u2588" * filled + "\u2591" * empty


# ─── Match Header ───────────────────────────────────────────────────────────

def print_match_header(game_type: str, opponent: str, wager_mon: float,
                       elo_diff: int = 0):
    """
    Print a styled match header box.

    Args:
        game_type:  "RPS", "Poker", or "Auction"
        opponent:   Opponent address
        wager_mon:  Wager amount in MON
        elo_diff:   Your ELO minus opponent ELO (positive = advantage)
    """
    opp_short = _truncate_addr(opponent)
    # ELO advantage/disadvantage indicator
    if elo_diff > 0:
        elo_str = f"{GREEN}+{elo_diff} ELO advantage{RESET}"
    elif elo_diff < 0:
        elo_str = f"{RED}{elo_diff} ELO disadvantage{RESET}"
    else:
        elo_str = f"{DIM}Even ELO{RESET}"

    print()
    print(f"  {BOLD}{'=' * 48}{RESET}")
    print(f"  {BOLD}{CYAN}  {game_type} Match{RESET}")
    print(f"  {BOLD}{'=' * 48}{RESET}")
    print(f"    Opponent:  {opp_short}")
    print(f"    Wager:     {wager_mon:.6f} MON")
    print(f"    ELO:       {elo_str}")
    print(f"  {BOLD}{'=' * 48}{RESET}")
    print()


# ─── Round Result ───────────────────────────────────────────────────────────

def print_round_result(round_num: int, total_rounds: int, my_move: str,
                       opp_move: str, won: bool, strategy: str = "",
                       confidence: float = 0.0):
    """
    Print a color-coded round result.

    Args:
        round_num:    Current round (1-indexed)
        total_rounds: Total rounds in match
        my_move:      Move name (e.g. "Rock")
        opp_move:     Opponent move name
        won:          True=win, False=loss, None=draw
        strategy:     Strategy name used
        confidence:   Strategy confidence (0-1)
    """
    if won is True:
        color = GREEN
        result_str = "WIN"
    elif won is False:
        color = RED
        result_str = "LOSS"
    else:
        color = YELLOW
        result_str = "DRAW"

    strat_str = f" [{strategy} {confidence:.0%}]" if strategy else ""

    print(f"    Round {round_num}/{total_rounds}: "
          f"{BOLD}{my_move}{RESET} vs {BOLD}{opp_move}{RESET}  "
          f"{color}{BOLD}{result_str}{RESET}"
          f"{DIM}{strat_str}{RESET}")


# ─── Match Summary ──────────────────────────────────────────────────────────

def print_match_summary(won: bool, my_score: int, opp_score: int,
                        elo_before: int = 0, elo_after: int = 0,
                        balance_before: float = 0, balance_after: float = 0,
                        tx_hash: str = ""):
    """
    Print a big WIN/LOSS banner with score, ELO change, and balance change.

    Args:
        won:             True=win, False=loss, None=draw
        my_score:        Our final score
        opp_score:       Opponent final score
        elo_before:      ELO before the match (0 to skip)
        elo_after:       ELO after the match (0 to skip)
        balance_before:  Balance before in MON (0 to skip)
        balance_after:   Balance after in MON (0 to skip)
        tx_hash:         Settlement tx hash (empty to skip)
    """
    if won is True:
        color = GREEN
        banner = "WIN"
    elif won is False:
        color = RED
        banner = "LOSS"
    else:
        color = YELLOW
        banner = "DRAW"

    print()
    print(f"  {color}{BOLD}{'=' * 48}{RESET}")
    print(f"  {color}{BOLD}  {banner}   {my_score} - {opp_score}{RESET}")
    print(f"  {color}{BOLD}{'=' * 48}{RESET}")

    # ELO change
    if elo_before > 0 and elo_after > 0:
        elo_delta = elo_after - elo_before
        elo_color = GREEN if elo_delta > 0 else (RED if elo_delta < 0 else DIM)
        print(f"    ELO:     {elo_before} -> {elo_after}  "
              f"({elo_color}{elo_delta:+d}{RESET})")

    # Balance change
    if balance_before > 0 or balance_after > 0:
        bal_delta = balance_after - balance_before
        bal_color = GREEN if bal_delta > 0 else (RED if bal_delta < 0 else DIM)
        print(f"    Balance: {balance_before:.6f} -> {balance_after:.6f} MON  "
              f"({bal_color}{bal_delta:+.6f}{RESET})")

    # TX hash
    if tx_hash:
        print(f"    TX:      {tx_hash}")

    print()


# ─── Strategy Reasoning ────────────────────────────────────────────────────

def print_strategy_reasoning(strategy_name: str, confidence: float,
                             alternatives: list = None):
    """
    Show which strategy was selected and alternatives considered.

    Args:
        strategy_name: Name of the selected strategy
        confidence:    Confidence (0-1)
        alternatives:  List of (name, confidence) tuples for alternatives
    """
    print(f"    {CYAN}Strategy:{RESET} {BOLD}{strategy_name}{RESET} "
          f"({confidence:.0%} confidence)")
    if alternatives:
        alt_str = ", ".join(f"{name} {conf:.0%}" for name, conf in alternatives)
        print(f"    {DIM}Alternatives: {alt_str}{RESET}")


# ─── Opponent Model State ──────────────────────────────────────────────────

def print_opponent_model_state(model):
    """
    Show opponent move distribution as ASCII bars and pattern detection.

    Args:
        model: OpponentModel instance (from opponent_model.py)
    """
    total = sum(model.move_counts.values())
    if total == 0:
        print(f"    {DIM}No opponent data yet.{RESET}")
        return

    print(f"    {BOLD}Opponent Profile{RESET} ({model.get_total_games()} games)")

    # Move distribution bars
    for move_int, name in [(1, "Rock"), (2, "Paper"), (3, "Scissors")]:
        count = model.move_counts.get(move_int, 0)
        frac = count / total if total > 0 else 0
        bar_str = _bar(frac, 20)
        print(f"      {name:8s} {bar_str} {frac:5.1%}  ({count})")

    # Pattern detection — check if transitions are significantly non-uniform
    if model.transitions:
        patterns = []
        for from_m, to_counts in model.transitions.items():
            total_from = sum(to_counts.values())
            if total_from >= 3:
                # Find most common follow-up
                most_common = max(to_counts, key=to_counts.get)
                freq = to_counts[most_common] / total_from
                if freq > 0.5:
                    from_name = _MOVE_NAMES.get(int(from_m), from_m)
                    to_name = _MOVE_NAMES.get(int(most_common), most_common)
                    patterns.append(f"{from_name}->{to_name} ({freq:.0%})")
        if patterns:
            print(f"      {YELLOW}Patterns:{RESET} {', '.join(patterns)}")

    # Win rate
    wr = model.get_win_rate()
    wr_color = GREEN if wr > 0.5 else (RED if wr < 0.5 else DIM)
    print(f"      {wr_color}Win rate: {wr:.1%}{RESET}")


# ─── Market Status ──────────────────────────────────────────────────────────

def print_market_status(market_data: dict, prices: tuple):
    """
    Show prediction market YES/NO prices with colored bars.

    Args:
        market_data: Dict with keys: question, resolved, outcome, totalYes, totalNo
        prices:      Tuple of (yes_price, no_price) as floats (0-1)
    """
    yes_price, no_price = prices
    question = market_data.get("question", "Unknown")
    resolved = market_data.get("resolved", False)

    print(f"    {BOLD}Market:{RESET} {question}")

    if resolved:
        outcome = market_data.get("outcome", False)
        outcome_str = f"{GREEN}YES{RESET}" if outcome else f"{RED}NO{RESET}"
        print(f"    {BOLD}Resolved:{RESET} {outcome_str}")
    else:
        print(f"    {DIM}Active{RESET}")

    # YES price bar
    yes_bar = _bar(yes_price, 20)
    print(f"      {GREEN}YES{RESET}  {yes_bar} {yes_price:5.1%}")

    # NO price bar
    no_bar = _bar(no_price, 20)
    print(f"      {RED}NO {RESET}  {no_bar} {no_price:5.1%}")

    # Volume
    total_yes = market_data.get("totalYes", 0)
    total_no = market_data.get("totalNo", 0)
    if total_yes > 0 or total_no > 0:
        print(f"      {DIM}Volume: {total_yes + total_no} shares "
              f"(YES:{total_yes} / NO:{total_no}){RESET}")


# ─── Tournament Standings ──────────────────────────────────────────────────

def print_tournament_standings(participants: list, points: dict,
                               format_name: str = ""):
    """
    Print a formatted tournament standings table.

    Args:
        participants: List of player addresses
        points:       Dict mapping address -> points/score
        format_name:  Tournament format name (e.g. "Round Robin")
    """
    if format_name:
        print(f"    {BOLD}{format_name} Standings{RESET}")
    else:
        print(f"    {BOLD}Tournament Standings{RESET}")

    # Sort by points descending
    sorted_players = sorted(participants,
                            key=lambda a: points.get(a, 0),
                            reverse=True)

    # Table header
    print(f"    {'#':>3}  {'Player':<14}  {'Points':>6}")
    print(f"    {'---':>3}  {'-' * 14}  {'------':>6}")

    for i, player in enumerate(sorted_players):
        rank = i + 1
        addr_short = _truncate_addr(player, 12)
        pts = points.get(player, 0)

        # Color top 3
        if rank == 1:
            color = GREEN
        elif rank == 2:
            color = CYAN
        elif rank == 3:
            color = YELLOW
        else:
            color = ""

        reset = RESET if color else ""
        print(f"    {color}{rank:>3}  {addr_short:<14}  {pts:>6}{reset}")

    print()
