// Auto-extracted from Foundry build artifacts (view functions only)
export const tournamentV2Abi = [
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
    "name": "deMatches",
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
    "name": "deMatchesReported",
    "inputs": [
      {
        "name": "",
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
    "name": "deTotalMatches",
    "inputs": [
      {
        "name": "",
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
    "name": "getDEMatch",
    "inputs": [
      {
        "name": "_tournamentId",
        "type": "uint256"
      },
      {
        "name": "_bracket",
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
    "name": "getGameForMatch",
    "inputs": [
      {
        "name": "_matchIndex",
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
    "name": "getPlayerLosses",
    "inputs": [
      {
        "name": "_tournamentId",
        "type": "uint256"
      },
      {
        "name": "_player",
        "type": "address"
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
    "name": "getPlayerPoints",
    "inputs": [
      {
        "name": "_tournamentId",
        "type": "uint256"
      },
      {
        "name": "_player",
        "type": "address"
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
    "name": "getRRMatch",
    "inputs": [
      {
        "name": "_tournamentId",
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
            "name": "format",
            "type": "uint8"
          },
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
    "name": "losses",
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
        "type": "uint256"
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
    "name": "rrMatches",
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
    "name": "rrMatchesReported",
    "inputs": [
      {
        "name": "",
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
    "name": "rrPoints",
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
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "rrTotalMatches",
    "inputs": [
      {
        "name": "",
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
    "name": "tournaments",
    "inputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "format",
        "type": "uint8"
      },
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
      }
    ],
    "stateMutability": "view"
  }
] as const;
