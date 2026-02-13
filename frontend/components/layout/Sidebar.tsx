import Link from "next/link";
import { useRouter } from "next/router";
import {
  LayoutDashboard,
  Swords,
  Users,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Sidebar navigation items — Dashboard now points to /dashboard
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/matches", label: "Matches", icon: Swords },
  { href: "/opponents", label: "Opponents", icon: Users },
  { href: "/markets", label: "Markets", icon: TrendingUp },
  { href: "/tournaments", label: "Tournaments", icon: Trophy },
];

export function Sidebar() {
  const router = useRouter();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-card">
      {/* Logo / branding */}
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <Swords className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold tracking-tight">Molteee</span>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = router.pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-6 py-4">
        <p className="text-xs text-muted-foreground">Monad Testnet</p>
      </div>
    </aside>
  );
}
