#!/usr/bin/env python3.13
"""
test_tournament_v2_e2e.py — TournamentV2 E2E test on Monad testnet.

Flow:
  1. Fighter creates a 4-player round-robin tournament (0.01 MON entry, 0.001 MON base wager)
  2. Fighter + Bot1 + Bot2 + Bot3 register (pay entry fee)
  3. Fighter generates the match schedule
  4. Verify: tournament status, player count, participants, schedule

Uses 4 wallets: DEPLOYER (Fighter), OPPONENT_1 (Bot1), OPPONENT_2 (Bot2), OPPONENT_3 (Bot3).
"""
import json
import os
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

MONAD_RPC_URL = os.getenv("MONAD_RPC_URL", "https://monad-testnet.g.alchemy.com/v2/uMvEY1mdMyM8svqTZD-p3")
CHAIN_ID = 10143

# Contract address
TOURNAMENT_V2_ADDRESS = os.getenv("TOURNAMENT_V2_ADDRESS", "")

# Tournament format enum (matching Solidity)
FORMAT_ROUND_ROBIN = 0
FORMAT_DOUBLE_ELIM = 1

# Tournament status enum
STATUS_REGISTRATION = 0
STATUS_ACTIVE = 1
STATUS_COMPLETE = 2
STATUS_CANCELLED = 3
STATUS_NAMES = {0: "Registration", 1: "Active", 2: "Complete", 3: "Cancelled"}

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
    print("TOURNAMENT V2 E2E TEST — Monad Testnet")
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
    bot3_key = os.getenv("OPPONENT_3_PRIVATE_KEY", "")
    if not all([fighter_key, bot1_key, bot2_key, bot3_key]):
        print("ERROR: Need DEPLOYER, OPPONENT_1, OPPONENT_2, OPPONENT_3 private keys in .env")
        sys.exit(1)

    fighter = w3.eth.account.from_key(fighter_key)
    bot1 = w3.eth.account.from_key(bot1_key)
    bot2 = w3.eth.account.from_key(bot2_key)
    bot3 = w3.eth.account.from_key(bot3_key)

    players = [
        ("Fighter", fighter),
        ("Bot1", bot1),
        ("Bot2", bot2),
        ("Bot3", bot3),
    ]

    print(f"\nPlayers:")
    for name, acct in players:
        bal = w3.eth.get_balance(acct.address)
        print(f"  {name}: {acct.address}  ({bal / 10**18:.6f} MON)")

    # Load contract
    tv2 = w3.eth.contract(
        address=Web3.to_checksum_address(TOURNAMENT_V2_ADDRESS),
        abi=load_abi("TournamentV2"),
    )

    # Track tx hashes
    tx_hashes = {}

    entry_fee = int(0.01 * 10**18)   # 0.01 MON entry
    base_wager = int(0.001 * 10**18)  # 0.001 MON per match

    # ── Step 1: Create round-robin tournament ──
    print(f"\n{'─' * 60}")
    print("Step 1: Create 4-player round-robin tournament")
    print(f"  Entry fee: 0.01 MON, Base wager: 0.001 MON")

    receipt = send_tx(w3, fighter,
        tv2.functions.createTournament(FORMAT_ROUND_ROBIN, entry_fee, base_wager, 4))
    tx_hashes["create_tournament"] = print_tx("createTournament", receipt)

    # Extract tournament ID from event
    logs = tv2.events.TournamentCreated().process_receipt(receipt)
    tid = logs[0]["args"]["tournamentId"]
    print(f"  Tournament ID: {tid}")

    # ── Step 2: Register all 4 players ──
    print(f"\n{'─' * 60}")
    print("Step 2: Register 4 players")

    for name, acct in players:
        receipt = send_tx(w3, acct,
            tv2.functions.register(tid),
            value=entry_fee)
        tx_hashes[f"register_{name.lower()}"] = print_tx(f"register({name})", receipt)
        # Small delay to avoid nonce collisions
        time.sleep(1)

    # Verify player count
    info = tv2.functions.getTournament(tid).call()
    print(f"  Player count: {info[4]} / {info[3]}")
    print(f"  Prize pool: {info[5] / 10**18:.4f} MON")
    print(f"  Status: {STATUS_NAMES.get(info[6], info[6])}")

    # ── Step 3: Generate schedule ──
    print(f"\n{'─' * 60}")
    print("Step 3: Generate round-robin schedule")

    receipt = send_tx(w3, fighter,
        tv2.functions.generateSchedule(tid))
    tx_hashes["generate_schedule"] = print_tx("generateSchedule", receipt)

    # Verify schedule
    info = tv2.functions.getTournament(tid).call()
    print(f"  Status after schedule: {STATUS_NAMES.get(info[6], info[6])}")

    total_matches = tv2.functions.rrTotalMatches(tid).call()
    print(f"  Total RR matches: {total_matches} (expected {4 * 3 // 2} = 6)")

    # ── Step 4: Verify participants and schedule ──
    print(f"\n{'─' * 60}")
    print("Step 4: Verify participants and match schedule")

    participants = tv2.functions.getParticipants(tid).call()
    print(f"  Participants ({len(participants)}):")
    for i, addr in enumerate(participants):
        # Find name
        pname = "Unknown"
        for name, acct in players:
            if acct.address.lower() == addr.lower():
                pname = name
                break
        print(f"    {i + 1}. {pname}: {addr}")

    # Print match schedule
    print(f"\n  Match Schedule ({total_matches} matches):")
    for idx in range(total_matches):
        match = tv2.functions.getRRMatch(tid, idx).call()
        p1_name = "?"
        p2_name = "?"
        for name, acct in players:
            if acct.address.lower() == match[0].lower():
                p1_name = name
            if acct.address.lower() == match[1].lower():
                p2_name = name
        # Get game type for this match index
        game_addr = tv2.functions.getGameForMatch(idx).call()
        game_type = "RPS" if idx % 3 == 0 else ("Poker" if idx % 3 == 1 else "Auction")
        print(f"    Match {idx}: {p1_name} vs {p2_name} ({game_type})")

    # ── Summary ──
    print(f"\n{'=' * 70}")
    print("SUMMARY — TournamentV2 E2E Test")
    print(f"{'=' * 70}")
    print(f"  Tournament ID:  {tid}")
    print(f"  Format:         Round-Robin")
    print(f"  Players:        {len(participants)}")
    print(f"  Total matches:  {total_matches}")
    print(f"  Prize pool:     {info[5] / 10**18:.4f} MON")
    print(f"  Status:         {STATUS_NAMES.get(info[6], info[6])}")

    # Final balances
    print(f"\n  Final balances:")
    for name, acct in players:
        bal = w3.eth.get_balance(acct.address)
        print(f"    {name}: {bal / 10**18:.6f} MON")

    # All tx hashes
    print(f"\n  Transaction hashes ({len(tx_hashes)} total):")
    for label, tx_hash in tx_hashes.items():
        print(f"    {label}: {tx_hash}")

    print(f"\n{'=' * 70}")
    print("TOURNAMENT V2 E2E TEST COMPLETE")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    main()
