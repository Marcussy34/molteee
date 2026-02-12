import dynamic from "next/dynamic";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { StatPanel } from "@/components/ui/StatPanel";
import { ScoreTicker } from "@/components/ui/ScoreTicker";
import { MatchFeed } from "@/components/ui/MatchFeed";
import { RetroSparkline } from "@/components/ui/RetroChart";
import { sfx } from "@/lib/sound";
import type { Match, Agent } from "@/lib/types";

const ArenaScene = dynamic(
  () => import("@/components/three/ArenaScene").then((m) => ({ default: m.ArenaScene })),
  { ssr: false }
);

// Simulate cycling through matches for the demo
function useMatchSimulation(matches: Match[]) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [roundIndex, setRoundIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const prevRoundRef = useRef(-1);

  // Play SFX when rounds change
  useEffect(() => {
    if (isActive && roundIndex !== prevRoundRef.current) {
      sfx.roundStart();
      prevRoundRef.current = roundIndex;
    }
  }, [roundIndex, isActive]);

  useEffect(() => {
    if (matches.length === 0) return;

    const match = matches[currentIndex % matches.length];

    // Start the match after a delay
    const startTimer = setTimeout(() => setIsActive(true), 2000);

    // Cycle through rounds
    const roundTimer = setInterval(() => {
      setRoundIndex((prev) => {
        if (prev >= (match.rounds?.length || 1) - 1) {
          // Match complete — play win/lose SFX
          sfx.win();
          setTimeout(() => {
            setIsActive(false);
            setRoundIndex(0);
            prevRoundRef.current = -1;
            setTimeout(() => {
              setCurrentIndex((i) => (i + 1) % matches.length);
            }, 3000);
          }, 2000);
          return prev;
        }
        return prev + 1;
      });
    }, 3000);

    return () => {
      clearTimeout(startTimer);
      clearInterval(roundTimer);
    };
  }, [currentIndex, matches]);

  const match = matches[currentIndex % matches.length] || null;
  const currentRound = match?.rounds?.[roundIndex];

  return { match, currentRound, isActive, roundIndex };
}

export default function ArenaPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [agents, setAgents] = useState<Record<string, Agent>>({});

  useEffect(() => {
    fetch("/api/match-data")
      .then((r) => r.json())
      .then((d) => d.ok && setMatches(d.data));
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

  const { match, currentRound, isActive, roundIndex } = useMatchSimulation(matches);

  const playerAAgent = match ? agents[match.playerA.address] : null;
  const playerBAgent = match ? agents[match.playerB.address] : null;

  const tickerItems = matches.map((m) => ({
    id: m.id,
    text: `${m.playerA.name} vs ${m.playerB.name} — ${m.gameType.toUpperCase()} — ${m.result === "playerA" ? m.playerA.name : m.playerB.name} WINS — ${m.wager} MON`,
    type: "info" as const,
  }));

  const moveA = currentRound?.moveA || currentRound?.actionA || currentRound?.bidA;
  const moveB = currentRound?.moveB || currentRound?.actionB || currentRound?.bidB;
  const roundWinner = currentRound?.winner === "A" ? "A" : currentRound?.winner === "B" ? "B" : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-monad-dark">
      {/* CRT Overlay */}
      <div className="crt-overlay" />

      {/* Top: Score Ticker */}
      <ScoreTicker items={tickerItems} />

      {/* Match info bar */}
      {match && (
        <div className="flex items-center justify-center gap-4 border-b border-monad-purple/20 bg-monad-deeper/80 px-4 py-1.5">
          <span className="font-pixel text-[9px] text-monad-purple">
            {match.gameType.toUpperCase()}
          </span>
          <span className="font-pixel text-[9px] text-text-dim">
            ROUND {roundIndex + 1} OF {match.rounds?.length || 1}
          </span>
          <span className="font-pixel text-[9px] text-neon-yellow">
            {match.wager} MON
          </span>
          {isActive && (
            <span className="font-pixel text-[9px] text-neon-green animate-blink">
              LIVE
            </span>
          )}
        </div>
      )}

      {/* Main: 3-column HUD */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Left Panel: Player A Stats */}
        <div className="w-64 shrink-0 border-r border-monad-purple/20 bg-monad-deeper/60 backdrop-blur-sm overflow-y-auto">
          {playerAAgent ? (
            <StatPanel
              address={playerAAgent.address}
              name={playerAAgent.name}
              elo={playerAAgent.elo.overall}
              wins={playerAAgent.wins}
              losses={playerAAgent.losses}
              bankroll={playerAAgent.bankroll}
              strategy={playerAAgent.strategy || ""}
              side="left"
              isWinner={match?.result === "playerA"}
              currentMove={isActive ? moveA : undefined}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="font-pixel text-[9px] text-text-dim">WAITING...</span>
            </div>
          )}
        </div>

        {/* Center: 3D Arena */}
        <div className="relative flex-1">
          <ArenaScene
            playerA={match?.playerA.address}
            playerB={match?.playerB.address}
            isActive={isActive}
            moveA={moveA}
            moveB={moveB}
            winner={roundWinner}
          />

          {/* Round result overlay */}
          {isActive && currentRound && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded border border-monad-purple/30 bg-monad-deeper/80 px-6 py-2 backdrop-blur-sm">
              {currentRound.winner === "draw" ? (
                <span className="font-pixel text-sm text-neon-yellow">DRAW</span>
              ) : (
                <span className={`font-pixel text-sm ${currentRound.winner === "A" ? "text-neon-green" : "text-neon-red"}`}>
                  {currentRound.winner === "A" ? match?.playerA.name : match?.playerB.name} WINS ROUND
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right Panel: Player B Stats */}
        <div className="w-64 shrink-0 border-l border-monad-purple/20 bg-monad-deeper/60 backdrop-blur-sm overflow-y-auto">
          {playerBAgent ? (
            <StatPanel
              address={playerBAgent.address}
              name={playerBAgent.name}
              elo={playerBAgent.elo.overall}
              wins={playerBAgent.wins}
              losses={playerBAgent.losses}
              bankroll={playerBAgent.bankroll}
              strategy={playerBAgent.strategy || ""}
              side="right"
              isWinner={match?.result === "playerB"}
              currentMove={isActive ? moveB : undefined}
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
          {/* Bankroll sparkline */}
          {playerAAgent && (
            <div className="w-48 shrink-0 border-l border-monad-purple/20 p-3 flex flex-col items-center justify-center">
              <span className="font-pixel text-[7px] text-text-dim mb-1">BANKROLL</span>
              <RetroSparkline
                data={buildBankrollSeries(matches, playerAAgent.address)}
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

/** Build a simple bankroll number series from match wagers */
function buildBankrollSeries(matches: Match[], playerAddress: string): number[] {
  const sorted = [...matches]
    .filter(
      (m) =>
        m.playerA.address.toLowerCase() === playerAddress.toLowerCase() ||
        m.playerB.address.toLowerCase() === playerAddress.toLowerCase()
    )
    .sort((a, b) => a.timestamp - b.timestamp);

  let balance = 5; // starting balance in MON
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
