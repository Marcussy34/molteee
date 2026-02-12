// Commit-reveal hash generation and salt management.
// Handles salt storage so agents never deal with raw cryptography.
import { keccak256, encodePacked, type Hex } from "viem";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

// Salt storage directory
const SALT_DIR = path.join(os.homedir(), ".arena-tools");
const SALT_FILE = path.join(SALT_DIR, "salts.json");

type SaltStore = Record<string, { salt: Hex; value: string; gameType: string }>;

// ─── Salt Management ─────────────────────────────────────────────────────────

/** Generate a cryptographically secure 32-byte salt */
export function generateSalt(): Hex {
  return `0x${crypto.randomBytes(32).toString("hex")}` as Hex;
}

/** Save a salt for later reveal */
export function saveSalt(
  key: string,
  salt: Hex,
  value: string,
  gameType: string
): void {
  if (!fs.existsSync(SALT_DIR)) {
    fs.mkdirSync(SALT_DIR, { recursive: true });
  }
  let store: SaltStore = {};
  if (fs.existsSync(SALT_FILE)) {
    store = JSON.parse(fs.readFileSync(SALT_FILE, "utf-8"));
  }
  store[key] = { salt, value, gameType };
  fs.writeFileSync(SALT_FILE, JSON.stringify(store, null, 2));
}

/** Load a saved salt and remove it from storage */
export function loadSalt(
  key: string
): { salt: Hex; value: string; gameType: string } | null {
  if (!fs.existsSync(SALT_FILE)) return null;
  const store: SaltStore = JSON.parse(fs.readFileSync(SALT_FILE, "utf-8"));
  const entry = store[key];
  if (!entry) return null;
  // Remove after loading (single-use)
  delete store[key];
  fs.writeFileSync(SALT_FILE, JSON.stringify(store, null, 2));
  return entry;
}

// ─── Hash Generation ─────────────────────────────────────────────────────────

/**
 * Generate commit hash for RPS moves or Poker hands.
 * Matches Solidity: keccak256(abi.encodePacked(uint8(value), bytes32(salt)))
 */
export function commitHash(value: number, salt: Hex): Hex {
  return keccak256(encodePacked(["uint8", "bytes32"], [value, salt]));
}

/**
 * Generate commit hash for Auction bids.
 * Matches Solidity: keccak256(abi.encodePacked(uint256(bid), bytes32(salt)))
 */
export function commitBidHash(bid: bigint, salt: Hex): Hex {
  return keccak256(encodePacked(["uint256", "bytes32"], [bid, salt]));
}
