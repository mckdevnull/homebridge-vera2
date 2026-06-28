import { afterEach, describe, expect, it, vi } from 'vitest';
import { noopLogger } from '../src/util/logger.js';
import { DeviceKind } from '../src/vera/categories.js';
import { LuupBackend } from '../src/vera/luupBackend.js';
import { ThermostatMode, type DeviceState } from '../src/vera/types.js';

const SDATA = {
  full: 1,
  loadtime: 111,
  dataversion: 222,
  mode: '1',
  temperature: 'F',
  categories: [
    { id: 2, name: 'Dimmable' },
    { id: 3, name: 'Switch' },
  ],
  rooms: [{ id: 1, name: 'Kitchen' }],
  scenes: [{ id: 7, name: 'Movie', room: 1 }],
  devices: [
    { id: 5, name: 'Lamp', category: 2, subcategory: 1, room: 1 },
    { id: 6, name: 'Plug', category: 3, subcategory: 1, room: 1 },
    { id: 8, name: 'Front Door', category: 7, subcategory: 0, room: 1 },
    { id: 9, name: 'Motion', category: 4, subcategory: 3, room: 1 },
    { id: 10, name: 'Hall Temp', category: 17, subcategory: 0, room: 1 },
  ],
};

const STATUS = {
  LoadTime: 111,
  DataVersion: 222,
  Mode: '1',
  devices: [
    {
      id: 5,
      states: [
        { service: 'urn:upnp-org:serviceId:SwitchPower1', variable: 'Status', value: '1' },
        { service: 'urn:upnp-org:serviceId:Dimming1', variable: 'LoadLevelStatus', value: '60' },
      ],
    },
    { id: 6, states: [{ service: 'urn:upnp-org:serviceId:SwitchPower1', variable: 'Status', value: '0' }] },
    { id: 8, states: [{ service: 'urn:micasaverde-com:serviceId:DoorLock1', variable: 'Status', value: '1' }] },
    {
      id: 9,
      states: [
        { service: 'urn:micasaverde-com:serviceId:SecuritySensor1', variable: 'Tripped', value: '0' },
        { service: 'urn:micasaverde-com:serviceId:SecuritySensor1', variable: 'Armed', value: '1' },
        { service: 'urn:micasaverde-com:serviceId:HaDevice1', variable: 'BatteryLevel', value: '80' },
      ],
    },
    {
      id: 10,
      states: [{ service: 'urn:upnp-org:serviceId:TemperatureSensor1', variable: 'CurrentTemperature', value: '68' }],
    },
  ],
};

const USERDATA = {
  devices: [
    {
      id: 5,
      device_type: 'urn:schemas-upnp-org:device:DimmableLight:1',
      device_file: 'D_DimmableLight1.xml',
      manufacturer: 'Acme',
      model: 'Dimmer X',
    },
  ],
};

function res(body: string): Response {
  return { ok: true, status: 200, statusText: 'OK', text: async () => body } as unknown as Response;
}

const actions: URL[] = [];
let refreshBody = '';

