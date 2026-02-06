#!/usr/bin/env python3.13
"""
arena.py — CLI dispatcher for the Gaming Arena Fighter Agent.

Usage: python3 skills/fighter/scripts/arena.py <command> [args]

Commands:
    status                              Show wallet balance, ELO, registration status
    register                            Register this agent in the AgentRegistry
    find-opponents                      List open agents for RPS
    challenge <opponent> <wager> [rounds]  Create and play an RPS match
    accept <match_id> [rounds]          Accept a challenge and play
    history                             Show match history
"""
import random
import sys
import time
from pathlib import Path

# ─── Path setup ──────────────────────────────────────────────────────────────
# Add skill's lib/ to sys.path so imports work when run from project root
_skill_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_skill_dir))

from lib.contracts import (
    GamePhase,
    GameType,
    MatchStatus,
    Move,
    MOVE_NAMES,
    RPS_GAME_ADDRESS,
    accept_escrow_match,
    claim_timeout,
    commit_move,
    create_escrow_match,
    create_rps_game,
    generate_salt,
    get_address,
    get_agent_info,
    get_balance,
    get_elo,
    get_escrow_match,
    get_game,
    get_match_count,
    get_match_history,
    get_next_game_id,
    get_open_agents,
    get_round,
    make_commit_hash,
    mon_to_wei,
    parse_game_id_from_receipt,
    parse_match_id_from_receipt,
    register_agent,
    reveal_move,
    wei_to_mon,
)

# ─── Constants ────────────────────────────────────────────────────────────────

POLL_INTERVAL = 3  # seconds between game state polls


# ═══════════════════════════════════════════════════════════════════════════════
# Commands
# ═══════════════════════════════════════════════════════════════════════════════

def cmd_status():
    """Show wallet balance, registration info, and ELO."""
    addr = get_address()
    balance = get_balance()
    print(f"Wallet:  {addr}")
    print(f"Balance: {wei_to_mon(balance):.6f} MON")

    try:
        info = get_agent_info(addr)
        game_types = [["RPS", "Poker", "Auction"][gt] for gt in info["gameTypes"]]
        elo_rps = get_elo(addr, GameType.RPS)
        matches = get_match_count(addr)
        print(f"Status:  Registered (open={info['isOpen']})")
        print(f"Games:   {', '.join(game_types)}")
        print(f"Wager:   {wei_to_mon(info['minWager']):.6f} - {wei_to_mon(info['maxWager']):.6f} MON")
        print(f"ELO:     {elo_rps}")
        print(f"Matches: {matches}")
    except Exception as e:
        err = str(e)
        if "agent not found" in err.lower() or "revert" in err.lower():
            print("Status:  Not registered")
        else:
            print(f"Status:  Error — {err}")


def cmd_register():
    """Register this agent in the AgentRegistry for RPS."""
    addr = get_address()

    # Check if already registered
    try:
        info = get_agent_info(addr)
        if info["exists"]:
            print(f"Already registered at {addr}")
            print(f"ELO: {get_elo(addr, GameType.RPS)}")
            return
    except Exception:
        pass  # Not registered yet — proceed

    # Register for RPS with wager range 0.001 - 1.0 MON
    min_wager = mon_to_wei(0.001)
    max_wager = mon_to_wei(1.0)
    print(f"Registering agent for RPS...")
    print(f"  Wager range: 0.001 - 1.0 MON")

    receipt = register_agent([GameType.RPS], min_wager, max_wager)
    print(f"  TX: {receipt['transactionHash'].hex()}")
    print(f"  Block: {receipt['blockNumber']}")
    print(f"  ELO: {get_elo(addr, GameType.RPS)}")
    print("Registration complete.")


def cmd_find_opponents():
    """List all open agents for RPS, excluding self."""
    addr = get_address()
    agents = get_open_agents(GameType.RPS)

    # Filter out self
    opponents = [a for a in agents if a.lower() != addr.lower()]

    if not opponents:
        print("No open opponents found for RPS.")
        return

    print(f"Found {len(opponents)} opponent(s):\n")
    for opp in opponents:
        try:
            info = get_agent_info(opp)
            elo_val = get_elo(opp, GameType.RPS)
            print(f"  {opp}")
            print(f"    ELO:   {elo_val}")
            print(f"    Wager: {wei_to_mon(info['minWager']):.6f} - {wei_to_mon(info['maxWager']):.6f} MON")
            print()
        except Exception:
            print(f"  {opp}  (info unavailable)")
            print()


