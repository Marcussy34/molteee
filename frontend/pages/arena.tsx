import dynamic from "next/dynamic";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { StatPanel } from "@/components/ui/StatPanel";
import { ScoreTicker } from "@/components/ui/ScoreTicker";
import { LiveMatchList } from "@/components/ui/LiveMatchList";
import { MoveRevealPopup } from "@/components/ui/MoveRevealPopup";
import { PokerTable } from "@/components/poker/PokerTable";
import { AuctionStage } from "@/components/auction/AuctionStage";
import { useActiveMatches, type GameFilter, type OnChainMatch } from "@/hooks/useActiveMatches";
import { useLiveGameState } from "@/hooks/useLiveGameState";
import { useBattleDirector } from "@/hooks/useBattleDirector";
import { usePokerDirector } from "@/hooks/usePokerDirector";
import { useAuctionDirector } from "@/hooks/useAuctionDirector";
import { liveToRpsMatch, liveToPokerMatch, liveToAuctionMatch, rpsMoveLabel } from "@/lib/liveStateAdapters";
import { getAgentName } from "@/lib/agentNames";
import { formatEther } from "viem";

// Lazy-load the 3D arena scene (client-only, uses Three.js)
const ArenaScene = dynamic(
  () => import("@/components/three/ArenaScene").then((m) => ({ default: m.ArenaScene })),
  { ssr: false }
);

