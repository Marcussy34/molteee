import { useState, useEffect } from "react";
import { formatEther } from "viem";
import { publicClient, ADDRESSES } from "@/lib/contracts";
import { agentRegistryAbi } from "@/lib/abi/AgentRegistry";

interface RegistrationStatus {
  isRegistered: boolean;
  gameTypes: number[];
  minWager: string;
  maxWager: string;
  isOpen: boolean;
  isLoading: boolean;
}

const DEFAULTS: RegistrationStatus = {
  isRegistered: false,
  gameTypes: [],
  minWager: "0",
  maxWager: "0",
  isOpen: false,
  isLoading: false,
};

// Checks if a wallet address is registered in the AgentRegistry
export function useRegistrationStatus(address?: string): RegistrationStatus {
  const [data, setData] = useState<RegistrationStatus>({
    ...DEFAULTS,
    isLoading: !!address,
  });

  useEffect(() => {
    if (!address) {
      setData(DEFAULTS);
      return;
    }

    let cancelled = false;
    setData((prev) => ({ ...prev, isLoading: true }));

    async function fetchData() {
      try {
        const agent = await publicClient.readContract({
          address: ADDRESSES.agentRegistry,
          abi: agentRegistryAbi,
          functionName: "getAgent",
          args: [address as `0x${string}`],
        });

        if (cancelled) return;

        setData({
          isRegistered: agent.exists,
          gameTypes: (agent.gameTypes as number[]) || [],
          minWager: formatEther(agent.minWager as bigint),
          maxWager: formatEther(agent.maxWager as bigint),
          isOpen: agent.isOpen,
          isLoading: false,
        });
      } catch (err) {
        // Contract reverts with "agent not found" for unregistered wallets — this is expected
        const msg = (err as Error)?.message || "";
        if (msg.includes("agent not found")) {
          if (!cancelled) setData({ ...DEFAULTS, isLoading: false });
          return;
        }
        console.error("Failed to check registration:", err);
        if (!cancelled) setData((prev) => ({ ...prev, isLoading: false }));
      }
    }

    fetchData();
    // Poll less frequently — registration status rarely changes
    const interval = setInterval(fetchData, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [address]);

  return data;
}
