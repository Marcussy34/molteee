// Auto-extracted from Foundry build artifacts (view functions only)
export const tournamentAbi = [
  {
    "type": "function",
    "name": "auctionGame",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "bracket",
    "inputs": [
      {
        "name": "",
        "type": "uint256"
      },
      {
        "name": "",
        "type": "uint256"
      },
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "player1",
        "type": "address"
      },
      {
        "name": "player2",
        "type": "address"
      },
      {
        "name": "winner",
        "type": "address"
      },
      {
        "name": "escrowMatchId",
        "type": "uint256"
      },
      {
        "name": "reported",
        "type": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "escrow",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getBracketMatch",
    "inputs": [
      {
        "name": "_tournamentId",
        "type": "uint256"
      },
      {
        "name": "_round",
        "type": "uint256"
      },
      {
        "name": "_matchIndex",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "components": [
          {
            "name": "player1",
            "type": "address"
          },
          {
            "name": "player2",
            "type": "address"
          },
          {
            "name": "winner",
            "type": "address"
          },
          {
            "name": "escrowMatchId",
            "type": "uint256"
          },
          {
            "name": "reported",
            "type": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getGameTypeForRound",
    "inputs": [
      {
        "name": "_round",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMatchCountForRound",
    "inputs": [
      {
        "name": "_tournamentId",
        "type": "uint256"
      },
      {
        "name": "_round",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getParticipants",
    "inputs": [
      {
        "name": "_tournamentId",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRoundWager",
    "inputs": [
      {
        "name": "_tournamentId",
        "type": "uint256"
      },
      {
        "name": "_round",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getTournament",
    "inputs": [
      {
        "name": "_tournamentId",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "components": [
          {
            "name": "entryFee",
            "type": "uint256"
          },
          {
            "name": "baseWager",
            "type": "uint256"
          },
          {
            "name": "maxPlayers",
            "type": "uint256"
          },
          {
            "name": "playerCount",
            "type": "uint256"
          },
          {
            "name": "prizePool",
            "type": "uint256"
          },
          {
            "name": "currentRound",
            "type": "uint256"
          },
          {
            "name": "totalRounds",
            "type": "uint256"
          },
          {
            "name": "status",
            "type": "uint8"
          },
          {
            "name": "creator",
            "type": "address"
          },
          {
            "name": "winner",
            "type": "address"
          },
          {
            "name": "runnerUp",
            "type": "address"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isRegistered",
    "inputs": [
      {
        "name": "",
        "type": "uint256"
      },
      {
        "name": "",
        "type": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "nextTournamentId",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "participants",
    "inputs": [
      {
        "name": "",
        "type": "uint256"
      },
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "pokerGame",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "registry",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "rpsGame",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "semifinalists",
    "inputs": [
      {
        "name": "",
        "type": "uint256"
      },
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "tournaments",
    "inputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "entryFee",
        "type": "uint256"
      },
      {
        "name": "baseWager",
        "type": "uint256"
      },
      {
        "name": "maxPlayers",
        "type": "uint256"
      },
      {
        "name": "playerCount",
        "type": "uint256"
      },
      {
        "name": "prizePool",
        "type": "uint256"
      },
      {
        "name": "currentRound",
        "type": "uint256"
      },
      {
        "name": "totalRounds",
        "type": "uint256"
      },
      {
        "name": "status",
        "type": "uint8"
      },
      {
        "name": "creator",
        "type": "address"
      },
      {
        "name": "winner",
        "type": "address"
      },
      {
        "name": "runnerUp",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  }
] as const;
