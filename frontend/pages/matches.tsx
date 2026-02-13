import { useState } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { PixelAvatar } from "@/components/ui/PixelAvatar";
import { useAllMatches } from "@/hooks/useAllMatches";
import type { MatchWithProof } from "@/hooks/useAllMatches";
import { getAgentName } from "@/lib/agentNames";
import { monadTestnet, ADDRESSES } from "@/lib/contracts";

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

// Block explorer base URL for all on-chain proof links
const EXPLORER = monadTestnet.blockExplorers.default.url;

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
        <div className="mb-4 rounded border border-monad-purple/20 bg-monad-deeper/50 px-4 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-pixel text-[8px] text-text-dim">
              VERIFIED ON-CHAIN — MONAD TESTNET
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span
              onClick={() => window.open(`${EXPLORER}/address/${ADDRESSES.escrow}`, "_blank")}
              className="font-pixel text-[7px] text-monad-purple/60 hover:text-monad-purple cursor-pointer transition-colors"
            >
              Escrow: {shortAddr(ADDRESSES.escrow)} ↗
            </span>
            <span
              onClick={() => window.open(`${EXPLORER}/address/${ADDRESSES.rpsGame}`, "_blank")}
              className="font-pixel text-[7px] text-monad-purple/60 hover:text-monad-purple cursor-pointer transition-colors"
            >
              RPSGame: {shortAddr(ADDRESSES.rpsGame)} ↗
            </span>
            <span
              onClick={() => window.open(`${EXPLORER}/address/${ADDRESSES.pokerGame}`, "_blank")}
              className="font-pixel text-[7px] text-monad-purple/60 hover:text-monad-purple cursor-pointer transition-colors"
            >
              PokerGame: {shortAddr(ADDRESSES.pokerGame)} ↗
            </span>
            <span
              onClick={() => window.open(`${EXPLORER}/address/${ADDRESSES.auctionGame}`, "_blank")}
              className="font-pixel text-[7px] text-monad-purple/60 hover:text-monad-purple cursor-pointer transition-colors"
            >
              AuctionGame: {shortAddr(ADDRESSES.auctionGame)} ↗
            </span>
            <span
              onClick={() => window.open(`${EXPLORER}/address/${ADDRESSES.agentRegistry}`, "_blank")}
              className="font-pixel text-[7px] text-monad-purple/60 hover:text-monad-purple cursor-pointer transition-colors"
            >
              AgentRegistry: {shortAddr(ADDRESSES.agentRegistry)} ↗
            </span>
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

              // Status badge for non-settled matches
              const statusLabel =
                m.status === "pending" ? "PENDING" :
                m.status === "active" ? "ACTIVE" :
                m.status === "cancelled" ? "CANCELLED" :
                isDraw ? "DRAW" :
                isP1Win ? "P1 WIN" :
                isP2Win ? "P2 WIN" : "-";

              const statusColor =
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
