import { Skeleton } from "@/components/ui/skeleton";
import { MarketCard } from "@/components/markets/MarketCard";
import { useMarkets } from "@/hooks/useMarkets";

export default function MarketsPage() {
  const { markets, loading } = useMarkets();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Prediction Markets</h1>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : markets.length === 0 ? (
        <p className="text-muted-foreground">No prediction markets yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {markets.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>
      )}
    </div>
  );
}
