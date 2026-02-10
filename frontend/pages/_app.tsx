import "@/styles/globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { config, queryClient } from "@/lib/wagmi";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // Landing page (/) renders its own full-width layout — no sidebar
  const isLanding = router.pathname === "/";

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          {isLanding ? (
            <Component {...pageProps} />
          ) : (
            <DashboardLayout>
              <Component {...pageProps} />
            </DashboardLayout>
          )}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
