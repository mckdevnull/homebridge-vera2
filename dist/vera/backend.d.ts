/**
 * Backend selection. Today only the local Luup HTTP backend exists; this is the
 * single place a future Ezlo (WSS / JSON-RPC, port 17000) backend would be wired
 * in based on config, without the HomeKit layer changing.
 */
import type { VeraConfig } from '../config.js';
import type { Logger } from '../util/logger.js';
import type { VeraBackend } from './types.js';
export declare function createBackend(config: VeraConfig, logger: Logger): VeraBackend;
