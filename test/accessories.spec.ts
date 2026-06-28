import { Accessory, Characteristic, HAPStatus, HapStatusError, Service, uuid } from '@homebridge/hap-nodejs';
import type { PlatformAccessory } from 'homebridge';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VeraDeviceAccessory } from '../src/accessories/deviceAccessory.js';
import { HouseModeAccessory } from '../src/accessories/houseMode.js';
import { SceneAccessory } from '../src/accessories/scene.js';
import { createArmSwitchAccessory, createDeviceAccessory } from '../src/factory.js';
import type { VeraHomebridgePlatform } from '../src/platform.js';
import { DeviceKind } from '../src/vera/categories.js';
import { ThermostatMode, type NormalizedDevice } from '../src/vera/types.js';
import { noopLogger } from '../src/util/logger.js';

function makeBackend() {
  return {
    temperatureUnit: 'C' as const,
    setSwitch: vi.fn(async () => {}),
    setBrightness: vi.fn(async () => {}),
    setColorRgb: vi.fn(async () => {}),
    setLock: vi.fn(async () => {}),
    setCoverPosition: vi.fn(async () => {}),
    coverStop: vi.fn(async () => {}),
    setThermostatMode: vi.fn(async () => {}),
    setThermostatSetpoint: vi.fn(async () => {}),
    setArmed: vi.fn(async () => {}),
    runScene: vi.fn(async () => {}),
    setHouseMode: vi.fn(async () => {}),
  };
}

type Backend = ReturnType<typeof makeBackend>;

function makePlatform(backend: Backend): VeraHomebridgePlatform {
  return {
    Service,
    Characteristic,
    log: noopLogger,
    api: { hap: { HapStatusError, HAPStatus, uuid } },
    backend,
  } as unknown as VeraHomebridgePlatform;
}

function makeAccessory(name = 'Test'): PlatformAccessory {
  return new Accessory(name, uuid.generate(`test-${name}-${Math.round(performance.now())}`)) as unknown as PlatformAccessory;
}

function makeDevice(kind: DeviceKind, state: Partial<NormalizedDevice['state']> = {}): NormalizedDevice {
  return {
    id: '1',
    name: `Test ${kind}`,
    kind,
    hasBattery: false,
    armable: false,
    category: 0,
    subcategory: 0,
    state: { online: true, ...state },
  };
}

afterEach(() => vi.restoreAllMocks());

const KIND_SERVICE: Array<[DeviceKind, typeof Service.Switch]> = [
  [DeviceKind.Switch, Service.Switch],
  [DeviceKind.Dimmer, Service.Lightbulb],
  [DeviceKind.RgbLight, Service.Lightbulb],
  [DeviceKind.Fan, Service.Fan],
  [DeviceKind.Lock, Service.LockMechanism],
  [DeviceKind.GarageDoor, Service.GarageDoorOpener],
  [DeviceKind.Thermostat, Service.Thermostat],
  [DeviceKind.WindowCovering, Service.WindowCovering],
  [DeviceKind.MotionSensor, Service.MotionSensor],
  [DeviceKind.ContactSensor, Service.ContactSensor],
  [DeviceKind.LeakSensor, Service.LeakSensor],
  [DeviceKind.SmokeSensor, Service.SmokeSensor],
  [DeviceKind.CoSensor, Service.CarbonMonoxideSensor],
  [DeviceKind.GlassBreakSensor, Service.MotionSensor],
  [DeviceKind.TemperatureSensor, Service.TemperatureSensor],
  [DeviceKind.HumiditySensor, Service.HumiditySensor],
  [DeviceKind.LightSensor, Service.LightSensor],
];

describe('factory + accessory construction', () => {
  it.each(KIND_SERVICE)('creates a %s accessory exposing the right service', (kind, serviceType) => {
    const platform = makePlatform(makeBackend());
    const accessory = makeAccessory(kind);
    const handler = createDeviceAccessory(platform, accessory, makeDevice(kind));
    expect(handler).toBeInstanceOf(VeraDeviceAccessory);
    expect(accessory.getService(serviceType)).toBeDefined();
  });

  it('adds a Battery service when the device reports a battery', () => {
    const platform = makePlatform(makeBackend());
    const accessory = makeAccessory('batt');
    const device = { ...makeDevice(DeviceKind.MotionSensor), hasBattery: true };
    device.state = { online: true, batteryLevel: 15, lowBattery: true };
    createDeviceAccessory(platform, accessory, device);
    const battery = accessory.getService(Service.Battery)!;
    expect(battery.getCharacteristic(Characteristic.BatteryLevel).value).toBe(15);
    expect(battery.getCharacteristic(Characteristic.StatusLowBattery).value).toBe(
      Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW,
    );
  });
});

