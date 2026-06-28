/**
 * Low-level Luup HTTP client. Knows nothing about device kinds — it only builds
 * `data_request` URLs, performs the HTTP round-trip with timeouts, and returns
 * raw text / parsed JSON. Higher layers ({@link LuupBackend}) interpret the data.
 */
/** Sentinel returned by `id=status` long-polls when nothing changed. */
export const NO_CHANGES = 'NO_CHANGES';
/** Hard cap on a single response body, to bound memory if the controller (or a
 * man-in-the-middle on the plaintext LAN link) returns an oversized body. */
export const MAX_RESPONSE_BYTES = 32 * 1024 * 1024;
export class LuupClient {
    opts;
    defaultTimeoutMs;
    constructor(opts) {
        this.opts = opts;
        this.defaultTimeoutMs = opts.requestTimeoutSeconds * 1000;
    }
    /**
     * Build a fully-qualified `data_request` URL.
     *
     * The host and port are assigned via the URL API (not string interpolation) so
     * a host value containing URL-significant characters can never rewrite the
     * path/authority. Params are set via `searchParams`, which percent-encodes
     * values (so externally-sourced device/scene ids and action args are safe).
     */
    buildUrl(params) {
        const url = new URL('http://localhost/data_request');
        url.hostname = this.opts.host;
        url.port = String(this.opts.port);
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, String(value));
        }
        return url.toString();
    }
    /**
     * Perform a request and return the raw response body (size-capped).
     * @param timeoutMs overrides the default request timeout (used for long-polls).
     * @param signal an external abort signal (used to cancel on shutdown).
     */
    async request(params, { timeoutMs, signal } = {}) {
        const url = this.buildUrl(params);
        const timeout = AbortSignal.timeout(timeoutMs ?? this.defaultTimeoutMs);
        const composite = signal ? AbortSignal.any([signal, timeout]) : timeout;
        this.opts.logger.debug(`Vera request: ${url}`);
        const res = await fetch(url, { signal: composite });
        if (!res.ok) {
            throw new Error(`Vera HTTP ${res.status} ${res.statusText} for id=${params.id}`);
        }
        const declared = Number(res.headers?.get?.('content-length'));
        if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
            throw new Error(`Vera response too large (${declared} bytes) for id=${params.id}`);
        }
        return this.readCapped(res, String(params.id));
    }
    /** Read a response body, enforcing {@link MAX_RESPONSE_BYTES}. Falls back to
     * `res.text()` when the body is not a readable stream (e.g. in tests). */
    async readCapped(res, id) {
        if (!res.body || typeof res.body.getReader !== 'function') {
            return res.text();
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let out = '';
        let received = 0;
        for (;;) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            received += value.byteLength;
            if (received > MAX_RESPONSE_BYTES) {
                await reader.cancel();
                throw new Error(`Vera response exceeded ${MAX_RESPONSE_BYTES} bytes for id=${id}`);
            }
            out += decoder.decode(value, { stream: true });
        }
        out += decoder.decode();
        return out;
    }
    /** Perform a request and parse the body as JSON. */
    async requestJson(params, opts = {}) {
        const body = await this.request(params, opts);
        const trimmed = body.trim();
        if (trimmed.length === 0) {
            throw new Error(`Empty response from Vera for id=${params.id}`);
        }
        try {
            return JSON.parse(trimmed);
        }
        catch {
            const snippet = trimmed.slice(0, 120);
            throw new Error(`Non-JSON response from Vera for id=${params.id}: ${snippet}`);
        }
    }
    /**
     * Invoke a UPnP action on a device.
     * Argument names are passed verbatim — Vera's casing is inconsistent
     * (e.g. `newLoadlevelTarget` vs `NewCurrentSetpoint`) and must not be altered.
     */
    async action(deviceNum, serviceId, action, args = {}) {
        await this.request({
            id: 'action',
            output_format: 'json',
            DeviceNum: deviceNum,
            serviceId,
            action,
            ...args,
        });
    }
}