function installFetch() {
  const fetchMock = vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    const id = url.searchParams.get('id');
    if (id === 'sdata') {
      return res(JSON.stringify(SDATA));
    }
    if (id === 'user_data') {
      return res(JSON.stringify(USERDATA));
    }
    if (id === 'action') {
      actions.push(url);
      return res('');
    }
    if (id === 'status') {
      if (url.searchParams.has('DeviceNum')) {
        return res(refreshBody);
      }
      if (url.searchParams.has('DataVersion')) {
        return res('NO_CHANGES');
      }
      return res(JSON.stringify(STATUS));
    }
    return res('');
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function makeBackend(): LuupBackend {
  return new LuupBackend({
    host: 'vera',
    port: 3480,
    requestTimeoutSeconds: 5,
    pollTimeoutSeconds: 5,
    pollMinimumDelayMs: 200,
    logger: noopLogger,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  actions.length = 0;
  refreshBody = '';
});

describe('LuupBackend discovery', () => {
  it('discovers and normalises devices, scenes, house mode and unit', async () => {
    installFetch();
    const backend = makeBackend();
    await backend.start();

    const devices = backend.getDevices();
    const byId = Object.fromEntries(devices.map((d) => [d.id, d]));
    expect(devices.length).toBe(5);

    expect(byId['5'].kind).toBe(DeviceKind.Dimmer);
    expect(byId['5'].state.on).toBe(true);
    expect(byId['5'].state.brightness).toBe(60);
    expect(byId['5'].manufacturer).toBe('Acme');
    expect(byId['5'].room).toBe('Kitchen');

    expect(byId['6'].kind).toBe(DeviceKind.Switch);
    expect(byId['6'].state.on).toBe(false);

    expect(byId['8'].kind).toBe(DeviceKind.Lock);
    expect(byId['8'].state.locked).toBe(true);

    expect(byId['9'].kind).toBe(DeviceKind.MotionSensor);
    expect(byId['9'].state.tripped).toBe(false);
    expect(byId['9'].state.armed).toBe(true);
    expect(byId['9'].hasBattery).toBe(true);
    expect(byId['9'].armable).toBe(true);
    expect(byId['9'].state.batteryLevel).toBe(80);

    expect(byId['10'].kind).toBe(DeviceKind.TemperatureSensor);
    expect(byId['10'].state.currentTemperature).toBe(20); // 68F -> 20C

    expect(backend.getScenes()).toHaveLength(1);
    expect(backend.getScenes()[0]).toMatchObject({ id: '7', name: 'Movie', room: 'Kitchen' });
    expect(backend.getHouseMode()).toBe(1);
    expect(backend.temperatureUnit).toBe('F');

    await backend.stop();
  });
});

describe('LuupBackend commands', () => {
  it('sends SwitchPower SetTarget with correct args', async () => {
    installFetch();
    const backend = makeBackend();
    await backend.start();
    await backend.setSwitch('6', true);
    const action = actions.at(-1)!;
    expect(action.searchParams.get('serviceId')).toBe('urn:upnp-org:serviceId:SwitchPower1');
    expect(action.searchParams.get('action')).toBe('SetTarget');
    expect(action.searchParams.get('newTargetValue')).toBe('1');
    expect(action.searchParams.get('DeviceNum')).toBe('6');
    await backend.stop();
  });

  it('converts thermostat setpoint to the controller unit', async () => {
    installFetch();
    const backend = makeBackend();
    await backend.start();
    await backend.setThermostatSetpoint('10', 20); // 20C -> 68F
    const action = actions.at(-1)!;
    expect(action.searchParams.get('serviceId')).toBe('urn:upnp-org:serviceId:TemperatureSetpoint1');
    expect(action.searchParams.get('action')).toBe('SetCurrentSetpoint');
    expect(action.searchParams.get('NewCurrentSetpoint')).toBe('68');
    await backend.stop();
  });

  it('runs a scene via the gateway device', async () => {
    installFetch();
    const backend = makeBackend();
    await backend.start();
    await backend.runScene('7');
    const action = actions.at(-1)!;
    expect(action.searchParams.get('DeviceNum')).toBe('0');
    expect(action.searchParams.get('action')).toBe('RunScene');
    expect(action.searchParams.get('SceneNum')).toBe('7');
    await backend.stop();
  });
});

describe('LuupBackend.probe', () => {
  it('discovers devices for the config UI without starting the poll loop', async () => {
    const fetchMock = installFetch();
    const backend = makeBackend();
    await backend.probe();

    expect(backend.getDevices().length).toBe(5);
    expect(backend.getScenes()).toHaveLength(1);

    // probe() must not start the long-poll: no status request carries a DataVersion.
    const polled = fetchMock.mock.calls.some((c) => String(c[0]).includes('DataVersion'));
    expect(polled).toBe(false);
    await backend.stop();
  });
});

describe('LuupBackend.refreshDevice', () => {
  it('refreshes a single device and emits a state patch', async () => {
    installFetch();
    refreshBody = JSON.stringify({
      devices: [
        { id: 6, states: [{ service: 'urn:upnp-org:serviceId:SwitchPower1', variable: 'Status', value: '1' }] },
      ],
    });
    const backend = makeBackend();
    await backend.start();

    const events: Array<[string, Partial<DeviceState>]> = [];
    backend.on('deviceState', (id, state) => events.push([id, state]));
    await backend.refreshDevice('6');

    expect(events.some(([id, state]) => id === '6' && state.on === true)).toBe(true);
    await backend.stop();
  });
});

describe('LuupBackend re-discovery behaviour', () => {
  it('ignores updates for known unsupported devices (no re-discovery loop)', async () => {
    const sdata = {
      full: 1,
      loadtime: 1,
      dataversion: 2,
      mode: '1',
      temperature: 'C',
      rooms: [],
      scenes: [],
      devices: [
        { id: 5, name: 'Lamp', category: 3, subcategory: 1 }, // supported switch
        { id: 99, name: 'Meter', category: 21, subcategory: 0 }, // power meter -> Unsupported
      ],
    };
    const statusFull = {
      LoadTime: 1,
      DataVersion: 2,
      devices: [
        { id: 5, states: [{ service: 'urn:upnp-org:serviceId:SwitchPower1', variable: 'Status', value: '0' }] },
        { id: 99, states: [{ service: 'urn:micasaverde-com:serviceId:EnergyMetering1', variable: 'Watts', value: '100' }] },
      ],
    };
    const pollDelta = {
      LoadTime: 1,
      DataVersion: 3,
      devices: [
        { id: 99, states: [{ service: 'urn:micasaverde-com:serviceId:EnergyMetering1', variable: 'Watts', value: '200' }] },
      ],
    };
    let sdataCalls = 0;
    let polled = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL) => {
        const url = new URL(String(input));
        const id = url.searchParams.get('id');
        if (id === 'sdata') {
          sdataCalls++;
          return res(JSON.stringify(sdata));
        }
        if (id === 'user_data') {
          return res(JSON.stringify({ devices: [] }));
        }
        if (id === 'status') {
          if (url.searchParams.has('DataVersion')) {
            if (!polled) {
              polled = true;
              return res(JSON.stringify(pollDelta));
            }
            return res('NO_CHANGES');
          }
          return res(JSON.stringify(statusFull));
        }
        return res('');
      }),
    );

    const backend = makeBackend();
    const topo: number[] = [];
    backend.on('topologyChanged', () => topo.push(1));
    await backend.start();
    await new Promise((r) => setTimeout(r, 60));

    expect(backend.getDevices()).toHaveLength(1); // only the supported switch
    expect(sdataCalls).toBe(1); // discovery ran once; the unsupported meter did NOT cause a re-discovery
    expect(topo).toHaveLength(0);
    await backend.stop();
  });

  it('re-discovers once when a genuinely new device appears', async () => {
    let sdataCalls = 0;
    let polled = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL) => {
        const url = new URL(String(input));
        const id = url.searchParams.get('id');
        if (id === 'sdata') {
          sdataCalls++;
          const devices =
            sdataCalls === 1
              ? [{ id: 5, name: 'Lamp', category: 3, subcategory: 1 }]
              : [
                  { id: 5, name: 'Lamp', category: 3, subcategory: 1 },
                  { id: 7, name: 'Plug', category: 3, subcategory: 1 },
                ];
          return res(JSON.stringify({ full: 1, loadtime: 1, dataversion: 2, temperature: 'C', rooms: [], scenes: [], devices }));
        }
        if (id === 'user_data') {
          return res(JSON.stringify({ devices: [] }));
        }
        if (id === 'status') {
          if (url.searchParams.has('DataVersion')) {
            if (!polled) {
              polled = true;
              return res(
                JSON.stringify({
                  LoadTime: 1,
                  DataVersion: 3,
                  devices: [{ id: 7, states: [{ service: 'urn:upnp-org:serviceId:SwitchPower1', variable: 'Status', value: '1' }] }],
                }),
              );
            }
            return res('NO_CHANGES');
          }
          const ids = sdataCalls <= 1 ? [5] : [5, 7];
          return res(
            JSON.stringify({
              LoadTime: 1,
              DataVersion: 2,
              devices: ids.map((n) => ({ id: n, states: [{ service: 'urn:upnp-org:serviceId:SwitchPower1', variable: 'Status', value: '0' }] })),
            }),
          );
        }
        return res('');
      }),
    );

    const backend = makeBackend();
    const topo: number[] = [];
    backend.on('topologyChanged', () => topo.push(1));
    await backend.start();
    await new Promise((r) => setTimeout(r, 80));

    expect(sdataCalls).toBeGreaterThanOrEqual(2); // re-discovered after the new device appeared
    expect(topo.length).toBeGreaterThanOrEqual(1);
    expect(backend.getDevices().map((d) => d.id).sort()).toEqual(['5', '7']);
    await backend.stop();
  });
});

