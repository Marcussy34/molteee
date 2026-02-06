#!/usr/bin/env python3.13
"""
mirror_bot.py — Tit-for-tat opponent that copies your last move.

Plays random on round 1, then copies the opponent's previous move.
Exploitable by Markov/sequence detection: if you played X last round,
mirror plays X this round, so play counter(X).
Uses Wallet 3.

Usage: python3.13 opponents/mirror_bot.py
"""
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from base_bot import BaseBot, ROCK, PAPER, SCISSORS


class MirrorBot(BaseBot):
    """Tit-for-tat: copies opponent's last move."""

    BOT_NAME = "Mirror Bot"
    MIN_WAGER_MON = 0.001
    MAX_WAGER_MON = 0.1

    def choose_move(self, game_id, current_round, history):
        if not history:
            # First round — play random
            return random.choice([ROCK, PAPER, SCISSORS])
        # Copy opponent's last move (history is from our perspective:
        # (my_move, opp_move), so opp's last move is history[-1][1])
        return history[-1][1]


if __name__ == "__main__":
    bot = MirrorBot(wallet_num=3)
    bot.run()
