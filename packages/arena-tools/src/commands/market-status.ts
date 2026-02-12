// arena-tools market-status — prediction market prices and state
import { formatEther } from "viem";
import { getPublicClient } from "../client.js";
import { CONTRACTS } from "../config.js";
import { predictionMarketAbi } from "../contracts.js";
import { ok } from "../utils/output.js";

export async function marketStatusCommand(marketId: string) {
    const client = getPublicClient();
    const id = BigInt(marketId);

    const [market, prices] = (await Promise.all([
        client.readContract({
            address: CONTRACTS.PredictionMarket,
            abi: predictionMarketAbi,
            functionName: "getMarket",
            args: [id],
        }),
        client.readContract({
            address: CONTRACTS.PredictionMarket,
            abi: predictionMarketAbi,
            functionName: "getPrice",
            args: [id],
        }),
    ])) as any;

    ok({
        marketId: Number(id),
        matchId: Number(market.matchId),
        player1: market.player1,
        player2: market.player2,
        resolved: market.resolved,
        winner: market.winner,
        reserveYES: formatEther(market.reserveYES),
        reserveNO: formatEther(market.reserveNO),
        seedLiquidity: formatEther(market.seedLiquidity),
        // Prices are in 1e18 basis (1.0 = 100%)
        yesPriceRaw: prices[0].toString(),
        noPriceRaw: prices[1].toString(),
    });
}
