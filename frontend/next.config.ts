import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Rewrite /skill.md to the API route that serves Agent Skill-format SKILL.md.
  // This lets agents discover the arena at https://<domain>/skill.md
  async rewrites() {
    return [
      {
        source: "/skill.md",
        destination: "/api/skill-md",
      },
      {
        // Serve agent-card.json at the standard .well-known path for agent discovery
        source: "/.well-known/agent-card.json",
        destination: "/api/agent-card",
      },
    ];
  },
};

export default nextConfig;