def cmd_challenge():
    """
    Create and play an RPS match against an opponent.
    Usage: challenge <opponent_address> <wager_mon> [rounds]
    """
    if len(sys.argv) < 4:
        print("Usage: arena.py challenge <opponent_address> <wager_MON> [rounds]")
        print("  Example: arena.py challenge 0xCD40Da... 0.001 3")
        sys.exit(1)

    opponent = sys.argv[2]
    wager_mon = float(sys.argv[3])
    rounds = int(sys.argv[4]) if len(sys.argv) > 4 else 3

    # Rounds must be odd
    if rounds % 2 == 0:
        rounds += 1
        print(f"Rounds adjusted to {rounds} (must be odd)")

    wager_wei = mon_to_wei(wager_mon)
    print(f"Challenging {opponent}")
    print(f"  Wager: {wager_mon} MON ({wager_wei} wei)")
    print(f"  Rounds: {rounds} (best of {rounds})")

    # Step 1: Create escrow match
    print("\n[1/4] Creating escrow match...")
    receipt = create_escrow_match(opponent, RPS_GAME_ADDRESS, wager_wei)
    match_id = parse_match_id_from_receipt(receipt)
    print(f"  Match ID: {match_id}")
    print(f"  TX: {receipt['transactionHash'].hex()}")

    # Step 2: Wait for opponent to accept
    print("\n[2/4] Waiting for opponent to accept...")
    while True:
        m = get_escrow_match(match_id)
        if m["status"] == MatchStatus.ACTIVE:
            print("  Opponent accepted!")
            break
        if m["status"] == MatchStatus.CANCELLED:
            print("  Match was cancelled.")
            return
        # Still waiting
        sys.stdout.write(".")
        sys.stdout.flush()
        time.sleep(POLL_INTERVAL)

    # Step 3: Create the RPS game
    print("\n[3/4] Creating RPS game...")
    receipt = create_rps_game(match_id, rounds)
    game_id = parse_game_id_from_receipt(receipt)
    print(f"  Game ID: {game_id}")
    print(f"  TX: {receipt['transactionHash'].hex()}")

    # Step 4: Play the game
    print(f"\n[4/4] Playing game {game_id}...")
    _play_game(game_id)


def cmd_accept():
    """
    Accept an existing escrow match and play the game.
    Usage: accept <match_id> [rounds]
    """
    if len(sys.argv) < 3:
        print("Usage: arena.py accept <match_id> [rounds]")
        sys.exit(1)

    match_id = int(sys.argv[2])
    rounds = int(sys.argv[3]) if len(sys.argv) > 3 else 3

    # Rounds must be odd
    if rounds % 2 == 0:
        rounds += 1
        print(f"Rounds adjusted to {rounds} (must be odd)")

    # Get match details
    m = get_escrow_match(match_id)
    print(f"Match {match_id}:")
    print(f"  Challenger: {m['player1']}")
    print(f"  Wager:      {wei_to_mon(m['wager']):.6f} MON")
    print(f"  Status:     {MatchStatus(m['status']).name}")

    if m["status"] != MatchStatus.CREATED:
        print(f"Error: Match is not in CREATED state (current: {MatchStatus(m['status']).name})")
        sys.exit(1)

    # Accept the escrow match
    print("\n[1/3] Accepting escrow match...")
    receipt = accept_escrow_match(match_id, m["wager"])
    print(f"  TX: {receipt['transactionHash'].hex()}")

    # Wait for game creation or create it ourselves
    print("\n[2/3] Waiting for game creation...")
    game_id = _wait_for_game_or_create(match_id, rounds)
    print(f"  Game ID: {game_id}")

    # Play the game
    print(f"\n[3/3] Playing game {game_id}...")
    _play_game(game_id)


def cmd_history():
    """Show match history, win/loss count, win rate, and ELO."""
    addr = get_address()
    history = get_match_history(addr)

    if not history:
        print("No match history yet.")
        return

    wins = sum(1 for m in history if m[2])  # m[2] = won (bool)
    losses = len(history) - wins
    win_rate = (wins / len(history)) * 100 if history else 0
    elo_val = get_elo(addr, GameType.RPS)

    print(f"Match History ({len(history)} matches)\n")
    print(f"  Wins:     {wins}")
    print(f"  Losses:   {losses}")
    print(f"  Win Rate: {win_rate:.1f}%")
    print(f"  ELO:      {elo_val}\n")

    # Show recent matches (most recent first)
    print("Recent matches:")
    for m in reversed(history[-10:]):
        opponent = m[0]
        game_type = ["RPS", "Poker", "Auction"][m[1]]
        result = "WIN" if m[2] else "LOSS"
        wager = wei_to_mon(m[3])
        ts = time.strftime("%Y-%m-%d %H:%M", time.localtime(m[4]))
        print(f"  {ts}  {result:4s}  vs {opponent[:10]}...  {wager:.4f} MON  ({game_type})")


# ═══════════════════════════════════════════════════════════════════════════════
# Game Loop
# ═══════════════════════════════════════════════════════════════════════════════

