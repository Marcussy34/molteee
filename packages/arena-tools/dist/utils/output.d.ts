/** Print a success response and exit */
export declare function ok(data: unknown): never;
/** Print an error response and exit */
export declare function fail(error: string, code?: string): never;
/** Print a streaming event (JSONL — one JSON object per line) */
export declare function event(data: Record<string, unknown>): void;
/** Wrap an async command handler with error catching */
export declare function wrapCommand<T extends (...args: any[]) => Promise<void>>(fn: T): T;
//# sourceMappingURL=output.d.ts.map