import type { NextApiRequest, NextApiResponse } from "next";
import matchesData from "@/data/matches.json";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, gameType } = req.query;

  // Single match lookup
  if (id && typeof id === "string") {
    const match = matchesData.find((m) => m.id === id);
    if (!match) return res.status(404).json({ ok: false, error: "Match not found" });
    return res.status(200).json({ ok: true, data: match });
  }

  let filtered = matchesData;

  // Filter by game type
  if (gameType && typeof gameType === "string") {
    filtered = filtered.filter((m) => m.gameType === gameType);
  }

  // Sort by timestamp descending (newest first)
  filtered = [...filtered].sort((a, b) => b.timestamp - a.timestamp);

  return res.status(200).json({ ok: true, data: filtered });
}
