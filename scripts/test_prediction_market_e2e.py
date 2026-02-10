#!/usr/bin/env python3.13
"""
test_prediction_market_e2e.py — Full prediction market lifecycle on Monad testnet.

Flow:
  1. Fighter creates escrow match vs Bot1 (RPS, 0.001 MON)
  2. Bot1 accepts the match
  3. Fighter creates prediction market with 0.01 MON seed
  4. Fighter buys YES tokens (0.005 MON)
  5. Bot2 buys NO tokens (0.003 MON)
  6. Fighter + Bot1 play RPS (3 rounds, commit-reveal) → Fighter wins
  7. RPSGame settles → Escrow records winner
  8. Fighter resolves prediction market (trustless: reads Escrow.winners)
  9. Fighter redeems winning YES tokens
 10. Print all tx hashes, market prices, token balances, final balances

Uses 3 wallets: DEPLOYER (Fighter), OPPONENT_1 (Bot1), OPPONENT_2 (Bot2).
"""
import json
import os
import secrets
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from web3 import Web3

# ─── Paths & Env ─────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONTRACTS_OUT = PROJECT_ROOT / "contracts" / "out"
load_dotenv(PROJECT_ROOT / ".env")

# ─── Config ───────────────────────────────────────────────────────────────────

MONAD_RPC_URL = os.getenv("MONAD_RPC_URL", "https://testnet-rpc.monad.xyz")
CHAIN_ID = 10143

# Contract addresses
ESCROW_ADDRESS = os.getenv("ESCROW_ADDRESS", "")
RPS_GAME_ADDRESS = os.getenv("RPS_GAME_ADDRESS", "")
PREDICTION_MARKET_ADDRESS = os.getenv("PREDICTION_MARKET_ADDRESS", "")

# RPS move constants (matching Solidity)
ROCK, PAPER, SCISSORS = 1, 2, 3
MOVE_NAMES = {1: "Rock", 2: "Paper", 3: "Scissors"}

# RPS phases
PHASE_COMMIT, PHASE_REVEAL, PHASE_COMPLETE = 0, 1, 2

# ─── ABI Loading ─────────────────────────────────────────────────────────────

def load_abi(name: str) -> list:
    """Load ABI from Foundry build artifact."""
    path = CONTRACTS_OUT / f"{name}.sol" / f"{name}.json"
    with open(path) as f:
        return json.load(f)["abi"]

# ─── Transaction Helper ─────────────────────────────────────────────────────

def send_tx(w3, account, func, value=0, retries=3):
    """Build, sign, send, wait for receipt. Retries on transient RPC errors."""
    for attempt in range(retries):
        try:
            tx = func.build_transaction({
                "from": account.address,
                "value": value,
                "nonce": w3.eth.get_transaction_count(account.address),
                "chainId": CHAIN_ID,
            })
            # Estimate gas with buffer
            try:
                estimated = w3.eth.estimate_gas(tx)
                tx["gas"] = int(estimated * 1.3)
            except Exception as e:
                if "revert" in str(e).lower():
                    raise
                tx["gas"] = 500000

            signed = account.sign_transaction(tx)
            tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            if receipt["status"] == 0:
                raise Exception(f"TX reverted: {tx_hash.hex()}")
            return receipt
        except Exception as e:
            err = str(e)
            if ("429" in err or "timeout" in err.lower()) and attempt < retries - 1:
                wait = 2 ** (attempt + 1)
                print(f"  [retry] RPC error, waiting {wait}s...")
                time.sleep(wait)
                continue
            raise


def print_tx(label: str, receipt):
    """Pretty-print a transaction result."""
    tx_hash = receipt["transactionHash"].hex()
    gas = receipt["gasUsed"]
    print(f"  {label}: {tx_hash} (gas: {gas})")
    return tx_hash


