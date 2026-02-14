// View-only ABI for AuctionGame contract
export const auctionGameAbi = [
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
          { "name": "prize", "type": "uint256" },
          { "name": "p1Bid", "type": "uint256" },
          { "name": "p2Bid", "type": "uint256" },
          { "name": "p1Committed", "type": "bool" },
          { "name": "p2Committed", "type": "bool" },
          { "name": "p1Revealed", "type": "bool" },
          { "name": "p2Revealed", "type": "bool" },
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
      { "name": "player2", "type": "address", "indexed": false },
      { "name": "prize", "type": "uint256", "indexed": false }
    ]
  }
] as const;
