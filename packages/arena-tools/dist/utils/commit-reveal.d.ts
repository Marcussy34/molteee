/** Generate a cryptographically secure 32-byte salt */
export declare function generateSalt(): `0x${string}`;
/** Save a salt for later reveal.
 *  Uses per-key files to avoid race conditions when multiple agents share the same machine. */
export declare function saveSalt(key: string, salt: string, value: string, gameType: string): void;
/** Load a saved salt WITHOUT deleting it.
 *  Salt persists until explicitly deleted via deleteSalt() after a successful reveal TX.
 *  This prevents salt loss when reveal transactions fail (e.g. insufficient gas). */
export declare function loadSalt(key: string): {
    salt: `0x${string}`;
    value: string;
    gameType: string;
} | null;
/** Delete a salt after successful reveal TX. Call this ONLY after the on-chain reveal succeeds. */
export declare function deleteSalt(key: string): void;
/**
 * Generate commit hash for RPS moves or Poker hands.
 * Matches Solidity: keccak256(abi.encodePacked(uint8(value), bytes32(salt)))
 */
export declare function commitHash(value: number, salt: `0x${string}`): `0x${string}`;
/**
 * Generate commit hash for Auction bids.
 * Matches Solidity: keccak256(abi.encodePacked(uint256(bid), bytes32(salt)))
 */
export declare function commitBidHash(bid: bigint, salt: `0x${string}`): `0x${string}`;