# ═══════════════════════════════════════════════════════════════════════════════
# Main E2E Test
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 70)
    print("PREDICTION MARKET E2E TEST — Monad Testnet")
    print("=" * 70)

    # ── Setup ──
    w3 = Web3(Web3.HTTPProvider(MONAD_RPC_URL, request_kwargs={"timeout": 30}))
    if not w3.is_connected():
        print("ERROR: Cannot connect to Monad RPC")
        sys.exit(1)

    # Load wallets
    fighter_key = os.getenv("DEPLOYER_PRIVATE_KEY", "")
    bot1_key = os.getenv("OPPONENT_1_PRIVATE_KEY", "")
    bot2_key = os.getenv("OPPONENT_2_PRIVATE_KEY", "")
    if not all([fighter_key, bot1_key, bot2_key]):
        print("ERROR: Need DEPLOYER_PRIVATE_KEY, OPPONENT_1_PRIVATE_KEY, OPPONENT_2_PRIVATE_KEY in .env")
        sys.exit(1)

    fighter = w3.eth.account.from_key(fighter_key)
    bot1 = w3.eth.account.from_key(bot1_key)
    bot2 = w3.eth.account.from_key(bot2_key)

    print(f"\nFighter:  {fighter.address}")
    print(f"Bot1:     {bot1.address}")
    print(f"Bot2:     {bot2.address}")

    # Print balances
    for name, acct in [("Fighter", fighter), ("Bot1", bot1), ("Bot2", bot2)]:
        bal = w3.eth.get_balance(acct.address)
        print(f"  {name} balance: {bal / 10**18:.6f} MON")

    # Load contract instances
    escrow = w3.eth.contract(
        address=Web3.to_checksum_address(ESCROW_ADDRESS),
        abi=load_abi("Escrow"),
    )
    rps_game = w3.eth.contract(
        address=Web3.to_checksum_address(RPS_GAME_ADDRESS),
        abi=load_abi("RPSGame"),
    )
    pred_market = w3.eth.contract(
        address=Web3.to_checksum_address(PREDICTION_MARKET_ADDRESS),
        abi=load_abi("PredictionMarket"),
    )

    # Track all tx hashes
    tx_hashes = {}
    wager = int(0.001 * 10**18)  # 0.001 MON

    # ── Step 1: Create escrow match ──
    print(f"\n{'─' * 60}")
    print("Step 1: Create escrow match (Fighter vs Bot1, 0.001 MON)")
    receipt = send_tx(w3, fighter,
        escrow.functions.createMatch(bot1.address, Web3.to_checksum_address(RPS_GAME_ADDRESS)),
        value=wager)
    tx_hashes["create_match"] = print_tx("createMatch", receipt)

    # Extract match ID from event
    logs = escrow.events.MatchCreated().process_receipt(receipt)
    match_id = logs[0]["args"]["matchId"]
    print(f"  Match ID: {match_id}")

    # ── Step 2: Bot1 accepts match ──
    print(f"\n{'─' * 60}")
    print("Step 2: Bot1 accepts match")
    receipt = send_tx(w3, bot1,
        escrow.functions.acceptMatch(match_id),
        value=wager)
    tx_hashes["accept_match"] = print_tx("acceptMatch", receipt)

    # ── Step 3: Create prediction market ──
    print(f"\n{'─' * 60}")
    print("Step 3: Create prediction market (0.01 MON seed)")
    seed = int(0.01 * 10**18)
    receipt = send_tx(w3, fighter,
        pred_market.functions.createMarket(match_id),
        value=seed)
    tx_hashes["create_market"] = print_tx("createMarket", receipt)

    logs = pred_market.events.MarketCreated().process_receipt(receipt)
    market_id = logs[0]["args"]["marketId"]
    print(f"  Market ID: {market_id}")

    # Check initial prices
    prices = pred_market.functions.getPrice(market_id).call()
    print(f"  Initial prices — YES: {prices[0] / 10**18:.4f}, NO: {prices[1] / 10**18:.4f}")

    # ── Step 4: Fighter buys YES tokens ──
    print(f"\n{'─' * 60}")
    print("Step 4: Fighter buys YES tokens (0.005 MON)")
    yes_amount = int(0.005 * 10**18)
    receipt = send_tx(w3, fighter,
        pred_market.functions.buyYES(market_id),
        value=yes_amount)
    tx_hashes["buy_yes"] = print_tx("buyYES", receipt)

    # Check balances + prices after YES buy
    fighter_bals = pred_market.functions.getUserBalances(market_id, fighter.address).call()
    print(f"  Fighter YES tokens: {fighter_bals[0] / 10**18:.6f}")
    prices = pred_market.functions.getPrice(market_id).call()
    print(f"  Prices after YES buy — YES: {prices[0] / 10**18:.4f}, NO: {prices[1] / 10**18:.4f}")

    # ── Step 5: Bot2 buys NO tokens ──
    print(f"\n{'─' * 60}")
    print("Step 5: Bot2 buys NO tokens (0.003 MON)")
    no_amount = int(0.003 * 10**18)
    receipt = send_tx(w3, bot2,
        pred_market.functions.buyNO(market_id),
        value=no_amount)
    tx_hashes["buy_no"] = print_tx("buyNO", receipt)

    # Check balances + prices after NO buy
    bot2_bals = pred_market.functions.getUserBalances(market_id, bot2.address).call()
    print(f"  Bot2 NO tokens: {bot2_bals[1] / 10**18:.6f}")
    prices = pred_market.functions.getPrice(market_id).call()
    print(f"  Prices after NO buy — YES: {prices[0] / 10**18:.4f}, NO: {prices[1] / 10**18:.4f}")

    # ── Step 6: Play RPS match to completion (3 rounds) ──
    print(f"\n{'─' * 60}")
    print("Step 6: Play RPS match (best-of-3)")

    # Create RPS game
    receipt = send_tx(w3, fighter,
        rps_game.functions.createGame(match_id, 3))
    tx_hashes["create_rps_game"] = print_tx("createGame", receipt)
    logs = rps_game.events.GameCreated().process_receipt(receipt)
    game_id = logs[0]["args"]["gameId"]
    print(f"  RPS Game ID: {game_id}")

    # Play rounds — Fighter plays Rock, Bot1 plays Scissors → Fighter always wins
    fighter_move = ROCK
    bot1_move = SCISSORS

    for round_num in range(3):
        print(f"\n  --- Round {round_num + 1} ---")

        # Wait for game state to be in commit phase for this round
        for _ in range(10):
            game = rps_game.functions.getGame(game_id).call()
            if game[9]:  # settled
                print(f"  Game settled early after round {round_num}")
                break
            if game[4] == round_num and game[7] == PHASE_COMMIT:
                break
            time.sleep(2)

        if game[9]:  # settled
            break

        # Fighter commits
        f_salt = secrets.token_bytes(32)
        f_hash = Web3.solidity_keccak(["uint8", "bytes32"], [fighter_move, f_salt])
        receipt = send_tx(w3, fighter, rps_game.functions.commit(game_id, f_hash))
        tx_hashes[f"r{round_num}_fighter_commit"] = print_tx(f"  Fighter commit ({MOVE_NAMES[fighter_move]})", receipt)

        # Bot1 commits
        b_salt = secrets.token_bytes(32)
        b_hash = Web3.solidity_keccak(["uint8", "bytes32"], [bot1_move, b_salt])
        receipt = send_tx(w3, bot1, rps_game.functions.commit(game_id, b_hash))
        tx_hashes[f"r{round_num}_bot1_commit"] = print_tx(f"  Bot1 commit ({MOVE_NAMES[bot1_move]})", receipt)

        # Wait for reveal phase
        for _ in range(10):
            game = rps_game.functions.getGame(game_id).call()
            if game[7] == PHASE_REVEAL:
                break
            time.sleep(2)

        # Fighter reveals
        receipt = send_tx(w3, fighter, rps_game.functions.reveal(game_id, fighter_move, f_salt))
        tx_hashes[f"r{round_num}_fighter_reveal"] = print_tx(f"  Fighter reveal", receipt)

        # Bot1 reveals
        receipt = send_tx(w3, bot1, rps_game.functions.reveal(game_id, bot1_move, b_salt))
        tx_hashes[f"r{round_num}_bot1_reveal"] = print_tx(f"  Bot1 reveal", receipt)

        # Brief pause for state propagation
        time.sleep(2)

        # Check scores
        game = rps_game.functions.getGame(game_id).call()
        print(f"  Score: Fighter {game[5]} - {game[6]} Bot1")

        if game[9]:  # settled
            print(f"  Game settled!")
            break

    # ── Verify match is settled ──
    print(f"\n{'─' * 60}")
    print("Step 7: Verify match settlement")

    # Wait for settlement to propagate
    for _ in range(15):
        game = rps_game.functions.getGame(game_id).call()
        if game[9]:
            break
        time.sleep(2)

    if not game[9]:
        print("  WARNING: Game not settled yet. Waiting longer...")
        time.sleep(10)
        game = rps_game.functions.getGame(game_id).call()

    print(f"  RPS Game settled: {game[9]}")
    print(f"  Final score: Fighter {game[5]} - {game[6]} Bot1")

    # Check Escrow winner
    escrow_winner = escrow.functions.winners(match_id).call()
    print(f"  Escrow winner: {escrow_winner}")
    if escrow_winner == fighter.address:
        print(f"  ✓ Fighter is the winner (YES tokens win!)")
    elif escrow_winner == bot1.address:
        print(f"  ! Bot1 is the winner (NO tokens would win)")
    else:
        print(f"  ! No winner recorded yet")

    # ── Step 8: Resolve prediction market ──
    print(f"\n{'─' * 60}")
    print("Step 8: Resolve prediction market")

    if escrow_winner != "0x" + "00" * 20 and escrow_winner != "0x0000000000000000000000000000000000000000":
        receipt = send_tx(w3, fighter, pred_market.functions.resolve(market_id))
        tx_hashes["resolve_market"] = print_tx("resolve", receipt)

        # Check market state
        market = pred_market.functions.getMarket(market_id).call()
        print(f"  Market resolved: {market[6]}")
        print(f"  Market winner: {market[7]}")
    else:
        print("  SKIPPED: No winner in Escrow yet (match may need more time)")

    # ── Step 9: Redeem winning tokens ──
    print(f"\n{'─' * 60}")
    print("Step 9: Redeem winning tokens")

    if escrow_winner == fighter.address:
        # Fighter holds YES tokens → redeem
        fighter_bals = pred_market.functions.getUserBalances(market_id, fighter.address).call()
        print(f"  Fighter YES tokens before redeem: {fighter_bals[0] / 10**18:.6f}")

        receipt = send_tx(w3, fighter, pred_market.functions.redeem(market_id))
        tx_hashes["redeem"] = print_tx("redeem", receipt)

        # Check payout from event
        logs = pred_market.events.Redeemed().process_receipt(receipt)
        if logs:
            payout = logs[0]["args"]["payout"]
            print(f"  Payout: {payout / 10**18:.6f} MON")
    else:
        print("  SKIPPED: Fighter did not win")

    # ── Summary ──
    print(f"\n{'=' * 70}")
    print("SUMMARY — Prediction Market E2E Test")
    print(f"{'=' * 70}")
    print(f"  Match ID:   {match_id}")
    print(f"  Market ID:  {market_id}")
    print(f"  RPS Game:   {game_id}")

    # Final balances
    print(f"\n  Final balances:")
    for name, acct in [("Fighter", fighter), ("Bot1", bot1), ("Bot2", bot2)]:
        bal = w3.eth.get_balance(acct.address)
        print(f"    {name}: {bal / 10**18:.6f} MON")

    # All tx hashes
    print(f"\n  Transaction hashes ({len(tx_hashes)} total):")
    for label, tx_hash in tx_hashes.items():
        print(f"    {label}: {tx_hash}")

    print(f"\n{'=' * 70}")
    print("PREDICTION MARKET E2E TEST COMPLETE")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    main()
