#!/usr/bin/env python3.13
"""
Play a complete RPS match between two bots.
Usage: python3.13 scripts/play_bot_match.py <bot1_num> <bot2_num> <move1> <move2>
  move1/move2: 1=Rock, 2=Paper, 3=Scissors
"""
import sys, os, time, secrets
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'skills', 'fighter'))
os.chdir(os.path.join(os.path.dirname(__file__), '..', 'skills', 'fighter'))

from dotenv import load_dotenv
load_dotenv('../../.env')
from web3 import Web3
from lib.contracts import (
    get_w3, get_escrow, get_rps_game, get_game, get_round,
    make_commit_hash, parse_match_id_from_receipt, parse_game_id_from_receipt,
    RPS_GAME_ADDRESS, MONAD_CHAIN_ID
)

MOVE_NAMES = {1: 'Rock', 2: 'Paper', 3: 'Scissors'}

def main():
    if len(sys.argv) < 5:
        print("Usage: play_bot_match.py <bot1_num> <bot2_num> <move1> <move2>")
        sys.exit(1)

    bot1_num = int(sys.argv[1])
    bot2_num = int(sys.argv[2])
    move1 = int(sys.argv[3])  # Bot1's move each round
    move2 = int(sys.argv[4])  # Bot2's move each round

    w3 = get_w3()

    # Load bot accounts
    pk1 = os.getenv(f'OPPONENT_{bot1_num}_PRIVATE_KEY', '')
    pk2 = os.getenv(f'OPPONENT_{bot2_num}_PRIVATE_KEY', '')
    acc1 = w3.eth.account.from_key(pk1)
    acc2 = w3.eth.account.from_key(pk2)
    print(f"Bot{bot1_num}: {acc1.address[:12]}... ({MOVE_NAMES[move1]})")
    print(f"Bot{bot2_num}: {acc2.address[:12]}... ({MOVE_NAMES[move2]})")

    def send(account, func, value=0):
        for retry in range(3):
            try:
                tx = func.build_transaction({
                    'from': account.address, 'value': value,
                    'nonce': w3.eth.get_transaction_count(account.address),
                    'chainId': MONAD_CHAIN_ID, 'gas': 1500000,
                })
                signed = account.sign_transaction(tx)
                tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
                r = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
                if r['status'] == 0:
                    # Try to get revert reason
                    try:
                        w3.eth.call(tx, block_identifier=r['blockNumber'])
                    except Exception as call_err:
                        raise Exception(f"Reverted: {str(call_err)[:200]}")
                    raise Exception(f"Reverted: {tx_hash.hex()}")
                return r
            except Exception as e:
                err = str(e)
                if "429" in err or "Too Many" in err or "higher priority" in err:
                    time.sleep(3)
                    continue
                raise

    wager = int(0.001 * 10**18)

    # 1. Create match
    receipt = send(acc1, get_escrow().functions.createMatch(acc2.address, RPS_GAME_ADDRESS), wager)
    match_id = parse_match_id_from_receipt(receipt)
    print(f"Match {match_id} created")
    time.sleep(2)

    # 2. Accept
    receipt = send(acc2, get_escrow().functions.acceptMatch(match_id), wager)
    print(f"Accepted")
    time.sleep(2)

    # 3. Create game (3 rounds)
    receipt = send(acc1, get_rps_game().functions.createGame(match_id, 3))
    game_id = parse_game_id_from_receipt(receipt)
    print(f"Game {game_id} created")
    time.sleep(2)

    # 4. Play rounds
    for attempt in range(30):
        game = get_game(game_id)
        if game['settled'] or game['phase'] == 2:
            break

        rnd = game['currentRound']
        phase = game['phase']

        if phase == 0:  # Commit
            rd = get_round(game_id, rnd)
            salt1 = secrets.token_bytes(32)
            salt2 = secrets.token_bytes(32)

            if rd['p1Commit'] == bytes(32):
                h1 = make_commit_hash(move1, salt1)
                send(acc1, get_rps_game().functions.commit(game_id, h1))
                time.sleep(1)

            if rd['p2Commit'] == bytes(32):
                h2 = make_commit_hash(move2, salt2)
                send(acc2, get_rps_game().functions.commit(game_id, h2))
                time.sleep(1)

            print(f"  Round {rnd+1}: Committed")

        elif phase == 1:  # Reveal
            rd = get_round(game_id, rnd)
            if not rd['p1Revealed']:
                send(acc1, get_rps_game().functions.reveal(game_id, move1, salt1))
                time.sleep(1)
            # Re-check — first reveal may trigger settlement if both were pending
            game = get_game(game_id)
            if game['settled'] or game['phase'] == 2:
                print(f"  Round {rnd+1}: Game settled after first reveal")
                break
            rd = get_round(game_id, rnd)
            if not rd['p2Revealed']:
                send(acc2, get_rps_game().functions.reveal(game_id, move2, salt2))
                time.sleep(1)
            print(f"  Round {rnd+1}: Revealed ({MOVE_NAMES[move1]} vs {MOVE_NAMES[move2]})")

        time.sleep(2)

    # 5. Check result
    game = get_game(game_id)
    print(f"\nResult: {game['p1Score']}-{game['p2Score']} (settled={game['settled']})")

    winner = get_escrow().functions.winners(match_id).call()
    print(f"Winner: {winner[:12]}...")
    print(f"Match ID: {match_id}")

if __name__ == "__main__":
    main()
