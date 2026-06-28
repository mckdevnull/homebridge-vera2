/**
 * Minimal logger contract so the Vera client/backend layer does not depend on
 * Homebridge's `Logging` type directly. Homebridge's logger satisfies this
 * interface, and tests can pass a no-op.
 */
export interface Logger {
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
}
/** A logger that discards everything. Useful in tests. */
export declare const noopLogger: Logger;
