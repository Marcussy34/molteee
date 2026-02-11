export declare const agentRegistryAbi: readonly [{
    readonly name: "register";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "_gameTypes";
        readonly type: "uint8[]";
    }, {
        readonly name: "_minWager";
        readonly type: "uint256";
    }, {
        readonly name: "_maxWager";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "updateStatus";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "_isOpen";
        readonly type: "bool";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "getAgent";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "_agent";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "tuple";
        readonly components: readonly [{
            readonly name: "wallet";
            readonly type: "address";
        }, {
            readonly name: "gameTypes";
            readonly type: "uint8[]";
        }, {
            readonly name: "minWager";
            readonly type: "uint256";
        }, {
            readonly name: "maxWager";
            readonly type: "uint256";
        }, {
            readonly name: "isOpen";
            readonly type: "bool";
        }, {
            readonly name: "exists";
            readonly type: "bool";
        }];
    }];
}, {
    readonly name: "getOpenAgents";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "_gameType";
        readonly type: "uint8";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address[]";
    }];
}, {
    readonly name: "elo";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "";
        readonly type: "address";
    }, {
        readonly name: "";
        readonly type: "uint8";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
}, {
    readonly name: "getMatchHistory";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "_agent";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "tuple[]";
        readonly components: readonly [{
            readonly name: "opponent";
            readonly type: "address";
        }, {
            readonly name: "gameType";
            readonly type: "uint8";
        }, {
            readonly name: "won";
            readonly type: "bool";
        }, {
            readonly name: "wager";
            readonly type: "uint256";
        }, {
            readonly name: "timestamp";
            readonly type: "uint256";
        }];
    }];
}];
export declare const escrowAbi: readonly [{
    readonly name: "createMatch";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly name: "_opponent";
        readonly type: "address";
    }, {
        readonly name: "_gameContract";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "matchId";
        readonly type: "uint256";
    }];
}, {
    readonly name: "acceptMatch";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly name: "_matchId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "cancelMatch";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "_matchId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "getMatch";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "_matchId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "tuple";
        readonly components: readonly [{
            readonly name: "player1";
            readonly type: "address";
        }, {
            readonly name: "player2";
            readonly type: "address";
        }, {
            readonly name: "wager";
            readonly type: "uint256";
        }, {
            readonly name: "gameContract";
            readonly type: "address";
        }, {
            readonly name: "status";
            readonly type: "uint8";
        }, {
            readonly name: "createdAt";
            readonly type: "uint256";
        }];
    }];
}, {
    readonly name: "winners";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
    }];
}, {
    readonly name: "nextMatchId";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
}, {
    readonly type: "event";
    readonly name: "MatchCreated";
    readonly inputs: readonly [{
        readonly name: "matchId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "player1";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "player2";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "wager";
        readonly type: "uint256";
        readonly indexed: false;
    }, {
        readonly name: "gameContract";
        readonly type: "address";
        readonly indexed: false;
    }];
}];
export declare const rpsGameAbi: readonly [{
    readonly name: "createGame";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "_escrowMatchId";
        readonly type: "uint256";
    }, {
        readonly name: "_totalRounds";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "gameId";
        readonly type: "uint256";
    }];
}, {
    readonly name: "commit";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "_gameId";
        readonly type: "uint256";
    }, {
        readonly name: "_hash";
        readonly type: "bytes32";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "reveal";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "_gameId";
        readonly type: "uint256";
    }, {
        readonly name: "_move";
        readonly type: "uint8";
    }, {
        readonly name: "_salt";
        readonly type: "bytes32";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "claimTimeout";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "_gameId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "getGame";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "_gameId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "tuple";
        readonly components: readonly [{
            readonly name: "escrowMatchId";
            readonly type: "uint256";
        }, {
            readonly name: "player1";
            readonly type: "address";
        }, {
            readonly name: "player2";
            readonly type: "address";
        }, {
            readonly name: "totalRounds";
            readonly type: "uint256";
        }, {
            readonly name: "currentRound";
            readonly type: "uint256";
        }, {
            readonly name: "p1Score";
            readonly type: "uint256";
        }, {
            readonly name: "p2Score";
            readonly type: "uint256";
        }, {
            readonly name: "phase";
            readonly type: "uint8";
        }, {
            readonly name: "phaseDeadline";
            readonly type: "uint256";
        }, {
            readonly name: "settled";
            readonly type: "bool";
        }];
    }];
}, {
    readonly name: "getRound";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "_gameId";
        readonly type: "uint256";
    }, {
        readonly name: "_round";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "tuple";
        readonly components: readonly [{
            readonly name: "p1Commit";
            readonly type: "bytes32";
        }, {
            readonly name: "p2Commit";
            readonly type: "bytes32";
        }, {
            readonly name: "p1Move";
            readonly type: "uint8";
        }, {
            readonly name: "p2Move";
            readonly type: "uint8";
        }, {
            readonly name: "p1Revealed";
            readonly type: "bool";
        }, {
            readonly name: "p2Revealed";
            readonly type: "bool";
        }];
    }];
}, {
    readonly name: "nextGameId";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
}];
export declare const pokerGameAbi: readonly [{
    readonly name: "createGame";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "_escrowMatchId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "gameId";
        readonly type: "uint256";
    }];
}, {
    readonly name: "commitHand";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "_gameId";
        readonly type: "uint256";
    }, {
        readonly name: "_hash";
        readonly type: "bytes32";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "takeAction";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly name: "_gameId";
        readonly type: "uint256";
    }, {
        readonly name: "_action";
        readonly type: "uint8";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "revealHand";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "_gameId";
        readonly type: "uint256";
    }, {
        readonly name: "_handValue";
        readonly type: "uint8";
    }, {
        readonly name: "_salt";
        readonly type: "bytes32";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "claimTimeout";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "_gameId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "getGame";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "_gameId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "tuple";
        readonly components: readonly [{
            readonly name: "escrowMatchId";
            readonly type: "uint256";
        }, {
            readonly name: "player1";
            readonly type: "address";
        }, {
            readonly name: "player2";
            readonly type: "address";
        }, {
            readonly name: "pot";
            readonly type: "uint256";
        }, {
            readonly name: "currentBet";
            readonly type: "uint256";
        }, {
            readonly name: "currentTurn";
            readonly type: "address";
        }, {
            readonly name: "phase";
            readonly type: "uint8";
        }, {
            readonly name: "phaseDeadline";
            readonly type: "uint256";
        }, {
            readonly name: "settled";
            readonly type: "bool";
        }, {
            readonly name: "p1HandValue";
            readonly type: "uint8";
        }, {
            readonly name: "p2HandValue";
            readonly type: "uint8";
        }, {
            readonly name: "p1Committed";
            readonly type: "bool";
        }, {
            readonly name: "p2Committed";
            readonly type: "bool";
        }, {
            readonly name: "p1Revealed";
            readonly type: "bool";
        }, {
            readonly name: "p2Revealed";
            readonly type: "bool";
        }, {
            readonly name: "p1ExtraBets";
            readonly type: "uint256";
        }, {
            readonly name: "p2ExtraBets";
            readonly type: "uint256";
        }];
    }];
}, {
    readonly name: "nextGameId";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
}];
export declare const auctionGameAbi: readonly [{
    readonly name: "createGame";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "_escrowMatchId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "gameId";
        readonly type: "uint256";
    }];
}, {
    readonly name: "commitBid";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "_gameId";
        readonly type: "uint256";
    }, {
        readonly name: "_hash";
        readonly type: "bytes32";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "revealBid";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "_gameId";
        readonly type: "uint256";
    }, {
        readonly name: "_bid";
        readonly type: "uint256";
    }, {
        readonly name: "_salt";
        readonly type: "bytes32";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "claimTimeout";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "_gameId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "getGame";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "_gameId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "tuple";
        readonly components: readonly [{
            readonly name: "escrowMatchId";
            readonly type: "uint256";
        }, {
            readonly name: "player1";
            readonly type: "address";
        }, {
            readonly name: "player2";
            readonly type: "address";
        }, {
            readonly name: "prize";
            readonly type: "uint256";
        }, {
            readonly name: "p1Bid";
            readonly type: "uint256";
        }, {
            readonly name: "p2Bid";
            readonly type: "uint256";
        }, {
            readonly name: "p1Committed";
            readonly type: "bool";
        }, {
            readonly name: "p2Committed";
            readonly type: "bool";
        }, {
            readonly name: "p1Revealed";
            readonly type: "bool";
        }, {
            readonly name: "p2Revealed";
            readonly type: "bool";
        }, {
            readonly name: "phase";
            readonly type: "uint8";
        }, {
            readonly name: "phaseDeadline";
            readonly type: "uint256";
        }, {
            readonly name: "settled";
            readonly type: "bool";
        }];
    }];
}, {
    readonly name: "nextGameId";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
}];
export declare const predictionMarketAbi: readonly [{
    readonly name: "createMarket";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly name: "_matchId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "buyYES";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly name: "_marketId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "buyNO";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly name: "_marketId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "resolve";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "_marketId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "redeem";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "_marketId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "getMarket";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "_marketId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "tuple";
        readonly components: readonly [{
            readonly name: "matchId";
            readonly type: "uint256";
        }, {
            readonly name: "reserveYES";
            readonly type: "uint256";
        }, {
            readonly name: "reserveNO";
            readonly type: "uint256";
        }, {
            readonly name: "seedLiquidity";
            readonly type: "uint256";
        }, {
            readonly name: "player1";
            readonly type: "address";
        }, {
            readonly name: "player2";
            readonly type: "address";
        }, {
            readonly name: "resolved";
            readonly type: "bool";
        }, {
            readonly name: "winner";
            readonly type: "address";
        }];
    }];
}, {
    readonly name: "getPrice";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "_marketId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "yesPrice";
        readonly type: "uint256";
    }, {
        readonly name: "noPrice";
        readonly type: "uint256";
    }];
}, {
    readonly name: "getUserBalances";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "_marketId";
        readonly type: "uint256";
    }, {
        readonly name: "_user";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "yes";
        readonly type: "uint256";
    }, {
        readonly name: "no";
        readonly type: "uint256";
    }];
}, {
    readonly name: "nextMarketId";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
}];
export declare const tournamentV2Abi: readonly [{
    readonly name: "register";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly name: "_tournamentId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "getTournament";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "_tournamentId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "tuple";
        readonly components: readonly [{
            readonly name: "format";
            readonly type: "uint8";
        }, {
            readonly name: "entryFee";
            readonly type: "uint256";
        }, {
            readonly name: "baseWager";
            readonly type: "uint256";
        }, {
            readonly name: "maxPlayers";
            readonly type: "uint256";
        }, {
            readonly name: "playerCount";
            readonly type: "uint256";
        }, {
            readonly name: "prizePool";
            readonly type: "uint256";
        }, {
            readonly name: "status";
            readonly type: "uint8";
        }, {
            readonly name: "creator";
            readonly type: "address";
        }, {
            readonly name: "winner";
            readonly type: "address";
        }];
    }];
}, {
    readonly name: "getParticipants";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "_tournamentId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address[]";
    }];
}, {
    readonly name: "nextTournamentId";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
}, {
    readonly name: "isRegistered";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }, {
        readonly name: "";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
    }];
}];
//# sourceMappingURL=contracts.d.ts.map