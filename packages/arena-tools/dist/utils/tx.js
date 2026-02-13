import { getPublicClient, getWalletClient } from "../client.js";
// IMPORTANT: Monad charges for the FULL gas limit, not just gas used.
// A hardcoded 1M limit costs ~0.102 MON per tx even for simple actions (~170k actual).
// Always estimate gas to avoid 5-6x overpay. Fallback to 1M only if estimation fails.
// Set ARENA_SKIP_ESTIMATE=1 to use fixed gas limit (NOT recommended).
const FALLBACK_GAS = 1000000n;
const SHOULD_SKIP_ESTIMATE = !!process.env.ARENA_SKIP_ESTIMATE;
// Max retries for 429 rate limit errors at the sendTx level
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;
/** Check if an error is a 429 rate limit error */
function isRateLimited(err) {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes("429") || msg.includes("Too Many Requests") || msg.includes("compute units");
}
/** Sleep for ms milliseconds */
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
/**
 * Send a write transaction with automatic retry on 429 rate limits.
 * Always estimates gas to avoid overpaying (Monad charges full gas limit).
 * Falls back to 1M gas limit only if estimation fails or ARENA_SKIP_ESTIMATE=1.
 * Returns the transaction hash, gas used, and receipt logs.
 */
export async function sendTx(params) {
    const publicClient = getPublicClient();
    const walletClient = getWalletClient();
    const account = walletClient.account;
    let lastError;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            // Gas: always estimate to avoid overpay. Fallback to 1M on failure.
            let gas = FALLBACK_GAS;
            if (!SHOULD_SKIP_ESTIMATE) {
                try {
                    const gasEstimate = await publicClient.estimateGas({
                        account: account.address,
                        to: params.to,
                        data: params.data,
                        value: params.value ?? 0n,
                    });
                    // 1.5x buffer — Monad needs more headroom than Ethereum
                    gas = (gasEstimate * 3n) / 2n;
                }
                catch {
                    // Estimation failed (e.g. rate limited) — use fallback
                    gas = FALLBACK_GAS;
                }
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
        }
        catch (err) {
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
//# sourceMappingURL=tx.js.map