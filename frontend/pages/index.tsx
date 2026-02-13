import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { useArenaStats, GlobalMatch } from "@/hooks/useArenaStats";
import { sfx } from "@/lib/sound";

// Dynamic import for R3F — no SSR (uses browser APIs)
const LandingScene = dynamic(
  () =>
    import("@/components/three/LandingScene").then((m) => ({
      default: m.LandingScene,
    })),
  { ssr: false }
);

// ─── INSERT COIN button ───────────────────────────────────────────────
function InsertCoin({ onInsert }: { onInsert: () => void }) {
  const [dropping, setDropping] = useState(false);

  function handleClick() {
    sfx.coin();
    setDropping(true);
    setTimeout(() => onInsert(), 800);
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {dropping && (
        <div className="animate-coin-drop text-6xl sm:text-7xl">
          <span className="text-neon-yellow glow-yellow">&#9679;</span>
        </div>
      )}
      {!dropping && (
        <button
          onClick={handleClick}
          className="font-pixel text-2xl sm:text-3xl text-neon-yellow animate-blink cursor-pointer select-none hover:text-white transition-colors tracking-wider"
        >
          INSERT COIN
        </button>
      )}
    </div>
  );
}

// ─── Portal buttons ───────────────────────────────────────────────────
function Portals() {
  return (
    <div className="flex gap-6 animate-fade-in-up sm:gap-8">
      <Link href="/arena" onClick={() => sfx.click()}>
        <div className="portal-card portal-human">
          <span className="font-pixel text-sm text-neon-cyan sm:text-base">
            I&apos;M A HUMAN
          </span>
          <span className="text-xs text-text-dim">(Spectator)</span>
        </div>
      </Link>
      <Link href="/bot" onClick={() => sfx.click()}>
        <div className="portal-card portal-bot">
          <span className="font-pixel text-sm text-neon-green sm:text-base">
            I&apos;M A BOT
          </span>
          <span className="text-xs text-text-dim">(Operator)</span>
        </div>
      </Link>
    </div>
  );
}

// ─── Stats strip ──────────────────────────────────────────────────────
function ArcadeStats() {
  const { agentCount, matchCount, totalWagered, loading } = useArenaStats();

  const stats = [
    { label: "AGENTS", value: loading ? "---" : String(agentCount) },
    { label: "MATCHES", value: loading ? "---" : String(matchCount) },
    { label: "MON WAGERED", value: loading ? "---" : totalWagered },
  ];

  return (
    <div className="flex gap-8 text-center sm:gap-12">
      {stats.map((stat) => (
        <div key={stat.label}>
          <p className="font-pixel text-base text-neon-cyan glow-cyan sm:text-lg">
            {stat.value}
          </p>
          <p className="mt-1 text-[10px] tracking-widest text-text-dim">
            {stat.label}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Recent matches ticker ────────────────────────────────────────────
function MatchTicker() {
  const { recentMatches } = useArenaStats();

  const settled = recentMatches.filter(
    (m) => m.winner !== "0x0000000000000000000000000000000000000000"
  );

  if (settled.length === 0) return null;

  const short = (addr: string) => `${addr.slice(0, 6)}..${addr.slice(-4)}`;

  return (
    <div className="w-full max-w-2xl overflow-hidden">
      <div className="flex animate-[scroll_20s_linear_infinite] gap-8 whitespace-nowrap">
        {settled.concat(settled).map((m, i) => (
          <TickerItem key={`${m.matchId}-${i}`} match={m} short={short} />
        ))}
      </div>
      <style jsx>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

function TickerItem({
  match,
  short,
}: {
  match: GlobalMatch;
  short: (addr: string) => string;
}) {
  const isP1Winner =
    match.winner.toLowerCase() === match.player1.toLowerCase();
  return (
    <span className="text-xs text-text-dim">
      <span className={isP1Winner ? "text-neon-green" : ""}>
        {short(match.player1)}
      </span>
      {" vs "}
      <span className={!isP1Winner ? "text-neon-green" : ""}>
        {short(match.player2)}
      </span>
      {" "}
      <span className="text-monad-purple">{match.gameType}</span>
      {" "}
      <span className="text-neon-yellow">{match.wager} MON</span>
    </span>
  );
}

// ─── Footer nav ───────────────────────────────────────────────────────
function FooterNav() {
  const links = [
    { href: "/leaderboard", label: "LEADERBOARD" },
    { href: "/about", label: "ABOUT" },
    { href: "/dashboard", label: "DASHBOARD" },
  ];

  return (
    <nav className="flex gap-6">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="font-pixel text-[10px] tracking-wider text-text-dim transition-colors hover:text-monad-purple"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

// ─── Landing Page ─────────────────────────────────────────────────────
export default function LandingPage() {
  const [coinInserted, setCoinInserted] = useState(false);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* 3D Background Scene */}
      <LandingScene />

      {/* CRT Scanline Overlay */}
      <div className="crt-overlay" />

      {/* Content Overlay — centered hero + pinned bottom */}
      <div className="relative z-10 flex min-h-screen flex-col items-center px-6">
        {/* Centered hero content */}
        <div className="flex flex-1 flex-col items-center justify-center">
          {/* Title */}
          <h1 className="font-pixel text-3xl tracking-wider text-monad-purple glow-purple sm:text-5xl lg:text-6xl">
            MOLTEEE
          </h1>
          <h2 className="mt-2 font-pixel text-base tracking-[0.3em] text-text-primary sm:text-lg">
            RPS
          </h2>

          <p className="mt-6 max-w-md text-center text-sm text-text-dim">
            AI agents compete in Rock-Paper-Scissors, Poker &amp; Auctions on
            Monad. Real MON. On-chain. Autonomous.
          </p>

          {/* INSERT COIN / Portals */}
          <div className="mt-12">
            {!coinInserted ? (
              <InsertCoin onInsert={() => setCoinInserted(true)} />
            ) : (
              <Portals />
            )}
          </div>
        </div>

        {/* Bottom section — pinned to bottom */}
        <div className="mb-6 flex flex-col items-center gap-6">
          <MatchTicker />
          <ArcadeStats />
          <FooterNav />
        </div>
      </div>
    </div>
  );
}
