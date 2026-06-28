# homebridge-vera2

A modern [Homebridge](https://homebridge.io) **dynamic platform** plugin that bridges
[Vera](https://getvera.com) (MiCasaVerde / now Ezlo) smart-home controllers to Apple HomeKit
over the **local Luup HTTP API**.

Built for **Homebridge 2.0** (and backward-compatible with 1.8+), TypeScript + ESM, **zero
runtime dependencies**, and Node.js 22/24. It is a clean, maintained replacement for the
abandoned `homebridge-vera` and `homebridge-plugin-vera` projects, which rely on APIs removed
in Homebridge 2.0.

> **Local-only by design.** This plugin talks to your Vera directly on your LAN
> (`http://<vera-ip>:3480`). It needs no Vera/Ezlo cloud account and is unaffected by the
> Ezlo cloud-API paywall taking effect **1 August 2026** — local control remains free.
> For remote access, use Homebridge's own remote-access features.

## Why a new plugin?

Homebridge 2.0 ships HAP-NodeJS v1, which removes the APIs the older Vera plugins depend on
(legacy `.on('get'/'set')` callbacks, `Characteristic.getValue()`, accessory reachability,
`BatteryService`, enums on the `Characteristic` class) and requires Node 22+. Rather than
patch an unmaintained codebase, `homebridge-vera2` is a fresh implementation that:

- uses the **Dynamic Platform** model with proper accessory caching, restoration and pruning;
- uses **`onGet`/`onSet` promise handlers** and `updateCharacteristic` push updates;
- surfaces **"Not Responding"** via `HapStatusError` (the 2.0 way), no reachability;
- keeps HomeKit in sync efficiently with Vera's **incremental long-poll** (`status` +
  `DataVersion`/`LoadTime`/`Timeout`/`MinimumDelay`) instead of brute-force 1-second polling;
- isolates the controller protocol behind a **pluggable backend** so a future Ezlo
  WSS/JSON-RPC backend can be added without touching the HomeKit mapping.

## Supported devices

| Vera category | HomeKit accessory |
|---|---|
| Dimmable light (2) | Lightbulb (+ Brightness) |
| Dimmable light, RGB (2/sub 4 or `Color1`) | Lightbulb (+ Brightness, Hue, Saturation) |
| Fan (2/3 with a fan device file) | Fan (+ variable speed) |
| Binary switch (3) | Switch |
| Garage door (3/sub 5, or 32) | Garage Door Opener |
| Security sensor — door/window (4/1) | Contact Sensor |
| Security sensor — leak (4/2) | Leak Sensor |
| Security sensor — motion (4/3) | Motion Sensor |
| Security sensor — smoke (4/4) | Smoke Sensor |
| Security sensor — CO (4/5) | Carbon Monoxide Sensor |
| Security sensor — glass break (4/6) | Motion Sensor |
| HVAC thermostat (5) | Thermostat |
| Door lock (7) | Lock Mechanism |
| Window covering (8) | Window Covering |
| Humidity sensor (16) | Humidity Sensor |
| Temperature sensor (17) | Temperature Sensor |
| Light sensor (18) | Light Sensor |
| Scenes | momentary Switch (runs the scene) |
| Controller House Mode | Security System |

Battery-powered devices also expose a Battery service with low-battery status. Armable
sensors can optionally expose an extra arm/disarm Switch (`exposeArmDisarm`).

## Installation

Requires **Node.js 22.14+ or 24+** and **Homebridge 1.8+ / 2.0+**.

Install via the Homebridge UI (search for `homebridge-vera2`) or:

```bash
npm install -g homebridge-vera2
```

## Configuration

Use the Homebridge UI (a config schema is provided), or add a platform block to `config.json`:

```json
{
  "platforms": [
    {
      "platform": "Vera2",
      "name": "Vera2",
      "host": "192.168.1.50",
      "port": 3480,
      "pollTimeoutSeconds": 30,
      "pollMinimumDelayMs": 200,
      "requestTimeoutSeconds": 10,
      "hideScenes": false,
      "hideHouseMode": false,
      "exposeArmDisarm": false,
      "includeDeviceIds": [],
      "excludeDeviceIds": [],
      "debug": false
    }
  ]
}
```

| Option | Default | Description |
|---|---|---|
| `host` *(required)* | — | Vera controller LAN IP / hostname |
| `port` | `3480` | Luup HTTP port |
| `pollTimeoutSeconds` | `30` | Long-poll hold time on the controller |
| `pollMinimumDelayMs` | `200` | Minimum delay to coalesce bursts |
| `requestTimeoutSeconds` | `10` | Timeout for control/read requests |
| `hideScenes` | `false` | Don't expose scenes |
| `hideHouseMode` | `false` | Don't expose House Mode as a Security System |
| `exposeArmDisarm` | `false` | Add an arm/disarm Switch for armable sensors |
| `includeDeviceIds` | `[]` | If set, expose ONLY these Vera device numbers |
| `excludeDeviceIds` | `[]` | Vera device numbers to never expose |
| `debug` | `false` | Verbose logging |

House Mode maps to the HomeKit Security System as: Home → Stay, Away → Away, Night → Night,
Vacation → Disarmed.

## Development

```bash
npm install
npm run build      # compile TypeScript to dist/
npm test           # run the vitest suite
npm run test:coverage
npm run lint       # type-only lint (tsc --noEmit)
```

See [DESIGN.md](DESIGN.md) for the architecture and the Vera Luup API reference this plugin
is built on.

## Compatibility notes

- Targets **legacy Vera units** (UI5/UI7: VeraEdge, VeraPlus, VeraSecure, VeraLite, Vera3)
  that expose the Luup HTTP API on port 3480.
- **Native Ezlo hubs** (Ezlo Plus/Secure/Atom) do **not** expose the Luup API; they use a new
  WSS/JSON-RPC API. A backend for those can be added later (the architecture is ready for it).

## License

[Apache-2.0](LICENSE).
