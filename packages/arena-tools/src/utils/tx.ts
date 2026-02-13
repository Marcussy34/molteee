import { getPublicClient, getWalletClient } from "../client.js";

// Default gas limit — skips estimateGas to save 1 RPC call per transaction.
// 300k covers all arena contracts (commits ~70k, creates ~150k, reveals ~120k).
// If estimation is needed, set ARENA_ESTIMATE_GAS=1 in env.
const DEFAULT_GAS = 300_000n;
const SHOULD_ESTIMATE = !!process.env.ARENA_ESTIMATE_GAS;

// Max retries for 429 rate limit errors at the sendTx level
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

/** Check if an error is a 429 rate limit error */
function isRateLimited(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes("429") || msg.includes("Too Many Requests") || msg.includes("compute units");
}

/** Sleep for ms milliseconds */
function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

/**
 * Send a write transaction with automatic retry on 429 rate limits.
 * By default uses a fixed gas limit (300k) to skip estimateGas and save an RPC call.
 * Set ARENA_ESTIMATE_GAS=1 to use dynamic gas estimation instead.
 * Returns the transaction hash, gas used, and receipt logs.
 */
export async function sendTx(params: { to: `0x${string}`; data: `0x${string}`; value?: bigint }) {
    const publicClient = getPublicClient();
    const walletClient = getWalletClient();
    const account = walletClient.account;

    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            // Gas: use fixed default or estimate dynamically
            let gas = DEFAULT_GAS;
            if (SHOULD_ESTIMATE) {
                const gasEstimate = await publicClient.estimateGas({
                    account: account.address,
                    to: params.to,
                    data: params.data,
                    value: params.value ?? 0n,
                });
                // 1.5x buffer — Monad needs more headroom than Ethereum
                gas = (gasEstimate * 3n) / 2n;
            }

            // Send transaction
            const hash = await walletClient.sendTransaction({
                to: params.to,
                data: params.data,
                value: params.value ?? 0n,
                gas,
            });

            // Wait for confirmation
            const receipt = await publicClient.waitForTransactionReceipt({
                hash,
                timeout: 60_000,
            });

            if (receipt.status === "reverted") {
                throw new Error(`Transaction reverted: ${hash}`);
            }

            return { hash, gasUsed: receipt.gasUsed, logs: receipt.logs };
        } catch (err) {
            lastError = err;
            // Only retry on rate limit errors, not reverts or other failures
            if (isRateLimited(err) && attempt < MAX_RETRIES) {
                // Exponential backoff: 2s, 4s, 8s
                const delay = BASE_DELAY_MS * Math.pow(2, attempt);
                process.stderr.write(`[arena-tools] Rate limited (429), retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})...\n`);
                await sleep(delay);
                continue;
            }
            throw err;
        }
    }

    // Should not reach here, but just in case
    throw lastError;
}
