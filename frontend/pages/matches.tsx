import { useState } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { PixelAvatar } from "@/components/ui/PixelAvatar";
import { useAllMatches } from "@/hooks/useAllMatches";
import type { MatchWithProof } from "@/hooks/useAllMatches";
import { getAgentName } from "@/lib/agentNames";
import { monadChain, ADDRESSES } from "@/lib/contracts";

// ─── Filter definitions ────────────────────────────────────────────────────

const GAME_FILTERS = [
  { key: "", label: "ALL" },
  { key: "rps", label: "RPS" },
  { key: "poker", label: "POKER" },
  { key: "auction", label: "AUCTION" },
];

const RESULT_FILTERS = [
  { key: "", label: "ALL" },
  { key: "playerA", label: "P1 WINS" },
  { key: "playerB", label: "P2 WINS" },
  { key: "draw", label: "DRAW" },
];

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Escrow ACCEPT_TIMEOUT is 1 hour — pending matches older than this are expired.
// Active matches with stalled games are considered expired after 2 hours.
const PENDING_TIMEOUT_S = 3600;      // 1 hour (matches Escrow.ACCEPT_TIMEOUT)
const ACTIVE_TIMEOUT_S  = 7200;      // 2 hours (generous for game phase deadlines)

// Block explorer base URL for all on-chain proof links
const EXPLORER = monadChain.blockExplorers.default.url;

// ─── Game contract address → explorer label ────────────────────────────────
const GAME_CONTRACT_LABELS: Record<string, string> = {
  [ADDRESSES.rpsGame.toLowerCase()]: "RPSGame",
  [ADDRESSES.pokerGame.toLowerCase()]: "PokerGameV2",
  [ADDRESSES.auctionGame.toLowerCase()]: "AuctionGame",
};

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Open a URL in a new tab — used inside Link rows to prevent parent navigation */
function openExplorer(e: React.MouseEvent, path: string) {
  e.preventDefault();
  e.stopPropagation();
  window.open(`${EXPLORER}${path}`, "_blank");
}

/** Derive result string from on-chain match data */
function getResult(m: MatchWithProof): "p1" | "p2" | "draw" | null {
  if (m.status !== "settled") return null;
  if (!m.winner || m.winner === ZERO_ADDRESS) return "draw";
  if (m.winner.toLowerCase() === m.player1.toLowerCase()) return "p1";
  if (m.winner.toLowerCase() === m.player2.toLowerCase()) return "p2";
  return null;
}

