/**
 * Low-level Luup HTTP client. Knows nothing about device kinds — it only builds
 * `data_request` URLs, performs the HTTP round-trip with timeouts, and returns
 * raw text / parsed JSON. Higher layers ({@link LuupBackend}) interpret the data.
 */
import type { Logger } from '../util/logger.js';
export interface LuupClientOptions {
    host: string;
    port: number;
    /** Default timeout for one-off requests, in seconds. */
    requestTimeoutSeconds: number;
    logger: Logger;
}
/** Sentinel returned by `id=status` long-polls when nothing changed. */
export declare const NO_CHANGES = "NO_CHANGES";
/** Hard cap on a single response body, to bound memory if the controller (or a
 * man-in-the-middle on the plaintext LAN link) returns an oversized body. */
export declare const MAX_RESPONSE_BYTES: number;
export type LuupParams = Record<string, string | number>;
export declare class LuupClient {
    private readonly opts;
    private readonly defaultTimeoutMs;
    constructor(opts: LuupClientOptions);
    /**
     * Build a fully-qualified `data_request` URL.
     *
     * The host and port are assigned via the URL API (not string interpolation) so
     * a host value containing URL-significant characters can never rewrite the
     * path/authority. Params are set via `searchParams`, which percent-encodes
     * values (so externally-sourced device/scene ids and action args are safe).
     */
    buildUrl(params: LuupParams): string;
    /**
     * Perform a request and return the raw response body (size-capped).
     * @param timeoutMs overrides the default request timeout (used for long-polls).
     * @param signal an external abort signal (used to cancel on shutdown).
     */
    request(params: LuupParams, { timeoutMs, signal }?: {
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<string>;
    /** Read a response body, enforcing {@link MAX_RESPONSE_BYTES}. Falls back to
     * `res.text()` when the body is not a readable stream (e.g. in tests). */
    private readCapped;
    /** Perform a request and parse the body as JSON. */
    requestJson<T>(params: LuupParams, opts?: {
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<T>;
    /**
     * Invoke a UPnP action on a device.
     * Argument names are passed verbatim — Vera's casing is inconsistent
     * (e.g. `newLoadlevelTarget` vs `NewCurrentSetpoint`) and must not be altered.
     */
    action(deviceNum: string | number, serviceId: string, action: string, args?: LuupParams): Promise<void>;
}
