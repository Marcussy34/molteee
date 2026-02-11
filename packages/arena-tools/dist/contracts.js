// ─── AgentRegistry ABI ──────────────────────────────────────────────────────
export const agentRegistryAbi = [
    {
        name: "register",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "_gameTypes", type: "uint8[]" },
            { name: "_minWager", type: "uint256" },
            { name: "_maxWager", type: "uint256" },
        ],
        outputs: [],
    },
    {
        name: "updateStatus",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "_isOpen", type: "bool" }],
        outputs: [],
    },
    {
        name: "getAgent",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "_agent", type: "address" }],
        outputs: [
            {
                name: "",
                type: "tuple",
                components: [
                    { name: "wallet", type: "address" },
                    { name: "gameTypes", type: "uint8[]" },
                    { name: "minWager", type: "uint256" },
                    { name: "maxWager", type: "uint256" },
                    { name: "isOpen", type: "bool" },
                    { name: "exists", type: "bool" },
                ],
            },
        ],
    },
    {
        name: "getOpenAgents",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "_gameType", type: "uint8" }],
        outputs: [{ name: "", type: "address[]" }],
    },
    {
        name: "elo",
        type: "function",
        stateMutability: "view",
        inputs: [
            { name: "", type: "address" },
            { name: "", type: "uint8" },
        ],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "getMatchHistory",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "_agent", type: "address" }],
        outputs: [
            {
                name: "",
                type: "tuple[]",
                components: [
                    { name: "opponent", type: "address" },
                    { name: "gameType", type: "uint8" },
                    { name: "won", type: "bool" },
                    { name: "wager", type: "uint256" },
                    { name: "timestamp", type: "uint256" },
                ],
            },
        ],
    },
];
// ─── Escrow ABI ──────────────────────────────────────────────────────────────
export const escrowAbi = [
    {
        name: "createMatch",
        type: "function",
        stateMutability: "payable",
        inputs: [
            { name: "_opponent", type: "address" },
            { name: "_gameContract", type: "address" },
        ],
        outputs: [{ name: "matchId", type: "uint256" }],
    },
    {
        name: "acceptMatch",
        type: "function",
        stateMutability: "payable",
        inputs: [{ name: "_matchId", type: "uint256" }],
        outputs: [],
    },
    {
        name: "cancelMatch",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "_matchId", type: "uint256" }],
        outputs: [],
    },
    {
        name: "getMatch",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "_matchId", type: "uint256" }],
        outputs: [
            {
                name: "",
                type: "tuple",
                components: [
                    { name: "player1", type: "address" },
                    { name: "player2", type: "address" },
                    { name: "wager", type: "uint256" },
                    { name: "gameContract", type: "address" },
                    { name: "status", type: "uint8" },
                    { name: "createdAt", type: "uint256" },
                ],
            },
        ],
    },
    {
        name: "winners",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "", type: "uint256" }],
        outputs: [{ name: "", type: "address" }],
    },
    {
        name: "nextMatchId",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    // ─── Events ────────────────────────────────────────────────────────────────
    {
        type: "event",
        name: "MatchCreated",
        inputs: [
            { name: "matchId", type: "uint256", indexed: true },
            { name: "player1", type: "address", indexed: true },
            { name: "player2", type: "address", indexed: true },
            { name: "wager", type: "uint256", indexed: false },
            { name: "gameContract", type: "address", indexed: false },
        ],
    },
];
// ─── RPSGame ABI ─────────────────────────────────────────────────────────────
export const rpsGameAbi = [
    {
        name: "createGame",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "_escrowMatchId", type: "uint256" },
            { name: "_totalRounds", type: "uint256" },
        ],
        outputs: [{ name: "gameId", type: "uint256" }],
    },
    {
        name: "commit",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "_gameId", type: "uint256" },
            { name: "_hash", type: "bytes32" },
        ],
        outputs: [],
    },
    {
        name: "reveal",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "_gameId", type: "uint256" },
            { name: "_move", type: "uint8" },
            { name: "_salt", type: "bytes32" },
        ],
        outputs: [],
    },
    {
        name: "claimTimeout",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "_gameId", type: "uint256" }],
        outputs: [],
    },
    {
        name: "getGame",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "_gameId", type: "uint256" }],
        outputs: [
            {
                name: "",
                type: "tuple",
                components: [
                    { name: "escrowMatchId", type: "uint256" },
                    { name: "player1", type: "address" },
                    { name: "player2", type: "address" },
                    { name: "totalRounds", type: "uint256" },
                    { name: "currentRound", type: "uint256" },
                    { name: "p1Score", type: "uint256" },
                    { name: "p2Score", type: "uint256" },
                    { name: "phase", type: "uint8" },
                    { name: "phaseDeadline", type: "uint256" },
                    { name: "settled", type: "bool" },
                ],
            },
        ],
    },
    {
        name: "getRound",
        type: "function",
        stateMutability: "view",
        inputs: [
            { name: "_gameId", type: "uint256" },
            { name: "_round", type: "uint256" },
        ],
        outputs: [
            {
                name: "",
                type: "tuple",
                components: [
                    { name: "p1Commit", type: "bytes32" },
                    { name: "p2Commit", type: "bytes32" },
                    { name: "p1Move", type: "uint8" },
                    { name: "p2Move", type: "uint8" },
                    { name: "p1Revealed", type: "bool" },
                    { name: "p2Revealed", type: "bool" },
                ],
            },
        ],
    },
];
// ─── PokerGame ABI ───────────────────────────────────────────────────────────
export const pokerGameAbi = [
    {
        name: "createGame",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "_escrowMatchId", type: "uint256" }],
        outputs: [{ name: "gameId", type: "uint256" }],
    },
    {
        name: "commitHand",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "_gameId", type: "uint256" },
            { name: "_hash", type: "bytes32" },
        ],
        outputs: [],
    },
    {
        name: "takeAction",
        type: "function",
        stateMutability: "payable",
        inputs: [
            { name: "_gameId", type: "uint256" },
            { name: "_action", type: "uint8" },
        ],
        outputs: [],
    },
    {
        name: "revealHand",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "_gameId", type: "uint256" },
            { name: "_handValue", type: "uint8" },
            { name: "_salt", type: "bytes32" },
        ],
        outputs: [],
    },
    {
        name: "claimTimeout",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "_gameId", type: "uint256" }],
        outputs: [],
    },
    {
        name: "getGame",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "_gameId", type: "uint256" }],
        outputs: [
            {
                name: "",
                type: "tuple",
                components: [
                    { name: "escrowMatchId", type: "uint256" },
                    { name: "player1", type: "address" },
                    { name: "player2", type: "address" },
                    { name: "pot", type: "uint256" },
                    { name: "currentBet", type: "uint256" },
                    { name: "currentTurn", type: "address" },
                    { name: "phase", type: "uint8" },
                    { name: "phaseDeadline", type: "uint256" },
                    { name: "settled", type: "bool" },
                    { name: "p1HandValue", type: "uint8" },
                    { name: "p2HandValue", type: "uint8" },
                    { name: "p1Committed", type: "bool" },
                    { name: "p2Committed", type: "bool" },
                    { name: "p1Revealed", type: "bool" },
                    { name: "p2Revealed", type: "bool" },
                    { name: "p1ExtraBets", type: "uint256" },
                    { name: "p2ExtraBets", type: "uint256" },
                ],
            },
        ],
    },
];
// ─── AuctionGame ABI ─────────────────────────────────────────────────────────
export const auctionGameAbi = [
    {
        name: "createGame",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "_escrowMatchId", type: "uint256" }],
        outputs: [{ name: "gameId", type: "uint256" }],
    },
    {
        name: "commitBid",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "_gameId", type: "uint256" },
            { name: "_hash", type: "bytes32" },
        ],
        outputs: [],
    },
    {
        name: "revealBid",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "_gameId", type: "uint256" },
            { name: "_bid", type: "uint256" },
            { name: "_salt", type: "bytes32" },
        ],
        outputs: [],
    },
    {
        name: "claimTimeout",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "_gameId", type: "uint256" }],
        outputs: [],
    },
    {
        name: "getGame",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "_gameId", type: "uint256" }],
        outputs: [
            {
                name: "",
                type: "tuple",
                components: [
                    { name: "escrowMatchId", type: "uint256" },
                    { name: "player1", type: "address" },
                    { name: "player2", type: "address" },
                    { name: "prize", type: "uint256" },
                    { name: "p1Bid", type: "uint256" },
                    { name: "p2Bid", type: "uint256" },
                    { name: "p1Committed", type: "bool" },
                    { name: "p2Committed", type: "bool" },
                    { name: "p1Revealed", type: "bool" },
                    { name: "p2Revealed", type: "bool" },
                    { name: "phase", type: "uint8" },
                    { name: "phaseDeadline", type: "uint256" },
                    { name: "settled", type: "bool" },
                ],
            },
        ],
    },
];
// ─── PredictionMarket ABI ────────────────────────────────────────────────────
export const predictionMarketAbi = [
    {
        name: "createMarket",
        type: "function",
        stateMutability: "payable",
        inputs: [{ name: "_matchId", type: "uint256" }],
        outputs: [],
    },
    {
        name: "buyYES",
        type: "function",
        stateMutability: "payable",
        inputs: [{ name: "_marketId", type: "uint256" }],
        outputs: [],
    },
    {
        name: "buyNO",
        type: "function",
        stateMutability: "payable",
        inputs: [{ name: "_marketId", type: "uint256" }],
        outputs: [],
    },
    {
        name: "resolve",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "_marketId", type: "uint256" }],
        outputs: [],
    },
    {
        name: "redeem",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "_marketId", type: "uint256" }],
        outputs: [],
    },
    {
        name: "getMarket",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "_marketId", type: "uint256" }],
        outputs: [
            {
                name: "",
                type: "tuple",
                components: [
                    { name: "matchId", type: "uint256" },
                    { name: "reserveYES", type: "uint256" },
                    { name: "reserveNO", type: "uint256" },
                    { name: "seedLiquidity", type: "uint256" },
                    { name: "player1", type: "address" },
                    { name: "player2", type: "address" },
                    { name: "resolved", type: "bool" },
                    { name: "winner", type: "address" },
                ],
            },
        ],
    },
    {
        name: "getPrice",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "_marketId", type: "uint256" }],
        outputs: [
            { name: "yesPrice", type: "uint256" },
            { name: "noPrice", type: "uint256" },
        ],
    },
    {
        name: "getUserBalances",
        type: "function",
        stateMutability: "view",
        inputs: [
            { name: "_marketId", type: "uint256" },
            { name: "_user", type: "address" },
        ],
        outputs: [
            { name: "yes", type: "uint256" },
            { name: "no", type: "uint256" },
        ],
    },
    {
        name: "nextMarketId",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
];
// ─── TournamentV2 ABI ────────────────────────────────────────────────────────
export const tournamentV2Abi = [
    {
        name: "register",
        type: "function",
        stateMutability: "payable",
        inputs: [{ name: "_tournamentId", type: "uint256" }],
        outputs: [],
    },
    {
        name: "getTournament",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "_tournamentId", type: "uint256" }],
        outputs: [
            {
                name: "",
                type: "tuple",
                components: [
                    { name: "format", type: "uint8" },
                    { name: "entryFee", type: "uint256" },
                    { name: "baseWager", type: "uint256" },
                    { name: "maxPlayers", type: "uint256" },
                    { name: "playerCount", type: "uint256" },
                    { name: "prizePool", type: "uint256" },
                    { name: "status", type: "uint8" },
                    { name: "creator", type: "address" },
                    { name: "winner", type: "address" },
                ],
            },
        ],
    },
    {
        name: "getParticipants",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "_tournamentId", type: "uint256" }],
        outputs: [{ name: "", type: "address[]" }],
    },
    {
        name: "nextTournamentId",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "isRegistered",
        type: "function",
        stateMutability: "view",
        inputs: [
            { name: "", type: "uint256" },
            { name: "", type: "address" },
        ],
        outputs: [{ name: "", type: "bool" }],
    },
];
//# sourceMappingURL=contracts.js.map