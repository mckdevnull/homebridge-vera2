/**
 * Low-level Luup HTTP client. Knows nothing about device kinds — it only builds
 * `data_request` URLs, performs the HTTP round-trip with timeouts, and returns
 * raw text / parsed JSON. Higher layers ({@link LuupBackend}) interpret the data.
 */
/** Sentinel returned by `id=status` long-polls when nothing changed. */
export const NO_CHANGES = 'NO_CHANGES';
export class LuupClient {
    opts;
    baseUrl;
    defaultTimeoutMs;
    constructor(opts) {
        this.opts = opts;
        this.baseUrl = `http://${opts.host}:${opts.port}/data_request`;
        this.defaultTimeoutMs = opts.requestTimeoutSeconds * 1000;
    }
    /** Build a fully-qualified `data_request` URL, preserving exact param casing. */
    buildUrl(params) {
        const url = new URL(this.baseUrl);
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, String(value));
        }
        return url.toString();
    }
    /**
     * Perform a request and return the raw response body.
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
        return res.text();
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
//# sourceMappingURL=luupClient.js.map