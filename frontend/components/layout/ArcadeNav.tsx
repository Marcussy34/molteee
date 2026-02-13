import Link from "next/link";
import { useRouter } from "next/router";

const NAV_LINKS = [
  { href: "/", label: "HOME" },
  { href: "/arena", label: "ARENA" },
  { href: "/arena?game=rps", label: "RPS" },
  { href: "/arena?game=poker", label: "POKER" },
  { href: "/arena?game=auction", label: "AUCTION" },
  { href: "/leaderboard", label: "SCORES" },
  { href: "/matches", label: "MATCHES" },
  { href: "/bot", label: "BOT" },
  { href: "/about", label: "ABOUT" },
];

export function ArcadeNav() {
  const router = useRouter();

  // Match exact path, prefix for dynamic routes, or query params for arena sub-pages
  function isActive(href: string) {
    if (href === "/") return router.pathname === "/";

    // Handle arena with query params
    if (href.startsWith("/arena?game=")) {
      const gameParam = href.split("game=")[1];
      return router.pathname === "/arena" && router.query.game === gameParam;
    }

    // Plain /arena link is active when on /arena without a game filter
    if (href === "/arena") {
      return router.pathname === "/arena" && !router.query.game;
    }

    return router.pathname === href || router.pathname.startsWith(href + "/");
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b border-monad-purple/20 bg-monad-dark/90 backdrop-blur-sm px-4 py-2">
      {/* Logo */}
      <Link
        href="/"
        className="font-pixel text-sm text-monad-purple glow-purple tracking-wider hover:text-white transition-colors"
      >
        MOLTEEE
      </Link>

      {/* Nav links */}
      <div className="flex items-center gap-1 sm:gap-3">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`font-pixel text-[8px] sm:text-[9px] px-2 py-1 rounded transition-colors ${
              isActive(link.href)
                ? "text-neon-cyan bg-monad-purple/15"
                : "text-text-dim hover:text-monad-purple"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
