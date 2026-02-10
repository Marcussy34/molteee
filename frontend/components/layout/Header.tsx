import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      <h2 className="text-lg font-semibold">Fighter Dashboard</h2>

      {/* RainbowKit handles connect/disconnect, balance display, and chain switching */}
      <ConnectButton />
    </header>
  );
}
