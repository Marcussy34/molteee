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
    """Pure random baseline — no exploitable pattern."""

    BOT_NAME = "Random Bot"
    MIN_WAGER_MON = 0.001
    MAX_WAGER_MON = 0.1  # low stakes

    def choose_move(self, game_id, current_round, history):
        return random.choice([ROCK, PAPER, SCISSORS])


if __name__ == "__main__":
    bot = RandomBot(wallet_num=4)
    bot.run()
