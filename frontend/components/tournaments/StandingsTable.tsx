import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FIGHTER_ADDRESS } from "@/lib/contracts";

interface StandingsTableProps {
  participants: string[];
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function StandingsTable({ participants }: StandingsTableProps) {
  if (participants.length === 0) {
    return <p className="text-sm text-muted-foreground">No participants yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">#</TableHead>
          <TableHead>Participant</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {participants.map((addr, i) => {
          const isFighter = addr.toLowerCase() === FIGHTER_ADDRESS.toLowerCase();
          return (
            <TableRow key={i} className={isFighter ? "bg-accent/30" : ""}>
              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
              <TableCell className="font-mono text-sm">
                {truncateAddress(addr)}
                {isFighter && (
                  <span className="ml-2 text-xs text-primary">(You)</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
