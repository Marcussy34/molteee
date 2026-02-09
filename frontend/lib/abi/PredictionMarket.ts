// Auto-extracted from Foundry build artifacts (view functions only)
export const predictionMarketAbi = [
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
    "name": "getMarket",
    "inputs": [
      {
        "name": "_marketId",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "components": [
          {
            "name": "matchId",
            "type": "uint256"
          },
          {
            "name": "reserveYES",
            "type": "uint256"
          },
          {
            "name": "reserveNO",
            "type": "uint256"
          },
          {
            "name": "seedLiquidity",
            "type": "uint256"
          },
          {
            "name": "player1",
            "type": "address"
          },
          {
            "name": "player2",
            "type": "address"
          },
          {
            "name": "resolved",
            "type": "bool"
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
    "name": "getPrice",
    "inputs": [
      {
        "name": "_marketId",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "yesPrice",
        "type": "uint256"
      },
      {
        "name": "noPrice",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getUserBalances",
    "inputs": [
      {
        "name": "_marketId",
        "type": "uint256"
      },
      {
        "name": "_user",
        "type": "address"
      }
    ],
    "outputs": [
      {
        "name": "yes",
        "type": "uint256"
      },
      {
        "name": "no",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "marketExists",
    "inputs": [
      {
        "name": "",
        "type": "uint256"
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
    "name": "markets",
    "inputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "matchId",
        "type": "uint256"
      },
      {
        "name": "reserveYES",
        "type": "uint256"
      },
      {
        "name": "reserveNO",
        "type": "uint256"
      },
      {
        "name": "seedLiquidity",
        "type": "uint256"
      },
      {
        "name": "player1",
        "type": "address"
      },
      {
        "name": "player2",
        "type": "address"
      },
      {
        "name": "resolved",
        "type": "bool"
      },
      {
        "name": "winner",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "matchToMarket",
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
    "name": "nextMarketId",
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
    "name": "noBalances",
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
    "name": "totalCollected",
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
    "name": "totalNODistributed",
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
    "name": "totalYESDistributed",
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
    "name": "yesBalances",
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
  }
] as const;
