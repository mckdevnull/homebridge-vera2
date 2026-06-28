/**
 * Strongly-typed, validated plugin configuration. We never trust the raw
 * config.json object — {@link parseConfig} coerces, bounds-checks and applies
 * defaults, throwing a clear error when a required field is missing.
 */

export interface VeraConfig {
  name: string;
  host: string;
  port: number;
  pollTimeoutSeconds: number;
  pollMinimumDelayMs: number;
  requestTimeoutSeconds: number;
  hideScenes: boolean;
  hideHouseMode: boolean;
  exposeArmDisarm: boolean;
  /** Device numbers (as strings) to include exclusively. Empty = include all. */
  includeDeviceIds: string[];
  /** Device numbers (as strings) to always exclude. */
  excludeDeviceIds: string[];
  debug: boolean;
}

const num = (value: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(n)));
};

const bool = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

const idList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);
};

/**
 * Validate that `host` is a bare IP/hostname (no scheme, port, path, credentials,
 * query or fragment) and return its normalised form. Prevents a stray `/`, `@`,
 * `:port` etc. from silently rewriting the request URL's authority/path.
 */
function validateHost(host: string): string {
  const bad = () =>
    new Error(
      `Invalid "host" (${host}) — use a bare IP address or hostname like "192.168.1.50" or "vera.local" ` +
        '(no "http://", port, path, or spaces; wrap IPv6 in brackets, e.g. "[fe80::1]").',
    );
  let url: URL;
  try {
    url = new URL(`http://${host}`);
  } catch {
    throw bad();
  }
  if (
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== '' ||
    url.username !== '' ||
    url.password !== '' ||
    url.port !== '' ||
    url.hostname.toLowerCase() !== host.toLowerCase()
  ) {
    throw bad();
  }
  return url.hostname;
}

export function parseConfig(raw: Record<string, unknown>): VeraConfig {
  const rawHost = typeof raw.host === 'string' ? raw.host.trim() : '';
  if (!rawHost) {
    throw new Error(
      'Missing required "host" — set your Vera controller\'s local IP address or hostname in the plugin config.',
    );
  }
  const host = validateHost(rawHost);

  return {
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Vera2',
    host,
    port: num(raw.port, 3480, 1, 65535),
    pollTimeoutSeconds: num(raw.pollTimeoutSeconds, 30, 5, 120),
    pollMinimumDelayMs: num(raw.pollMinimumDelayMs, 200, 0, 5000),
    requestTimeoutSeconds: num(raw.requestTimeoutSeconds, 10, 2, 60),
    hideScenes: bool(raw.hideScenes),
    hideHouseMode: bool(raw.hideHouseMode),
    exposeArmDisarm: bool(raw.exposeArmDisarm),
    includeDeviceIds: idList(raw.includeDeviceIds),
    excludeDeviceIds: idList(raw.excludeDeviceIds),
    debug: bool(raw.debug),
  };
}
