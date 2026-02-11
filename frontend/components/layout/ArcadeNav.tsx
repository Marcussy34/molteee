import Link from "next/link";
import { useRouter } from "next/router";

const NAV_LINKS = [
  { href: "/", label: "HOME" },
  { href: "/arena", label: "ARENA" },
  { href: "/leaderboard", label: "SCORES" },
  { href: "/matches", label: "MATCHES" },
  { href: "/bot", label: "BOT" },
  { href: "/about", label: "ABOUT" },
];

export function ArcadeNav() {
  const router = useRouter();

  // Match exact path or prefix for dynamic routes
  function isActive(href: string) {
    if (href === "/") return router.pathname === "/";
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
