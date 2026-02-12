import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MatchRecord } from "@/hooks/useMatchHistory";

interface OpponentStats {
  address: string;
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  lastPlayed: number;
  totalWagered: string;
}

interface OpponentCardProps {
  stats: OpponentStats;
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDate(timestamp: number) {
  if (!timestamp) return "—";
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Build opponent stats from match history
export function groupByOpponent(matches: MatchRecord[]): OpponentStats[] {
  const map = new Map<string, MatchRecord[]>();
  for (const m of matches) {
    const existing = map.get(m.opponent) ?? [];
    existing.push(m);
    map.set(m.opponent, existing);
  }

  return Array.from(map.entries())
    .map(([address, records]) => {
      const wins = records.filter((r) => r.won).length;
      const totalWagered = records.reduce(
        (sum, r) => sum + parseFloat(r.wager),
        0
      );
      const lastPlayed = Math.max(...records.map((r) => r.timestamp));
      return {
        address,
        matches: records.length,
        wins,
        losses: records.length - wins,
        winRate: Math.round((wins / records.length) * 100),
        lastPlayed,
        totalWagered: totalWagered.toFixed(4),
      };
    })
    .sort((a, b) => b.matches - a.matches);
}

export function OpponentCard({ stats }: OpponentCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="font-mono text-sm">{truncateAddress(stats.address)}</span>
          <Badge variant={stats.winRate >= 50 ? "default" : "destructive"}>
            {stats.winRate}% WR
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Matches</p>
            <p className="font-medium">{stats.matches}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Record</p>
            <p className="font-medium">
              <span className="text-green-500">{stats.wins}W</span>
              {" / "}
              <span className="text-red-500">{stats.losses}L</span>
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Wagered</p>
            <p className="font-medium">{stats.totalWagered} MON</p>
          </div>
          <div>
            <p className="text-muted-foreground">Last Played</p>
            <p className="font-medium">{formatDate(stats.lastPlayed)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
