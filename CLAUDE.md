# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Homebridge **dynamic platform** plugin bridging Vera (MiCasaVerde / Ezlo) controllers to
HomeKit over the **local Luup HTTP API** (`http://<ip>:3480/data_request`). Homebridge 2.0
target, backward compatible to 1.8. TypeScript + ESM, **zero runtime dependencies**, Node 22/24.

## Commands

```bash
npm run build          # rimraf dist + tsc -> dist/
npm run lint           # tsc --noEmit (type-only gate; see ESLint note below)
npm test               # vitest run (all specs)
npm run test:coverage  # vitest with v8 coverage (threshold expectation: >80%)
npx vitest run test/luupBackend.spec.ts          # a single test file
npx vitest run -t "discovers and normalises"     # a single test by name
```

## Architecture (the big picture)

Layered so the HomeKit code never imports Luup specifics:

```
index.ts → platform.ts (DynamicPlatformPlugin) → factory.ts → accessories/*  (HAP only)
                                  ▲ events / semantic commands ▼
                          vera/types.ts (VeraBackend interface)
                                  ▲ implemented by
                          vera/luupBackend.ts → vera/luupClient.ts → HTTP :3480
```

- **`VeraBackend` (`src/vera/types.ts`) is the seam.** The platform/accessories speak only
  `NormalizedDevice` / `DeviceState` (normalised units) and semantic commands (`setSwitch`,
  `setBrightness`, `setLock`, `setThermostatSetpoint`, …). `LuupBackend` is the only
  implementation today; an Ezlo WSS/JSON-RPC backend would implement the same interface and be
  selected in `src/vera/backend.ts` — **no accessory code should change to add it.**
- **Data flow:** `LuupBackend` discovers via `sdata` (topology/names/scenes/house-mode/unit) +
  `status` (authoritative service variables) + `user_data` (metadata), then keeps state current
  with an **incremental `lu_sdata` long-poll** (lowercase `loadtime`/`dataversion`/`timeout`/
  `minimumdelay`) — chosen over `status` because real Vera firmware returns changes from sdata
  promptly. It emits `deviceState` patches; the platform routes them to accessory `updateState`.
- **Mapping:** `mapDeviceKind` (`src/vera/categories.ts`) turns Vera category/subcategory
  (+ device_type/file hints) into a `DeviceKind`; `factory.ts` maps `DeviceKind` to an accessory
  class. Read `DESIGN.md` for the full category/serviceId/action reference.

## Non-obvious things to know before editing

- **Accessory setup must run via `init()`, not the constructor.** `VeraDeviceAccessory`
  subclasses set fields in `setupServices()`. With `useDefineForClassFields` (ES2022 target),
  subclass field declarations re-initialise to `undefined` *after* `super()`, which would wipe
  anything a base constructor set. So the base constructor only stores `device`/`state`; the
  **factory calls `.init()`** after construction to wire services and push initial state. Keep
  this pattern for any new device accessory. (Scene/HouseMode extend `AccessoryBase` and set up
  in their own constructors, which is fine.)
- **Vera argument-name casing is inconsistent and must be passed verbatim**
  (`newTargetValue`, `newLoadlevelTarget` — lowercase "l", `newArmedValue`, vs `NewModeTarget`,
  `NewCurrentSetpoint`). Do not "normalise" these.
- **`status` seeds the variable map at discovery; the live `lu_sdata` long-poll updates it.**
  sdata carries shortcut fields (status/level/locked/tripped/armed/temperature/humidity/light/
  batterylevel) mapped onto `#vars`; colour + thermostat mode/setpoint aren't in sdata, so
  `RgbLight`/`Thermostat` get a targeted `status&DeviceNum` refresh on change. A `full=1` sdata
  payload means the topology changed → full re-discovery + `topologyChanged`.
- **Units:** HomeKit needs Celsius (convert using the controller unit from `sdata.temperature`);
  brightness is 0–100 in both Vera and HomeKit (no 0–255 scaling). Raw Luup values are loosely
  typed strings (`"1"`, `"0.0"`, `"55%"`) — always parse via `src/vera/transform.ts`.
- **HomeKit specifics:** use `onGet`/`onSet` + `updateCharacteristic`; surface offline as
  `HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE)` (there is no reachability in 2.0);
  reach HAP types only through `this.platform.api.hap` / `this.Service` / `this.Characteristic`.
- **ESM/NodeNext:** relative imports in `src/` use **`.js` extensions** (e.g.
  `./categories.js`). Tests under `test/` import without extension (Vite resolves to `.ts`).
- **`verbatimModuleSyntax` is intentionally OFF** in `tsconfig.json`: enabling it crashes `tsc`
  on hap-nodejs `const enum`s. `import type` is still used throughout.
- **No ESLint config file is committed** — a global config-protection hook blocks creating
  `eslint.config.*`. `npm run lint` is `tsc --noEmit`. ESLint deps are present so a flat config
  can be added later when that hook is disabled.
- **Config UI X custom UI** lives in `homebridge-ui/` (`server.js` + `public/`), enabled by
  `"customUi": true` in `config.schema.json`. The server reuses `LuupBackend.probe()` (one-shot
  discovery, no poll loop) to list devices; the page (`public/ui.js`) renders show/hide toggles
  that write `excludeDeviceIds`. This is the ONLY runtime dependency (`@homebridge/plugin-ui-utils`,
  used by the UI server, not the Homebridge runtime). `homebridge-ui` must stay in package.json
  `files`. The page can be visually tested via a standalone harness that stubs the `homebridge`
  global (see the device-picker work) — it can't be driven through real Config UI X headlessly.

## Testing approach

`vitest` with the **real `@homebridge/hap-nodejs` types** and a mocked global `fetch`. Drive
characteristics with `characteristic.handleGetRequest()` / `handleSetRequest(value)` (these
invoke the `onGet`/`onSet` handlers; a thrown `HapStatusError` makes `handleGetRequest` reject).
The platform is tested with a fake `API` (a `FakePlatformAccessory extends Accessory`) and a fake
`VeraBackend`, swapped onto `platform.backend` before calling the private `start()`.

## Scope

Targets legacy Vera (UI5/UI7) on port 3480. Local-only (no cloud); unaffected by the Aug 2026
Ezlo cloud paywall. Native Ezlo hubs (port 17000 WSS API) are a future backend, not yet built.
