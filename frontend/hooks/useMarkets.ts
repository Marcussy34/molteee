import { useState, useEffect } from "react";
import { formatEther } from "viem";
import { publicClient, ADDRESSES } from "@/lib/contracts";
import { predictionMarketAbi } from "@/lib/abi/PredictionMarket";

export interface MarketData {
  id: number;
  matchId: number;
  player1: string;
  player2: string;
  reserveYES: string;
  reserveNO: string;
  seedLiquidity: string;
  resolved: boolean;
  winner: string;
  yesPrice: number;
  noPrice: number;
}

interface MarketsResult {
  markets: MarketData[];
  loading: boolean;
}

export function useMarkets(): MarketsResult {
  const [data, setData] = useState<MarketsResult>({
    markets: [],
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        // Get total number of markets
        const nextId = await publicClient.readContract({
          address: ADDRESSES.predictionMarket,
          abi: predictionMarketAbi,
          functionName: "nextMarketId",
        });

        const count = Number(nextId);
        if (count <= 1) {
          // Markets start at id 1, nextMarketId=1 means none exist
          if (!cancelled) setData({ markets: [], loading: false });
          return;
        }

        // Fetch all markets + prices in parallel
        const promises = [];
        for (let i = 1; i < count; i++) {
          promises.push(
            Promise.all([
              publicClient.readContract({
                address: ADDRESSES.predictionMarket,
                abi: predictionMarketAbi,
                functionName: "getMarket",
                args: [BigInt(i)],
              }),
              publicClient.readContract({
                address: ADDRESSES.predictionMarket,
                abi: predictionMarketAbi,
                functionName: "getPrice",
                args: [BigInt(i)],
              }),
            ]).then(([market, price]) => ({ id: i, market, price }))
          );
        }

        const results = await Promise.all(promises);
        if (cancelled) return;

        const markets: MarketData[] = results.map(({ id, market, price }) => {
          const m = market as {
            matchId: bigint;
            reserveYES: bigint;
            reserveNO: bigint;
            seedLiquidity: bigint;
            player1: string;
            player2: string;
            resolved: boolean;
            winner: string;
          };
          const p = price as readonly [bigint, bigint];

          // Prices are scaled to 1e18 (e.g. 0.8e18 = 80%), divide by 1e16 for percentage
          return {
            id,
            matchId: Number(m.matchId),
            player1: m.player1,
            player2: m.player2,
            reserveYES: formatEther(m.reserveYES),
            reserveNO: formatEther(m.reserveNO),
            seedLiquidity: formatEther(m.seedLiquidity),
            resolved: m.resolved,
            winner: m.winner,
            yesPrice: Number(p[0]) / 1e16,
            noPrice: Number(p[1]) / 1e16,
          };
        });

        setData({ markets, loading: false });
      } catch (err) {
        console.error("Failed to fetch markets:", err);
        if (!cancelled) setData((prev) => ({ ...prev, loading: false }));
      }
    }

    fetchData();
    // Poll every 10s for near-real-time market price updates
    const interval = setInterval(fetchData, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return data;
}
