import { afterEach, describe, expect, it, vi } from 'vitest';
import { noopLogger } from '../src/util/logger.js';
import { DeviceKind } from '../src/vera/categories.js';
import { LuupBackend } from '../src/vera/luupBackend.js';
import { ThermostatMode } from '../src/vera/types.js';

const SDATA = {
  full: 1,
  loadtime: 1,
  dataversion: 2,
  mode: '1',
  temperature: 'C',
  rooms: [],
  scenes: [],
  devices: [
    { id: 20, name: 'RGB', category: 2, subcategory: 4 },
    { id: 21, name: 'Blind', category: 8, subcategory: 1 },
    { id: 22, name: 'Thermostat', category: 5, subcategory: 1 },
    { id: 23, name: 'Humidity', category: 16, subcategory: 0 },
    { id: 24, name: 'Lux', category: 18, subcategory: 0 },
    { id: 25, name: 'Garage', category: 32, subcategory: 0 },
    { id: 26, name: 'Fan', category: 2, subcategory: 1 },
    { id: 27, name: 'Door', category: 4, subcategory: 1 },
  ],
};

const STATUS = {
  LoadTime: 1,
  DataVersion: 2,
  Mode: '1',
  devices: [
    {
      id: 20,
      states: [
        { service: 'urn:upnp-org:serviceId:SwitchPower1', variable: 'Status', value: '1' },
        { service: 'urn:upnp-org:serviceId:Dimming1', variable: 'LoadLevelStatus', value: '50' },
        { service: 'urn:micasaverde-com:serviceId:Color1', variable: 'SupportedColors', value: 'W,D,R,G,B' },
        { service: 'urn:micasaverde-com:serviceId:Color1', variable: 'CurrentColor', value: '0=0,1=0,2=0,3=255,4=0' },
      ],
    },
    { id: 21, states: [{ service: 'urn:upnp-org:serviceId:Dimming1', variable: 'LoadLevelStatus', value: '30' }] },
    {
      id: 22,
      states: [
        { service: 'urn:upnp-org:serviceId:TemperatureSensor1', variable: 'CurrentTemperature', value: '21' },
        { service: 'urn:upnp-org:serviceId:HVAC_UserOperatingMode1', variable: 'ModeStatus', value: 'HeatOn' },
        { service: 'urn:micasaverde-com:serviceId:HVAC_OperatingState1', variable: 'ModeState', value: 'Heating' },
        { service: 'urn:upnp-org:serviceId:TemperatureSetpoint1', variable: 'CurrentSetpoint', value: '22' },
      ],
    },
    { id: 23, states: [{ service: 'urn:micasaverde-com:serviceId:HumiditySensor1', variable: 'CurrentLevel', value: '55' }] },
    { id: 24, states: [{ service: 'urn:micasaverde-com:serviceId:LightSensor1', variable: 'CurrentLevel', value: '300' }] },
    { id: 25, states: [{ service: 'urn:upnp-org:serviceId:SwitchPower1', variable: 'Status', value: '1' }] },
    {
      id: 26,
      states: [
        { service: 'urn:upnp-org:serviceId:SwitchPower1', variable: 'Status', value: '1' },
        { service: 'urn:upnp-org:serviceId:Dimming1', variable: 'LoadLevelStatus', value: '75' },
      ],
    },
    { id: 27, states: [{ service: 'urn:micasaverde-com:serviceId:SecuritySensor1', variable: 'Tripped', value: '1' }] },
  ],
};

const USERDATA = { devices: [{ id: 26, device_file: 'D_FanSpeed1.xml' }] };

function res(body: string): Response {
  return { ok: true, status: 200, statusText: 'OK', text: async () => body } as unknown as Response;
}

function installFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      const id = url.searchParams.get('id');
      if (id === 'sdata') {
        // discovery sdata has no `timeout`; the live long-poll does.
        return url.searchParams.has('timeout') ? res('NO_CHANGES') : res(JSON.stringify(SDATA));
      }
      if (id === 'user_data') {
        return res(JSON.stringify(USERDATA));
      }
      if (id === 'status') {
        return res(JSON.stringify(STATUS));
      }
      return res('');
    }),
  );
}

afterEach(() => vi.restoreAllMocks());

describe('LuupBackend computeState across kinds', () => {
  it('normalises every supported device kind', async () => {
    installFetch();
    const backend = new LuupBackend({
      host: 'vera',
      port: 3480,
      requestTimeoutSeconds: 5,
      pollTimeoutSeconds: 5,
      pollMinimumDelayMs: 200,
      logger: noopLogger,
    });
    await backend.start();
    const byId = Object.fromEntries(backend.getDevices().map((d) => [d.id, d]));

    expect(byId['20'].kind).toBe(DeviceKind.RgbLight);
    expect(byId['20'].state.on).toBe(true);
    expect(byId['20'].state.brightness).toBe(50);
    expect(byId['20'].state.hue).toBe(120); // green
    expect(byId['20'].state.saturation).toBe(100);

    expect(byId['21'].kind).toBe(DeviceKind.WindowCovering);
    expect(byId['21'].state.position).toBe(30);

    expect(byId['22'].kind).toBe(DeviceKind.Thermostat);
    expect(byId['22'].state.currentTemperature).toBe(21);
    expect(byId['22'].state.mode).toBe(ThermostatMode.Heat);
    expect(byId['22'].state.operatingState).toBe('heating');
    expect(byId['22'].state.targetTemperature).toBe(22);

    expect(byId['23'].kind).toBe(DeviceKind.HumiditySensor);
    expect(byId['23'].state.humidity).toBe(55);

    expect(byId['24'].kind).toBe(DeviceKind.LightSensor);
    expect(byId['24'].state.lightLevel).toBe(300);

    expect(byId['25'].kind).toBe(DeviceKind.GarageDoor);
    expect(byId['25'].state.on).toBe(true);

    expect(byId['26'].kind).toBe(DeviceKind.Fan);
    expect(byId['26'].state.on).toBe(true);
    expect(byId['26'].state.brightness).toBe(75);

    expect(byId['27'].kind).toBe(DeviceKind.ContactSensor);
    expect(byId['27'].state.tripped).toBe(true);

    await backend.stop();
  });
});
