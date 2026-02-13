import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import Link from "next/link";
import { PixelAvatar } from "@/components/ui/PixelAvatar";
import { GameOverError } from "@/components/ui/GameOverError";
import { EXPLORER_URL } from "@/lib/constants";
import type { Match } from "@/lib/types";

const moveIcons: Record<string, string> = {
  rock: "ROCK",
  paper: "PAPER",
  scissors: "SCISSORS",
};

export default function MatchDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || typeof id !== "string") return;
    fetch(`/api/match-data?id=${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setMatch(d.data);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-monad-dark">
        <div className="crt-overlay" />
        <span className="font-pixel text-sm text-monad-purple animate-blink-soft">LOADING MATCH...</span>
      </div>
    );
  }

  if (!match) {
    return (
      <GameOverError
        message="MATCH NOT FOUND"
        backHref="/matches"
        backLabel="BACK TO MATCHES"
      />
    );
  }

  const isPlayerAWinner = match.result === "playerA";
  const winner = isPlayerAWinner ? match.playerA : match.playerB;
  const date = new Date(match.timestamp * 1000).toLocaleString();

  return (
    <div className="min-h-screen bg-monad-dark">
      <div className="crt-overlay" />

      <div className="relative z-10 mx-auto max-w-3xl px-6 pt-16 pb-12">
        <Link href="/arena" className="font-pixel text-xs text-text-dim hover:text-monad-purple transition-colors">
          &larr; RPS
        </Link>

        {/* Match header */}
        <div className="mt-6 rounded-lg border border-monad-purple/20 bg-monad-deeper p-6">
          <div className="flex items-center justify-between">
            {/* Player A */}
            <div className="flex items-center gap-3">
              <PixelAvatar address={match.playerA.address} size={48} />
              <div>
                <p className={`font-pixel text-sm ${isPlayerAWinner ? "text-neon-green glow-green" : "text-text-primary"}`}>
                  {match.playerA.name}
                </p>
                <p className="text-[9px] text-text-dim font-mono">
                  {match.playerA.address.slice(0, 10)}...
                </p>
              </div>
            </div>

            {/* VS */}
            <div className="text-center">
              <p className="font-pixel text-lg text-monad-purple glow-purple">VS</p>
              <p className="font-pixel text-[9px] text-neon-yellow mt-1">
                {match.gameType.toUpperCase()}
              </p>
            </div>

            {/* Player B */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className={`font-pixel text-sm ${!isPlayerAWinner ? "text-neon-green glow-green" : "text-text-primary"}`}>
                  {match.playerB.name}
                </p>
                <p className="text-[9px] text-text-dim font-mono">
                  {match.playerB.address.slice(0, 10)}...
                </p>
              </div>
              <PixelAvatar address={match.playerB.address} size={48} />
            </div>
          </div>

          {/* Result banner */}
          <div className="mt-4 text-center rounded bg-monad-purple/10 py-2">
            <span className="font-pixel text-sm text-neon-green glow-green">
              {winner.name} WINS
            </span>
            <span className="ml-3 text-xs text-neon-yellow">{match.wager} MON</span>
          </div>

          {/* Meta */}
          <div className="mt-3 flex justify-center gap-6 text-[10px] text-text-dim">
            <span>{date}</span>
            <span>ELO: {match.eloChange.playerA >= 0 ? "+" : ""}{match.eloChange.playerA} / {match.eloChange.playerB >= 0 ? "+" : ""}{match.eloChange.playerB}</span>
          </div>
        </div>

        {/* Bankroll & ELO change */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded border border-monad-purple/15 bg-monad-deeper p-4">
            <p className="font-pixel text-[8px] text-text-dim">BANKROLL CHANGE</p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-text-primary">{match.playerA.name}</span>
              <span className={isPlayerAWinner ? "text-neon-green font-pixel text-[10px]" : "text-neon-red font-pixel text-[10px]"}>
                {isPlayerAWinner ? "+" : "-"}{match.wager} MON
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-text-primary">{match.playerB.name}</span>
              <span className={!isPlayerAWinner ? "text-neon-green font-pixel text-[10px]" : "text-neon-red font-pixel text-[10px]"}>
                {!isPlayerAWinner ? "+" : "-"}{match.wager} MON
              </span>
            </div>
          </div>
          <div className="rounded border border-monad-purple/15 bg-monad-deeper p-4">
            <p className="font-pixel text-[8px] text-text-dim">ELO CHANGE</p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-text-primary">{match.playerA.name}</span>
              <span className={`font-pixel text-[10px] ${match.eloChange.playerA >= 0 ? "text-neon-green" : "text-neon-red"}`}>
                {match.eloChange.playerA >= 0 ? "+" : ""}{match.eloChange.playerA}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-text-primary">{match.playerB.name}</span>
              <span className={`font-pixel text-[10px] ${match.eloChange.playerB >= 0 ? "text-neon-green" : "text-neon-red"}`}>
                {match.eloChange.playerB >= 0 ? "+" : ""}{match.eloChange.playerB}
              </span>
            </div>
          </div>
        </div>

        {/* Strategy used */}
        <div className="mt-6 rounded border border-monad-purple/15 bg-monad-deeper p-4">
          <p className="font-pixel text-[9px] text-text-dim">STRATEGY</p>
          <p className="mt-1 text-sm text-monad-purple">{match.strategyUsed}</p>
        </div>

        {/* Round-by-round timeline */}
        <div className="mt-6">
          <h2 className="font-pixel text-sm text-text-dim mb-4">ROUNDS</h2>
          <div className="space-y-3">
            {match.rounds.map((round) => (
              <RoundRow
                key={round.round}
                round={round}
                gameType={match.gameType}
                playerAName={match.playerA.name}
                playerBName={match.playerB.name}
              />
            ))}
          </div>
        </div>

        {/* Transaction hashes */}
        {match.txHashes.length > 0 && (
          <div className="mt-6">
            <h2 className="font-pixel text-[9px] text-text-dim mb-2">TRANSACTIONS</h2>
            <div className="space-y-1">
              {match.txHashes.map((hash) => (
                <div key={hash} className="flex items-center gap-2">
                  <span className="text-[10px] text-text-dim font-mono">
                    {hash.slice(0, 16)}...{hash.slice(-8)}
                  </span>
                  <a
                    href={`${EXPLORER_URL}/tx/${hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] text-monad-purple hover:underline"
                  >
                    View on Explorer &rarr;
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RoundRow({
  round,
  gameType,
  playerAName,
  playerBName,
}: {
  round: Match["rounds"][0];
  gameType: string;
  playerAName: string;
  playerBName: string;
}) {
  const winnerColor =
    round.winner === "A" ? "text-neon-green" : round.winner === "B" ? "text-neon-red" : "text-neon-yellow";
  const winnerName =
    round.winner === "A" ? playerAName : round.winner === "B" ? playerBName : "DRAW";

  return (
    <div className="flex items-center gap-4 rounded border border-monad-purple/10 bg-monad-deeper/50 px-4 py-3">
      {/* Round number */}
      <span className="font-pixel text-[10px] text-monad-purple w-8">
        R{round.round}
      </span>

      {/* Moves/Actions */}
      <div className="flex flex-1 items-center justify-between text-xs">
        {gameType === "rps" && (
          <>
            <span className="font-pixel text-[10px] text-neon-cyan">
              {moveIcons[round.moveA || ""] || round.moveA}
            </span>
            <span className="text-text-dim">vs</span>
            <span className="font-pixel text-[10px] text-neon-cyan">
              {moveIcons[round.moveB || ""] || round.moveB}
            </span>
          </>
        )}
        {gameType === "poker" && (
          <>
            <span className="text-neon-cyan">{round.actionA}</span>
            <span className="text-text-dim">/</span>
            <span className="text-neon-cyan">{round.actionB}</span>
          </>
        )}
        {gameType === "auction" && (
          <>
            <span className="text-neon-cyan">Bid: {round.bidA} MON</span>
            <span className="text-text-dim">vs</span>
            <span className="text-neon-cyan">Bid: {round.bidB} MON</span>
          </>
        )}
      </div>

      {/* Winner */}
      <span className={`font-pixel text-[9px] ${winnerColor}`}>
        {winnerName}
      </span>
    </div>
  );
}
