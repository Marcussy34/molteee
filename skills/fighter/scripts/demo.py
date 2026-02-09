#!/usr/bin/env python3.13
"""
demo.py — Scripted showcase of the Gaming Arena Fighter Agent.

Runs a 3-5 minute demo sequence that demonstrates:
1. Agent status and registration
2. Opponent discovery and EV ranking
3. RPS strategy display
4. Prediction market creation and status
5. TournamentV2 display
6. Psychology module (pump targets)
7. Final stats summary

Usage: python3.13 skills/fighter/scripts/demo.py
"""
import subprocess
import sys
import time

# ─── Config ──────────────────────────────────────────────────────────────────

ARENA = "skills/fighter/scripts/arena.py"
PYTHON = "python3.13"

# Delay between demo steps (seconds) — controls pacing
STEP_DELAY = 2
SECTION_DELAY = 4


def run_cmd(args: list[str], label: str = None):
    """Run a command and print its output with optional label."""
    if label:
        print(f"\n{'─' * 60}")
        print(f"  {label}")
        print(f"{'─' * 60}\n")
        time.sleep(1)

    cmd = [PYTHON] + args
    print(f"$ {' '.join(cmd)}\n")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.stdout:
        print(result.stdout)
    if result.stderr:
        # Only show stderr if it's not empty/whitespace
        err = result.stderr.strip()
        if err:
            print(f"[stderr] {err}")

    time.sleep(STEP_DELAY)
    return result


def narrate(text: str):
    """Print narration text with visual separator."""
    print(f"\n{'═' * 60}")
    print(f"  {text}")
    print(f"{'═' * 60}")
    time.sleep(SECTION_DELAY)


# ═══════════════════════════════════════════════════════════════════════════════
# Demo Sequence
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print()
    print("=" * 60)
    print("  MOLTEEE — Gaming Arena Agent Demo")
    print("  Autonomous AI Agent on Monad Testnet")
    print("=" * 60)
    time.sleep(SECTION_DELAY)

    # ── Step 1: Agent Status ──
    narrate("Step 1: Check Agent Status")
    print("The fighter agent checks its wallet balance, registration,")
    print("and ELO ratings across all game types.\n")
    run_cmd([ARENA, "status"], "arena.py status")

    # ── Step 2: Find Opponents ──
    narrate("Step 2: Discover Opponents")
    print("The agent scans the on-chain AgentRegistry for open opponents.")
    print("It queries each game type to find potential challengers.\n")
    run_cmd([ARENA, "find-opponents"], "arena.py find-opponents")
    run_cmd([ARENA, "find-opponents", "poker"], "arena.py find-opponents poker")

    # ── Step 3: EV Ranking ──
    narrate("Step 3: Rank Opponents by Expected Value")
    print("The strategy engine evaluates each opponent using:")
    print("  - Historical win rate from persistent opponent models")
    print("  - Kelly criterion for optimal wager sizing")
    print("  - Expected value (EV) calculation per matchup\n")
    run_cmd([ARENA, "select-match"], "arena.py select-match")

    # ── Step 4: Wager Recommendation ──
    narrate("Step 4: Kelly Criterion Wager Sizing")
    print("For the best opponent, the agent calculates the exact wager")
    print("using the Kelly criterion — balancing edge vs. bankroll risk.\n")
    # We'll try recommend on a known address; if none exist, skip gracefully
    result = run_cmd([ARENA, "find-opponents"], None)
    # Extract first opponent address from output if available
    lines = (result.stdout or "").split("\n")
    opp_addr = None
    for line in lines:
        line = line.strip()
        if line.startswith("0x") and len(line) >= 42:
            opp_addr = line[:42]
            break

    if opp_addr:
        run_cmd([ARENA, "recommend", opp_addr], "arena.py recommend <opponent>")
    else:
        print("  (No opponents available for wager recommendation demo)")

    # ── Step 5: Match History ──
    narrate("Step 5: Match History & Win Rate")
    print("The agent reviews its past performance — wins, losses,")
    print("win rate, and ELO progression over time.\n")
    run_cmd([ARENA, "history"], "arena.py history")

    # ── Step 6: Prediction Market ──
    narrate("Step 6: Prediction Markets")
    print("The PredictionMarket contract enables betting on match outcomes.")
    print("Uses a constant-product AMM (like Uniswap) for YES/NO tokens.\n")
    # Show market status if any exist
    run_cmd([ARENA, "market-status", "0"], "arena.py market-status 0")

    # ── Step 7: TournamentV2 ──
    narrate("Step 7: Tournament System")
    print("TournamentV2 supports two formats:")
    print("  - Round-Robin: every player plays every other player")
    print("  - Double-Elimination: eliminated after 2 losses\n")
    run_cmd([ARENA, "tournaments"], "arena.py tournaments")

    # ── Step 8: Psychology Module ──
    narrate("Step 8: Psychology & ELO Pumping")
    print("The psychology module adds tactical edges:")
    print("  - Commit timing delays (fast/slow/erratic/escalating)")
    print("  - Pattern seeding + exploitation")
    print("  - Tilt challenge recommendations after wins")
    print("  - ELO pumping target identification\n")
    run_cmd([ARENA, "pump-targets"], "arena.py pump-targets")

    # ── Final Summary ──
    narrate("Demo Complete!")
    print("Molteee demonstrates a fully autonomous gaming agent that:")
    print()
    print("  1. Discovers and evaluates opponents on-chain")
    print("  2. Plays 3 game types with adaptive strategy engines")
    print("  3. Manages bankroll using Kelly criterion")
    print("  4. Builds persistent opponent models")
    print("  5. Creates and trades on prediction markets")
    print("  6. Competes in round-robin & double-elim tournaments")
    print("  7. Uses psychological tactics for competitive edge")
    print("  8. Posts results to ERC-8004 reputation registry")
    print()
    print("All gameplay settled on Monad testnet (chain 10143).")
    print("Built for the Moltiverse Hackathon — Gaming Arena Agent Bounty")
    print()
    print("=" * 60)


if __name__ == "__main__":
    main()
