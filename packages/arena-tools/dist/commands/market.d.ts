/** List all prediction markets with prices and state */
export declare function listMarketsCommand(): Promise<void>;
/** Create a prediction market for a match */
export declare function createMarketCommand(matchId: string, seed: string): Promise<void>;
/** Buy YES or NO tokens */
export declare function betCommand(marketId: string, side: string, amount: string): Promise<void>;
/** Resolve a prediction market */
export declare function resolveMarketCommand(marketId: string): Promise<void>;
/** Redeem winning tokens */
export declare function redeemCommand(marketId: string): Promise<void>;
//# sourceMappingURL=market.d.ts.map