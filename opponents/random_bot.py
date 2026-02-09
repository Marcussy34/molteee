#!/usr/bin/env python3.13
"""
random_bot.py — Pure random baseline opponent.

33/33/33 random moves with low wager range. Serves as a control:
no strategy should consistently beat pure random above 50%.
Uses Wallet 4.

Usage: python3.13 opponents/random_bot.py
"""
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from base_bot import BaseBot, ROCK, PAPER, SCISSORS


class RandomBot(BaseBot):
    """Pure random baseline — no exploitable pattern.
    Poker: Random actions with uniform probability.
    Auction: Random bid between 20-80% of wager."""

    BOT_NAME = "Random Bot"
    MIN_WAGER_MON = 0.001
    MAX_WAGER_MON = 0.1  # low stakes

    def choose_move(self, game_id, current_round, history):
        return random.choice([ROCK, PAPER, SCISSORS])

    def choose_poker_action(self, hand_value, phase, current_bet, pot, wager):
        # Pure random actions
        if current_bet == 0:
            action = random.choice(["check", "bet"])
            if action == "bet":
                return ("bet", int(wager * random.uniform(0.1, 0.5)))
            return ("check", 0)
        action = random.choice(["call", "fold", "raise"])
        if action == "raise":
            return ("raise", min(int(current_bet * 2), int(wager * 2)))
        elif action == "fold":
            return ("fold", 0)
        return ("call", current_bet)

    def choose_auction_bid(self, wager_wei):
        # Random bid: 20-80% of wager
        frac = random.uniform(0.20, 0.80)
        return max(1, int(wager_wei * frac))


if __name__ == "__main__":
    bot = RandomBot(wallet_num=4)
    bot.run()
