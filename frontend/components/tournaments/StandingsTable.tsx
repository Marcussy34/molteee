import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface StandingsTableProps {
  participants: string[];
  // Connected wallet address — used to highlight "You" in the table
  userAddress?: string;
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function StandingsTable({ participants, userAddress }: StandingsTableProps) {
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
          const isUser = userAddress
            ? addr.toLowerCase() === userAddress.toLowerCase()
            : false;
          return (
            <TableRow key={i} className={isUser ? "bg-accent/30" : ""}>
              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
              <TableCell className="font-mono text-sm">
                {truncateAddress(addr)}
                {isUser && (
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
