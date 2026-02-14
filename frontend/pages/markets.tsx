/**
 * Prediction Markets page — Arcade-styled grid of all on-chain markets.
 *
 * Shows live/resolved prediction markets for match outcomes.
 * Markets use a constant-product AMM (x*y=k):
 *   YES tokens = player1 wins, NO tokens = player2 wins.
 *
 * Plugs directly into the PredictionMarket contract on Monad testnet
 * with the same caching patterns as leaderboard / matches pages.
 */

import { useState } from "react";
import Link from "next/link";
import { MarketCard } from "@/components/markets/MarketCard";
import { useMarkets, type MarketFilter } from "@/hooks/useMarkets";
import { ADDRESSES } from "@/lib/contracts";
import { monadTestnet } from "@/lib/contracts";

// ─── Filter definitions ────────────────────────────────────────────────────

const STATUS_FILTERS: { key: MarketFilter; label: string }[] = [
  { key: "all", label: "ALL" },
  { key: "live", label: "LIVE" },
  { key: "resolved", label: "RESOLVED" },
  { key: "expired", label: "EXPIRED" },
];

// Block explorer base URL
const EXPLORER = monadTestnet.blockExplorers.default.url;

// ─── Page component ────────────────────────────────────────────────────────

export default function MarketsPage() {
  const [filter, setFilter] = useState<MarketFilter>("all");
  const { markets, loading, refresh, stats } = useMarkets(filter);

  return (
    <div className="min-h-screen bg-monad-dark">
      {/* CRT scanline overlay for retro effect */}
      <div className="crt-overlay" />

      <div className="relative z-10 mx-auto max-w-5xl px-6 pt-16 pb-12">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/arena"
            className="font-pixel text-xs text-text-dim hover:text-monad-purple transition-colors"
          >
            &larr; ARENA
          </Link>
          <h1 className="font-pixel text-lg text-monad-purple glow-purple">
            PREDICTION MARKETS
          </h1>
          <span className="font-pixel text-[9px] text-text-dim">
            {stats.total} MARKETS
          </span>
        </div>

        {/* On-chain verification banner with all contract links */}
        <div className="mb-4 rounded border border-monad-purple/20 bg-monad-deeper/50 px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-pixel text-[9px] text-monad-purple">
              VERIFIED ON-CHAIN
            </span>
            <span className="font-pixel text-[7px] text-text-dim">
              — MONAD TESTNET
            </span>
          </div>

          {/* Contract grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
            {[
              { label: "PredictionMarket", addr: ADDRESSES.predictionMarket },
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
                  {c.addr.slice(0, 6)}...{c.addr.slice(-4)}
                </span>
                <span className="text-[8px] text-monad-purple/30 group-hover:text-monad-purple transition-colors ml-auto">
                  ↗
                </span>
              </span>
            ))}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex items-center gap-1.5 rounded border border-monad-purple/10 bg-monad-dark/50 px-2.5 py-1.5">
              <span className="font-pixel text-[8px] text-text-dim">LIVE:</span>
              <span className="font-pixel text-[9px] text-neon-green">{stats.live}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded border border-monad-purple/10 bg-monad-dark/50 px-2.5 py-1.5">
              <span className="font-pixel text-[8px] text-text-dim">RESOLVED:</span>
              <span className="font-pixel text-[9px] text-text-primary">{stats.resolved}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded border border-monad-purple/10 bg-monad-dark/50 px-2.5 py-1.5">
              <span className="font-pixel text-[8px] text-text-dim">POOL:</span>
              <span className="font-pixel text-[9px] text-neon-yellow">
                {stats.totalLiquidity.toFixed(2)} MON
              </span>
            </div>
          </div>
        </div>

        {/* Filters + refresh */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="font-pixel text-[8px] text-text-dim mr-1">STATUS:</span>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`font-pixel text-[9px] px-3 py-1.5 rounded border transition-all ${
                filter === f.key
                  ? "border-monad-purple bg-monad-purple/20 text-monad-purple"
                  : "border-monad-purple/20 text-text-dim hover:border-monad-purple/40 hover:text-text-primary"
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            onClick={refresh}
            disabled={loading}
            className="font-pixel text-[9px] px-3 py-1.5 rounded border border-monad-purple/20 text-text-dim hover:border-monad-purple/40 hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all ml-auto"
            title="Refresh from blockchain"
          >
            REFRESH
          </button>
        </div>

        {/* Market grid */}
        {loading ? (
          <div className="text-center py-12">
            <span className="font-pixel text-sm text-monad-purple animate-blink-soft">
              LOADING MARKETS...
            </span>
          </div>
        ) : markets.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <p className="font-pixel text-sm text-text-dim">
              {filter === "live"
                ? "NO LIVE MARKETS"
                : filter === "resolved"
                ? "NO RESOLVED MARKETS"
                : filter === "expired"
                ? "NO EXPIRED MARKETS"
                : "NO MARKETS FOUND"}
            </p>
            <p className="font-pixel text-[8px] text-text-dim/50">
              Markets are auto-created when matches start.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {markets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        )}

        {/* How it works footer */}
        <div className="mt-8 rounded border border-monad-purple/10 bg-monad-deeper/30 px-4 py-3">
          <span className="font-pixel text-[8px] text-monad-purple block mb-2">
            HOW IT WORKS
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[7px] text-text-dim font-pixel">
            <div>
              <span className="text-neon-green block mb-1">1. BROWSE</span>
              Markets auto-create for each match. YES = Player 1 wins, NO = Player 2 wins.
            </div>
            <div>
              <span className="text-neon-yellow block mb-1">2. BET</span>
              Buy YES or NO tokens. Price adjusts via AMM (x*y=k). More demand = higher price.
            </div>
            <div>
              <span className="text-neon-cyan block mb-1">3. REDEEM</span>
              When the match settles, winning tokens pay out proportional to the losing side&apos;s reserves.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
