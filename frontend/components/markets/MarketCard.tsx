import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MarketData } from "@/hooks/useMarkets";

interface MarketCardProps {
  market: MarketData;
}

function truncateAddress(addr: string) {
  if (addr === "0x0000000000000000000000000000000000000000") return "None";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function MarketCard({ market }: MarketCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="text-sm">Market #{market.id}</span>
          <Badge variant={market.resolved ? "secondary" : "default"}>
            {market.resolved ? "Resolved" : "Active"}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Match #{market.matchId}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Players */}
        <div className="flex justify-between text-sm">
          <div>
            <p className="text-muted-foreground">Player 1 (YES)</p>
            <p className="font-mono text-xs">{truncateAddress(market.player1)}</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">Player 2 (NO)</p>
            <p className="font-mono text-xs">{truncateAddress(market.player2)}</p>
          </div>
        </div>

        {/* Price bars */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-green-500 font-medium">YES</span>
            <span className="font-mono">{market.yesPrice.toFixed(1)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${Math.min(market.yesPrice, 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-red-500 font-medium">NO</span>
            <span className="font-mono">{market.noPrice.toFixed(1)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-red-500 transition-all"
              style={{ width: `${Math.min(market.noPrice, 100)}%` }}
            />
          </div>
        </div>

        {/* Liquidity info */}
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Seed: {parseFloat(market.seedLiquidity).toFixed(4)} MON</span>
          {market.resolved && (
            <span>Winner: {truncateAddress(market.winner)}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
