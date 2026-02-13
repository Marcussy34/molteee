#!/usr/bin/env python3.13
"""
spectate.py — CLI dispatcher for the Spectator Agent.

Usage: python3.13 skills/spectator/scripts/spectate.py <command> [args]

Commands:
    watch                           Scan recent escrow matches, show active ones
    analyze <match_id>              ELO-based win probability analysis
    bet <market_id> <yes|no> <amt>  Buy YES/NO tokens on a prediction market
    portfolio                       Show current market positions and P&L
    accuracy                        Historical prediction accuracy stats
"""
import json
import sys
import time
from pathlib import Path

# ─── Path setup ──────────────────────────────────────────────────────────────
# Add spectator's lib/ to sys.path so imports work when run from project root
_skill_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_skill_dir))

from lib.contracts import (
    MatchStatus,
    GameType,
    get_address,
    get_balance,
    get_escrow_match,
    get_next_match_id,
    get_agent_info,
    get_elo,
    get_market,
    get_market_price,
    get_user_balances,
    get_next_market_id,
    buy_yes,
    buy_no,
    wei_to_mon,
    mon_to_wei,
)
from lib.estimator import estimate_win_probability, get_recommendation

# ─── Predictions Persistence ─────────────────────────────────────────────────
# Track prediction history for accuracy stats

_PREDICTIONS_PATH = _skill_dir / "data" / "predictions.json"


def _load_predictions() -> dict:
    """Load predictions from JSON file."""
    try:
        with open(_PREDICTIONS_PATH) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"predictions": [], "total": 0, "correct": 0}


def _save_predictions(data: dict):
    """Save predictions to JSON file."""
    _PREDICTIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(_PREDICTIONS_PATH, "w") as f:
        json.dump(data, f, indent=2)


# ═══════════════════════════════════════════════════════════════════════════════
# Commands
# ═══════════════════════════════════════════════════════════════════════════════

def cmd_watch():
    """Scan recent escrow matches and show active ones."""
    next_id = get_next_match_id()

    if next_id == 0:
        print("No matches created yet.")
        return

    # Scan the most recent 20 matches (or all if fewer)
    start = max(0, next_id - 20)
    found = 0

    print(f"Scanning matches {start} to {next_id - 1}...\n")

    for mid in range(start, next_id):
        try:
            m = get_escrow_match(mid)
            status = MatchStatus
            status_name = {0: "CREATED", 1: "ACTIVE", 2: "SETTLED", 3: "CANCELLED"}.get(
                m["status"], "UNKNOWN"
            )

            # Show CREATED and ACTIVE matches (interesting for spectators)
            if m["status"] in (MatchStatus.CREATED, MatchStatus.ACTIVE):
                found += 1
                wager_mon = wei_to_mon(m["wager"])

                print(f"Match #{mid}  [{status_name}]")
                print(f"  Player 1: {m['player1']}")
                print(f"  Player 2: {m['player2']}")
                print(f"  Wager:    {wager_mon:.6f} MON")
                print(f"  Game:     {m['gameContract']}")
                print()
        except Exception:
            continue

    if found == 0:
        print("No active matches found. Check back later.")
    else:
        print(f"Found {found} active/pending match(es).")


