/**
 * Config UI X custom-UI backend. Runs inside Homebridge Config UI X (not in the
 * Homebridge runtime) and answers `/devices` requests from the settings page by
 * performing a one-shot discovery against the Vera controller.
 */
import { HomebridgePluginUiServer, RequestError } from '@homebridge/plugin-ui-utils';
import { LuupBackend } from '../dist/vera/luupBackend.js';

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} };

class VeraUiServer extends HomebridgePluginUiServer {
  constructor() {
    super();

    this.onRequest('/devices', async (payload) => {
      const host = String((payload && payload.host) || '').trim();
      const port = Number((payload && payload.port) || 3480) || 3480;
      if (!host) {
        throw new RequestError('Enter the Vera host/IP first, then load devices.', { status: 400 });
      }

      const backend = new LuupBackend({
        host,
        port,
        requestTimeoutSeconds: 10,
        pollTimeoutSeconds: 30,
        pollMinimumDelayMs: 200,
        logger: noopLogger,
      });

      try {
        await backend.probe();
      } catch (err) {
        throw new RequestError(`Could not reach Vera at ${host}:${port} — ${err.message}`, { status: 502 });
      }

      const devices = backend
        .getDevices()
        .map((d) => ({ id: d.id, name: d.name, kind: d.kind, room: d.room || '' }))
        .sort((a, b) => a.name.localeCompare(b.name));
      const scenes = backend.getScenes().map((s) => ({ id: s.id, name: s.name, room: s.room || '' }));

      return { devices, scenes, temperatureUnit: backend.temperatureUnit };
    });

    this.ready();
  }
}

(() => new VeraUiServer())();
