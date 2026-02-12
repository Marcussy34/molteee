#!/usr/bin/env python3.13
"""
run_all.py — Launches all 5 opponent bots in parallel threads.

Each bot runs in its own thread with its assigned wallet.
Ctrl+C stops all bots gracefully.

Usage: python3.13 opponents/run_all.py
"""
import signal
import sys
import threading
from pathlib import Path

# Add opponents/ to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent))

from rock_bot import RockBot
from gambler_bot import GamblerBot
from mirror_bot import MirrorBot
from random_bot import RandomBot
from counter_bot import CounterBot

# Bot configurations: (BotClass, wallet_num)
BOT_CONFIGS = [
    (RockBot, 1),
    (GamblerBot, 2),
    (MirrorBot, 3),
    (RandomBot, 4),
    (CounterBot, 5),
]

# Global flag to signal all threads to stop
_shutdown = threading.Event()


def run_bot(bot_class, wallet_num):
    """Run a single bot in a thread. Catches exceptions to avoid crashing."""
    try:
        bot = bot_class(wallet_num=wallet_num)
        # Override the main loop to check shutdown flag
        original_run = bot.run

        def patched_run():
            """Patched run that checks _shutdown flag each iteration."""
            balance = bot.w3.eth.get_balance(bot.address)
            balance_mon = balance / 10**18
            print(f"\n{'='*60}")
            print(f"{bot.BOT_NAME} (Wallet #{bot.wallet_num})")
            print(f"  Address: {bot.address}")
            print(f"  Balance: {balance_mon:.6f} MON")
            print(f"{'='*60}\n")

            if balance_mon < 0.001:
                print(f"WARNING: [{bot.BOT_NAME}] Very low balance! Skipping.")
                return

            bot.ensure_registered()

            # Mark existing matches as known
            next_id = bot.escrow.functions.nextMatchId().call()
            for mid in range(next_id):
                bot.known_match_ids.add(mid)
            print(f"  Skipped {next_id} existing matches.\n")

            # Track active game IDs by type
            playing_rps = set()
            playing_poker = set()
            playing_auction = set()

            print(f"[{bot.BOT_NAME}] Polling for challenges...\n")

            while not _shutdown.is_set():
                try:
                    # Scan for new challenges
                    challenges = bot.scan_for_challenges()
                    for match_id, match_data in challenges:
                        try:
                            game_type = bot._determine_game_contract(match_data)
                            bot.accept_challenge(match_id, match_data)

                            if game_type == "poker" and bot.poker_game:
                                game_id = bot.wait_for_poker_game_or_create(match_id)
                                playing_poker.add(game_id)
                            elif game_type == "auction" and bot.auction_game:
                                game_id = bot.wait_for_auction_game_or_create(match_id)
                                playing_auction.add(game_id)
                            else:
                                game_id = bot.wait_for_game_or_create(match_id)
                                playing_rps.add(game_id)
                        except Exception as e:
                            print(f"  [{bot.BOT_NAME}] Error accepting match {match_id}: {e}")

                    # Check for games on accepted matches
                    next_match = bot.escrow.functions.nextMatchId().call()
                    for mid in range(next_match):
                        try:
                            m = bot.escrow.functions.getMatch(mid).call()
                            if (m[1].lower() == bot.address.lower() and m[4] == 1):
                                game_type = bot._determine_game_contract(m)
                                if game_type == "poker" and bot.poker_game:
                                    gid = bot.find_poker_game_for_match(mid)
                                    if gid is not None and gid not in playing_poker:
                                        g = bot.poker_game.functions.getGame(gid).call()
                                        if not g[8]:
                                            playing_poker.add(gid)
                                elif game_type == "auction" and bot.auction_game:
                                    gid = bot.find_auction_game_for_match(mid)
                                    if gid is not None and gid not in playing_auction:
                                        g = bot.auction_game.functions.getGame(gid).call()
                                        if not g[12]:
                                            playing_auction.add(gid)
                                else:
                                    gid = bot.find_game_for_match(mid)
                                    if gid is not None and gid not in playing_rps:
                                        g = bot.rps_game.functions.getGame(gid).call()
                                        if not g[9]:
                                            playing_rps.add(gid)
                        except Exception:
                            continue

                    # Play active RPS games
                    finished = set()
                    for gid in playing_rps:
                        try:
                            if not bot.play_game_tick(gid):
                                finished.add(gid)
                        except Exception as e:
                            print(f"  [{bot.BOT_NAME}] Error playing RPS game {gid}: {e}")
                    playing_rps -= finished

                    # Play active Poker games
                    finished = set()
                    for gid in playing_poker:
                        try:
                            if not bot.play_poker_tick(gid):
                                finished.add(gid)
                        except Exception as e:
                            print(f"  [{bot.BOT_NAME}] Error playing Poker game {gid}: {e}")
                    playing_poker -= finished

                    # Play active Auction games
                    finished = set()
                    for gid in playing_auction:
                        try:
                            if not bot.play_auction_tick(gid):
                                finished.add(gid)
                        except Exception as e:
                            print(f"  [{bot.BOT_NAME}] Error playing Auction game {gid}: {e}")
                    playing_auction -= finished

                    # Wait with shutdown check
                    _shutdown.wait(timeout=5)

                except Exception as e:
                    print(f"[{bot.BOT_NAME}] Error in main loop: {e}")
                    _shutdown.wait(timeout=5)

        patched_run()

    except Exception as e:
        print(f"[Bot wallet {wallet_num}] Fatal error: {e}")


def main():
    print("=" * 60)
    print("  Launching All Opponent Bots")
    print("  Bots: Rock, Gambler, Mirror, Random, Counter")
    print("  Press Ctrl+C to stop all bots")
    print("=" * 60)

    threads = []
    for bot_class, wallet_num in BOT_CONFIGS:
        t = threading.Thread(
            target=run_bot,
            args=(bot_class, wallet_num),
            name=f"bot-{bot_class.BOT_NAME}",
            daemon=True,
        )
        threads.append(t)
        t.start()

    # Wait for Ctrl+C
    try:
        # Block main thread until interrupted
        signal.signal(signal.SIGINT, lambda s, f: _shutdown.set())
        for t in threads:
            while t.is_alive():
                t.join(timeout=1)
                if _shutdown.is_set():
                    break
        if _shutdown.is_set():
            print("\nShutdown signal received. Waiting for bots to finish...")
            for t in threads:
                t.join(timeout=10)
            print("All bots stopped.")
    except KeyboardInterrupt:
        _shutdown.set()
        print("\nShutdown signal received. Waiting for bots to finish...")
        for t in threads:
            t.join(timeout=10)
        print("All bots stopped.")


if __name__ == "__main__":
    main()
