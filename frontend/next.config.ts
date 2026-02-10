import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Rewrite /skill.md to the API route that serves OpenClaw-format SKILL.md.
  // This lets agents discover the arena at https://<domain>/skill.md
  async rewrites() {
    return [
      {
        source: "/skill.md",
        destination: "/api/skill-md",
      },
    ];
  },
};

export default nextConfig;