def cmd_analyze():
    """
    Analyze a match using ELO ratings and compare with market price.
    Usage: analyze <match_id>
    """
    if len(sys.argv) < 3:
        print("Usage: spectate.py analyze <match_id>")
        sys.exit(1)

    match_id = int(sys.argv[2])
    m = get_escrow_match(match_id)

    status_name = {0: "CREATED", 1: "ACTIVE", 2: "SETTLED", 3: "CANCELLED"}.get(
        m["status"], "UNKNOWN"
    )
    wager_mon = wei_to_mon(m["wager"])

    print(f"Match #{match_id}  [{status_name}]")
    print(f"  Player 1: {m['player1']}")
    print(f"  Player 2: {m['player2']}")
    print(f"  Wager:    {wager_mon:.6f} MON\n")

    # Get ELO ratings for both players (default to RPS)
    try:
        elo_p1 = get_elo(m["player1"], GameType.RPS)
    except Exception:
        elo_p1 = 1000  # Default ELO

    try:
        elo_p2 = get_elo(m["player2"], GameType.RPS)
    except Exception:
        elo_p2 = 1000

    # Calculate win probability
    p1_prob = estimate_win_probability(elo_p1, elo_p2)

    print(f"ELO Analysis:")
    print(f"  Player 1 ELO: {elo_p1}")
    print(f"  Player 2 ELO: {elo_p2}")
    print(f"  P1 win prob:  {p1_prob:.1%}")
    print(f"  P2 win prob:  {1 - p1_prob:.1%}")

    # Check if a prediction market exists for this match
    try:
        next_market = get_next_market_id()
        market_found = False

        for mk_id in range(next_market):
            try:
                market = get_market(mk_id)
                if market["matchId"] == match_id:
                    market_found = True
                    prices = get_market_price(mk_id)
                    yes_pct = prices[0] / 1e18 * 100
                    no_pct = prices[1] / 1e18 * 100

                    print(f"\nPrediction Market #{mk_id}:")
                    print(f"  YES price: {yes_pct:.1f}%  (P1 wins)")
                    print(f"  NO price:  {no_pct:.1f}%  (P2 wins)")

                    # Get recommendation
                    rec = get_recommendation(elo_p1, elo_p2, prices[0], prices[1])
                    if rec["recommend"]:
                        print(f"\n  RECOMMENDATION: Buy {rec['side'].upper()}")
                        print(f"    Edge: {rec['edge']:.1%}")
                        print(f"    {rec['reason']}")
                    else:
                        print(f"\n  No bet recommended: {rec['reason']}")

                    # Save prediction for accuracy tracking
                    preds = _load_predictions()
                    preds["predictions"].append({
                        "match_id": match_id,
                        "market_id": mk_id,
                        "elo_p1": elo_p1,
                        "elo_p2": elo_p2,
                        "p1_prob": round(p1_prob, 4),
                        "predicted_winner": "p1" if p1_prob > 0.5 else "p2",
                        "timestamp": int(time.time()),
                        "resolved": False,
                        "correct": None,
                    })
                    preds["total"] += 1
                    _save_predictions(preds)
                    break
            except Exception:
                continue

        if not market_found:
            print("\n  No prediction market found for this match.")

    except Exception:
        print("\n  Could not check prediction markets.")


def cmd_bet():
    """
    Buy YES or NO tokens on a prediction market.
    Usage: bet <market_id> <yes|no> <amount_MON>
    """
    if len(sys.argv) < 5:
        print("Usage: spectate.py bet <market_id> <yes|no> <amount_MON>")
        print("  Example: spectate.py bet 0 yes 0.001")
        sys.exit(1)

    market_id = int(sys.argv[2])
    side = sys.argv[3].lower()
    amount_mon = float(sys.argv[4])
    amount_wei = mon_to_wei(amount_mon)

    if side not in ("yes", "no"):
        print("Error: side must be 'yes' or 'no'")
        sys.exit(1)

    # Show current prices before buying
    prices = get_market_price(market_id)
    yes_pct = prices[0] / 1e18 * 100
    no_pct = prices[1] / 1e18 * 100
    print(f"Market #{market_id} prices: YES {yes_pct:.1f}% / NO {no_pct:.1f}%")
    print(f"  Buying {side.upper()} with {amount_mon} MON...")

    if side == "yes":
        receipt = buy_yes(market_id, amount_wei)
    else:
        receipt = buy_no(market_id, amount_wei)

    print(f"  TX: {receipt['transactionHash'].hex()}")

    # Show updated balances
    addr = get_address()
    balances = get_user_balances(market_id, addr)
    print(f"  Your balances: YES={balances[0]}  NO={balances[1]}")

    # Show updated prices
    prices = get_market_price(market_id)
    yes_pct = prices[0] / 1e18 * 100
    no_pct = prices[1] / 1e18 * 100
    print(f"  New prices:    YES {yes_pct:.1f}% / NO {no_pct:.1f}%")


