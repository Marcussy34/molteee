// JSON output helpers — all commands use these for consistent stdout format.
/** Print a success response and exit */
export function ok(data) {
    console.log(JSON.stringify({ ok: true, data }, null, 2));
    process.exit(0);
}
/** Print an error response and exit.
 *  Uses stdout (not stderr) so JSON output is always visible even with 2>/dev/null. */
export function fail(error, code) {
    console.log(JSON.stringify({ ok: false, error, code }, null, 2));
    process.exit(1);
}
/** Print a streaming event (JSONL — one JSON object per line) */
export function event(data) {
    console.log(JSON.stringify(data));
}
/** Wrap an async command handler with error catching */
export function wrapCommand(fn) {
    return (async (...args) => {
        try {
            await fn(...args);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            fail(message, "UNEXPECTED_ERROR");
        }
    });
}
//# sourceMappingURL=output.js.map