export default function ArenaPage() {
  const router = useRouter();

  // ─── Filter from URL query ────────────────────────────────────────────────
  const filterParam = (router.query.game as string) || "all";
  const filter: GameFilter = ["rps", "poker", "auction"].includes(filterParam)
    ? (filterParam as GameFilter)
    : "all";

  const setFilter = (f: GameFilter) => {
    if (f === "all") {
      router.push("/arena", undefined, { shallow: true });
    } else {
      router.push(`/arena?game=${f}`, undefined, { shallow: true });
    }
  };

  // ─── Match discovery from Escrow contract ─────────────────────────────────
  const { liveMatches, pendingChallenges, recentSettled, loading } = useActiveMatches(filter);

  // ─── Selected match ───────────────────────────────────────────────────────
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const userDeselectedRef = useRef(false);
  // Latch: keep passing game state to directors even after settlement
  // so they can play the final clash → victory cinematic
  const wasLiveRef = useRef(false);

  // No auto-select — let the user choose which match to enter.
  // Live matches appear in the match list with a LIVE badge; user clicks to enter.

  // Wrap setSelectedMatchId to track when user explicitly deselects
  const selectMatch = (id: number | null) => {
    if (id === null) {
      userDeselectedRef.current = true;
      lastSelectedRef.current = null; // Clear safety ref on explicit deselect
    } else {
      userDeselectedRef.current = false;
    }
    setSelectedMatchId(id);
  };

  // Reset live latch when match changes
  useEffect(() => { wasLiveRef.current = false; }, [selectedMatchId]);

  // Find selected match object (use === null to allow matchId 0)
  // Safety: keep a ref to prevent the match from vanishing mid-animation
  // if it briefly disappears from arrays during state transitions
  const lastSelectedRef = useRef<OnChainMatch | null>(null);

  const selectedMatch = useMemo(() => {
    if (selectedMatchId === null) return null;
    const found =
      liveMatches.find((m) => m.matchId === selectedMatchId) ||
      pendingChallenges.find((m) => m.matchId === selectedMatchId) ||
      recentSettled.find((m) => m.matchId === selectedMatchId) ||
      null;
    // Fallback to last known match if it briefly vanishes during settlement transition
    if (found) {
      lastSelectedRef.current = found;
      return found;
    }
    return lastSelectedRef.current;
  }, [selectedMatchId, liveMatches, pendingChallenges, recentSettled]);

  // ─── Live game state for selected match ───────────────────────────────────
  // Use faster polling (2s) for live matches, default (5s) for settled replays
  const isSelectedLive = selectedMatch?.isPlaying === true;
  const { state: gameState, loading: gameLoading } = useLiveGameState(
    selectedMatch?.matchId ?? null,
    selectedMatch?.gameType ?? null,
    selectedMatch?.status === "settled",
    isSelectedLive ? 2000 : 5000,
  );

  // ─── Build synthetic Match arrays for each director ───────────────────────
  // Directors expect Match[] and auto-play through their animation sequences.
  const rpsMatches = useMemo(() => {
    if (!gameState || !selectedMatch || gameState.gameType !== "rps") return [];
    return [liveToRpsMatch(gameState, selectedMatch)];
  }, [gameState, selectedMatch]);

  const pokerMatches = useMemo(() => {
    if (!gameState || !selectedMatch || gameState.gameType !== "poker") return [];
    return [liveToPokerMatch(gameState, selectedMatch)];
  }, [gameState, selectedMatch]);

  const auctionMatches = useMemo(() => {
    if (!gameState || !selectedMatch || gameState.gameType !== "auction") return [];
    return [liveToAuctionMatch(gameState, selectedMatch)];
  }, [gameState, selectedMatch]);

  // ─── Director hooks drive animations ──────────────────────────────────────
  // Pass liveChainState for live matches so directors can be chain-reactive;
  // pass null/undefined for settled matches to use replay mode (fixed timeline).
  // Activate latch when viewing a live match
  if (isSelectedLive && gameState && !gameState.settled) {
    wasLiveRef.current = true;
  }
  // Keep passing chain state to directors even after settlement, so they can
  // play the final clash → round_result → victory cinematic sequence
  const liveChainStateForDirector = (wasLiveRef.current || isSelectedLive) && gameState
    ? gameState
    : null;

  const battleState = useBattleDirector(rpsMatches, liveChainStateForDirector);
  const pokerState = usePokerDirector(pokerMatches, liveChainStateForDirector);
  const auctionState = useAuctionDirector(auctionMatches, liveChainStateForDirector);

  // ─── Score ticker items ───────────────────────────────────────────────────
  const tickerItems = useMemo(() => {
    const all = [...liveMatches, ...recentSettled];
    return all.slice(0, 10).map((m) => {
      const p1 = getAgentName(m.player1);
      const p2 = getAgentName(m.player2);
      const wager = formatEther(m.wager);
      const gameLabel = m.gameType.toUpperCase();
      const statusText = m.status === "settled" && m.winner
        ? `${getAgentName(m.winner)} WINS`
        : "IN PROGRESS";
      return {
        id: String(m.matchId),
        text: `${p1} vs ${p2} — ${gameLabel} — ${statusText} — ${wager} MON`,
        type: (m.status === "settled" ? "win" : "info") as "info" | "win" | "loss",
      };
    });
  }, [liveMatches, recentSettled]);

  // ─── Derived state ────────────────────────────────────────────────────────
  // Only truly live if game is actively in progress on-chain
  const isLive = selectedMatch?.isPlaying === true;
  const p1Name = selectedMatch ? getAgentName(selectedMatch.player1) : "";
  const p2Name = selectedMatch ? getAgentName(selectedMatch.player2) : "";
  const hasGame = gameState !== null;  // game state loaded from chain
  const gameType = gameState?.gameType;

  // Active directors provide current animation phase info
  const activePhase = gameType === "rps" ? battleState.phase
    : gameType === "poker" ? pokerState.phase
    : gameType === "auction" ? auctionState.phase
    : "idle";
  const isAnimating = activePhase !== "idle" && activePhase !== "reset";

  // Only reveal moves at clash or after — keeps suspense until the reveal animation
  const shouldRevealMoves =
    gameType === "rps" &&
    (activePhase === "clash" || activePhase === "round_result" || activePhase === "victory");

  // Active chain phase label from the live director
  const chainPhaseLabel = gameType === "rps" ? battleState.chainPhaseLabel
    : gameType === "poker" ? pokerState.chainPhaseLabel
    : gameType === "auction" ? auctionState.chainPhaseLabel
    : null;

  // Waiting-for label from the live director
  const waitingFor = gameType === "rps" ? battleState.waitingFor
    : gameType === "poker" ? pokerState.waitingFor
    : gameType === "auction" ? auctionState.waitingFor
    : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-monad-dark pt-14">
      {/* CRT Overlay */}
      <div className="crt-overlay" />

      {/* Top: Score Ticker */}
      <ScoreTicker items={tickerItems} />

      {/* Match info bar (when a match is selected) */}
      {selectedMatch && (
        <div className="flex items-center justify-center gap-4 border-b border-monad-purple/20 bg-monad-deeper/80 px-4 py-1.5">
          <span className="font-pixel text-[9px] text-monad-purple">
            {selectedMatch.gameType.toUpperCase()}
          </span>
          {hasGame && gameState.totalRounds !== undefined && (
            <span className="font-pixel text-[9px] text-text-dim">
              ROUND {(gameType === "rps" ? battleState.roundIndex : (gameState.currentRound || 0)) + 1} OF {gameState.totalRounds || 1}
            </span>
          )}
          <span className="font-pixel text-[9px] text-neon-yellow">
            {formatEther(selectedMatch.wager)} MON
          </span>

          {/* Live mode indicators — show during active play AND during settlement grace period */}
          {/* Grace period: isLive may still be true (match in liveMatches) even after settlement */}
          {isLive && (!hasGame || !gameState.settled) && chainPhaseLabel &&
            !["clash", "round_result", "victory"].includes(activePhase) && (
            <span className="font-pixel text-[9px] text-neon-green animate-blink">
              {chainPhaseLabel}
            </span>
          )}
          {/* Live cinematic (clash/result/victory) or live without chain label */}
          {isLive && (!hasGame || !gameState.settled) && (
            !chainPhaseLabel || ["clash", "round_result", "victory"].includes(activePhase)
          ) && (
            <span className="font-pixel text-[9px] text-neon-green animate-blink">LIVE</span>
          )}
          {/* Settlement detected but cinematic still playing (grace period) */}
          {isLive && hasGame && gameState.settled && (
            <span className="font-pixel text-[9px] text-neon-green animate-blink">MATCH COMPLETE</span>
          )}
          {/* Truly past match — not live, not in grace period */}
          {!isLive && hasGame && gameState.settled && (
            <>
              <span className="font-pixel text-[9px] text-monad-purple">REPLAY</span>
              <span className="font-pixel text-[8px] text-text-dim">(past match — showing final round)</span>
            </>
          )}
          <button
            onClick={() => selectMatch(null)}
            className="ml-4 font-pixel text-[8px] text-text-dim hover:text-monad-purple transition-colors"
          >
            ← BACK
          </button>
        </div>
      )}

      {/* Main content area */}
      <div className="relative flex flex-1 overflow-hidden">
        {selectedMatch ? (
          <>
            {/* Left Panel: Player 1 Stats */}
            <div className="w-64 shrink-0 border-r border-monad-purple/20 bg-monad-deeper/60 backdrop-blur-sm overflow-y-auto">
              <StatPanel
                address={selectedMatch.player1}
                name={p1Name}
                elo={0}
                wins={hasGame ? (gameState.p1Score || 0) : 0}
                losses={hasGame ? (gameState.p2Score || 0) : 0}
                bankroll={formatEther(selectedMatch.wager)}
                strategy=""
                side="left"
                isWinner={hasGame && gameState.settled && (gameState.p1Score || 0) > (gameState.p2Score || 0)}
                currentMove={
                  gameType === "rps" && shouldRevealMoves ? battleState.moveA :
                  gameType === "poker" && isAnimating ? pokerState.actionA :
                  gameType === "auction" && isAnimating && auctionState.bidA ? `${auctionState.bidA} MON` :
                  undefined
                }
                hasCommitted={hasGame ? gameState.p1Committed : undefined}
                hasRevealed={hasGame ? gameState.p1Revealed : undefined}
                isLive={isLive && hasGame && !gameState.settled}
              />
            </div>

            {/* Center: Animated game visualization (or loading) */}
            <div className="relative flex-1 min-h-0 overflow-hidden">
              {/* Loading state while game ID is being discovered */}
              {!hasGame && (
                <div className="flex h-full flex-col items-center justify-center gap-3">
                  <span className="font-pixel text-lg text-monad-purple animate-pulse" style={{ textShadow: "0 0 15px #836EF9" }}>
                    CONNECTING TO CHAIN...
                  </span>
                  <span className="font-pixel text-[8px] text-text-dim">
                    Discovering game for match #{selectedMatch.matchId}
                  </span>
                </div>
              )}

              {/* RPS → 3D ArenaScene */}
              {hasGame && gameType === "rps" && (
                <>
                  <ArenaScene battleState={battleState} />

                  {/* ─── Round history indicators (past rounds) ──────────── */}
                  {battleState.roundHistory.length > 0 && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-2">
                      {battleState.roundHistory.map((rh, i) => (
                        <div key={i} className="flex items-center gap-1 rounded border border-monad-purple/20 bg-monad-deeper/70 px-2 py-0.5 backdrop-blur-sm">
                          <span className="font-pixel text-[7px] text-text-dim">R{i + 1}:</span>
                          <span className="font-pixel text-[7px] text-neon-cyan">{rpsMoveLabel(rh.p1Move).toUpperCase() || "?"}</span>
                          <span className="font-pixel text-[6px] text-text-dim">vs</span>
                          <span className="font-pixel text-[7px] text-neon-cyan">{rpsMoveLabel(rh.p2Move).toUpperCase() || "?"}</span>
                          <span className={`font-pixel text-[7px] ${rh.winner === "A" ? "text-neon-green" : rh.winner === "B" ? "text-neon-red" : "text-neon-yellow"}`}>
                            {rh.winner === "A" ? "P1" : rh.winner === "B" ? "P2" : "TIE"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Phase overlays */}
                  {battleState.phase === "round_result" && battleState.roundWinner && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded border border-monad-purple/30 bg-monad-deeper/80 px-6 py-2 backdrop-blur-sm">
                      {battleState.roundWinner === "draw" ? (
                        <span className="font-pixel text-sm text-neon-yellow">DRAW</span>
                      ) : (
                        <span className={`font-pixel text-sm ${battleState.roundWinner === "A" ? "text-neon-green" : "text-neon-red"}`}>
                          {battleState.roundWinner === "A" ? p1Name : p2Name} WINS ROUND
                        </span>
                      )}
                    </div>
                  )}
                  {battleState.phase === "clash" && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                      <span className="font-pixel text-2xl text-neon-yellow animate-blink" style={{ textShadow: "0 0 20px #FFD700" }}>
                        CLASH!
                      </span>
                    </div>
                  )}
                  {battleState.phase === "clash" && battleState.moveA && (
                    <MoveRevealPopup move={battleState.moveA} side="left" visible={battleState.phaseElapsed < 0.6} phaseElapsed={battleState.phaseElapsed} />
                  )}
                  {battleState.phase === "clash" && battleState.moveB && (
                    <MoveRevealPopup move={battleState.moveB} side="right" visible={battleState.phaseElapsed < 0.6} phaseElapsed={battleState.phaseElapsed} />
                  )}
                  {battleState.phase === "victory" && battleState.match && (
                    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                      <span className="font-pixel text-3xl text-neon-green block" style={{ textShadow: "0 0 30px #39FF14" }}>
                        {battleState.matchWinner === "A" ? p1Name : p2Name}
                      </span>
                      <span className="font-pixel text-lg text-neon-yellow mt-2 block">WINS!</span>
                    </div>
                  )}
                  {(battleState.phase === "entrance_a" || battleState.phase === "entrance_b") && battleState.match && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                      <span className="font-pixel text-lg text-monad-purple animate-blink" style={{ textShadow: "0 0 15px #836EF9" }}>
                        {battleState.phase === "entrance_a" ? p1Name : p2Name}
                      </span>
                    </div>
                  )}

                  {/* Standoff overlay: chain-reactive for live, static for replay */}
                  {battleState.phase === "standoff" && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                      {battleState.isLiveMode && waitingFor ? (
                        <>
                          <span className="font-pixel text-lg text-neon-red animate-pulse" style={{ textShadow: "0 0 15px #FF3131" }}>
                            {`ROUND ${battleState.roundIndex + 1}`}
                          </span>
                          <span className="font-pixel text-sm text-monad-purple block mt-2 animate-pulse">
                            {waitingFor}
                          </span>
                        </>
                      ) : (
                        <span className="font-pixel text-4xl text-neon-red animate-blink" style={{ textShadow: "0 0 25px #FF3131" }}>
                          VS
                        </span>
                      )}
                    </div>
                  )}

                  {/* Thinking overlay: chain-reactive for live */}
                  {battleState.phase === "thinking" && battleState.isLiveMode && waitingFor && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                      <span className="font-pixel text-sm text-monad-purple animate-pulse" style={{ textShadow: "0 0 10px #836EF9" }}>
                        {waitingFor}
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Poker → PokerTable with cards, chips, dealer */}
              {hasGame && gameType === "poker" && (
                <PokerTable
                  pokerState={pokerState}
                  playerAName={p1Name}
                  playerBName={p2Name}
                />
              )}

              {/* Auction → AuctionStage with sealed bids, countdown */}
              {hasGame && gameType === "auction" && (
                <AuctionStage
                  auctionState={auctionState}
                  playerAName={p1Name}
                  playerBName={p2Name}
                  isLiveMode={auctionState.isLiveMode}
                  waitingFor={auctionState.waitingFor}
                />
              )}
            </div>

            {/* Right Panel: Player 2 Stats */}
            <div className="w-64 shrink-0 border-l border-monad-purple/20 bg-monad-deeper/60 backdrop-blur-sm overflow-y-auto">
              <StatPanel
                address={selectedMatch.player2}
                name={p2Name}
                elo={0}
                wins={hasGame ? (gameState.p2Score || 0) : 0}
                losses={hasGame ? (gameState.p1Score || 0) : 0}
                bankroll={formatEther(selectedMatch.wager)}
                strategy=""
                side="right"
                isWinner={hasGame && gameState.settled && (gameState.p2Score || 0) > (gameState.p1Score || 0)}
                currentMove={
                  gameType === "rps" && shouldRevealMoves ? battleState.moveB :
                  gameType === "poker" && isAnimating ? pokerState.actionB :
                  gameType === "auction" && isAnimating && auctionState.bidB ? `${auctionState.bidB} MON` :
                  undefined
                }
                hasCommitted={hasGame ? gameState.p2Committed : undefined}
                hasRevealed={hasGame ? gameState.p2Revealed : undefined}
                isLive={isLive && hasGame && !gameState.settled}
              />
            </div>
          </>
        ) : (
          // ─── No match selected: full-width match list ───────────────────
          <div className="relative z-10 flex-1 min-h-0">
            <LiveMatchList
              liveMatches={liveMatches}
              pendingChallenges={pendingChallenges}
              recentSettled={recentSettled}
              loading={loading}
              filter={filter}
              onFilterChange={setFilter}
              selectedMatchId={selectedMatchId}
              onSelectMatch={selectMatch}
            />
          </div>
        )}
      </div>

      {/* Bottom: Match list (collapsed when viewing a game) */}
      {selectedMatch && (
        <div className="relative z-20 shrink-0 border-t border-monad-purple/20 bg-monad-deeper/80 max-h-48 overflow-y-auto">
          <LiveMatchList
            liveMatches={liveMatches}
            pendingChallenges={pendingChallenges}
            recentSettled={recentSettled}
            loading={loading}
            filter={filter}
            onFilterChange={setFilter}
            selectedMatchId={selectedMatchId}
            onSelectMatch={selectMatch}
          />
        </div>
      )}

      {/* Footer link */}
      <div className="shrink-0 border-t border-monad-purple/10 bg-monad-deeper/80 flex justify-center py-1.5">
        <Link href="/matches" className="font-pixel text-[8px] text-text-dim hover:text-monad-purple transition-colors">
          VIEW ALL MATCHES &rarr;
        </Link>
      </div>
    </div>
  );
}
