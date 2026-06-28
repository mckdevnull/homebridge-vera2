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
export declare function parseConfig(raw: Record<string, unknown>): VeraConfig;
