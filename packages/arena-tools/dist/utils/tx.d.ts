/**
 * Send a write transaction with automatic retry on 429 rate limits.
 * By default uses a fixed gas limit (300k) to skip estimateGas and save an RPC call.
 * Set ARENA_ESTIMATE_GAS=1 to use dynamic gas estimation instead.
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
