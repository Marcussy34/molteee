/** Create a new RPS game for a match */
export declare function rpsCreateCommand(matchId: string, rounds?: string): Promise<void>;
/** Commit a move (salt is generated and stored automatically) */
export declare function rpsCommitCommand(gameId: string, move: string): Promise<void>;
/** Reveal the committed move (loads the saved salt automatically) */
export declare function rpsRevealCommand(gameId: string): Promise<void>;
