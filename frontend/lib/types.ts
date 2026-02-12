export interface Agent {
  address: string;
  name: string;
  elo: { rps: number; poker: number; auction: number; overall: number };
  wins: number;
  losses: number;
  draws: number;
  bankroll: string;
  registered: boolean;
  favoriteGame: "rps" | "poker" | "auction";
  strategy?: string;
}

export interface MatchRound {
  round: number;
  moveA?: string;
  moveB?: string;
  actionA?: string;
  actionB?: string;
  bidA?: string;
  bidB?: string;
  winner: "A" | "B" | "draw";
}

export interface Match {
  id: string;
  matchId: number;
  gameType: "rps" | "poker" | "auction";
  playerA: { address: string; name: string };
  playerB: { address: string; name: string };
  wager: string;
  rounds: MatchRound[];
  result: "playerA" | "playerB" | "draw";
  eloChange: { playerA: number; playerB: number };
  strategyUsed: string;
  txHashes: string[];
  timestamp: number;
}

export interface LeaderboardEntry {
  rank: number;
  address: string;
  name: string;
  elo: number;
  wins: number;
  losses: number;
  winRate: number;
  recentChange: number;
}
