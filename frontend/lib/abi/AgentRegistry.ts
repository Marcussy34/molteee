// Auto-extracted from Foundry build artifacts
export const agentRegistryAbi = [
  {
    "type": "function",
    "name": "register",
    "inputs": [
      { "name": "_gameTypes", "type": "uint8[]" },
      { "name": "_minWager", "type": "uint256" },
      { "name": "_maxWager", "type": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "agentList",
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
    "name": "elo",
    "inputs": [
      {
        "name": "",
        "type": "address"
      },
      {
        "name": "",
        "type": "uint8"
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
    "name": "getAgent",
    "inputs": [
      {
        "name": "_agent",
        "type": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "components": [
          {
            "name": "wallet",
            "type": "address"
          },
          {
            "name": "gameTypes",
            "type": "uint8[]"
          },
          {
            "name": "minWager",
            "type": "uint256"
          },
          {
            "name": "maxWager",
            "type": "uint256"
          },
          {
            "name": "isOpen",
            "type": "bool"
          },
          {
            "name": "exists",
            "type": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMatchCount",
    "inputs": [
      {
        "name": "_agent",
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
    "name": "getMatchHistory",
    "inputs": [
      {
        "name": "_agent",
        "type": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple[]",
        "components": [
          {
            "name": "opponent",
            "type": "address"
          },
          {
            "name": "gameType",
            "type": "uint8"
          },
          {
            "name": "won",
            "type": "bool"
          },
          {
            "name": "wager",
            "type": "uint256"
          },
          {
            "name": "timestamp",
            "type": "uint256"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getOpenAgents",
    "inputs": [
      {
        "name": "_gameType",
        "type": "uint8"
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
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  }
] as const;
