#!/usr/bin/env python3.13
"""
arena.py — CLI dispatcher for the Gaming Arena Fighter Agent.

Usage: python3.13 skills/fighter/scripts/arena.py <command> [args]

Commands:
    status                              Show wallet balance, ELO, registration status
    register [game_types]               Register this agent (default: RPS,Poker,Auction)
    find-opponents [game_type]          List open agents (default: RPS)
    challenge <opponent> <wager> [rounds]  Create and play an RPS match
    accept <match_id> [rounds]          Accept an RPS challenge and play
    challenge-poker <opponent> <wager>  Create and play a poker match
    accept-poker <match_id>             Accept a poker challenge and play
    challenge-auction <opponent> <wager>  Create and play an auction match
    accept-auction <match_id>           Accept an auction challenge and play
    history                             Show match history
    select-match                        Rank opponents by expected value
    recommend <opponent>                Show Kelly-sized wager recommendation
"""
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
    PokerPhase,
    PokerAction,
    AuctionPhase,
    RPS_GAME_ADDRESS,
    POKER_GAME_ADDRESS,
    AUCTION_GAME_ADDRESS,
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
    # Poker wrappers
    create_poker_game,
    commit_poker_hand,
    poker_take_action,
    reveal_poker_hand,
    get_poker_game_state,
    get_next_poker_game_id,
    claim_poker_timeout,
    parse_poker_game_id_from_receipt,
    make_poker_hand_hash,
    # Auction wrappers
    create_auction_game,
    commit_auction_bid,
    reveal_auction_bid,
    get_auction_game_state,
    get_next_auction_game_id,
    claim_auction_timeout,
    parse_auction_game_id_from_receipt,
    make_auction_bid_hash,
)
from lib.strategy import (
    choose_move as strategy_choose_move,
    MOVE_NAMES as STRAT_MOVE_NAMES,
    choose_hand_value,
    choose_poker_action,
    choose_auction_bid,
)
from lib.opponent_model import OpponentModelStore
from lib.bankroll import recommend_wager, estimate_win_prob, format_recommendation

# ─── Constants ────────────────────────────────────────────────────────────────

POLL_INTERVAL = 3  # seconds between game state polls

# Shared model store — persists opponent data across games
_model_store = OpponentModelStore()


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
        game_type_names = [["RPS", "Poker", "Auction"][gt] for gt in info["gameTypes"]]
        matches = get_match_count(addr)
        print(f"Status:  Registered (open={info['isOpen']})")
        print(f"Games:   {', '.join(game_type_names)}")
        print(f"Wager:   {wei_to_mon(info['minWager']):.6f} - {wei_to_mon(info['maxWager']):.6f} MON")
        # Show ELO for each registered game type
        elo_map = {0: GameType.RPS, 1: GameType.POKER, 2: GameType.AUCTION}
        for gt_idx in info["gameTypes"]:
            gt = elo_map.get(gt_idx)
            if gt is not None:
                name = ["RPS", "Poker", "Auction"][gt_idx]
                print(f"ELO {name:7s}: {get_elo(addr, gt)}")
        print(f"Matches: {matches}")
    except Exception as e:
        err = str(e)
        if "agent not found" in err.lower() or "revert" in err.lower():
            print("Status:  Not registered")
        else:
            print(f"Status:  Error — {err}")


def cmd_register():
    """Register this agent in the AgentRegistry for all game types."""
    addr = get_address()

    # Parse optional game types from args (default: all)
    game_types = [GameType.RPS, GameType.POKER, GameType.AUCTION]
    type_names = ["RPS", "Poker", "Auction"]
    if len(sys.argv) >= 3:
        type_names = [t.strip() for t in sys.argv[2].split(",")]
        type_map = {"rps": GameType.RPS, "poker": GameType.POKER, "auction": GameType.AUCTION}
        game_types = [type_map[t.lower()] for t in type_names if t.lower() in type_map]
        type_names = [t.capitalize() for t in type_names]

    # Check if already registered
    try:
        info = get_agent_info(addr)
        if info["exists"]:
            print(f"Already registered at {addr}")
            for gt, name in zip(game_types, type_names):
                print(f"  {name} ELO: {get_elo(addr, gt)}")
            return
    except Exception:
        pass  # Not registered yet — proceed

    # Register with wager range 0.001 - 1.0 MON
    min_wager = mon_to_wei(0.001)
    max_wager = mon_to_wei(1.0)
    print(f"Registering agent for {', '.join(type_names)}...")
    print(f"  Wager range: 0.001 - 1.0 MON")

    receipt = register_agent(game_types, min_wager, max_wager)
    print(f"  TX: {receipt['transactionHash'].hex()}")
    print(f"  Block: {receipt['blockNumber']}")
    for gt, name in zip(game_types, type_names):
        print(f"  {name} ELO: {get_elo(addr, gt)}")
    print("Registration complete.")


