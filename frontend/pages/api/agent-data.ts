import type { NextApiRequest, NextApiResponse } from "next";
import agentsData from "@/data/agents.json";
import opponentModels from "@/data/opponent_models.json";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { address } = req.query;

  // Single agent lookup
  if (address && typeof address === "string") {
    const agent = agentsData.find(
      (a) => a.address.toLowerCase() === address.toLowerCase()
    );
    if (!agent) return res.status(404).json({ ok: false, error: "Agent not found" });
    const model = opponentModels[agent.address as keyof typeof opponentModels] || null;
    return res.status(200).json({ ok: true, data: agent, strategyStats: model });
  }

  // Return all agents
  return res.status(200).json({ ok: true, data: agentsData });
}
