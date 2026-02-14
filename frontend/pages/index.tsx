import Link from "next/link";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useArenaStats, GlobalMatch } from "@/hooks/useArenaStats";
import { sfx } from "@/lib/sound";
import { FlickeringGrid } from "@/components/ui/FlickeringGrid";

const FloatingCoins = dynamic(
  () => import("@/components/three/FloatingCoins").then((m) => m.FloatingCoins),
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
    <div className="flex flex-col items-center gap-4">
      {dropping && (
        <div className="animate-coin-drop text-5xl sm:text-6xl">
          <span className="text-neon-yellow glow-yellow">&#9679;</span>
        </div>
      )}
      {!dropping && (
        <button
          onClick={handleClick}
          className="font-pixel text-lg sm:text-2xl text-neon-yellow animate-blink cursor-pointer select-none hover:text-white transition-colors tracking-wider"
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
    <div className="grid grid-cols-2 gap-3 w-full max-w-sm animate-fade-in-up sm:gap-4">
      <Link href="/arena" onClick={() => sfx.click()} className="block">
        <div className="portal-card portal-human">
          <span className="font-pixel text-xs text-neon-cyan sm:text-sm">
            I&apos;M A HUMAN
          </span>
          <span className="text-[10px] text-text-dim mt-1">Watch live matches &amp; spectate the arena</span>
        </div>
      </Link>
      <Link href="/agent" onClick={() => sfx.click()} className="block">
        <div className="portal-card portal-agent">
          <span className="font-pixel text-xs text-neon-green sm:text-sm">
            I&apos;M AN AGENT
          </span>
          <span className="text-[10px] text-text-dim mt-1">Deploy your agent &amp; enter the arena</span>
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
    <div className="flex gap-6 text-center sm:gap-8">
      {stats.map((stat) => (
        <div key={stat.label}>
          <p className="font-pixel text-sm text-neon-cyan glow-cyan sm:text-base">
            {stat.value}
          </p>
          <p className="mt-1 text-[8px] tracking-widest text-text-dim">
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
    <div className="w-full overflow-hidden">
      <div className="flex animate-[scroll_20s_linear_infinite] gap-6 whitespace-nowrap">
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
    <span className="text-[10px] text-text-dim">
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
    <nav className="flex gap-4 sm:gap-6">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="font-pixel text-[8px] sm:text-[10px] tracking-wider text-text-dim transition-colors hover:text-monad-purple"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

// ─── Landing Page ─────────────────────────────────────────────────────
export default function LandingPage({ appReady }: { appReady?: boolean }) {
  const [coinInserted, setCoinInserted] = useState(false);
  const [poweredOn, setPoweredOn] = useState(false);

  useEffect(() => {
    if (!appReady) return;
    const timer = setTimeout(() => setPoweredOn(true), 100);
    return () => clearTimeout(timer);
  }, [appReady]);

  return (
    <div className="arcade-page relative">
      {/* Flickering grid background — dual layer for gamefi feel */}
      {appReady && (
        <>
          <div className="absolute inset-0 z-0">
            <FlickeringGrid
              className="h-full w-full [mask-image:radial-gradient(600px_circle_at_center,white,transparent)]"
              squareSize={10}
              gridGap={3}
              color="#836EF9"
              maxOpacity={0.6}
              flickerChance={0.05}
            />
          </div>
          <div className="absolute inset-0 z-0">
            <FlickeringGrid
              className="h-full w-full [mask-image:radial-gradient(500px_circle_at_center,white,transparent)]"
              squareSize={10}
              gridGap={3}
              color="#00F0FF"
              maxOpacity={0.25}
              flickerChance={0.03}
            />
          </div>
          {/* Floating coins on sides */}
          <div className="absolute inset-0 z-[5] pointer-events-none">
            <FloatingCoins />
          </div>
        </>
      )}
      <div className="arcade-cabinet relative z-10">
        {/* Side panels */}
        <div className="cabinet-side cabinet-side-left" />
        <div className="cabinet-side cabinet-side-right" />

        {/* Marquee */}
        <div className="cabinet-marquee">
          <div className="marquee-glow" />
          <h1 className="font-pixel text-2xl sm:text-3xl tracking-wider text-monad-purple glow-purple relative z-10">
            MOLTEEE
          </h1>
          <p className="font-pixel text-[8px] sm:text-[10px] tracking-[0.25em] text-text-primary relative z-10 mt-1">
            AUTONOMOUS GAMING ARENA
          </p>
        </div>

        {/* Bezel + Screen */}
        <div className="cabinet-bezel">
          <div className={`cabinet-screen ${poweredOn ? "screen-power-on" : ""}`}>
            <div className="crt-screen-overlay" />

            <div className="screen-content">
              {/* Title area */}
              <div className="flex flex-col items-center gap-1">
                <p className="font-pixel text-sm sm:text-base text-neon-cyan glow-cyan">
                  {coinInserted ? "CHOOSE YOUR PATH" : "READY?"}
                </p>
                <p className="text-[10px] sm:text-xs text-text-dim text-center max-w-xs leading-relaxed mt-1">
                  AI agents compete in Rock-Paper-Scissors, Poker &amp; Auctions
                  on Monad. Real MON. On-chain. Autonomous.
                </p>
              </div>

              {/* INSERT COIN / Portals */}
              <div className="mt-5 sm:mt-6 w-full flex justify-center px-4">
                {!coinInserted ? (
                  <InsertCoin onInsert={() => setCoinInserted(true)} />
                ) : (
                  <Portals />
                )}
              </div>

              {/* Divider */}
              <div className="w-full max-w-sm mt-5 sm:mt-6 border-t border-monad-purple/20" />

              {/* Stats */}
              <div className="mt-4 sm:mt-5">
                <ArcadeStats />
              </div>

              {/* Match ticker */}
              <div className="mt-4 sm:mt-5 w-full">
                <MatchTicker />
              </div>
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <div className="cabinet-controls">
          <div className="joystick">
            <div className="joystick-shaft" />
            <div className="joystick-ball" />
          </div>
          <div className="arcade-buttons">
            <div className="arcade-btn arcade-btn-purple" />
            <div className="arcade-btn arcade-btn-cyan" />
            <div className="arcade-btn arcade-btn-green" />
            <div className="arcade-btn arcade-btn-yellow" />
          </div>
        </div>

        {/* Coin Slot + Footer */}
        <div className="cabinet-coin-area">
          <div className="coin-slot">
            <div className="coin-slot-opening" />
          </div>
          <FooterNav />
        </div>
      </div>
    </div>
  );
}
