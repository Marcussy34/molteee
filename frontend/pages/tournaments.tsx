import { useState } from "react";
import { useAccount } from "wagmi";
import { Skeleton } from "@/components/ui/skeleton";
import { TournamentCard } from "@/components/tournaments/TournamentCard";
import { StandingsTable } from "@/components/tournaments/StandingsTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTournaments } from "@/hooks/useTournaments";

export default function TournamentsPage() {
  const { address } = useAccount();
  const { tournaments, loading } = useTournaments();
  // Track which tournament's participants are expanded
  const [expanded, setExpanded] = useState<string | null>(null);

  function toggleExpand(key: string) {
    setExpanded((prev) => (prev === key ? null : key));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tournaments</h1>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : tournaments.length === 0 ? (
        <p className="text-muted-foreground">No tournaments yet.</p>
      ) : (
        <div className="space-y-4">
          {tournaments.map((t) => {
            const key = `tournament-${t.id}`;
            const isExpanded = expanded === key;
            return (
              <div key={key} className="space-y-2">
                <div
                  className="cursor-pointer"
                  onClick={() => toggleExpand(key)}
                >
                  <TournamentCard tournament={t} />
                </div>
                {isExpanded && t.participants.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Participants</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <StandingsTable
                        participants={t.participants}
                        userAddress={address}
                      />
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
