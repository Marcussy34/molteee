import { useState, useEffect } from "react";
import { formatEther } from "viem";
import { publicClient, ADDRESSES, GameType } from "@/lib/contracts";
import { agentRegistryAbi } from "@/lib/abi/AgentRegistry";

interface AgentData {
  balance: string | null;
  elo: Record<number, number>;
  matchCount: number;
  isRegistered: boolean;
  isOpen: boolean;
  loading: boolean;
}

const DEFAULTS: AgentData = {
  balance: null,
  elo: {},
  matchCount: 0,
  isRegistered: false,
  isOpen: false,
  loading: false,
};

// Accepts optional address — returns defaults when no wallet is connected
export function useAgentData(address?: string): AgentData {
  const [data, setData] = useState<AgentData>({ ...DEFAULTS, loading: !!address });

  useEffect(() => {
    // No address = no data to fetch
    if (!address) {
      setData(DEFAULTS);
      return;
    }

    let cancelled = false;
    setData((prev) => ({ ...prev, loading: true }));

    async function fetchData() {
      try {
        const addr = address as `0x${string}`;

        // Fetch balance + agent info + ELO for each game type + match count in parallel
        const [balance, agent, eloRps, eloPoker, eloAuction, matchCount] =
          await Promise.all([
            publicClient.getBalance({ address: addr }),
            publicClient.readContract({
              address: ADDRESSES.agentRegistry,
              abi: agentRegistryAbi,
              functionName: "getAgent",
              args: [addr],
            }),
            publicClient.readContract({
              address: ADDRESSES.agentRegistry,
              abi: agentRegistryAbi,
              functionName: "elo",
              args: [addr, GameType.RPS],
            }),
            publicClient.readContract({
              address: ADDRESSES.agentRegistry,
              abi: agentRegistryAbi,
              functionName: "elo",
              args: [addr, GameType.Poker],
            }),
            publicClient.readContract({
              address: ADDRESSES.agentRegistry,
              abi: agentRegistryAbi,
              functionName: "elo",
              args: [addr, GameType.Auction],
            }),
            publicClient.readContract({
              address: ADDRESSES.agentRegistry,
              abi: agentRegistryAbi,
              functionName: "getMatchCount",
              args: [addr],
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
        // Contract reverts with "agent not found" for unregistered wallets — expected
        const msg = (err as Error)?.message || "";
        if (msg.includes("agent not found")) {
          if (!cancelled) {
            // Still fetch balance even if not registered
            try {
              const balance = await publicClient.getBalance({ address: address as `0x${string}` });
              setData({ ...DEFAULTS, balance: parseFloat(formatEther(balance)).toFixed(4), loading: false });
            } catch {
              setData({ ...DEFAULTS, loading: false });
            }
          }
          return;
        }
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
  }, [address]);

  return data;
}
