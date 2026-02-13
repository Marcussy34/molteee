import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Deprecated: Leaderboard data now comes from on-chain AgentRegistry via useLeaderboard.
 * This route is stubbed for backward compatibility.
 */
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  return res.status(200).json({ ok: false, data: [] });
}
