// arena-tools market commands — create-market, list-markets, bet, resolve-market, redeem
import { encodeFunctionData, parseEther, formatEther } from "viem";
import { CONTRACTS } from "../config.js";
import { predictionMarketAbi } from "../contracts.js";
import { getPublicClient } from "../client.js";
import { sendTx } from "../utils/tx.js";
import { ok, fail } from "../utils/output.js";

/** List all prediction markets with prices and state */
export async function listMarketsCommand() {
  const client = getPublicClient();

  // Get the next market ID to know how many exist
  const nextId = (await client.readContract({
    address: CONTRACTS.PredictionMarket as `0x${string}`,
    abi: predictionMarketAbi,
    functionName: "nextMarketId",
  })) as bigint;

  // Fetch each market's data and prices
  const markets = [];
  for (let i = 1n; i < nextId; i++) {
    const [market, prices] = await Promise.all([
      client.readContract({
        address: CONTRACTS.PredictionMarket as `0x${string}`,
        abi: predictionMarketAbi,
        functionName: "getMarket",
        args: [i],
      }),
      client.readContract({
        address: CONTRACTS.PredictionMarket as `0x${string}`,
        abi: predictionMarketAbi,
        functionName: "getPrice",
        args: [i],
      }),
    ]);

    const [yesPrice, noPrice] = prices as readonly [bigint, bigint];
    markets.push({
      id: Number(i),
      matchId: Number(market.matchId),
      player1: market.player1,
      player2: market.player2,
      resolved: market.resolved,
      winner: market.winner,
      reserveYES: formatEther(market.reserveYES as bigint),
      reserveNO: formatEther(market.reserveNO as bigint),
      seedLiquidity: formatEther(market.seedLiquidity as bigint),
      yesPriceRaw: yesPrice.toString(),
      noPriceRaw: noPrice.toString(),
    });
  }

  ok({ count: markets.length, markets });
}

/** Create a prediction market for a match */
export async function createMarketCommand(matchId: string, seed: string) {
  const seedWei = parseEther(seed);

  const data = encodeFunctionData({
    abi: predictionMarketAbi,
    functionName: "createMarket",
    args: [BigInt(matchId)],
  });

  const { hash } = await sendTx({
    to: CONTRACTS.PredictionMarket as `0x${string}`,
    data,
    value: seedWei,
  });

  ok({
    action: "create-market",
    matchId: parseInt(matchId),
    seed,
    txHash: hash,
  });
}

/** Buy YES or NO tokens */
export async function betCommand(
  marketId: string,
  side: string,
  amount: string
) {
  const sideLower = side.toLowerCase();
  if (sideLower !== "yes" && sideLower !== "no") {
    fail(`Invalid side: ${side}. Must be yes or no.`, "INVALID_SIDE");
  }

  const amountWei = parseEther(amount);
  const functionName = sideLower === "yes" ? "buyYES" : "buyNO";

  const data = encodeFunctionData({
    abi: predictionMarketAbi,
    functionName,
    args: [BigInt(marketId)],
  });

  const { hash } = await sendTx({
    to: CONTRACTS.PredictionMarket as `0x${string}`,
    data,
    value: amountWei,
  });

  ok({
    action: "bet",
    marketId: parseInt(marketId),
    side: sideLower,
    amount,
    txHash: hash,
  });
}

/** Resolve a prediction market */
export async function resolveMarketCommand(marketId: string) {
  const data = encodeFunctionData({
    abi: predictionMarketAbi,
    functionName: "resolve",
    args: [BigInt(marketId)],
  });

  const { hash } = await sendTx({
    to: CONTRACTS.PredictionMarket as `0x${string}`,
    data,
  });

  ok({
    action: "resolve-market",
    marketId: parseInt(marketId),
    txHash: hash,
  });
}

/** Redeem winning tokens */
export async function redeemCommand(marketId: string) {
  const data = encodeFunctionData({
    abi: predictionMarketAbi,
    functionName: "redeem",
    args: [BigInt(marketId)],
  });

  const { hash } = await sendTx({
    to: CONTRACTS.PredictionMarket as `0x${string}`,
    data,
  });

  ok({
    action: "redeem",
    marketId: parseInt(marketId),
    txHash: hash,
  });
}
