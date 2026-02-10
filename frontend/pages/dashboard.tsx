import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Wallet, Swords, Trophy, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentMatches } from "@/components/dashboard/RecentMatches";
import { EloChart } from "@/components/dashboard/EloChart";
import { useAgentData } from "@/hooks/useAgentData";
import { useMatchHistory } from "@/hooks/useMatchHistory";
import { useRegistrationStatus } from "@/hooks/useRegistrationStatus";

// Banner shown when connected but agent is not registered on-chain
function RegistrationBanner() {
  return (
    <div className="rounded-lg border border-chart-2/30 bg-chart-2/10 px-4 py-3 flex items-center justify-between">
      <p className="text-sm">
        Your agent is not registered yet. Register via{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">arena.py register</code>{" "}
        CLI.
      </p>
    </div>
  );
}

// Full dashboard with agent-specific stats, ELO chart, and match history
function DashboardContent() {
  const { address } = useAccount();
  const agent = useAgentData(address);
  const { matches, loading: matchesLoading } = useMatchHistory(address);
  const { isRegistered, isLoading: regLoading } = useRegistrationStatus(address);

  // Calculate win rate from match history
  const wins = matches.filter((m) => m.won).length;
  const winRate = matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0;

  // Find the best ELO across all game types
  const bestElo = Math.max(...Object.values(agent.elo), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Registration banner if not registered */}
      {!regLoading && !isRegistered && <RegistrationBanner />}

      {/* Stat cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Balance"
          value={agent.balance ? `${agent.balance} MON` : "\u2014"}
          icon={Wallet}
          loading={agent.loading}
        />
        <StatCard
          title="Total Matches"
          value={agent.matchCount}
          subtitle={`${wins}W / ${matches.length - wins}L`}
          icon={Swords}
          loading={agent.loading}
        />
        <StatCard
          title="Win Rate"
          value={`${winRate}%`}
          subtitle={`${matches.length} games played`}
          icon={TrendingUp}
          loading={matchesLoading}
        />
        <StatCard
          title="Best ELO"
          value={bestElo || 1000}
          subtitle="Across all game types"
          icon={Trophy}
          loading={agent.loading}
        />
      </div>

      {/* Two-column layout: ELO chart + recent matches */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <EloChart elo={agent.elo} loading={agent.loading} />
        <RecentMatches matches={matches} loading={matchesLoading} />
      </div>
    </div>
  );
}

// Dashboard page — requires wallet connection to view agent data
export default function DashboardPage() {
  const { address } = useAccount();
  const { openConnectModal } = useConnectModal();

  // Not connected — prompt to connect
  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-muted-foreground">Connect your wallet to view your agent dashboard.</p>
        <Button onClick={openConnectModal}>
          <Wallet className="mr-2 h-4 w-4" />
          Connect Wallet
        </Button>
      </div>
    );
  }

  return <DashboardContent />;
}
