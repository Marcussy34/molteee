#!/usr/bin/env python3.13
"""
rock_bot.py — Biased opponent bot that heavily favors Rock.

70% Rock, 20% Paper, 10% Scissors. Exploitable by frequency analysis.
Uses Wallet 1. Conservative wager range.

Usage: python3.13 opponents/rock_bot.py
"""
import random
import sys
from pathlib import Path

# Add parent so base_bot import works
sys.path.insert(0, str(Path(__file__).resolve().parent))

from base_bot import BaseBot, ROCK, PAPER, SCISSORS


class RockBot(BaseBot):
    """Heavily biased toward Rock — exploitable via frequency analysis."""

    BOT_NAME = "Rock Bot"
    MIN_WAGER_MON = 0.001
    MAX_WAGER_MON = 0.1  # conservative

    def choose_move(self, game_id, current_round, history):
        # 70% rock, 20% paper, 10% scissors
        return random.choices([ROCK, PAPER, SCISSORS], weights=[70, 20, 10])[0]


if __name__ == "__main__":
    bot = RockBot(wallet_num=1)
    bot.run()
