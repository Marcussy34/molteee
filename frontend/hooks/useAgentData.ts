import { useState, useEffect } from "react";
import { formatEther } from "viem";
import { publicClient, ADDRESSES, FIGHTER_ADDRESS, GameType } from "@/lib/contracts";
import { agentRegistryAbi } from "@/lib/abi/AgentRegistry";

interface AgentData {
  balance: string | null;
  elo: Record<number, number>;
  matchCount: number;
  isRegistered: boolean;
  isOpen: boolean;
  loading: boolean;
}

export function useAgentData(): AgentData {
  const [data, setData] = useState<AgentData>({
    balance: null,
    elo: {},
    matchCount: 0,
    isRegistered: false,
    isOpen: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        // Fetch balance + agent info + ELO for each game type + match count in parallel
        const [balance, agent, eloRps, eloPoker, eloAuction, matchCount] =
          await Promise.all([
            publicClient.getBalance({ address: FIGHTER_ADDRESS }),
            publicClient.readContract({
              address: ADDRESSES.agentRegistry,
              abi: agentRegistryAbi,
              functionName: "getAgent",
              args: [FIGHTER_ADDRESS],
            }),
            publicClient.readContract({
              address: ADDRESSES.agentRegistry,
              abi: agentRegistryAbi,
              functionName: "elo",
              args: [FIGHTER_ADDRESS, GameType.RPS],
            }),
            publicClient.readContract({
              address: ADDRESSES.agentRegistry,
              abi: agentRegistryAbi,
              functionName: "elo",
              args: [FIGHTER_ADDRESS, GameType.Poker],
            }),
            publicClient.readContract({
              address: ADDRESSES.agentRegistry,
              abi: agentRegistryAbi,
              functionName: "elo",
              args: [FIGHTER_ADDRESS, GameType.Auction],
            }),
            publicClient.readContract({
              address: ADDRESSES.agentRegistry,
              abi: agentRegistryAbi,
              functionName: "getMatchCount",
              args: [FIGHTER_ADDRESS],
            }),
          ]);

        if (cancelled) return;

        setData({
          balance: parseFloat(formatEther(balance)).toFixed(4),
          elo: {
            [GameType.RPS]: Number(eloRps),
            [GameType.Poker]: Number(eloPoker),
            [GameType.Auction]: Number(eloAuction),
          },
          matchCount: Number(matchCount),
          isRegistered: agent.exists,
          isOpen: agent.isOpen,
          loading: false,
        });
      } catch (err) {
        console.error("Failed to fetch agent data:", err);
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
