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
    """Heavily biased toward Rock — exploitable via frequency analysis.
    Poker: Very tight — folds to any bet >20% of pot, never bluffs.
    Auction: Conservative — bids only 30% of wager."""

    BOT_NAME = "Rock Bot"
    MIN_WAGER_MON = 0.001
    MAX_WAGER_MON = 0.1  # conservative

    def choose_move(self, game_id, current_round, history):
        # 70% rock, 20% paper, 10% scissors
        return random.choices([ROCK, PAPER, SCISSORS], weights=[70, 20, 10])[0]

    def choose_poker_action(self, hand_value, phase, current_bet, pot, wager):
        # Very tight: fold to any bet > 20% of pot unless hand is strong (>70)
        if current_bet == 0:
            if hand_value > 70:
                return ("bet", int(wager * 0.2))
            return ("check", 0)
        # Fold to any significant bet unless hand is strong
        if hand_value > 70:
            return ("call", current_bet)
        return ("fold", 0)

    def choose_auction_bid(self, wager_wei):
        # Very conservative: bid only 30%
        return max(1, int(wager_wei * 0.30))


if __name__ == "__main__":
    bot = RockBot(wallet_num=1)
    bot.run()