describe('switch mapping (both directions)', () => {
  it('pushes state and routes sets to the backend', async () => {
    const backend = makeBackend();
    const platform = makePlatform(backend);
    const accessory = makeAccessory('sw');
    const handler = createDeviceAccessory(platform, accessory, makeDevice(DeviceKind.Switch, { on: false }))!;
    const on = accessory.getService(Service.Switch)!.getCharacteristic(Characteristic.On);

    expect(on.value).toBe(false);
    handler.updateState({ on: true });
    expect(on.value).toBe(true);

    await on.handleSetRequest(false);
    expect(backend.setSwitch).toHaveBeenCalledWith('1', false);
  });

  it('reports Not Responding when offline', async () => {
    const platform = makePlatform(makeBackend());
    const accessory = makeAccessory('sw2');
    createDeviceAccessory(platform, accessory, makeDevice(DeviceKind.Switch, { on: true, online: false }));
    const on = accessory.getService(Service.Switch)!.getCharacteristic(Characteristic.On);
    // onGet throws HapStatusError -> handleGetRequest rejects with the HAP status code.
    await expect(on.handleGetRequest()).rejects.toBeTruthy();
  });
});

describe('dimmer + lock mapping', () => {
  it('maps brightness', async () => {
    const backend = makeBackend();
    const platform = makePlatform(backend);
    const accessory = makeAccessory('dim');
    createDeviceAccessory(platform, accessory, makeDevice(DeviceKind.Dimmer, { on: true, brightness: 42 }));
    const svc = accessory.getService(Service.Lightbulb)!;
    expect(svc.getCharacteristic(Characteristic.Brightness).value).toBe(42);
    await svc.getCharacteristic(Characteristic.Brightness).handleSetRequest(80);
    expect(backend.setBrightness).toHaveBeenCalledWith('1', 80);
  });

  it('maps lock secured/unsecured', async () => {
    const backend = makeBackend();
    const platform = makePlatform(backend);
    const accessory = makeAccessory('lock');
    createDeviceAccessory(platform, accessory, makeDevice(DeviceKind.Lock, { locked: true }));
    const svc = accessory.getService(Service.LockMechanism)!;
    expect(svc.getCharacteristic(Characteristic.LockCurrentState).value).toBe(
      Characteristic.LockCurrentState.SECURED,
    );
    await svc.getCharacteristic(Characteristic.LockTargetState).handleSetRequest(
      Characteristic.LockTargetState.UNSECURED,
    );
    expect(backend.setLock).toHaveBeenCalledWith('1', false);
  });
});

describe('rgb light colour', () => {
  it('coalesces hue/saturation into one RGB command', async () => {
    const backend = makeBackend();
    const platform = makePlatform(backend);
    const accessory = makeAccessory('rgb');
    createDeviceAccessory(platform, accessory, makeDevice(DeviceKind.RgbLight, { on: true, brightness: 100 }));
    const svc = accessory.getService(Service.Lightbulb)!;
    await svc.getCharacteristic(Characteristic.Hue).handleSetRequest(120);
    await svc.getCharacteristic(Characteristic.Saturation).handleSetRequest(100);
    await new Promise((r) => setTimeout(r, 90));
    expect(backend.setColorRgb).toHaveBeenCalledTimes(1);
    expect(backend.setColorRgb.mock.calls.at(-1)![1]).toEqual({ r: 0, g: 255, b: 0 });
  });
});

describe('thermostat mapping', () => {
  it('maps current temperature, mode and setpoint', async () => {
    const backend = makeBackend();
    const platform = makePlatform(backend);
    const accessory = makeAccessory('thermo');
    createDeviceAccessory(
      platform,
      accessory,
      makeDevice(DeviceKind.Thermostat, {
        currentTemperature: 20,
        targetTemperature: 21,
        mode: ThermostatMode.Heat,
        operatingState: 'heating',
      }),
    );
    const svc = accessory.getService(Service.Thermostat)!;
    expect(svc.getCharacteristic(Characteristic.CurrentTemperature).value).toBe(20);
    expect(svc.getCharacteristic(Characteristic.TargetHeatingCoolingState).value).toBe(
      Characteristic.TargetHeatingCoolingState.HEAT,
    );
    await svc.getCharacteristic(Characteristic.TargetTemperature).handleSetRequest(22);
    expect(backend.setThermostatSetpoint).toHaveBeenCalledWith('1', 22);
    await svc.getCharacteristic(Characteristic.TargetHeatingCoolingState).handleSetRequest(
      Characteristic.TargetHeatingCoolingState.COOL,
    );
    expect(backend.setThermostatMode).toHaveBeenCalledWith('1', ThermostatMode.Cool);
  });
});

