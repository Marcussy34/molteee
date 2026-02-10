import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { QueryClient } from "@tanstack/react-query";
import { monadTestnet } from "./contracts";

// Wagmi + RainbowKit config for wallet connection
export const config = getDefaultConfig({
  appName: "Molteee Arena",
  // WalletConnect project ID — public demo ID for dev
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_ID || "",
  chains: [monadTestnet],
  ssr: true,
});

// Shared react-query client
export const queryClient = new QueryClient();
