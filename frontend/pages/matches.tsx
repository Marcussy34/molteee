import { useAccount } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchTable } from "@/components/matches/MatchTable";
import { useMatchHistory } from "@/hooks/useMatchHistory";

export default function MatchesPage() {
  const { address } = useAccount();
  const { matches, loading } = useMatchHistory(address);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Match History</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            All Matches ({matches.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MatchTable matches={matches} loading={loading} />
        </CardContent>
      </Card>
    </div>
  );
}
