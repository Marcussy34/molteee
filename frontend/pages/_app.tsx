import "@/styles/globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { config, queryClient } from "@/lib/wagmi";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ArcadeNav } from "@/components/layout/ArcadeNav";
import { GlitchTransition } from "@/components/ui/GlitchTransition";
import { SoundToggle } from "@/components/ui/SoundToggle";

// RainbowKit requires WalletConnect projectId — skip it if not configured
const hasWalletConnect = !!process.env.NEXT_PUBLIC_WALLETCONNECT_ID;

function MaybeRainbowKit({ children }: { children: React.ReactNode }) {
  // Always render RainbowKitProvider — hooks require the context even without WalletConnect
  return (
    <RainbowKitProvider theme={darkTheme()}>{children}</RainbowKitProvider>
  );
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // Arcade pages render full-screen without the dashboard sidebar
  // Arcade pages render full-screen without the dashboard sidebar
  const arcadePages = ["/", "/arena", "/poker", "/auction", "/leaderboard", "/matches", "/markets", "/bot", "/about"];
  const isArcade =
    arcadePages.includes(router.pathname) ||
    router.pathname.startsWith("/agents/") ||
    router.pathname.startsWith("/matches/");

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <MaybeRainbowKit>
          <GlitchTransition />
          {isArcade && router.pathname !== "/" && <ArcadeNav />}
          {isArcade && <SoundToggle />}
          {isArcade ? (
            <Component {...pageProps} />
          ) : (
            <DashboardLayout>
              <Component {...pageProps} />
            </DashboardLayout>
          )}
        </MaybeRainbowKit>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
