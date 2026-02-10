import { type Hex } from "viem";
/**
 * Send a write transaction with gas estimation.
 * Returns the transaction hash and receipt.
 */
export declare function sendTx(params: {
    to: `0x${string}`;
    data: Hex;
    value?: bigint;
}): Promise<{
    hash: Hex;
    gasUsed: bigint;
}>;
//# sourceMappingURL=tx.d.ts.map