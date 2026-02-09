import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TournamentStatus, TournamentFormat, type TournamentData } from "@/hooks/useTournaments";

interface TournamentCardProps {
  tournament: TournamentData;
}

const STATUS_LABELS: Record<number, string> = {
  [TournamentStatus.Registration]: "Registration",
  [TournamentStatus.Active]: "Active",
  [TournamentStatus.Completed]: "Completed",
  [TournamentStatus.Cancelled]: "Cancelled",
};

const FORMAT_LABELS: Record<number, string> = {
  [TournamentFormat.RoundRobin]: "Round Robin",
  [TournamentFormat.DoubleElimination]: "Double Elimination",
};

function truncateAddress(addr: string) {
  if (addr === "0x0000000000000000000000000000000000000000") return "TBD";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function statusVariant(status: number) {
  switch (status) {
    case TournamentStatus.Active:
      return "default" as const;
    case TournamentStatus.Completed:
      return "secondary" as const;
    case TournamentStatus.Cancelled:
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

export function TournamentCard({ tournament: t }: TournamentCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="text-sm">
            V{t.version} Tournament #{t.id}
          </span>
          <Badge variant={statusVariant(t.status)}>
            {STATUS_LABELS[t.status] ?? "Unknown"}
          </Badge>
        </CardTitle>
        {t.version === 2 && t.format !== undefined && (
          <p className="text-xs text-muted-foreground">
            {FORMAT_LABELS[t.format] ?? "Unknown Format"}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Entry Fee</p>
            <p className="font-medium">{parseFloat(t.entryFee).toFixed(4)} MON</p>
          </div>
          <div>
            <p className="text-muted-foreground">Prize Pool</p>
            <p className="font-medium">{parseFloat(t.prizePool).toFixed(4)} MON</p>
          </div>
          <div>
            <p className="text-muted-foreground">Players</p>
            <p className="font-medium">
              {t.playerCount} / {t.maxPlayers}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Winner</p>
            <p className="font-mono text-xs font-medium">{truncateAddress(t.winner)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
