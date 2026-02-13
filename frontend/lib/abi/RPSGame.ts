// View-only ABI for RPSGame contract (V5 deployment)
export const rpsGameAbi = [
  {
    "type": "function",
    "name": "getGame",
    "inputs": [{ "name": "_gameId", "type": "uint256" }],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "components": [
          { "name": "escrowMatchId", "type": "uint256" },
          { "name": "player1", "type": "address" },
          { "name": "player2", "type": "address" },
          { "name": "totalRounds", "type": "uint256" },
          { "name": "currentRound", "type": "uint256" },
          { "name": "p1Score", "type": "uint256" },
          { "name": "p2Score", "type": "uint256" },
          { "name": "phase", "type": "uint8" },
          { "name": "phaseDeadline", "type": "uint256" },
          { "name": "settled", "type": "bool" }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRound",
    "inputs": [
      { "name": "_gameId", "type": "uint256" },
      { "name": "_round", "type": "uint256" }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "components": [
          { "name": "p1Commit", "type": "bytes32" },
          { "name": "p2Commit", "type": "bytes32" },
          { "name": "p1Move", "type": "uint8" },
          { "name": "p2Move", "type": "uint8" },
          { "name": "p1Revealed", "type": "bool" },
          { "name": "p2Revealed", "type": "bool" }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "nextGameId",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view"
  }
] as const;