/** Format unix timestamp as "Feb 12" style date */
function formatDate(timestamp: number): string {
  if (!timestamp) return "-";
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Truncate address for display */
function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ─── Page component ────────────────────────────────────────────────────────

export default function MatchesPage() {
  const { matches: allMatches, loading } = useAllMatches();
  const [gameFilter, setGameFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");

  // Apply game type filter
  const gameFiltered = gameFilter
    ? allMatches.filter((m) => m.gameType === gameFilter)
    : allMatches;

  // Apply result filter (only settled matches have results)
  const filtered = resultFilter
    ? gameFiltered.filter((m) => {
        const result = getResult(m);
        if (resultFilter === "playerA") return result === "p1";
        if (resultFilter === "playerB") return result === "p2";
        if (resultFilter === "draw") return result === "draw";
        return true;
      })
    : gameFiltered;

  return (
    <div className="min-h-screen bg-monad-dark">
      <div className="crt-overlay" />

      <div className="relative z-10 mx-auto max-w-5xl px-6 pt-16 pb-12">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <Link href="/arena" className="font-pixel text-xs text-text-dim hover:text-monad-purple transition-colors">
            &larr; ARENA
          </Link>
          <h1 className="font-pixel text-lg text-monad-purple glow-purple">MATCH HISTORY</h1>
          <span className="font-pixel text-[9px] text-text-dim">
            {filtered.length} MATCHES
          </span>
        </div>

        {/* On-chain verification banner with contract links */}
        <div className="mb-4 rounded border border-monad-purple/20 bg-monad-deeper/50 px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-pixel text-[9px] text-monad-purple">
              VERIFIED ON-CHAIN
            </span>
            <span className="font-pixel text-[7px] text-text-dim">
              — MONAD
            </span>
          </div>

          {/* Contract grid — 2 columns on mobile, 3 on desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: "Escrow", addr: ADDRESSES.escrow },
              { label: "RPSGame", addr: ADDRESSES.rpsGame },
              { label: "PokerGame", addr: ADDRESSES.pokerGame },
              { label: "AuctionGame", addr: ADDRESSES.auctionGame },
              { label: "AgentRegistry", addr: ADDRESSES.agentRegistry },
            ].map((c) => (
              <span
                key={c.label}
                onClick={() => window.open(`${EXPLORER}/address/${c.addr}`, "_blank")}
                className="flex items-center gap-1.5 rounded border border-monad-purple/10 bg-monad-dark/50 px-2.5 py-1.5 cursor-pointer hover:border-monad-purple/30 hover:bg-monad-purple/5 transition-all group"
              >
                <span className="font-pixel text-[8px] text-text-dim group-hover:text-text-primary transition-colors">
                  {c.label}
                </span>
                <span className="font-mono text-[9px] text-monad-purple/50 group-hover:text-monad-purple transition-colors truncate">
                  {shortAddr(c.addr)}
                </span>
                <span className="text-[8px] text-monad-purple/30 group-hover:text-monad-purple transition-colors ml-auto">
                  ↗
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          {/* Game type filter */}
          <div className="flex gap-2">
            <span className="font-pixel text-[8px] text-text-dim self-center mr-1">GAME:</span>
            {GAME_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setGameFilter(f.key)}
                className={`font-pixel text-[9px] px-3 py-1.5 rounded border transition-all ${
                  gameFilter === f.key
                    ? "border-monad-purple bg-monad-purple/20 text-monad-purple"
                    : "border-monad-purple/20 text-text-dim hover:border-monad-purple/40 hover:text-text-primary"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Result filter */}
          <div className="flex gap-2">
            <span className="font-pixel text-[8px] text-text-dim self-center mr-1">RESULT:</span>
            {RESULT_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setResultFilter(f.key)}
                className={`font-pixel text-[9px] px-3 py-1.5 rounded border transition-all ${
                  resultFilter === f.key
                    ? "border-monad-purple bg-monad-purple/20 text-monad-purple"
                    : "border-monad-purple/20 text-text-dim hover:border-monad-purple/40 hover:text-text-primary"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Match table */}
        {loading ? (
          <div className="text-center py-12">
            <span className="font-pixel text-sm text-monad-purple animate-blink-soft">
              LOADING...
            </span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="font-pixel text-sm text-text-dim">NO MATCHES FOUND</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Table header */}
            <div className="grid grid-cols-[36px_50px_1fr_40px_1fr_70px_70px_50px_36px] gap-2 px-4 py-2 text-[8px] text-text-dim font-pixel">
              <span>#</span>
              <span>TYPE</span>
              <span>PLAYER 1</span>
              <span>VS</span>
              <span>PLAYER 2</span>
              <span>RESULT</span>
              <span>WAGER</span>
              <span>DATE</span>
              <span>TX</span>
            </div>

            {/* Match rows */}
            {filtered.map((m) => {
              const result = getResult(m);
              const isP1Win = result === "p1";
              const isP2Win = result === "p2";
              const isDraw = result === "draw";

              // Detect expired matches — on-chain status is still pending/active
              // but the timeout has long passed so they're effectively dead
              const now = Math.floor(Date.now() / 1000);
              const age = now - m.createdAt;
              const isExpired =
                (m.status === "pending" && age > PENDING_TIMEOUT_S) ||
                (m.status === "active" && age > ACTIVE_TIMEOUT_S);

              // Status badge
              const statusLabel =
                isExpired ? "EXPIRED" :
                m.status === "pending" ? "PENDING" :
                m.status === "active" ? "ACTIVE" :
                m.status === "cancelled" ? "CANCELLED" :
                isDraw ? "DRAW" :
                isP1Win ? "P1 WIN" :
                isP2Win ? "P2 WIN" : "-";

              const statusColor =
                isExpired ? "text-text-dim" :
                m.status === "pending" ? "text-neon-yellow" :
                m.status === "active" ? "text-monad-purple" :
                m.status === "cancelled" ? "text-text-dim" :
                isDraw ? "text-neon-yellow" :
                isP1Win ? "text-neon-green" :
                isP2Win ? "text-neon-red" : "text-text-dim";

              // Game contract label for tooltip
              const gameLabel = GAME_CONTRACT_LABELS[m.gameContract.toLowerCase()] || "Unknown";

              return (
                <Link
                  key={m.matchId}
                  href={`/matches/${m.matchId}`}
                  className="grid grid-cols-[36px_50px_1fr_40px_1fr_70px_70px_50px_36px] gap-2 items-center rounded border border-monad-purple/10 bg-monad-deeper/50 px-4 py-3 transition-colors hover:bg-monad-purple/5 hover:border-monad-purple/25"
                >
                  {/* Match ID */}
                  <span className="font-pixel text-[9px] text-text-dim">
                    {m.matchId}
                  </span>

                  {/* Game type — clickable to game contract on explorer */}
                  <span
                    onClick={(e) => openExplorer(e, `/address/${m.gameContract}`)}
                    className="font-pixel text-[9px] text-monad-purple hover:text-monad-purple/80 cursor-pointer"
                    title={`${gameLabel}: ${m.gameContract}`}
                  >
                    {m.gameType === "unknown" ? "?" : m.gameType.toUpperCase()}
                  </span>

                  {/* Player 1 — clickable address + ELO */}
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span
                      onClick={(e) => openExplorer(e, `/address/${m.player1}`)}
                      className="cursor-pointer shrink-0"
                      title={m.player1}
                    >
                      <PixelAvatar address={m.player1} size={20} />
                    </span>
                    <span
                      onClick={(e) => openExplorer(e, `/address/${m.player1}`)}
                      className={`text-xs truncate cursor-pointer hover:underline ${isP1Win ? "text-neon-green" : "text-text-primary"}`}
                      title={m.player1}
                    >
                      {getAgentName(m.player1)}
                      {m.player1Elo !== undefined && m.player1Elo > 0 && (
                        <span className="text-[8px] text-text-dim ml-1">({m.player1Elo})</span>
                      )}
                    </span>
                  </div>

                  {/* VS */}
                  <span className="text-center text-[8px] text-text-dim">vs</span>

                  {/* Player 2 — clickable address + ELO */}
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span
                      onClick={(e) => openExplorer(e, `/address/${m.player2}`)}
                      className="cursor-pointer shrink-0"
                      title={m.player2}
                    >
                      <PixelAvatar address={m.player2} size={20} />
                    </span>
                    <span
                      onClick={(e) => openExplorer(e, `/address/${m.player2}`)}
                      className={`text-xs truncate cursor-pointer hover:underline ${isP2Win ? "text-neon-green" : "text-text-primary"}`}
                      title={m.player2}
                    >
                      {getAgentName(m.player2)}
                      {m.player2Elo !== undefined && m.player2Elo > 0 && (
                        <span className="text-[8px] text-text-dim ml-1">({m.player2Elo})</span>
                      )}
                    </span>
                  </div>

                  {/* Result / Status */}
                  <span className={`font-pixel text-[9px] ${statusColor}`}>
                    {statusLabel}
                  </span>

                  {/* Wager */}
                  <span className="text-[10px] text-neon-yellow">
                    {formatEther(m.wager)} MON
                  </span>

                  {/* Date */}
                  <span className="font-pixel text-[9px] text-text-dim">
                    {formatDate(m.createdAt)}
                  </span>

                  {/* TX hash — links to block explorer transaction page */}
                  {m.txHash ? (
                    <span
                      onClick={(e) => openExplorer(e, `/tx/${m.txHash}`)}
                      className="font-pixel text-[8px] text-monad-purple/60 hover:text-monad-purple cursor-pointer transition-colors text-center"
                      title={m.txHash}
                    >
                      TX ↗
                    </span>
                  ) : (
                    <span className="text-[8px] text-text-dim/30 text-center">-</span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