describe('binary + measurement sensors', () => {
  it('maps motion tripped state', () => {
    const platform = makePlatform(makeBackend());
    const accessory = makeAccessory('motion');
    const handler = createDeviceAccessory(platform, accessory, makeDevice(DeviceKind.MotionSensor, { tripped: false }))!;
    const md = accessory.getService(Service.MotionSensor)!.getCharacteristic(Characteristic.MotionDetected);
    expect(md.value).toBe(false);
    handler.updateState({ tripped: true });
    expect(md.value).toBe(true);
  });

  it('maps contact tripped to ContactSensorState', () => {
    const platform = makePlatform(makeBackend());
    const accessory = makeAccessory('contact');
    const handler = createDeviceAccessory(platform, accessory, makeDevice(DeviceKind.ContactSensor, { tripped: true }))!;
    const cs = accessory.getService(Service.ContactSensor)!.getCharacteristic(Characteristic.ContactSensorState);
    expect(cs.value).toBe(Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
    handler.updateState({ tripped: false });
    expect(cs.value).toBe(Characteristic.ContactSensorState.CONTACT_DETECTED);
  });

  it('maps temperature/humidity/light readings', () => {
    const platform = makePlatform(makeBackend());
    const t = makeAccessory('t');
    createDeviceAccessory(platform, t, makeDevice(DeviceKind.TemperatureSensor, { currentTemperature: 19.5 }));
    expect(t.getService(Service.TemperatureSensor)!.getCharacteristic(Characteristic.CurrentTemperature).value).toBe(
      19.5,
    );

    const h = makeAccessory('h');
    createDeviceAccessory(platform, h, makeDevice(DeviceKind.HumiditySensor, { humidity: 55 }));
    expect(
      h.getService(Service.HumiditySensor)!.getCharacteristic(Characteristic.CurrentRelativeHumidity).value,
    ).toBe(55);
  });
});

describe('arm switch, scenes and house mode', () => {
  it('arms/disarms via the companion switch', async () => {
    const backend = makeBackend();
    const platform = makePlatform(backend);
    const accessory = makeAccessory('arm');
    createArmSwitchAccessory(platform, accessory, makeDevice(DeviceKind.MotionSensor, { armed: false }));
    await accessory.getService(Service.Switch)!.getCharacteristic(Characteristic.On).handleSetRequest(true);
    expect(backend.setArmed).toHaveBeenCalledWith('1', true);
  });

  it('runs a scene when the momentary switch is turned on', async () => {
    const backend = makeBackend();
    const platform = makePlatform(backend);
    const accessory = makeAccessory('scene');
    new SceneAccessory(platform, accessory, { id: '7', name: 'Movie' });
    await accessory.getService(Service.Switch)!.getCharacteristic(Characteristic.On).handleSetRequest(true);
    expect(backend.runScene).toHaveBeenCalledWith('7');
  });

  it('maps house mode to the security system and back', async () => {
    const backend = makeBackend();
    const platform = makePlatform(backend);
    const accessory = makeAccessory('house');
    const handler = new HouseModeAccessory(platform, accessory, 1); // Home
    const svc = accessory.getService(Service.SecuritySystem)!;
    expect(svc.getCharacteristic(Characteristic.SecuritySystemCurrentState).value).toBe(
      Characteristic.SecuritySystemCurrentState.STAY_ARM,
    );
    await svc.getCharacteristic(Characteristic.SecuritySystemTargetState).handleSetRequest(
      Characteristic.SecuritySystemTargetState.AWAY_ARM,
    );
    expect(backend.setHouseMode).toHaveBeenCalledWith(2); // Away
    handler.updateHouseMode(3); // Night
    expect(svc.getCharacteristic(Characteristic.SecuritySystemCurrentState).value).toBe(
      Characteristic.SecuritySystemCurrentState.NIGHT_ARM,
    );
  });
});
