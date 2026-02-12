/** Print a success response and exit */
export declare function ok(data: any): never;
/** Print an error response and exit */
export declare function fail(error: string, code: string): never;
/** Print a streaming event (JSONL — one JSON object per line) */
export declare function event(data: any): void;
/** Wrap an async command handler with error catching */
export declare function wrapCommand(fn: (...args: any[]) => Promise<void>): (...args: any[]) => Promise<void>;
