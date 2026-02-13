#!/usr/bin/env python3.13
"""
gambler_bot.py — Uniform random bot that accepts high wagers.

Pure 33/33/33 random moves, but with high max wager (1.0 MON).
Good for bankroll management testing — no exploitable pattern.
Uses Wallet 2.

Usage: python3.13 opponents/gambler_bot.py
"""
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from base_bot import BaseBot, ROCK, PAPER, SCISSORS


class GamblerBot(BaseBot):
    """Uniform random moves, accepts big bets.
    Poker: Loose-aggressive — bluffs 50%, calls everything.
    Auction: Aggressive — bids 75% of wager."""

    BOT_NAME = "Gambler Bot"
    MIN_WAGER_MON = 0.001
    MAX_WAGER_MON = 1.0  # accepts high wagers

    def choose_move(self, game_id, current_round, history):
        # Pure uniform random — no exploitable pattern
        return random.choice([ROCK, PAPER, SCISSORS])

    def choose_poker_action(self, hand_value, phase, current_bet, pot, wager):
        # Loose-aggressive: bluffs 50% of the time, always calls
        if current_bet == 0:
            if hand_value > 50 or random.random() < 0.5:
                # Bet aggressively
                return ("bet", int(wager * 0.5))
            return ("check", 0)
        # Always call — never folds
        if random.random() < 0.3:
            return ("raise", min(int(current_bet * 2), int(wager * 2)))
        return ("call", current_bet)

    def choose_auction_bid(self, wager_wei):
        # Aggressive: bid 70-80% of wager
        frac = random.uniform(0.70, 0.80)
        return max(1, int(wager_wei * frac))


if __name__ == "__main__":
    bot = GamblerBot(wallet_num=2)
    bot.run()
