import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { createConfig, http } from "wagmi";
import { QueryClient } from "@tanstack/react-query";
import { monadChain } from "./contracts";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_ID || "";

// Use RainbowKit's full config when projectId is available,
// otherwise fall back to a basic wagmi config for local dev / build.
export const config = projectId
  ? getDefaultConfig({
      appName: "Molteee Arena",
      projectId,
      chains: [monadChain],
      ssr: true,
    })
  : createConfig({
      chains: [monadChain],
      transports: { [monadChain.id]: http() },
      ssr: true,
    });

// Shared react-query client
export const queryClient = new QueryClient();
