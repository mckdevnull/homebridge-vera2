/**
 * The Homebridge Dynamic Platform.
 *
 * Lifecycle:
 *  - `configureAccessory` caches each accessory restored from disk (before launch).
 *  - on `didFinishLaunching` we connect the backend, then `discoverDevices`
 *    reuses cached accessories, registers new ones and prunes stale ones.
 *  - backend events route state patches to the matching accessory handler(s).
 *  - a topology change re-runs discovery; `shutdown` stops the backend.
 */
import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';
import { type VeraConfig } from './config.js';
import type { VeraBackend } from './vera/types.js';
export declare class VeraHomebridgePlatform implements DynamicPlatformPlugin {
    readonly log: Logging;
    readonly api: API;
    readonly Service: typeof Service;
    readonly Characteristic: typeof Characteristic;
    /** Cached accessories restored from disk, keyed by UUID. */
    readonly accessories: Map<string, PlatformAccessory<import("homebridge").UnknownContext>>;
    /** Active device handlers keyed by Vera device id (a sensor can have >1). */
    private readonly deviceHandlers;
    private houseModeHandler?;
    private readonly discoveredUuids;
    config: VeraConfig;
    backend: VeraBackend;
    private configValid;
    private started;
    constructor(log: Logging, rawConfig: PlatformConfig, api: API);
    /** Called once per cached accessory at startup, before `didFinishLaunching`. */
    configureAccessory(accessory: PlatformAccessory): void;
    private start;
    private wireEvents;
    private discoverDevices;
    private setupDevice;
    private setupArmSwitch;
    private setupScene;
    private setupHouseMode;
    private uuid;
    /** Reuse a cached accessory for `uuid` or create a new one. */
    private acquire;
    private register;
    private addHandler;
    private pruneStale;
    private shouldInclude;
}
