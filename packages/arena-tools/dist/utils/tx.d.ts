/**
 * Send a write transaction with gas estimation.
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
