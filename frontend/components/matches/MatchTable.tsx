import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GAME_TYPE_LABELS } from "@/lib/contracts";
import type { MatchRecord } from "@/hooks/useMatchHistory";

interface MatchTableProps {
  matches: MatchRecord[];
  loading: boolean;
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDate(timestamp: number) {
  if (!timestamp) return "—";
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MatchTable({ matches, loading }: MatchTableProps) {
  // Newest first
  const sorted = [...matches].reverse();

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground">No matches found.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Opponent</TableHead>
          <TableHead>Game Type</TableHead>
          <TableHead>Result</TableHead>
          <TableHead className="text-right">Wager</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((match, i) => (
          <TableRow key={i}>
            <TableCell className="text-muted-foreground">
              {formatDate(match.timestamp)}
            </TableCell>
            <TableCell className="font-mono text-sm">
              {truncateAddress(match.opponent)}
            </TableCell>
            <TableCell>
              {GAME_TYPE_LABELS[match.gameType] ?? `Game ${match.gameType}`}
            </TableCell>
            <TableCell>
              <Badge variant={match.won ? "default" : "destructive"}>
                {match.won ? "WIN" : "LOSS"}
              </Badge>
            </TableCell>
            <TableCell className="text-right">{match.wager} MON</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
