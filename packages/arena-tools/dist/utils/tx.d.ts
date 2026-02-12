import { type Hex, type Log } from "viem";
/**
 * Send a write transaction with gas estimation.
 * Returns the transaction hash, gas used, and receipt logs.
 */
export declare function sendTx(params: {
    to: `0x${string}`;
    data: Hex;
    value?: bigint;
}): Promise<{
    hash: Hex;
    gasUsed: bigint;
    logs: Log[];
}>;
//# sourceMappingURL=tx.d.ts.map