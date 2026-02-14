import "@/styles/globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { config, queryClient } from "@/lib/wagmi";
import { ArcadeNav } from "@/components/layout/ArcadeNav";
import { GlitchTransition } from "@/components/ui/GlitchTransition";
import { SoundToggle } from "@/components/ui/SoundToggle";

function MaybeRainbowKit({ children }: { children: React.ReactNode }) {
  // Always render RainbowKitProvider — hooks require the context even without WalletConnect
  return (
    <RainbowKitProvider theme={darkTheme()}>{children}</RainbowKitProvider>
  );
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // Home page (/) has its own full-screen layout without the top nav
  const isHome = router.pathname === "/";

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <MaybeRainbowKit>
          <GlitchTransition />
          {!isHome && <ArcadeNav />}
          <SoundToggle />
          <Component {...pageProps} />
        </MaybeRainbowKit>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
