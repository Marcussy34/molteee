// Commit-reveal hash generation and salt management.
// Handles salt storage so agents never deal with raw cryptography.
import { keccak256, encodePacked } from "viem";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
// Salt storage directory
const SALT_DIR = path.join(os.homedir(), ".arena-tools");
const SALT_FILE = path.join(SALT_DIR, "salts.json");
// ─── Salt Management ─────────────────────────────────────────────────────────
/** Generate a cryptographically secure 32-byte salt */
export function generateSalt() {
    return `0x${crypto.randomBytes(32).toString("hex")}`;
}
/** Save a salt for later reveal.
 *  Uses per-key files to avoid race conditions when multiple agents share the same machine. */
export function saveSalt(key, salt, value, gameType) {
    if (!fs.existsSync(SALT_DIR)) {
        fs.mkdirSync(SALT_DIR, { recursive: true });
    }
    // Write to per-key file (avoids read-modify-write race on shared salts.json)
    const keyFile = path.join(SALT_DIR, `salt-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
    fs.writeFileSync(keyFile, JSON.stringify({ salt, value, gameType }));
    // Also write to shared file for backwards compat
    let store = {};
    if (fs.existsSync(SALT_FILE)) {
        try {
            store = JSON.parse(fs.readFileSync(SALT_FILE, "utf-8"));
        }
        catch {
            store = {};
        }
    }
    store[key] = { salt, value, gameType };
    fs.writeFileSync(SALT_FILE, JSON.stringify(store, null, 2));
}
/** Load a saved salt and remove it from storage */
export function loadSalt(key) {
    // Try per-key file first (race-safe)
    const keyFile = path.join(SALT_DIR, `salt-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
    if (fs.existsSync(keyFile)) {
        const entry = JSON.parse(fs.readFileSync(keyFile, "utf-8"));
        fs.unlinkSync(keyFile); // single-use
        return entry;
    }
    // Fall back to shared salts.json
    if (!fs.existsSync(SALT_FILE))
        return null;
    let store;
    try {
        store = JSON.parse(fs.readFileSync(SALT_FILE, "utf-8"));
    }
    catch {
        return null;
    }
    const entry = store[key];
    if (!entry)
        return null;
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
export function commitHash(value, salt) {
    return keccak256(encodePacked(["uint8", "bytes32"], [value, salt]));
}
/**
 * Generate commit hash for Auction bids.
 * Matches Solidity: keccak256(abi.encodePacked(uint256(bid), bytes32(salt)))
 */
export function commitBidHash(bid, salt) {
    return keccak256(encodePacked(["uint256", "bytes32"], [bid, salt]));
}
//# sourceMappingURL=commit-reveal.js.map