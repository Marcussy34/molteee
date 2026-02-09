import { Wallet, Swords, Trophy, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentMatches } from "@/components/dashboard/RecentMatches";
import { EloChart } from "@/components/dashboard/EloChart";
import { useAgentData } from "@/hooks/useAgentData";
import { useMatchHistory } from "@/hooks/useMatchHistory";

export default function DashboardPage() {
  const agent = useAgentData();
  const { matches, loading: matchesLoading } = useMatchHistory();

  // Calculate win rate from match history
  const wins = matches.filter((m) => m.won).length;
  const winRate = matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0;

  // Find the best ELO across all game types
  const bestElo = Math.max(...Object.values(agent.elo), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stat cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Balance"
          value={agent.balance ? `${agent.balance} MON` : "—"}
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
