#!/usr/bin/env python3.13
"""
counter_bot.py — Counters the opponent's most frequent move.

Tracks your move frequency across the game and plays the counter
to your most common move. Forces the fighter to mix strategies.
Uses Wallet 5.

Usage: python3.13 opponents/counter_bot.py
"""
import random
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from base_bot import BaseBot, ROCK, PAPER, SCISSORS

# Map each move to the move that beats it
COUNTER = {ROCK: PAPER, PAPER: SCISSORS, SCISSORS: ROCK}


class CounterBot(BaseBot):
    """Counters opponent's most frequent move.
    Poker: Tracks fighter bluff frequency and adjusts calling threshold.
    Auction: Outbids the assumed average — bids 60% of wager."""

    BOT_NAME = "Counter Bot"
    MIN_WAGER_MON = 0.001
    MAX_WAGER_MON = 0.1

    def choose_move(self, game_id, current_round, history):
        if not history:
            return random.choice([ROCK, PAPER, SCISSORS])

        # Count opponent's move frequencies (from our perspective,
        # opponent moves are history[i][1])
        freq = Counter(opp_move for _, opp_move in history)
        most_common = freq.most_common(1)[0][0]

        # Counter their most frequent move
        return COUNTER[most_common]

    def choose_poker_action(self, hand_value, phase, current_bet, pot, wager):
        # Counter strategy: call more to catch bluffs, bet value hands
        if current_bet == 0:
            if hand_value > 60:
                return ("bet", int(wager * 0.4))
            return ("check", 0)
        # Call most bets to counter bluffers (only fold with very weak hands)
        if hand_value < 20:
            return ("fold", 0)
        return ("call", current_bet)

    def choose_auction_bid(self, wager_wei):
        # Slightly above average to outbid most opponents
        frac = random.uniform(0.55, 0.65)
        return max(1, int(wager_wei * frac))


if __name__ == "__main__":
    bot = CounterBot(wallet_num=5)
    bot.run()
