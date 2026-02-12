/** Create a new Poker game for a match */
export declare function pokerCreateCommand(matchId: string): Promise<void>;
/** Commit a hand value (1-100) */
export declare function pokerCommitCommand(gameId: string, handValue: string): Promise<void>;
/** Take a betting action (check, bet, raise, call, fold) */
export declare function pokerActionCommand(gameId: string, action: string, amount?: string): Promise<void>;
/** Reveal the committed hand value */
export declare function pokerRevealCommand(gameId: string): Promise<void>;
//# sourceMappingURL=poker.d.ts.map