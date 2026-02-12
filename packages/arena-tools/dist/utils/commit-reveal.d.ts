/** Generate a cryptographically secure 32-byte salt */
export declare function generateSalt(): `0x${string}`;
/** Save a salt for later reveal */
export declare function saveSalt(key: string, salt: string, value: string, gameType: string): void;
/** Load a saved salt and remove it from storage */
export declare function loadSalt(key: string): {
    salt: `0x${string}`;
    value: string;
    gameType: string;
} | null;
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
