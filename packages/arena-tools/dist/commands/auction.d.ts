/** Create a new Auction game for a match */
export declare function auctionCreateCommand(matchId: string): Promise<void>;
/** Commit a bid amount (in MON) */
export declare function auctionCommitCommand(gameId: string, bid: string): Promise<void>;
/** Reveal the committed bid */
export declare function auctionRevealCommand(gameId: string): Promise<void>;
//# sourceMappingURL=auction.d.ts.map