import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import Link from "next/link";
import { PixelAvatar } from "@/components/ui/PixelAvatar";
import { HealthBar } from "@/components/ui/HealthBar";
import { RetroChart } from "@/components/ui/RetroChart";
import { GameOverError } from "@/components/ui/GameOverError";
import { EXPLORER_URL } from "@/lib/constants";
import type { Agent, Match } from "@/lib/types";

interface StrategyStats {
  mostUsedStrategy: string;
  bluffSuccessRate: number;
  favoriteMove: string;
  avgBidRatio: number;
  perGame: {
    rps: { wins: number; losses: number; draws: number; winRate: number };
    poker: { wins: number; losses: number; draws: number; winRate: number };
    auction: { wins: number; losses: number; draws: number; winRate: number };
  };
}

export default function AgentProfilePage() {
  const router = useRouter();
  const { address } = router.query;
  const [agent, setAgent] = useState<Agent | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [strategyStats, setStrategyStats] = useState<StrategyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address || typeof address !== "string") return;
    Promise.all([
      fetch(`/api/agent-data?address=${address}`).then((r) => r.json()),
      fetch(`/api/match-data?player=${address}`).then((r) => r.json()),
    ]).then(([agentRes, matchRes]) => {
      if (agentRes.ok) setAgent(agentRes.data);
      if (agentRes.strategyStats) setStrategyStats(agentRes.strategyStats);
      if (matchRes.ok) setMatches(matchRes.data);
      setLoading(false);
    });
  }, [address]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-monad-dark">
        <div className="crt-overlay" />
        <span className="font-pixel text-sm text-monad-purple animate-blink-soft">LOADING AGENT...</span>
      </div>
    );
  }

  if (!agent) {
    return (
      <GameOverError
        message="AGENT NOT FOUND"
        backHref="/leaderboard"
        backLabel="BACK TO LEADERBOARD"
      />
    );
  }

  const totalGames = agent.wins + agent.losses + agent.draws;
  const winRate = totalGames > 0 ? Math.round((agent.wins / totalGames) * 100) : 0;
  const bankrollPercent = (parseFloat(agent.bankroll) / 10) * 100;

  return (
    <div className="min-h-screen bg-monad-dark">
      <div className="crt-overlay" />

      <div className="relative z-10 mx-auto max-w-4xl px-6 pt-16 pb-12">
        {/* Back link */}
        <Link href="/leaderboard" className="font-pixel text-xs text-text-dim hover:text-monad-purple transition-colors">
          &larr; LEADERBOARD
        </Link>

        {/* Agent header */}
        <div className="mt-6 flex items-center gap-6">
          <PixelAvatar address={agent.address} size={80} />
          <div>
            <h1 className="font-pixel text-2xl text-monad-purple glow-purple">{agent.name}</h1>
            <p className="mt-1 text-sm text-text-dim font-mono">{agent.address}</p>
            <p className="mt-1 text-xs text-monad-violet">{agent.strategy}</p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatBox label="OVERALL ELO" value={String(agent.elo.overall)} color="cyan" />
          <StatBox label="WIN RATE" value={`${winRate}%`} color="green" />
          <StatBox label="TOTAL MATCHES" value={String(totalGames)} color="purple" />
          <StatBox label="BANKROLL" value={`${agent.bankroll} MON`} color="yellow" />
        </div>

        {/* Bankroll bar */}
        <div className="mt-6">
          <HealthBar value={bankrollPercent} label="BANKROLL HEALTH" maxLabel={`${agent.bankroll} / 10 MON`} size="lg" />
        </div>

        {/* Per-game ELO + Win Rates */}
        <div className="mt-8">
          <h2 className="font-pixel text-sm text-text-dim mb-3">ELO BY GAME</h2>
          <div className="grid grid-cols-3 gap-4">
            <GameEloCard
              game="RPS"
              elo={agent.elo.rps}
              color="monad-purple"
              winRate={strategyStats?.perGame.rps.winRate}
              record={strategyStats ? `${strategyStats.perGame.rps.wins}W-${strategyStats.perGame.rps.losses}L` : undefined}
            />
            <GameEloCard
              game="POKER"
              elo={agent.elo.poker}
              color="neon-cyan"
              winRate={strategyStats?.perGame.poker.winRate}
              record={strategyStats ? `${strategyStats.perGame.poker.wins}W-${strategyStats.perGame.poker.losses}L` : undefined}
            />
            <GameEloCard
              game="AUCTION"
              elo={agent.elo.auction}
              color="neon-yellow"
              winRate={strategyStats?.perGame.auction.winRate}
              record={strategyStats ? `${strategyStats.perGame.auction.wins}W-${strategyStats.perGame.auction.losses}L` : undefined}
            />
          </div>
        </div>

        {/* Strategy Stats */}
        {strategyStats && (
          <div className="mt-8">
            <h2 className="font-pixel text-sm text-text-dim mb-3">STRATEGY ANALYSIS</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatBox label="MOST USED" value={strategyStats.mostUsedStrategy} color="purple" />
              <StatBox label="BLUFF RATE" value={`${strategyStats.bluffSuccessRate}%`} color="cyan" />
              <StatBox label="FAV MOVE" value={strategyStats.favoriteMove.toUpperCase()} color="green" />
              <StatBox label="AVG BID RATIO" value={`${Math.round(strategyStats.avgBidRatio * 100)}%`} color="yellow" />
            </div>
          </div>
        )}

        {/* ELO History Chart */}
        {matches.length > 0 && (
          <div className="mt-8">
            <h2 className="font-pixel text-sm text-text-dim mb-3">ELO HISTORY</h2>
            <RetroChart
              data={buildEloHistory(agent, matches)}
              color="#836EF9"
              height={180}
            />
          </div>
        )}

        {/* Explorer link */}
        <div className="mt-6 flex gap-3">
          <a
            href={`${EXPLORER_URL}/address/${agent.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-monad-purple/30 bg-monad-deeper px-4 py-2 font-pixel text-[9px] text-monad-purple transition-colors hover:bg-monad-purple/10 hover:text-text-primary"
          >
            VIEW ON EXPLORER &rarr;
          </a>
        </div>

        {/* Match history */}
        <div className="mt-8">
          <h2 className="font-pixel text-sm text-text-dim mb-3">MATCH HISTORY</h2>
          <div className="space-y-2">
            {matches.map((m) => {
              const isPlayerA = m.playerA.address.toLowerCase() === agent.address.toLowerCase();
              const opponent = isPlayerA ? m.playerB : m.playerA;
              const won = (isPlayerA && m.result === "playerA") || (!isPlayerA && m.result === "playerB");
              const eloChange = isPlayerA ? m.eloChange.playerA : m.eloChange.playerB;

              return (
                <Link
                  key={m.id}
                  href={`/matches/${m.id}`}
                  className="flex items-center justify-between rounded border border-monad-purple/10 bg-monad-deeper/50 px-4 py-3 transition-colors hover:bg-monad-purple/5"
                >
                  <div className="flex items-center gap-3">
                    <span className={`font-pixel text-[10px] ${won ? "text-neon-green" : "text-neon-red"}`}>
                      {won ? "WIN" : "LOSS"}
                    </span>
                    <span className="font-pixel text-[9px] text-monad-purple">
                      {m.gameType.toUpperCase()}
                    </span>
                    <span className="text-xs text-text-dim">vs {opponent.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`font-pixel text-[10px] ${eloChange >= 0 ? "text-neon-green" : "text-neon-red"}`}>
                      {eloChange >= 0 ? "+" : ""}{eloChange} ELO
                    </span>
                    <span className="text-xs text-neon-yellow">{m.wager} MON</span>
                  </div>
                </Link>
              );
            })}
            {matches.length === 0 && (
              <p className="text-center text-sm text-text-dim py-8">No matches found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  const colorClass: Record<string, string> = {
    cyan: "text-neon-cyan glow-cyan",
    green: "text-neon-green glow-green",
    purple: "text-monad-purple glow-purple",
    yellow: "text-neon-yellow glow-yellow",
  };
  return (
    <div className="rounded border border-monad-purple/15 bg-monad-deeper p-4 text-center">
      <p className="text-[8px] text-text-dim tracking-widest">{label}</p>
      <p className={`mt-1 font-pixel text-lg ${colorClass[color] || "text-text-primary"}`}>
        {value}
      </p>
    </div>
  );
}

function GameEloCard({ game, elo, color, winRate, record }: { game: string; elo: number; color: string; winRate?: number; record?: string }) {
  return (
    <div className="rounded border border-monad-purple/15 bg-monad-deeper p-4 text-center">
      <p className={`font-pixel text-[10px] text-${color}`}>{game}</p>
      <p className="mt-2 font-pixel text-xl text-text-primary">{elo}</p>
      {winRate !== undefined && (
        <p className="mt-1 font-pixel text-[9px] text-neon-green">{winRate}% WIN</p>
      )}
      {record && (
        <p className="mt-0.5 text-[8px] text-text-dim">{record}</p>
      )}
    </div>
  );
}

/** Build ELO progression from match history (reconstructed from deltas) */
function buildEloHistory(agent: Agent, matches: Match[]) {
  // Sort matches oldest first
  const sorted = [...matches].sort((a, b) => a.timestamp - b.timestamp);
  let elo = agent.elo.overall;

  // Walk backwards to find starting ELO
  for (let i = sorted.length - 1; i >= 0; i--) {
    const m = sorted[i];
    const isA = m.playerA.address.toLowerCase() === agent.address.toLowerCase();
    const delta = isA ? m.eloChange.playerA : m.eloChange.playerB;
    elo -= delta;
  }

  // Now walk forward building the chart data
  const data: { label: string; value: number }[] = [{ label: "Start", value: elo }];
  for (const m of sorted) {
    const isA = m.playerA.address.toLowerCase() === agent.address.toLowerCase();
    const delta = isA ? m.eloChange.playerA : m.eloChange.playerB;
    elo += delta;
    const label = `M${data.length}`;
    data.push({ label, value: elo });
  }

  return data;
}
