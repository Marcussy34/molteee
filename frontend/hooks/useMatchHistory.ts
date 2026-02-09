import { useState, useEffect } from "react";
import { formatEther } from "viem";
import { publicClient, ADDRESSES, FIGHTER_ADDRESS } from "@/lib/contracts";
import { agentRegistryAbi } from "@/lib/abi/AgentRegistry";

export interface MatchRecord {
  opponent: string;
  gameType: number;
  won: boolean;
  wager: string;
  wagerRaw: bigint;
  timestamp: number;
}

interface MatchHistoryData {
  matches: MatchRecord[];
  loading: boolean;
}

export function useMatchHistory(): MatchHistoryData {
  const [data, setData] = useState<MatchHistoryData>({
    matches: [],
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const raw = await publicClient.readContract({
          address: ADDRESSES.agentRegistry,
          abi: agentRegistryAbi,
          functionName: "getMatchHistory",
          args: [FIGHTER_ADDRESS],
        });

        if (cancelled) return;

        // Map raw on-chain data to typed records
        const matches: MatchRecord[] = (raw as readonly {
          opponent: string;
          gameType: number;
          won: boolean;
          wager: bigint;
          timestamp: bigint;
        }[]).map((m) => ({
          opponent: m.opponent,
          gameType: Number(m.gameType),
          won: m.won,
          wager: parseFloat(formatEther(m.wager)).toFixed(4),
          wagerRaw: m.wager,
          timestamp: Number(m.timestamp),
        }));

        setData({ matches, loading: false });
      } catch (err) {
        console.error("Failed to fetch match history:", err);
        if (!cancelled) setData((prev) => ({ ...prev, loading: false }));
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return data;
}
