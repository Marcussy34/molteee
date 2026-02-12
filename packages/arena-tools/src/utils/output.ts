// JSON output helpers — all commands use these for consistent stdout format.

/** Print a success response and exit */
export function ok(data: unknown): never {
  console.log(JSON.stringify({ ok: true, data }, null, 2));
  process.exit(0);
}

/** Print an error response and exit */
export function fail(error: string, code?: string): never {
  console.error(JSON.stringify({ ok: false, error, code }, null, 2));
  process.exit(1);
}

/** Print a streaming event (JSONL — one JSON object per line) */
export function event(data: Record<string, unknown>): void {
  console.log(JSON.stringify(data));
}

/** Wrap an async command handler with error catching */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function wrapCommand<T extends (...args: any[]) => Promise<void>>(
  fn: T
): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (async (...args: any[]) => {
    try {
      await fn(...args);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : String(err);
      fail(message, "UNEXPECTED_ERROR");
    }
  }) as T;
}
