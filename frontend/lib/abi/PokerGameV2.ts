// View-only ABI for PokerGameV2 (Budget Poker) contract
export const pokerGameV2Abi = [
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
          { "name": "startingBudget", "type": "uint256" },
          { "name": "p1Budget", "type": "uint256" },
          { "name": "p2Budget", "type": "uint256" },
          { "name": "p1ExtraBets", "type": "uint256" },
          { "name": "p2ExtraBets", "type": "uint256" },
          { "name": "phase", "type": "uint8" },
          { "name": "phaseDeadline", "type": "uint256" },
          { "name": "settled", "type": "bool" },
          { "name": "currentBet", "type": "uint256" },
          { "name": "currentTurn", "type": "address" },
          { "name": "p1Committed", "type": "bool" },
          { "name": "p2Committed", "type": "bool" },
          { "name": "p1Revealed", "type": "bool" },
          { "name": "p2Revealed", "type": "bool" }
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
          { "name": "p1HandValue", "type": "uint8" },
          { "name": "p2HandValue", "type": "uint8" },
          { "name": "p1Committed", "type": "bool" },
          { "name": "p2Committed", "type": "bool" },
          { "name": "p1Revealed", "type": "bool" },
          { "name": "p2Revealed", "type": "bool" },
          { "name": "currentBet", "type": "uint256" },
          { "name": "lastBettor", "type": "address" },
          { "name": "betsThisRound", "type": "uint8" },
          { "name": "currentTurn", "type": "address" }
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
  },
  {
    "type": "event",
    "name": "GameCreated",
    "inputs": [
      { "name": "gameId", "type": "uint256", "indexed": true },
      { "name": "escrowMatchId", "type": "uint256", "indexed": true },
      { "name": "player1", "type": "address", "indexed": true },
      { "name": "player2", "type": "address", "indexed": false }
    ]
  }
] as const;
