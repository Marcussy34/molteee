import { useAccount } from "wagmi";
import { Skeleton } from "@/components/ui/skeleton";
import { OpponentCard, groupByOpponent } from "@/components/opponents/OpponentCard";
import { useMatchHistory } from "@/hooks/useMatchHistory";

export default function OpponentsPage() {
  const { address } = useAccount();
  const { matches, loading } = useMatchHistory(address);
  const opponents = groupByOpponent(matches);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Opponents</h1>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : opponents.length === 0 ? (
        <p className="text-muted-foreground">No opponents faced yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {opponents.map((stats) => (
            <OpponentCard key={stats.address} stats={stats} />
          ))}
        </div>
      )}
    </div>
  );
}
