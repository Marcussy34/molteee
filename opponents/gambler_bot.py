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
    """Uniform random moves, accepts big bets."""

    BOT_NAME = "Gambler Bot"
    MIN_WAGER_MON = 0.001
    MAX_WAGER_MON = 1.0  # accepts high wagers

    def choose_move(self, game_id, current_round, history):
        # Pure uniform random — no exploitable pattern
        return random.choice([ROCK, PAPER, SCISSORS])


if __name__ == "__main__":
    bot = GamblerBot(wallet_num=2)
    bot.run()
