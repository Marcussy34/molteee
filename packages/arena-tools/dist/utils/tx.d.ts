/**
 * Send a write transaction with automatic retry on 429 rate limits.
 * Always estimates gas to avoid overpaying (Monad charges full gas limit).
 * Falls back to 1M gas limit only if estimation fails or ARENA_SKIP_ESTIMATE=1.
 * Returns the transaction hash, gas used, and receipt logs.
 */
export declare function sendTx(params: {
    to: `0x${string}`;
    data: `0x${string}`;
    value?: bigint;
}): Promise<{
    hash: any;
    gasUsed: any;
    logs: any;
}>;
