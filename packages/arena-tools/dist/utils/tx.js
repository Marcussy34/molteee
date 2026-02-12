import { getPublicClient, getWalletClient } from "../client.js";
/**
 * Send a write transaction with gas estimation.
 * Returns the transaction hash, gas used, and receipt logs.
 */
export async function sendTx(params) {
    const publicClient = getPublicClient();
    const walletClient = getWalletClient();
    const account = walletClient.account;
    // Estimate gas with 1.5x buffer (Monad needs more than Ethereum)
    const gasEstimate = await publicClient.estimateGas({
        account: account.address,
        to: params.to,
        data: params.data,
        value: params.value ?? 0n,
    });
    const gas = (gasEstimate * 3n) / 2n;
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
//# sourceMappingURL=tx.js.map