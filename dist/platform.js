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
import { HouseModeAccessory } from './accessories/houseMode.js';
import { SceneAccessory } from './accessories/scene.js';
import { parseConfig } from './config.js';
import { createArmSwitchAccessory, createDeviceAccessory } from './factory.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { createBackend } from './vera/backend.js';
import { isSensorKind } from './vera/categories.js';
export class VeraHomebridgePlatform {
    log;
    api;
    Service;
    Characteristic;
    /** Cached accessories restored from disk, keyed by UUID. */
    accessories = new Map();
    /** Active device handlers keyed by Vera device id (a sensor can have >1). */
    deviceHandlers = new Map();
    houseModeHandler;
    discoveredUuids = new Set();
    config;
    backend;
    configValid = false;
    started = false;
    constructor(log, rawConfig, api) {
        this.log = log;
        this.api = api;
        this.Service = api.hap.Service;
        this.Characteristic = api.hap.Characteristic;
        try {
            this.config = parseConfig(rawConfig);
            this.configValid = true;
        }
        catch (err) {
            this.log.error(`Vera2 configuration error: ${err.message}`);
            return;
        }
        this.backend = createBackend(this.config, this.log);
        this.api.on('didFinishLaunching', () => void this.start());
        this.api.on('shutdown', () => void this.backend?.stop());
    }
    /** Called once per cached accessory at startup, before `didFinishLaunching`. */
    configureAccessory(accessory) {
        this.accessories.set(accessory.UUID, accessory);
    }
    async start() {
        if (!this.configValid) {
            return;
        }
        this.wireEvents();
        try {
            await this.backend.start();
        }
        catch (err) {
            this.log.error(`Failed to connect to Vera at ${this.config.host}:${this.config.port} — ${err.message}`);
            return;
        }
        this.started = true;
        this.discoverDevices();
    }
    wireEvents() {
        this.backend.on('deviceState', (id, patch) => {
            for (const handler of this.deviceHandlers.get(id) ?? []) {
                handler.updateState(patch);
            }
        });
        this.backend.on('houseMode', (mode) => this.houseModeHandler?.updateHouseMode(mode));
        this.backend.on('topologyChanged', () => {
            if (!this.started) {
                return;
            }
            try {
                this.discoverDevices();
            }
            catch (err) {
                this.log.error(`Failed to refresh accessories after a Vera topology change: ${err.message}`);
            }
        });
        this.backend.on('connection', (connected) => this.log.debug(`Vera connection ${connected ? 'established' : 'lost'}`));
        this.backend.on('error', (err) => this.log.debug(`Backend error: ${err.message}`));
    }
    // ---------------------------------------------------------------------------
    // Discovery / caching lifecycle
    // ---------------------------------------------------------------------------
    discoverDevices() {
        // Cancel pending timers on the previous round's handlers before dropping them.
        for (const handlers of this.deviceHandlers.values()) {
            for (const handler of handlers) {
                try {
                    handler.dispose();
                }
                catch {
                    /* ignore disposal errors */
                }
            }
        }
        this.discoveredUuids.clear();
        this.deviceHandlers.clear();
        this.houseModeHandler = undefined;
        // Each accessory is set up in isolation so one malformed device can't abort
        // discovery of all the others.
        for (const device of this.backend.getDevices()) {
            if (!this.shouldInclude(device.id)) {
                continue;
            }
            try {
                this.setupDevice(device);
                if (this.config.exposeArmDisarm && device.armable && isSensorKind(device.kind)) {
                    this.setupArmSwitch(device);
                }
            }
            catch (err) {
                this.log.error(`Skipping device ${device.id} (${device.name}) — setup failed: ${err.message}`);
            }
        }
        if (!this.config.hideScenes) {
            for (const scene of this.backend.getScenes()) {
                try {
                    this.setupScene(scene);
                }
                catch (err) {
                    this.log.error(`Skipping scene ${scene.id} (${scene.name}) — setup failed: ${err.message}`);
                }
            }
        }
        if (!this.config.hideHouseMode) {
            const mode = this.backend.getHouseMode();
            if (mode !== undefined) {
                try {
                    this.setupHouseMode(mode);
                }
                catch (err) {
                    this.log.error(`House Mode accessory setup failed: ${err.message}`);
                }
            }
        }
        this.pruneStale();
    }
    setupDevice(device) {
        const { accessory, isNew } = this.acquire(this.uuid(`device:${device.id}`), device.name, {
            kind: 'device',
            deviceId: device.id,
        });
        const handler = createDeviceAccessory(this, accessory, device);
        if (!handler) {
            return;
        }
        this.addHandler(device.id, handler);
        if (isNew) {
            this.register(accessory);
        }
    }
    setupArmSwitch(device) {
        const { accessory, isNew } = this.acquire(this.uuid(`arm:${device.id}`), `${device.name} Arm`, {
            kind: 'arm',
            deviceId: device.id,
        });
        this.addHandler(device.id, createArmSwitchAccessory(this, accessory, device));
        if (isNew) {
            this.register(accessory);
        }
    }
    setupScene(scene) {
        const { accessory, isNew } = this.acquire(this.uuid(`scene:${scene.id}`), scene.name, {
            kind: 'scene',
            sceneId: scene.id,
        });
        new SceneAccessory(this, accessory, scene);
        if (isNew) {
            this.register(accessory);
        }
    }
    setupHouseMode(mode) {
        const { accessory, isNew } = this.acquire(this.uuid('housemode'), 'House Mode', { kind: 'housemode' });
        this.houseModeHandler = new HouseModeAccessory(this, accessory, mode);
        if (isNew) {
            this.register(accessory);
        }
    }
    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------
    uuid(suffix) {
        return this.api.hap.uuid.generate(`${PLUGIN_NAME}:${suffix}`);
    }
    /** Reuse a cached accessory for `uuid` or create a new one. */
    acquire(uuid, displayName, context) {
        this.discoveredUuids.add(uuid);
        const existing = this.accessories.get(uuid);
        if (existing) {
            existing.context = context;
            this.api.updatePlatformAccessories([existing]);
            return { accessory: existing, isNew: false };
        }
        const accessory = new this.api.platformAccessory(displayName, uuid);
        accessory.context = context;
        this.accessories.set(uuid, accessory);
        return { accessory, isNew: true };
    }
    register(accessory) {
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
    addHandler(deviceId, handler) {
        const list = this.deviceHandlers.get(deviceId);
        if (list) {
            list.push(handler);
        }
        else {
            this.deviceHandlers.set(deviceId, [handler]);
        }
    }
    pruneStale() {
        for (const [uuid, accessory] of this.accessories) {
            if (!this.discoveredUuids.has(uuid)) {
                this.log.info(`Removing accessory no longer present on Vera: ${accessory.displayName}`);
                this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
                this.accessories.delete(uuid);
            }
        }
    }
    shouldInclude(id) {
        const { includeDeviceIds, excludeDeviceIds } = this.config;
        if (includeDeviceIds.length > 0 && !includeDeviceIds.includes(id)) {
            return false;
        }
        return !excludeDeviceIds.includes(id);
    }
}
