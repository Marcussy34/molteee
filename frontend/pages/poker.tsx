import { useState, useEffect } from "react";
import Link from "next/link";
import { StatPanel } from "@/components/ui/StatPanel";
import { ScoreTicker } from "@/components/ui/ScoreTicker";
import { MatchFeed } from "@/components/ui/MatchFeed";
import { RetroSparkline } from "@/components/ui/RetroChart";
import { usePokerDirector } from "@/hooks/usePokerDirector";
import { PokerTable } from "@/components/poker/PokerTable";
import type { Match, Agent } from "@/lib/types";

export default function PokerPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [agents, setAgents] = useState<Record<string, Agent>>({});

  useEffect(() => {
    fetch("/api/match-data?gameType=poker")
      .then((r) => r.json())
      .then((d) => d.ok && setMatches(d.data));
    fetch("/api/match-data")
      .then((r) => r.json())
      .then((d) => d.ok && setAllMatches(d.data));
    fetch("/api/agent-data")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          const map: Record<string, Agent> = {};
          d.data.forEach((a: Agent) => { map[a.address] = a; });
          setAgents(map);
        }
      });
  }, []);

  const pokerState = usePokerDirector(matches);
  const { match, roundIndex, phase, actionA, actionB, matchWinner } = pokerState;

  const isActive = phase !== "idle" && phase !== "reset" && phase !== "entrance_a" && phase !== "entrance_b";

  const playerAAgent = match ? agents[match.playerA.address] : null;
  const playerBAgent = match ? agents[match.playerB.address] : null;

  const tickerItems = allMatches.map((m) => ({
    id: m.id,
    text: `${m.playerA.name} vs ${m.playerB.name} — ${m.gameType.toUpperCase()} — ${m.result === "playerA" ? m.playerA.name : m.playerB.name} WINS — ${m.wager} MON`,
    type: "info" as const,
  }));

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-monad-dark pt-14">
      <div className="crt-overlay" />

      <ScoreTicker items={tickerItems} />

      {match && (
        <div className="flex items-center justify-center gap-4 border-b border-monad-purple/20 bg-monad-deeper/80 px-4 py-1.5">
          <span className="font-pixel text-[9px] text-neon-yellow">POKER</span>
          <span className="font-pixel text-[9px] text-text-dim">
            ROUND {roundIndex + 1} OF {match.rounds?.length || 1}
          </span>
          <span className="font-pixel text-[9px] text-neon-yellow">
            {match.wager} MON
          </span>
          {isActive && (
            <span className="font-pixel text-[9px] text-neon-green animate-blink">LIVE</span>
          )}
        </div>
      )}

      <div className="relative flex flex-1 overflow-hidden">
        {/* Left Panel: Player A Stats */}
        <div className="w-64 shrink-0 border-r border-monad-purple/20 bg-monad-deeper/60 backdrop-blur-sm overflow-y-auto">
          {playerAAgent ? (
            <StatPanel
              address={playerAAgent.address}
              name={playerAAgent.name}
              elo={playerAAgent.elo.poker}
              wins={playerAAgent.wins}
              losses={playerAAgent.losses}
              bankroll={playerAAgent.bankroll}
              strategy={playerAAgent.strategy || ""}
              side="left"
              isWinner={match?.result === "playerA"}
              currentMove={isActive ? actionA : undefined}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="font-pixel text-[9px] text-text-dim">WAITING...</span>
            </div>
          )}
        </div>

        {/* Center: Poker Table */}
        <div className="relative flex-1">
          <PokerTable
            pokerState={pokerState}
            playerAName={match?.playerA.name || "Player A"}
            playerBName={match?.playerB.name || "Player B"}
          />
        </div>

        {/* Right Panel: Player B Stats */}
        <div className="w-64 shrink-0 border-l border-monad-purple/20 bg-monad-deeper/60 backdrop-blur-sm overflow-y-auto">
          {playerBAgent ? (
            <StatPanel
              address={playerBAgent.address}
              name={playerBAgent.name}
              elo={playerBAgent.elo.poker}
              wins={playerBAgent.wins}
              losses={playerBAgent.losses}
              bankroll={playerBAgent.bankroll}
              strategy={playerBAgent.strategy || ""}
              side="right"
              isWinner={match?.result === "playerB"}
              currentMove={isActive ? actionB : undefined}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="font-pixel text-[9px] text-text-dim">WAITING...</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Match Feed + Sparkline */}
      <div className="shrink-0 border-t border-monad-purple/20 bg-monad-deeper/80">
        <div className="flex items-stretch">
          <div className="flex-1 max-h-48 overflow-y-auto">
            <MatchFeed matches={matches} maxItems={5} />
          </div>
          {playerAAgent && (
            <div className="w-48 shrink-0 border-l border-monad-purple/20 p-3 flex flex-col items-center justify-center">
              <span className="font-pixel text-[7px] text-text-dim mb-1">BANKROLL</span>
              <RetroSparkline
                data={buildBankrollSeries(allMatches, playerAAgent.address)}
                color="#39FF14"
                width={130}
                height={36}
              />
              <span className="font-pixel text-[8px] text-neon-green mt-1">
                {playerAAgent.bankroll} MON
              </span>
            </div>
          )}
        </div>
        <div className="flex justify-center border-t border-monad-purple/10 py-1.5">
          <Link href="/matches" className="font-pixel text-[8px] text-text-dim hover:text-monad-purple transition-colors">
            VIEW ALL MATCHES &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}

function buildBankrollSeries(matches: Match[], playerAddress: string): number[] {
  const sorted = [...matches]
    .filter(
      (m) =>
        m.playerA.address.toLowerCase() === playerAddress.toLowerCase() ||
        m.playerB.address.toLowerCase() === playerAddress.toLowerCase()
    )
    .sort((a, b) => a.timestamp - b.timestamp);

  let balance = 5;
  const series = [balance];

  for (const m of sorted) {
    const isA = m.playerA.address.toLowerCase() === playerAddress.toLowerCase();
    const wager = parseFloat(m.wager) || 0;
    const won = (isA && m.result === "playerA") || (!isA && m.result === "playerB");
    balance += won ? wager : -wager;
    series.push(Math.max(0, balance));
  }

  return series;
}