def _play_game(game_id: int):
    """
    Play a full RPS game — commit/reveal loop for all rounds.
    Uses random moves (Phase 2). Strategy comes in Phase 3.
    """
    my_addr = get_address()

    # Track our secrets per round so we can reveal later
    saved_moves = {}   # round_index -> move_int
    saved_salts = {}   # round_index -> salt_bytes

    while True:
        game = get_game(game_id)

        # Game is settled — show final result
        if game["settled"]:
            _print_game_result(game, my_addr)
            return

        current_round = game["currentRound"]
        phase = game["phase"]
        deadline = game["phaseDeadline"]
        now = int(time.time())

        # Check for timeout opportunity
        if now > deadline and phase != GamePhase.COMPLETE:
            rd = get_round(game_id, current_round)
            # Only claim timeout if we've acted and opponent hasn't
            i_am_p1 = game["player1"].lower() == my_addr.lower()
            if phase == GamePhase.COMMIT:
                my_committed = rd["p1Commit"] != b'\x00' * 32 if i_am_p1 else rd["p2Commit"] != b'\x00' * 32
                opp_committed = rd["p2Commit"] != b'\x00' * 32 if i_am_p1 else rd["p1Commit"] != b'\x00' * 32
                if my_committed and not opp_committed:
                    print(f"  Round {current_round + 1}: Opponent timed out on commit — claiming...")
                    claim_timeout(game_id)
                    continue
            elif phase == GamePhase.REVEAL:
                my_revealed = rd["p1Revealed"] if i_am_p1 else rd["p2Revealed"]
                opp_revealed = rd["p2Revealed"] if i_am_p1 else rd["p1Revealed"]
                if my_revealed and not opp_revealed:
                    print(f"  Round {current_round + 1}: Opponent timed out on reveal — claiming...")
                    claim_timeout(game_id)
                    continue

        # ── Commit phase ──
        if phase == GamePhase.COMMIT:
            rd = get_round(game_id, current_round)
            i_am_p1 = game["player1"].lower() == my_addr.lower()
            my_committed = rd["p1Commit"] != b'\x00' * 32 if i_am_p1 else rd["p2Commit"] != b'\x00' * 32

            if not my_committed:
                # Pick a random move (Phase 2 — random strategy)
                move = random.choice([Move.ROCK, Move.PAPER, Move.SCISSORS])
                salt = generate_salt()
                commit_hash = make_commit_hash(move, salt)

                # Save for reveal
                saved_moves[current_round] = move
                saved_salts[current_round] = salt

                print(f"  Round {current_round + 1}/{game['totalRounds']}: Committing {MOVE_NAMES[move]}...")
                commit_move(game_id, commit_hash)
                print(f"    Committed.")

        # ── Reveal phase ──
        elif phase == GamePhase.REVEAL:
            rd = get_round(game_id, current_round)
            i_am_p1 = game["player1"].lower() == my_addr.lower()
            my_revealed = rd["p1Revealed"] if i_am_p1 else rd["p2Revealed"]

            if not my_revealed:
                move = saved_moves.get(current_round)
                salt = saved_salts.get(current_round)
                if move is None or salt is None:
                    print(f"  Round {current_round + 1}: ERROR — missing saved move/salt for reveal!")
                    return

                print(f"  Round {current_round + 1}/{game['totalRounds']}: Revealing {MOVE_NAMES[move]}...")
                reveal_move(game_id, move, salt)
                print(f"    Revealed.")

        # Wait before polling again
        time.sleep(POLL_INTERVAL)


def _wait_for_game_or_create(match_id: int, rounds: int) -> int:
    """
    Wait up to 10s for the challenger to create the RPS game.
    If they don't, create it ourselves. Returns game_id.
    """
    # Track the current next game ID to detect new games
    start_game_id = get_next_game_id()
    waited = 0

    while waited < 10:
        # Check if a new game was created for our match
        current_next = get_next_game_id()
        for gid in range(start_game_id, current_next):
            g = get_game(gid)
            if g["escrowMatchId"] == match_id:
                return gid
        time.sleep(2)
        waited += 2

    # Timeout — create the game ourselves
    print("  Challenger didn't create game — creating it ourselves...")
    receipt = create_rps_game(match_id, rounds)
    return parse_game_id_from_receipt(receipt)


def _print_game_result(game: dict, my_addr: str):
    """Print the final game result."""
    i_am_p1 = game["player1"].lower() == my_addr.lower()
    my_score = game["p1Score"] if i_am_p1 else game["p2Score"]
    opp_score = game["p2Score"] if i_am_p1 else game["p1Score"]

    print(f"\n  ════════════════════════════════")
    print(f"  Game complete! Score: {my_score} - {opp_score}")

    if my_score > opp_score:
        print(f"  Result: WIN")
    elif opp_score > my_score:
        print(f"  Result: LOSS")
    else:
        print(f"  Result: DRAW")
    print(f"  ════════════════════════════════\n")


# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]

    commands = {
        "status": cmd_status,
        "register": cmd_register,
        "find-opponents": cmd_find_opponents,
        "challenge": cmd_challenge,
        "accept": cmd_accept,
        "history": cmd_history,
    }

    if command in commands:
        commands[command]()
    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
