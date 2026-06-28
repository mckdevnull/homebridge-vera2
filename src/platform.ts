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

import type {
  API,
  Characteristic,
  DynamicPlatformPlugin,
  Logging,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';

import type { VeraDeviceAccessory } from './accessories/deviceAccessory.js';
import { HouseModeAccessory } from './accessories/houseMode.js';
import { SceneAccessory } from './accessories/scene.js';
import { parseConfig, type VeraConfig } from './config.js';
import { createArmSwitchAccessory, createDeviceAccessory } from './factory.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { createBackend } from './vera/backend.js';
import { isSensorKind, type HouseModeValue } from './vera/categories.js';
import type { NormalizedDevice, NormalizedScene, VeraBackend } from './vera/types.js';

export class VeraHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  /** Cached accessories restored from disk, keyed by UUID. */
  public readonly accessories = new Map<string, PlatformAccessory>();

  /** Active device handlers keyed by Vera device id (a sensor can have >1). */
  private readonly deviceHandlers = new Map<string, VeraDeviceAccessory[]>();
  private houseModeHandler?: HouseModeAccessory;
  private readonly discoveredUuids = new Set<string>();

  public config!: VeraConfig;
  public backend!: VeraBackend;
  private configValid = false;
  private started = false;

  constructor(
    public readonly log: Logging,
    rawConfig: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    try {
      this.config = parseConfig(rawConfig as unknown as Record<string, unknown>);
      this.configValid = true;
    } catch (err) {
      this.log.error(`Vera2 configuration error: ${(err as Error).message}`);
      return;
    }

    this.backend = createBackend(this.config, this.log);

    // Never let a startup error become an unhandled rejection — that would crash
    // the (child) bridge process and take all its accessories offline.
    this.api.on('didFinishLaunching', () => {
      this.start().catch((err) => this.log.error(`Vera2 startup failed: ${(err as Error).message}`));
    });
    this.api.on('shutdown', () => {
      this.backend?.stop().catch(() => {});
    });
  }

  /** Called once per cached accessory at startup, before `didFinishLaunching`. */
  configureAccessory(accessory: PlatformAccessory): void {
    this.accessories.set(accessory.UUID, accessory);
  }

  private async start(): Promise<void> {
    if (!this.configValid) {
      return;
    }
    this.wireEvents();
    try {
      await this.backend.start();
    } catch (err) {
      this.log.error(
        `Failed to connect to Vera at ${this.config.host}:${this.config.port} — ${(err as Error).message}`,
      );
      return;
    }
    this.started = true;
    this.discoverDevices();
  }

  private wireEvents(): void {
    this.backend.on('deviceState', (id, patch) => {
      for (const handler of this.deviceHandlers.get(id) ?? []) {
        try {
          handler.updateState(patch);
        } catch (err) {
          this.log.debug(`Failed to apply update to device ${id}: ${(err as Error).message}`);
        }
      }
    });
    this.backend.on('houseMode', (mode) => this.houseModeHandler?.updateHouseMode(mode));
    this.backend.on('topologyChanged', () => {
      if (!this.started) {
        return;
      }
      try {
        this.discoverDevices();
      } catch (err) {
        this.log.error(`Failed to refresh accessories after a Vera topology change: ${(err as Error).message}`);
      }
    });
    this.backend.on('connection', (connected) =>
      this.log.debug(`Vera connection ${connected ? 'established' : 'lost'}`),
    );
    this.backend.on('error', (err) => this.log.debug(`Backend error: ${err.message}`));
  }

  // ---------------------------------------------------------------------------
  // Discovery / caching lifecycle
  // ---------------------------------------------------------------------------

  private discoverDevices(): void {
    // Cancel pending timers on the previous round's handlers before dropping them.
    for (const handlers of this.deviceHandlers.values()) {
      for (const handler of handlers) {
        try {
          handler.dispose();
        } catch {
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
      } catch (err) {
        this.log.error(`Skipping device ${device.id} (${device.name}) — setup failed: ${(err as Error).message}`);
      }
    }

    if (!this.config.hideScenes) {
      for (const scene of this.backend.getScenes()) {
        try {
          this.setupScene(scene);
        } catch (err) {
          this.log.error(`Skipping scene ${scene.id} (${scene.name}) — setup failed: ${(err as Error).message}`);
        }
      }
    }

    if (!this.config.hideHouseMode) {
      const mode = this.backend.getHouseMode();
      if (mode !== undefined) {
        try {
          this.setupHouseMode(mode);
        } catch (err) {
          this.log.error(`House Mode accessory setup failed: ${(err as Error).message}`);
        }
      }
    }

    this.pruneStale();
  }

  private setupDevice(device: NormalizedDevice): void {
    const { accessory, isNew } = this.acquire(this.uuid(`device:${device.id}`), device.name, {
      kind: 'device',
      deviceId: device.id,
    });
    const handler = createDeviceAccessory(this, accessory, device);
    if (!handler) {
      return;
    }
    this.addHandler(device.id, handler);
    this.log.info(`${isNew ? 'Adding' : 'Restoring'} "${device.name}" (Vera device ${device.id}) as ${device.kind}`);
    if (isNew) {
      this.register(accessory);
    }
  }

  private setupArmSwitch(device: NormalizedDevice): void {
    const { accessory, isNew } = this.acquire(this.uuid(`arm:${device.id}`), `${device.name} Arm`, {
      kind: 'arm',
      deviceId: device.id,
    });
    this.addHandler(device.id, createArmSwitchAccessory(this, accessory, device));
    this.log.info(`${isNew ? 'Adding' : 'Restoring'} arm/disarm switch for "${device.name}" (Vera device ${device.id})`);
    if (isNew) {
      this.register(accessory);
    }
  }

  private setupScene(scene: NormalizedScene): void {
    const { accessory, isNew } = this.acquire(this.uuid(`scene:${scene.id}`), scene.name, {
      kind: 'scene',
      sceneId: scene.id,
    });
    new SceneAccessory(this, accessory, scene);
    this.log.info(`${isNew ? 'Adding' : 'Restoring'} scene "${scene.name}" (id ${scene.id}) as a momentary switch`);
    if (isNew) {
      this.register(accessory);
    }
  }

  private setupHouseMode(mode: HouseModeValue): void {
    const { accessory, isNew } = this.acquire(this.uuid('housemode'), 'House Mode', { kind: 'housemode' });
    this.houseModeHandler = new HouseModeAccessory(this, accessory, mode);
    this.log.info(`${isNew ? 'Adding' : 'Restoring'} controller House Mode as a Security System`);
    if (isNew) {
      this.register(accessory);
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private uuid(suffix: string): string {
    return this.api.hap.uuid.generate(`${PLUGIN_NAME}:${suffix}`);
  }

  /** Reuse a cached accessory for `uuid` or create a new one. */
  private acquire(
    uuid: string,
    displayName: string,
    context: Record<string, unknown>,
  ): { accessory: PlatformAccessory; isNew: boolean } {
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

  private register(accessory: PlatformAccessory): void {
    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
  }

  private addHandler(deviceId: string, handler: VeraDeviceAccessory): void {
    const list = this.deviceHandlers.get(deviceId);
    if (list) {
      list.push(handler);
    } else {
      this.deviceHandlers.set(deviceId, [handler]);
    }
  }

  private pruneStale(): void {
    for (const [uuid, accessory] of this.accessories) {
      if (!this.discoveredUuids.has(uuid)) {
        this.log.info(`Removing accessory no longer present on Vera: ${accessory.displayName}`);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.accessories.delete(uuid);
      }
    }
  }

  private shouldInclude(id: string): boolean {
    const { includeDeviceIds, excludeDeviceIds } = this.config;
    if (includeDeviceIds.length > 0 && !includeDeviceIds.includes(id)) {
      return false;
    }
    return !excludeDeviceIds.includes(id);
  }
}
