import { Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FIGHTER_ADDRESS } from "@/lib/contracts";

interface HeaderProps {
  balance: string | null;
  loading: boolean;
}

export function Header({ balance, loading }: HeaderProps) {
  // Truncate address for display: 0x6cCB...7Fbf
  const truncated = `${FIGHTER_ADDRESS.slice(0, 6)}...${FIGHTER_ADDRESS.slice(-4)}`;

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      <h2 className="text-lg font-semibold">Fighter Dashboard</h2>

      <div className="flex items-center gap-4">
        {/* MON balance */}
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          {loading ? (
            <Skeleton className="h-5 w-20" />
          ) : (
            <span className="text-sm font-medium">
              {balance ? `${balance} MON` : "—"}
            </span>
          )}
        </div>

        {/* Fighter address badge */}
        <Badge variant="secondary" className="font-mono text-xs">
          {truncated}
        </Badge>
      </div>
    </header>
  );
}
