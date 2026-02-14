/**
 * MarketCard — Arcade-styled prediction market card.
 *
 * Shows YES/NO odds as a split bar, player names, liquidity,
 * and resolved status. Matches the retro pixel-art aesthetic.
 */

import Link from "next/link";
import { PixelAvatar } from "@/components/ui/PixelAvatar";
import type { MarketData } from "@/hooks/useMarkets";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

interface MarketCardProps {
  market: MarketData;
}

export function MarketCard({ market }: MarketCardProps) {
  const isResolved = market.status === "resolved";
  const isExpired = market.status === "expired";
  const isLive = market.status === "live";
  const hasWinner = market.winner !== ZERO_ADDRESS;

  // Live matches → arena with 3D visualization; resolved/expired → static match detail
  const href = isLive
    ? `/arena?match=${market.matchId}`
    : `/matches/${market.matchId}`;

  // Clamp prices to 0-100 range for display
  const yesPercent = Math.min(Math.max(market.yesPrice, 0), 100);
  const noPercent = Math.min(Math.max(market.noPrice, 0), 100);

  // Determine which side won (for resolved markets)
  const p1Won = isResolved && hasWinner && market.winner.toLowerCase() === market.player1.toLowerCase();
  const p2Won = isResolved && hasWinner && market.winner.toLowerCase() === market.player2.toLowerCase();

  return (
    <Link
      href={href}
      className={`block rounded border transition-all hover:scale-[1.01] ${
        isExpired
          ? "border-text-dim/15 bg-monad-deeper/30 opacity-60 hover:opacity-80 hover:border-text-dim/25"
          : isResolved
          ? "border-monad-purple/15 bg-monad-deeper/40 hover:border-monad-purple/30"
          : "border-monad-purple/25 bg-monad-deeper/60 hover:border-monad-purple/50 hover:bg-monad-purple/5"
      }`}
    >
      {/* Header: Market ID + Status badge */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-monad-purple/10">
        <div className="flex items-center gap-2">
          <span className="font-pixel text-[9px] text-monad-purple">
            MARKET #{market.id}
          </span>
          <span className="font-pixel text-[7px] text-text-dim">
            MATCH #{market.matchId}
          </span>
        </div>
        <span
          className={`font-pixel text-[8px] px-2 py-0.5 rounded ${
            isExpired
              ? "bg-neon-red/10 text-neon-red/60"
              : isResolved
              ? "bg-text-dim/10 text-text-dim"
              : "bg-neon-green/10 text-neon-green animate-blink-soft"
          }`}
        >
          {isExpired ? "EXPIRED" : isResolved ? "RESOLVED" : "LIVE"}
        </span>
      </div>

      {/* Players */}
      <div className="px-4 py-3 space-y-3">
        {/* Player 1 (YES side) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <PixelAvatar address={market.player1} size={20} />
            <div className="overflow-hidden">
              <span className={`font-pixel text-[9px] block truncate ${p1Won ? "text-neon-green" : "text-text-primary"}`}>
                {market.player1Name}
              </span>
              <span className="font-pixel text-[7px] text-neon-green/70">YES</span>
            </div>
          </div>
          <span className={`font-pixel text-sm tabular-nums ${
            yesPercent > 50 ? "text-neon-green" : "text-text-primary"
          }`}>
            {yesPercent.toFixed(1)}%
          </span>
        </div>

        {/* Odds bar — split YES/NO */}
        <div className="relative h-3 w-full rounded-full overflow-hidden bg-monad-dark border border-monad-purple/15">
          {/* YES bar (left, green) */}
          <div
            className="absolute inset-y-0 left-0 rounded-l-full transition-all duration-700 ease-out"
            style={{
              width: `${yesPercent}%`,
              background: "linear-gradient(90deg, #39FF14, #2abf10)",
              boxShadow: yesPercent > 50 ? "0 0 8px #39FF1440" : "none",
            }}
          />
          {/* NO bar (right, red) */}
          <div
            className="absolute inset-y-0 right-0 rounded-r-full transition-all duration-700 ease-out"
            style={{
              width: `${noPercent}%`,
              background: "linear-gradient(90deg, #cc2828, #FF3131)",
              boxShadow: noPercent > 50 ? "0 0 8px #FF313140" : "none",
            }}
          />
          {/* Center divider line */}
          <div className="absolute inset-y-0 left-1/2 w-px bg-monad-purple/30" />
        </div>

        {/* Player 2 (NO side) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <PixelAvatar address={market.player2} size={20} />
            <div className="overflow-hidden">
              <span className={`font-pixel text-[9px] block truncate ${p2Won ? "text-neon-green" : "text-text-primary"}`}>
                {market.player2Name}
              </span>
              <span className="font-pixel text-[7px] text-neon-red/70">NO</span>
            </div>
          </div>
          <span className={`font-pixel text-sm tabular-nums ${
            noPercent > 50 ? "text-neon-red" : "text-text-primary"
          }`}>
            {noPercent.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Footer: Liquidity + Winner */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-monad-purple/10">
        <span className="font-pixel text-[7px] text-text-dim">
          POOL: {parseFloat(market.totalLiquidity).toFixed(2)} MON
        </span>
        {isResolved && hasWinner && (
          <span className="font-pixel text-[7px] text-neon-yellow">
            WINNER: {market.winnerName}
          </span>
        )}
        {isResolved && !hasWinner && (
          <span className="font-pixel text-[7px] text-neon-yellow">
            DRAW
          </span>
        )}
        {!isResolved && (
          <span className="font-pixel text-[7px] text-monad-purple/50">
            SEED: {parseFloat(market.seedLiquidity).toFixed(2)} MON
          </span>
        )}
      </div>
    </Link>
  );
}