def cmd_find_opponents():
    """List all open agents for a game type (default: RPS), excluding self."""
    # Parse optional game type from args
    type_map = {"rps": GameType.RPS, "poker": GameType.POKER, "auction": GameType.AUCTION}
    game_type_name = sys.argv[2].lower() if len(sys.argv) >= 3 else "rps"
    game_type = type_map.get(game_type_name, GameType.RPS)

    addr = get_address()
    agents = get_open_agents(game_type)

    # Filter out self
    opponents = [a for a in agents if a.lower() != addr.lower()]

    if not opponents:
        print(f"No open opponents found for {game_type_name.upper()}.")
        return

    print(f"Found {len(opponents)} {game_type_name.upper()} opponent(s):\n")
    for opp in opponents:
        try:
            info = get_agent_info(opp)
            elo_val = get_elo(opp, game_type)
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
    If wager not specified, auto-sizes via bankroll module.
    """
    if len(sys.argv) < 3:
        print("Usage: arena.py challenge <opponent_address> [wager_MON] [rounds]")
        print("  Example: arena.py challenge 0xCD40Da... 0.001 3")
        print("  Omit wager to auto-size via Kelly criterion")
        sys.exit(1)

    opponent = sys.argv[2]
    rounds = 3  # default

    # Parse wager — auto-size if not provided
    if len(sys.argv) >= 4:
        wager_mon = float(sys.argv[3])
        wager_wei = mon_to_wei(wager_mon)
        if len(sys.argv) > 4:
            rounds = int(sys.argv[4])
    else:
        # Auto-size wager using Kelly criterion
        balance = get_balance()
        win_prob = estimate_win_prob(opponent, _model_store)
        try:
            opp_info = get_agent_info(opponent)
            min_w = opp_info["minWager"]
            max_w = opp_info["maxWager"]
        except Exception:
            min_w = mon_to_wei(0.001)
            max_w = mon_to_wei(0.1)
        wager_wei = recommend_wager(balance, win_prob, min_w, max_w)
        wager_mon = wei_to_mon(wager_wei)
        print(f"Auto-sized wager: {wager_mon:.6f} MON (win prob: {win_prob:.1%})")

    # Rounds must be odd
    if rounds % 2 == 0:
        rounds += 1
        print(f"Rounds adjusted to {rounds} (must be odd)")

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
        sys.stdout.write(".")
        sys.stdout.flush()
        time.sleep(POLL_INTERVAL)

    # Step 3: Create the RPS game
    print("\n[3/4] Creating RPS game...")
    receipt = create_rps_game(match_id, rounds)
    game_id = parse_game_id_from_receipt(receipt)
    print(f"  Game ID: {game_id}")
    print(f"  TX: {receipt['transactionHash'].hex()}")

    # Step 4: Play the game with strategy engine
    print(f"\n[4/4] Playing game {game_id} with strategy engine...")
    _play_game(game_id, opponent)


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
    opponent = m["player1"]
    print(f"Match {match_id}:")
    print(f"  Challenger: {opponent}")
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
    print(f"\n[3/3] Playing game {game_id} with strategy engine...")
    _play_game(game_id, opponent)


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


def cmd_select_match():
    """
    Rank open opponents by expected value (EV).
    Shows win probability, recommended wager, and EV for each.
    """
    addr = get_address()
    balance = get_balance()
    agents = get_open_agents(GameType.RPS)
    opponents = [a for a in agents if a.lower() != addr.lower()]

    if not opponents:
        print("No open opponents found for RPS.")
        return

    print(f"Ranking opponents by expected value...\n")
    print(f"  Your balance: {wei_to_mon(balance):.6f} MON\n")

    rankings = []
    for opp in opponents:
        try:
            info = get_agent_info(opp)
            elo_val = get_elo(opp, GameType.RPS)
            win_prob = estimate_win_prob(opp, _model_store)
            min_w = info["minWager"]
            max_w = info["maxWager"]
            wager = recommend_wager(balance, win_prob, min_w, max_w)
            edge = 2 * win_prob - 1
            ev = edge * wager  # EV in wei

            model = _model_store.get(opp)
            games_played = model.get_total_games()

            rankings.append({
                "addr": opp,
                "elo": elo_val,
                "win_prob": win_prob,
                "wager": wager,
                "ev": ev,
                "games": games_played,
            })
        except Exception as e:
            print(f"  {opp[:10]}... — error: {e}")

    # Sort by EV descending
    rankings.sort(key=lambda x: x["ev"], reverse=True)

    for i, r in enumerate(rankings):
        ev_mon = r["ev"] / 10**18
        wager_mon = r["wager"] / 10**18
        marker = " <-- BEST" if i == 0 and r["ev"] > 0 else ""
        print(f"  #{i+1} {r['addr']}")
        print(f"      ELO: {r['elo']}  |  Win Prob: {r['win_prob']:.1%}  |  Games Played: {r['games']}")
        print(f"      Wager: {wager_mon:.6f} MON  |  EV: {ev_mon:+.6f} MON{marker}")
        print()

    # Recommend the best
    if rankings and rankings[0]["ev"] > 0:
        best = rankings[0]
        print(f"Recommendation: Challenge {best['addr'][:10]}... with {wei_to_mon(best['wager']):.6f} MON")
    elif rankings:
        print("No positive-EV opponents found. Use minimum wager for data gathering.")


def cmd_recommend():
    """
    Show detailed wager recommendation for a specific opponent.
    Usage: recommend <opponent_address>
    """
    if len(sys.argv) < 3:
        print("Usage: arena.py recommend <opponent_address>")
        sys.exit(1)

    opponent = sys.argv[2]
    addr = get_address()
    balance = get_balance()

    # Get opponent info
    try:
        info = get_agent_info(opponent)
        min_w = info["minWager"]
        max_w = info["maxWager"]
        elo_val = get_elo(opponent, GameType.RPS)
    except Exception:
        print(f"Error: Cannot get info for {opponent}")
        sys.exit(1)

    # Calculate recommendation
    win_prob = estimate_win_prob(opponent, _model_store)
    wager = recommend_wager(balance, win_prob, min_w, max_w)

    model = _model_store.get(opponent)
    games = model.get_total_games()
    historical_wr = model.get_win_rate() if games > 0 else None

    print(f"Wager Recommendation vs {opponent[:10]}...\n")
    print(f"  Opponent ELO:    {elo_val}")
    print(f"  Games Played:    {games}")
    if historical_wr is not None:
        print(f"  Historical WR:   {historical_wr:.1%}")
    print()
    print(format_recommendation(balance, win_prob, wager))


# ═══════════════════════════════════════════════════════════════════════════════
# Game Loop — now with strategy engine
# ═══════════════════════════════════════════════════════════════════════════════

def _play_game(game_id: int, opponent_addr: str = None):
    """
    Play a full RPS game using the multi-signal strategy engine.
    Loads opponent model, uses strategy for each move, updates model after.
    """
    my_addr = get_address()

    # Load opponent model for strategy use
    model = _model_store.get(opponent_addr) if opponent_addr else None

    # Track our secrets per round
    saved_moves = {}
    saved_salts = {}
    # Track round results as they happen
    game_round_history = []

    while True:
        game = get_game(game_id)

        # Game is settled — show result and update model
        if game["settled"]:
            _print_game_result(game, my_addr)

            # Update opponent model with game results
            if opponent_addr and model is not None:
                i_am_p1 = game["player1"].lower() == my_addr.lower()
                my_score = game["p1Score"] if i_am_p1 else game["p2Score"]
                opp_score = game["p2Score"] if i_am_p1 else game["p1Score"]
                won = my_score > opp_score

                # Build complete round history from on-chain data
                full_history = _build_round_history_from_chain(
                    game_id, game["totalRounds"], i_am_p1
                )
                model.update(full_history, won=won,
                             my_score=my_score, opp_score=opp_score)
                _model_store.save(opponent_addr)
                print(f"  Opponent model updated ({model.get_total_games()} games total)")
            return

        current_round = game["currentRound"]
        phase = game["phase"]
        deadline = game["phaseDeadline"]
        now = int(time.time())

        # Check for timeout opportunity
        if now > deadline and phase != GamePhase.COMPLETE:
            rd = get_round(game_id, current_round)
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

        # ── Commit phase — use strategy engine ──
        if phase == GamePhase.COMMIT:
            rd = get_round(game_id, current_round)
            i_am_p1 = game["player1"].lower() == my_addr.lower()
            my_committed = rd["p1Commit"] != b'\x00' * 32 if i_am_p1 else rd["p2Commit"] != b'\x00' * 32

            if not my_committed:
                # Build round history for strategy
                round_history = _build_round_history_from_chain(
                    game_id, current_round, i_am_p1
                )

                # Use strategy engine to pick move
                move_int, strategy_name, confidence = strategy_choose_move(
                    opponent_addr or "", round_history, model
                )

                # Map from strategy.py int to Move enum
                move = move_int
                salt = generate_salt()
                commit_hash = make_commit_hash(move, salt)

                # Save for reveal
                saved_moves[current_round] = move
                saved_salts[current_round] = salt

                print(f"  Round {current_round + 1}/{game['totalRounds']}: "
                      f"[{strategy_name} {confidence:.0%}] Committing {MOVE_NAMES[move]}...")
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


def _build_round_history_from_chain(game_id: int, up_to_round: int,
                                     i_am_p1: bool) -> list[tuple[int, int]]:
    """
    Build round history by querying on-chain getRound() data.
    Returns list of (my_move, opp_move) tuples for completed rounds.
    """
    history = []
    for r in range(up_to_round):
        try:
            rd = get_round(game_id, r)
            p1_move = rd["p1Move"]
            p2_move = rd["p2Move"]
            p1_revealed = rd["p1Revealed"]
            p2_revealed = rd["p2Revealed"]

            if p1_revealed and p2_revealed and p1_move > 0 and p2_move > 0:
                if i_am_p1:
                    history.append((p1_move, p2_move))
                else:
                    history.append((p2_move, p1_move))
        except Exception:
            continue
    return history


def _wait_for_game_or_create(match_id: int, rounds: int) -> int:
    """
    Wait up to 10s for the challenger to create the RPS game.
    If they don't, create it ourselves. Returns game_id.
    """
    start_game_id = get_next_game_id()
    waited = 0

    while waited < 10:
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
# Poker Commands + Game Loop
# ═══════════════════════════════════════════════════════════════════════════════

def cmd_challenge_poker():
    """
    Create and play a poker match against an opponent.
    Usage: challenge-poker <opponent_address> <wager_MON>
    """
    if len(sys.argv) < 4:
        print("Usage: arena.py challenge-poker <opponent_address> <wager_MON>")
        print("  Example: arena.py challenge-poker 0xCD40Da... 0.01")
        sys.exit(1)

    opponent = sys.argv[2]
    wager_mon = float(sys.argv[3])
    wager_wei = mon_to_wei(wager_mon)

    print(f"Challenging {opponent} to Poker")
    print(f"  Wager: {wager_mon} MON ({wager_wei} wei)")

    # Step 1: Create escrow match pointing to PokerGame contract
    print("\n[1/4] Creating escrow match (Poker)...")
    receipt = create_escrow_match(opponent, POKER_GAME_ADDRESS, wager_wei)
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
        sys.stdout.write(".")
        sys.stdout.flush()
        time.sleep(POLL_INTERVAL)

    # Step 3: Create the poker game
    print("\n[3/4] Creating Poker game...")
    receipt = create_poker_game(match_id)
    game_id = parse_poker_game_id_from_receipt(receipt)
    print(f"  Game ID: {game_id}")
    print(f"  TX: {receipt['transactionHash'].hex()}")

    # Step 4: Play the poker game
    print(f"\n[4/4] Playing poker game {game_id}...")
    _play_poker_game(game_id, opponent, wager_wei)


def cmd_accept_poker():
    """
    Accept a poker escrow match and play.
    Usage: accept-poker <match_id>
    """
    if len(sys.argv) < 3:
        print("Usage: arena.py accept-poker <match_id>")
        sys.exit(1)

    match_id = int(sys.argv[2])

    # Get match details
    m = get_escrow_match(match_id)
    opponent = m["player1"]
    wager_wei = m["wager"]
    print(f"Poker Match {match_id}:")
    print(f"  Challenger: {opponent}")
    print(f"  Wager:      {wei_to_mon(wager_wei):.6f} MON")
    print(f"  Status:     {MatchStatus(m['status']).name}")

    if m["status"] != MatchStatus.CREATED:
        print(f"Error: Match not in CREATED state (current: {MatchStatus(m['status']).name})")
        sys.exit(1)

    # Accept the escrow match
    print("\n[1/3] Accepting escrow match...")
    receipt = accept_escrow_match(match_id, wager_wei)
    print(f"  TX: {receipt['transactionHash'].hex()}")

    # Wait for game creation or create it ourselves
    print("\n[2/3] Waiting for poker game creation...")
    game_id = _wait_for_poker_game_or_create(match_id)
    print(f"  Game ID: {game_id}")

    # Play the game
    print(f"\n[3/3] Playing poker game {game_id}...")
    _play_poker_game(game_id, opponent, wager_wei)


def _wait_for_poker_game_or_create(match_id: int) -> int:
    """
    Wait up to 10s for the challenger to create the poker game.
    If they don't, create it ourselves. Returns game_id.
    """
    start_game_id = get_next_poker_game_id()
    waited = 0

    while waited < 10:
        current_next = get_next_poker_game_id()
        for gid in range(start_game_id, current_next):
            g = get_poker_game_state(gid)
            if g["escrowMatchId"] == match_id:
                return gid
        time.sleep(2)
        waited += 2

    # Timeout — create the game ourselves
    print("  Challenger didn't create poker game — creating it ourselves...")
    receipt = create_poker_game(match_id)
    return parse_poker_game_id_from_receipt(receipt)


def _play_poker_game(game_id: int, opponent_addr: str, wager_wei: int):
    """
    Play a full poker game: commit hand → betting rounds → showdown.
    Uses strategy engine for hand selection and betting decisions.
    """
    my_addr = get_address()

    # Load opponent model for strategy decisions
    model = _model_store.get(opponent_addr) if opponent_addr else None

    # Choose and save our hand value + salt at the start
    hand_value = choose_hand_value()
    salt = generate_salt()
    hand_hash = make_poker_hand_hash(hand_value, salt)

    print(f"  Hand value chosen: {hand_value}/100")

    while True:
        game = get_poker_game_state(game_id)

        # Game is settled — show result and update model
        if game["settled"]:
            _print_poker_result(game, my_addr)

            # Update opponent model
            if opponent_addr and model is not None:
                i_am_p1 = game["player1"].lower() == my_addr.lower()
                my_hand = game["p1HandValue"] if i_am_p1 else game["p2HandValue"]
                opp_hand = game["p2HandValue"] if i_am_p1 else game["p1HandValue"]
                won = my_hand > opp_hand
                # Use hand values as simple round history for modeling
                model.update([(my_hand, opp_hand)], won=won,
                             my_score=1 if won else 0,
                             opp_score=0 if won else 1)
                _model_store.save(opponent_addr)
                print(f"  Opponent model updated ({model.get_total_games()} games total)")
            return

        phase = game["phase"]
        now = int(time.time())
        deadline = game["phaseDeadline"]

        # Check for timeout opportunity
        if now > deadline and phase != PokerPhase.COMPLETE:
            i_am_p1 = game["player1"].lower() == my_addr.lower()
            if phase == PokerPhase.COMMIT:
                my_committed = game["p1Committed"] if i_am_p1 else game["p2Committed"]
                opp_committed = game["p2Committed"] if i_am_p1 else game["p1Committed"]
                if my_committed and not opp_committed:
                    print("  Opponent timed out on commit — claiming...")
                    claim_poker_timeout(game_id)
                    continue
            elif phase in (PokerPhase.BETTING_ROUND1, PokerPhase.BETTING_ROUND2):
                # If it's opponent's turn and they timed out
                if game["currentTurn"].lower() != my_addr.lower():
                    print("  Opponent timed out on betting — claiming...")
                    claim_poker_timeout(game_id)
                    continue
            elif phase == PokerPhase.SHOWDOWN:
                my_revealed = game["p1Revealed"] if i_am_p1 else game["p2Revealed"]
                opp_revealed = game["p2Revealed"] if i_am_p1 else game["p1Revealed"]
                if my_revealed and not opp_revealed:
                    print("  Opponent timed out on reveal — claiming...")
                    claim_poker_timeout(game_id)
                    continue

        # ── Commit phase — submit our hand hash ──
        if phase == PokerPhase.COMMIT:
            i_am_p1 = game["player1"].lower() == my_addr.lower()
            my_committed = game["p1Committed"] if i_am_p1 else game["p2Committed"]

            if not my_committed:
                print(f"  Committing hand (value={hand_value})...")
                commit_poker_hand(game_id, hand_hash)
                print(f"    Committed.")

        # ── Betting rounds — use poker strategy ──
        elif phase in (PokerPhase.BETTING_ROUND1, PokerPhase.BETTING_ROUND2):
            # Only act if it's our turn
            if game["currentTurn"].lower() == my_addr.lower():
                round_name = "Round 1" if phase == PokerPhase.BETTING_ROUND1 else "Round 2"
                current_bet = game["currentBet"]
                pot = game["pot"]

                # Use strategy engine to decide action
                action, amount_wei, strategy_name, confidence = choose_poker_action(
                    hand_value=hand_value,
                    phase=("round1" if phase == PokerPhase.BETTING_ROUND1 else "round2"),
                    current_bet=current_bet,
                    pot=pot,
                    wager=wager_wei,
                    opponent_addr=opponent_addr,
                    model=model,
                )

                # Map string action to PokerAction enum
                action_map = {
                    "check": PokerAction.CHECK,
                    "bet": PokerAction.BET,
                    "raise": PokerAction.RAISE,
                    "call": PokerAction.CALL,
                    "fold": PokerAction.FOLD,
                }
                action_int = action_map[action]
                send_value = amount_wei if action in ("bet", "raise") else (current_bet if action == "call" else 0)

                print(f"  {round_name} [{strategy_name} {confidence:.0%}]: {action.upper()}"
                      + (f" ({wei_to_mon(send_value):.6f} MON)" if send_value > 0 else ""))

                poker_take_action(game_id, action_int, send_value)
                print(f"    Action submitted.")

        # ── Showdown — reveal our hand ──
        elif phase == PokerPhase.SHOWDOWN:
            i_am_p1 = game["player1"].lower() == my_addr.lower()
            my_revealed = game["p1Revealed"] if i_am_p1 else game["p2Revealed"]

            if not my_revealed:
                print(f"  Revealing hand (value={hand_value})...")
                reveal_poker_hand(game_id, hand_value, salt)
                print(f"    Revealed.")

        # Wait before polling again
        time.sleep(POLL_INTERVAL)


def _print_poker_result(game: dict, my_addr: str):
    """Print the final poker game result."""
    i_am_p1 = game["player1"].lower() == my_addr.lower()
    my_hand = game["p1HandValue"] if i_am_p1 else game["p2HandValue"]
    opp_hand = game["p2HandValue"] if i_am_p1 else game["p1HandValue"]
    pot = game["pot"]

    print(f"\n  ════════════════════════════════")
    print(f"  Poker game complete!")
    print(f"  My hand:  {my_hand}/100")
    print(f"  Opp hand: {opp_hand}/100")
    print(f"  Pot:      {wei_to_mon(pot):.6f} MON")

    if my_hand > opp_hand:
        print(f"  Result: WIN")
    elif opp_hand > my_hand:
        print(f"  Result: LOSS")
    else:
        print(f"  Result: DRAW")
    print(f"  ════════════════════════════════\n")


# ═══════════════════════════════════════════════════════════════════════════════
# Auction Commands + Game Loop
# ═══════════════════════════════════════════════════════════════════════════════

def cmd_challenge_auction():
    """
    Create and play an auction match against an opponent.
    Usage: challenge-auction <opponent_address> <wager_MON>
    """
    if len(sys.argv) < 4:
        print("Usage: arena.py challenge-auction <opponent_address> <wager_MON>")
        print("  Example: arena.py challenge-auction 0xCD40Da... 0.01")
        sys.exit(1)

    opponent = sys.argv[2]
    wager_mon = float(sys.argv[3])
    wager_wei = mon_to_wei(wager_mon)

    print(f"Challenging {opponent} to Auction")
    print(f"  Wager: {wager_mon} MON ({wager_wei} wei)")

    # Step 1: Create escrow match pointing to AuctionGame contract
    print("\n[1/4] Creating escrow match (Auction)...")
    receipt = create_escrow_match(opponent, AUCTION_GAME_ADDRESS, wager_wei)
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
        sys.stdout.write(".")
        sys.stdout.flush()
        time.sleep(POLL_INTERVAL)

    # Step 3: Create the auction game
    print("\n[3/4] Creating Auction game...")
    receipt = create_auction_game(match_id)
    game_id = parse_auction_game_id_from_receipt(receipt)
    print(f"  Game ID: {game_id}")
    print(f"  TX: {receipt['transactionHash'].hex()}")

    # Step 4: Play the auction game
    print(f"\n[4/4] Playing auction game {game_id}...")
    _play_auction_game(game_id, opponent, wager_wei)


def cmd_accept_auction():
    """
    Accept an auction escrow match and play.
    Usage: accept-auction <match_id>
    """
    if len(sys.argv) < 3:
        print("Usage: arena.py accept-auction <match_id>")
        sys.exit(1)

    match_id = int(sys.argv[2])

    # Get match details
    m = get_escrow_match(match_id)
    opponent = m["player1"]
    wager_wei = m["wager"]
    print(f"Auction Match {match_id}:")
    print(f"  Challenger: {opponent}")
    print(f"  Wager:      {wei_to_mon(wager_wei):.6f} MON")
    print(f"  Status:     {MatchStatus(m['status']).name}")

    if m["status"] != MatchStatus.CREATED:
        print(f"Error: Match not in CREATED state (current: {MatchStatus(m['status']).name})")
        sys.exit(1)

    # Accept the escrow match
    print("\n[1/3] Accepting escrow match...")
    receipt = accept_escrow_match(match_id, wager_wei)
    print(f"  TX: {receipt['transactionHash'].hex()}")

    # Wait for game creation or create it ourselves
    print("\n[2/3] Waiting for auction game creation...")
    game_id = _wait_for_auction_game_or_create(match_id)
    print(f"  Game ID: {game_id}")

    # Play the game
    print(f"\n[3/3] Playing auction game {game_id}...")
    _play_auction_game(game_id, opponent, wager_wei)


def _wait_for_auction_game_or_create(match_id: int) -> int:
    """
    Wait up to 10s for the challenger to create the auction game.
    If they don't, create it ourselves. Returns game_id.
    """
    start_game_id = get_next_auction_game_id()
    waited = 0

    while waited < 10:
        current_next = get_next_auction_game_id()
        for gid in range(start_game_id, current_next):
            g = get_auction_game_state(gid)
            if g["escrowMatchId"] == match_id:
                return gid
        time.sleep(2)
        waited += 2

    # Timeout — create the game ourselves
    print("  Challenger didn't create auction game — creating it ourselves...")
    receipt = create_auction_game(match_id)
    return parse_auction_game_id_from_receipt(receipt)


def _play_auction_game(game_id: int, opponent_addr: str, wager_wei: int):
    """
    Play a full auction game: commit bid → reveal bid → result.
    Uses strategy engine for bid sizing.
    """
    my_addr = get_address()

    # Load opponent model for strategy decisions
    model = _model_store.get(opponent_addr) if opponent_addr else None

    # Choose bid using strategy engine
    bid_wei, strategy_name, confidence = choose_auction_bid(
        wager_wei=wager_wei,
        opponent_addr=opponent_addr,
        model=model,
    )
    salt = generate_salt()
    bid_hash = make_auction_bid_hash(bid_wei, salt)

    bid_pct = (bid_wei / wager_wei * 100) if wager_wei > 0 else 0
    print(f"  Bid: {wei_to_mon(bid_wei):.6f} MON ({bid_pct:.1f}% of wager) [{strategy_name} {confidence:.0%}]")

    while True:
        game = get_auction_game_state(game_id)

        # Game is settled — show result and update model
        if game["settled"]:
            _print_auction_result(game, my_addr)

            # Update opponent model
            if opponent_addr and model is not None:
                i_am_p1 = game["player1"].lower() == my_addr.lower()
                my_bid = game["p1Bid"] if i_am_p1 else game["p2Bid"]
                opp_bid = game["p2Bid"] if i_am_p1 else game["p1Bid"]
                won = my_bid > opp_bid
                # Store bid pair as round history for modeling
                model.update([(my_bid, opp_bid)], won=won,
                             my_score=1 if won else 0,
                             opp_score=0 if won else 1)
                _model_store.save(opponent_addr)
                print(f"  Opponent model updated ({model.get_total_games()} games total)")
            return

        phase = game["phase"]
        now = int(time.time())
        deadline = game["phaseDeadline"]

        # Check for timeout opportunity
        if now > deadline and phase != AuctionPhase.COMPLETE:
            i_am_p1 = game["player1"].lower() == my_addr.lower()
            if phase == AuctionPhase.COMMIT:
                my_committed = game["p1Committed"] if i_am_p1 else game["p2Committed"]
                opp_committed = game["p2Committed"] if i_am_p1 else game["p1Committed"]
                if my_committed and not opp_committed:
                    print("  Opponent timed out on commit — claiming...")
                    claim_auction_timeout(game_id)
                    continue
            elif phase == AuctionPhase.REVEAL:
                my_revealed = game["p1Revealed"] if i_am_p1 else game["p2Revealed"]
                opp_revealed = game["p2Revealed"] if i_am_p1 else game["p1Revealed"]
                if my_revealed and not opp_revealed:
                    print("  Opponent timed out on reveal — claiming...")
                    claim_auction_timeout(game_id)
                    continue

        # ── Commit phase — submit our bid hash ──
        if phase == AuctionPhase.COMMIT:
            i_am_p1 = game["player1"].lower() == my_addr.lower()
            my_committed = game["p1Committed"] if i_am_p1 else game["p2Committed"]

            if not my_committed:
                print(f"  Committing bid...")
                commit_auction_bid(game_id, bid_hash)
                print(f"    Committed.")

        # ── Reveal phase — reveal our bid ──
        elif phase == AuctionPhase.REVEAL:
            i_am_p1 = game["player1"].lower() == my_addr.lower()
            my_revealed = game["p1Revealed"] if i_am_p1 else game["p2Revealed"]

            if not my_revealed:
                print(f"  Revealing bid ({wei_to_mon(bid_wei):.6f} MON)...")
                reveal_auction_bid(game_id, bid_wei, salt)
                print(f"    Revealed.")

        # Wait before polling again
        time.sleep(POLL_INTERVAL)


def _print_auction_result(game: dict, my_addr: str):
    """Print the final auction game result."""
    i_am_p1 = game["player1"].lower() == my_addr.lower()
    my_bid = game["p1Bid"] if i_am_p1 else game["p2Bid"]
    opp_bid = game["p2Bid"] if i_am_p1 else game["p1Bid"]
    prize = game["prize"]

    print(f"\n  ════════════════════════════════")
    print(f"  Auction game complete!")
    print(f"  My bid:  {wei_to_mon(my_bid):.6f} MON")
    print(f"  Opp bid: {wei_to_mon(opp_bid):.6f} MON")
    print(f"  Prize:   {wei_to_mon(prize):.6f} MON")

    if my_bid > opp_bid:
        print(f"  Result: WIN")
    elif opp_bid > my_bid:
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
        "challenge-poker": cmd_challenge_poker,
        "accept-poker": cmd_accept_poker,
        "challenge-auction": cmd_challenge_auction,
        "accept-auction": cmd_accept_auction,
        "history": cmd_history,
        "select-match": cmd_select_match,
        "recommend": cmd_recommend,
    }

    if command in commands:
        commands[command]()
    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
