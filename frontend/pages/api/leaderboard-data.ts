import type { NextApiRequest, NextApiResponse } from "next";
import agentsData from "@/data/agents.json";
import type { LeaderboardEntry } from "@/lib/types";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { game } = req.query;

  const entries: LeaderboardEntry[] = agentsData
    .map((agent) => {
      const eloKey = (typeof game === "string" && (game === "rps" || game === "poker" || game === "auction"))
        ? game
        : "overall";
      const elo = agent.elo[eloKey as keyof typeof agent.elo];
      const total = agent.wins + agent.losses;
      const winRate = total > 0 ? Math.round((agent.wins / total) * 100) : 0;

      // Simulate recent change based on ELO relative to 1000
      const recentChange = elo > 1050 ? Math.floor((elo - 1050) / 5) : elo < 980 ? -Math.floor((980 - elo) / 5) : 0;

      return {
        rank: 0,
        address: agent.address,
        name: agent.name,
        elo,
        wins: agent.wins,
        losses: agent.losses,
        winRate,
        recentChange,
      };
    })
    .sort((a, b) => b.elo - a.elo)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));

  return res.status(200).json({ ok: true, data: entries });
}
