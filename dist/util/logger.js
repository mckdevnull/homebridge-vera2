/** A logger that discards everything. Useful in tests. */
export const noopLogger = {
    debug: () => { },
    info: () => { },
    warn: () => { },
    error: () => { },
};
