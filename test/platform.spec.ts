import { Accessory, Characteristic, HAPStatus, HapStatusError, Service, uuid } from '@homebridge/hap-nodejs';
import type { API, Logging, PlatformConfig } from 'homebridge';
import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VeraHomebridgePlatform } from '../src/platform.js';
import { PLUGIN_NAME } from '../src/settings.js';
import { DeviceKind } from '../src/vera/categories.js';
import { TypedEmitter, type BackendEventMap, type NormalizedDevice } from '../src/vera/types.js';
import { noopLogger } from '../src/util/logger.js';

class FakePlatformAccessory extends Accessory {
  context: Record<string, unknown> = {};
}

class FakeAPI extends EventEmitter {
  hap = { Service, Characteristic, uuid, HapStatusError, HAPStatus };
  platformAccessory = FakePlatformAccessory;
  registerPlatformAccessories = vi.fn();
  updatePlatformAccessories = vi.fn();
  unregisterPlatformAccessories = vi.fn();
}

class FakeBackend extends TypedEmitter<BackendEventMap> {
  temperatureUnit: 'C' | 'F' = 'C';
  devices: NormalizedDevice[] = [];
  scenes = [{ id: '7', name: 'Movie' }];
  houseMode: 1 | 2 | 3 | 4 | undefined = 1;
  start = vi.fn(async () => {});
  stop = vi.fn(async () => {});
  refreshDevice = vi.fn(async () => {});
  setSwitch = vi.fn(async () => {});
  setBrightness = vi.fn(async () => {});
  setColorRgb = vi.fn(async () => {});
  setLock = vi.fn(async () => {});
  setCoverPosition = vi.fn(async () => {});
  coverStop = vi.fn(async () => {});
  setThermostatMode = vi.fn(async () => {});
  setThermostatSetpoint = vi.fn(async () => {});
  setArmed = vi.fn(async () => {});
  runScene = vi.fn(async () => {});
  setHouseMode = vi.fn(async () => {});
  getDevices() {
    return this.devices;
  }
  getScenes() {
    return this.scenes;
  }
  getHouseMode() {
    return this.houseMode;
  }
}

function device(id: string, kind = DeviceKind.Switch): NormalizedDevice {
  return {
    id,
    name: `Device ${id}`,
    kind,
    hasBattery: false,
    armable: false,
    category: 0,
    subcategory: 0,
    state: { online: true, on: false },
  };
}

function makePlatform(backend: FakeBackend, config: Partial<PlatformConfig> = {}) {
  const api = new FakeAPI();
  const platform = new VeraHomebridgePlatform(
    noopLogger as unknown as Logging,
    { platform: 'Vera2', name: 'Vera2', host: '10.0.0.1', ...config } as PlatformConfig,
    api as unknown as API,
  );
  platform.backend = backend as never;
  return { api, platform };
}

const start = (platform: VeraHomebridgePlatform) =>
  (platform as unknown as { start(): Promise<void> }).start();

afterEach(() => vi.restoreAllMocks());

describe('VeraHomebridgePlatform', () => {
  it('discovers devices, scenes and house mode and registers accessories', async () => {
    const backend = new FakeBackend();
    backend.devices = [device('5'), device('6', DeviceKind.Dimmer)];
    const { api, platform } = makePlatform(backend);

    await start(platform);

    // 2 devices + 1 scene + 1 house mode = 4 accessories registered.
    const registered = api.registerPlatformAccessories.mock.calls.flatMap((c) => c[2] as Accessory[]);
    expect(registered).toHaveLength(4);
    expect(platform.accessories.size).toBe(4);
    expect(backend.start).toHaveBeenCalled();
  });

  it('reuses cached accessories and prunes stale ones', async () => {
    const backend = new FakeBackend();
    backend.devices = [device('5')];
    backend.scenes = [];
    backend.houseMode = undefined;
    const { api, platform } = makePlatform(backend);

    // A stale cached accessory for a device that no longer exists.
    const stale = new FakePlatformAccessory('Old', uuid.generate(`${PLUGIN_NAME}:device:999`));
    platform.configureAccessory(stale as never);
    // A cached accessory that WILL be rediscovered (device 5).
    const cached = new FakePlatformAccessory('Device 5', uuid.generate(`${PLUGIN_NAME}:device:5`));
    platform.configureAccessory(cached as never);

    await start(platform);

    // device 5 reused -> not registered as new; stale removed.
    expect(api.registerPlatformAccessories).not.toHaveBeenCalled();
    const unregistered = api.unregisterPlatformAccessories.mock.calls.flatMap((c) => c[2] as Accessory[]);
    expect(unregistered).toContain(stale);
    expect(platform.accessories.has(stale.UUID)).toBe(false);
  });

  it('honours include/exclude device id filters', async () => {
    const backend = new FakeBackend();
    backend.devices = [device('5'), device('6'), device('7')];
    backend.scenes = [];
    backend.houseMode = undefined;
    const { platform } = makePlatform(backend, { excludeDeviceIds: ['6'] });

    await start(platform);

    expect(platform.accessories.has(uuid.generate(`${PLUGIN_NAME}:device:5`))).toBe(true);
    expect(platform.accessories.has(uuid.generate(`${PLUGIN_NAME}:device:6`))).toBe(false);
    expect(platform.accessories.has(uuid.generate(`${PLUGIN_NAME}:device:7`))).toBe(true);
  });

  it('routes backend state events to the accessory', async () => {
    const backend = new FakeBackend();
    backend.devices = [device('5')];
    backend.scenes = [];
    backend.houseMode = undefined;
    const { platform } = makePlatform(backend);
    await start(platform);

    backend.emit('deviceState', '5', { on: true });

    const accessory = platform.accessories.get(uuid.generate(`${PLUGIN_NAME}:device:5`))!;
    const on = accessory.getService(Service.Switch)!.getCharacteristic(Characteristic.On);
    expect(on.value).toBe(true);
  });

  it('re-discovers on topology change', async () => {
    const backend = new FakeBackend();
    backend.devices = [device('5')];
    backend.scenes = [];
    backend.houseMode = undefined;
    const { platform } = makePlatform(backend);
    await start(platform);

    backend.devices = [device('5'), device('8')];
    backend.emit('topologyChanged');

    expect(platform.accessories.has(uuid.generate(`${PLUGIN_NAME}:device:8`))).toBe(true);
  });

  it('does not start when host is missing (invalid config)', async () => {
    const backend = new FakeBackend();
    const { platform } = makePlatform(backend, { host: undefined });
    await start(platform);
    expect(backend.start).not.toHaveBeenCalled();
  });
});