describe('LuupBackend thermostat inference & name fallback', () => {
  function stub(sdata: object, statusFull: object) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL) => {
        const url = new URL(String(input));
        const id = url.searchParams.get('id');
        if (id === 'sdata') {
          return res(JSON.stringify(sdata));
        }
        if (id === 'user_data') {
          return res(JSON.stringify({ devices: [] }));
        }
        if (id === 'status') {
          return url.searchParams.has('DataVersion') ? res('NO_CHANGES') : res(JSON.stringify(statusFull));
        }
        return res('');
      }),
    );
  }

  it('infers heating when HVAC_OperatingState ModeState is absent', async () => {
    stub(
      { full: 1, loadtime: 1, dataversion: 2, temperature: 'C', rooms: [], scenes: [], devices: [{ id: 30, name: 'Thermo', category: 5, subcategory: 1 }] },
      {
        LoadTime: 1,
        DataVersion: 2,
        devices: [
          {
            id: 30,
            states: [
              { service: 'urn:upnp-org:serviceId:TemperatureSensor1', variable: 'CurrentTemperature', value: '18' },
              { service: 'urn:upnp-org:serviceId:HVAC_UserOperatingMode1', variable: 'ModeStatus', value: 'HeatOn' },
              { service: 'urn:upnp-org:serviceId:TemperatureSetpoint1', variable: 'CurrentSetpoint', value: '22' },
              // deliberately NO HVAC_OperatingState1.ModeState
            ],
          },
        ],
      },
    );
    const backend = makeBackend();
    await backend.start();
    const t = backend.getDevices().find((d) => d.id === '30')!;
    expect(t.state.mode).toBe(ThermostatMode.Heat);
    expect(t.state.operatingState).toBe('heating'); // inferred from 18 < 22 while in Heat mode
    await backend.stop();
  });

  it('falls back to a generated name when the device name is empty', async () => {
    stub(
      { full: 1, loadtime: 1, dataversion: 2, temperature: 'C', rooms: [], scenes: [], devices: [{ id: 41, name: '', category: 3, subcategory: 1 }] },
      { LoadTime: 1, DataVersion: 2, devices: [{ id: 41, states: [{ service: 'urn:upnp-org:serviceId:SwitchPower1', variable: 'Status', value: '1' }] }] },
    );
    const backend = makeBackend();
    await backend.start();
    expect(backend.getDevices()[0].name).toBe('Device 41');
    await backend.stop();
  });
});
