// Auto-extracted from Foundry build artifacts (view functions only)
export const escrowAbi = [
  {
    "type": "function",
    "name": "ACCEPT_TIMEOUT",
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
    "name": "authorizedContracts",
    "inputs": [
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
    "name": "getMatch",
    "inputs": [
      {
        "name": "_matchId",
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
            "name": "wager",
            "type": "uint256"
          },
          {
            "name": "gameContract",
            "type": "address"
          },
          {
            "name": "status",
            "type": "uint8"
          },
          {
            "name": "createdAt",
            "type": "uint256"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "matches",
    "inputs": [
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
        "name": "wager",
        "type": "uint256"
      },
      {
        "name": "gameContract",
        "type": "address"
      },
      {
        "name": "status",
        "type": "uint8"
      },
      {
        "name": "createdAt",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "nextMatchId",
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
    "name": "winners",
    "inputs": [
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
  }
] as const;
