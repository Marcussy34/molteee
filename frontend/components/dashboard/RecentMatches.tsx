import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GAME_TYPE_LABELS } from "@/lib/contracts";
import type { MatchRecord } from "@/hooks/useMatchHistory";

interface RecentMatchesProps {
  matches: MatchRecord[];
  loading: boolean;
}

// Truncate address: 0x1234...abcd
function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function RecentMatches({ matches, loading }: RecentMatchesProps) {
  // Show last 10, newest first
  const recent = [...matches].reverse().slice(0, 10);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Recent Matches</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches yet</p>
        ) : (
          <ScrollArea className="h-[320px]">
            <div className="space-y-2">
              {recent.map((match, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={match.won ? "default" : "destructive"}
                      className="w-12 justify-center text-xs"
                    >
                      {match.won ? "WIN" : "LOSS"}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium font-mono">
                        {truncateAddress(match.opponent)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {GAME_TYPE_LABELS[match.gameType] ?? `Game ${match.gameType}`}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {match.wager} MON
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
