/**
 * Backend selection. Today only the local Luup HTTP backend exists; this is the
 * single place a future Ezlo (WSS / JSON-RPC, port 17000) backend would be wired
 * in based on config, without the HomeKit layer changing.
 */
import { LuupBackend } from './luupBackend.js';
export function createBackend(config, logger) {
    // Future: switch on config.backend === 'ezlo' to return an EzloBackend.
    return new LuupBackend({
        host: config.host,
        port: config.port,
        requestTimeoutSeconds: config.requestTimeoutSeconds,
        pollTimeoutSeconds: config.pollTimeoutSeconds,
        pollMinimumDelayMs: config.pollMinimumDelayMs,
        logger,
    });
}