def cmd_portfolio():
    """Show current prediction market positions and estimated P&L."""
    addr = get_address()
    balance = get_balance()
    print(f"Wallet: {addr}")
    print(f"Balance: {wei_to_mon(balance):.6f} MON\n")

    try:
        next_market = get_next_market_id()
    except Exception:
        print("Could not read prediction markets.")
        return

    if next_market == 0:
        print("No prediction markets exist yet.")
        return

    print(f"Scanning {next_market} market(s)...\n")
    found = 0

    for mk_id in range(next_market):
        try:
            balances = get_user_balances(mk_id, addr)
            yes_bal = balances[0]
            no_bal = balances[1]

            # Only show markets where we have a position
            if yes_bal > 0 or no_bal > 0:
                found += 1
                market = get_market(mk_id)
                prices = get_market_price(mk_id)
                yes_pct = prices[0] / 1e18 * 100
                no_pct = prices[1] / 1e18 * 100

                resolved_str = "RESOLVED" if market["resolved"] else "OPEN"

                print(f"Market #{mk_id}  [{resolved_str}]  (Match {market['matchId']})")
                print(f"  YES tokens: {yes_bal}  (price: {yes_pct:.1f}%)")
                print(f"  NO tokens:  {no_bal}  (price: {no_pct:.1f}%)")
                if market["resolved"]:
                    zero_addr = "0x" + "0" * 40
                    if market["winner"] == zero_addr:
                        print(f"  Outcome: DRAW")
                    else:
                        winner_short = market["winner"][:10] + "..."
                        print(f"  Winner: {winner_short}")
                print()
        except Exception:
            continue

    if found == 0:
        print("No active positions found.")
    else:
        print(f"Total: {found} market position(s).")


def cmd_accuracy():
    """Show historical prediction accuracy stats."""
    preds = _load_predictions()

    total = preds["total"]
    if total == 0:
        print("No predictions recorded yet.")
        print("Use 'analyze <match_id>' to generate predictions.")
        return

    # Count resolved predictions
    resolved = [p for p in preds["predictions"] if p.get("resolved")]
    correct = preds["correct"]
    unresolved = total - len(resolved)

    print(f"Prediction Accuracy Stats\n")
    print(f"  Total predictions: {total}")
    print(f"  Resolved:          {len(resolved)}")
    print(f"  Correct:           {correct}")
    print(f"  Unresolved:        {unresolved}")

    if len(resolved) > 0:
        accuracy = correct / len(resolved) * 100
        print(f"\n  Accuracy: {accuracy:.1f}%")
    else:
        print(f"\n  Accuracy: N/A (no resolved predictions yet)")

    # Show recent predictions
    recent = preds["predictions"][-5:]
    if recent:
        print(f"\nRecent predictions:")
        for p in reversed(recent):
            ts = time.strftime("%Y-%m-%d %H:%M", time.localtime(p["timestamp"]))
            status = "CORRECT" if p.get("correct") else ("WRONG" if p.get("resolved") else "PENDING")
            winner = p["predicted_winner"].upper()
            prob = p["p1_prob"]
            print(f"  {ts}  Match #{p['match_id']}  Predicted: {winner}  ({prob:.0%})  [{status}]")


# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]

    commands = {
        "watch": cmd_watch,
        "analyze": cmd_analyze,
        "bet": cmd_bet,
        "portfolio": cmd_portfolio,
        "accuracy": cmd_accuracy,
    }

    if command in commands:
        commands[command]()
    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
