import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { GameType, GAME_TYPE_LABELS } from "@/lib/contracts";

interface EloChartProps {
  elo: Record<number, number>;
  loading: boolean;
}

// Colors for each game type bar
const COLORS = ["#8b5cf6", "#06b6d4", "#f59e0b"];

export function EloChart({ elo, loading }: EloChartProps) {
  const chartData = [
    { name: "RPS", elo: elo[GameType.RPS] ?? 1000, fullName: GAME_TYPE_LABELS[GameType.RPS] },
    { name: "Poker", elo: elo[GameType.Poker] ?? 1000, fullName: GAME_TYPE_LABELS[GameType.Poker] },
    { name: "Auction", elo: elo[GameType.Auction] ?? 1000, fullName: GAME_TYPE_LABELS[GameType.Auction] },
  ];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">ELO Ratings</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[320px] w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="name"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              />
              <YAxis
                domain={[800, "auto"]}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  color: "hsl(var(--card-foreground))",
                }}
                formatter={(value) => [String(value), "ELO"]}
              />
              <Bar dataKey="elo" radius={[6, 6, 0, 0]} maxBarSize={60}>
                {chartData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
