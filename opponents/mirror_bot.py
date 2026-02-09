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
    """Tit-for-tat: copies opponent's last move.
    Poker: Matches opponent bet sizes — mirrors betting behavior.
    Auction: Bids exactly 50% of wager (baseline)."""

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

    def choose_poker_action(self, hand_value, phase, current_bet, pot, wager):
        # Mirror: matches opponent bet sizes exactly
        if current_bet == 0:
            # Bet proportional to hand strength
            if hand_value > 50:
                bet_frac = hand_value / 200.0  # 25-50% of wager
                return ("bet", int(wager * bet_frac))
            return ("check", 0)
        # Always call — mirrors the bet
        return ("call", current_bet)

    def choose_auction_bid(self, wager_wei):
        # Neutral: bid exactly 50%
        return max(1, wager_wei // 2)


if __name__ == "__main__":
    bot = MirrorBot(wallet_num=3)
    bot.run()
