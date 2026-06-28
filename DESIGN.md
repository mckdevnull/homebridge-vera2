# Design & Architecture

`homebridge-vera2` is layered so the HomeKit mapping never depends on Vera/Luup specifics.

```
Homebridge runtime
      │
      ▼
src/index.ts ──registerPlatform──► src/platform.ts  (DynamicPlatformPlugin)
                                        │  caching · discovery · pruning · event routing
                                        ▼
                              src/factory.ts  (DeviceKind ─► accessory class)
                                        │
                                        ▼
                          src/accessories/*  (HomeKit get/set/push, HAP only)
                                        ▲
                                        │  normalised DeviceState (events) / semantic commands
                                        ▼
                               src/vera/types.ts  (VeraBackend interface)
                                        ▲
                                        │ implements
                                        ▼
                            src/vera/luupBackend.ts  ──► src/vera/luupClient.ts ──► HTTP :3480
```

**Key boundary:** accessories and the platform speak only `NormalizedDevice` / `DeviceState`
/ semantic commands (`setSwitch`, `setBrightness`, `setLock`, …). The `VeraBackend` interface
is the seam; `LuupBackend` is today's implementation. An `EzloBackend` (WSS/JSON-RPC, port
17000) can be added in `src/vera/backend.ts` later without changing any accessory code.

## File map

| Path | Responsibility |
|---|---|
| `src/index.ts` | Homebridge entry point (`registerPlatform`) |
| `src/settings.ts` | `PLATFORM_NAME` / `PLUGIN_NAME` constants |
| `src/config.ts` | Validate & default the raw config (`parseConfig`) |
| `src/platform.ts` | Dynamic platform: lifecycle, discovery, pruning, event routing |
| `src/factory.ts` | Map a `DeviceKind` to a concrete accessory class |
| `src/color.ts` | Pure HSV↔RGB conversion |
| `src/util/logger.ts` | Minimal logger interface (decouples backend from Homebridge) |
| `src/vera/types.ts` | Domain model + `VeraBackend` interface + typed event emitter |
| `src/vera/categories.ts` | Category/service-id constants + `mapDeviceKind` |
| `src/vera/transform.ts` | Defensive value parsing + unit conversion |
| `src/vera/luupClient.ts` | Low-level `data_request` HTTP client |
| `src/vera/luupBackend.ts` | Discovery, incremental long-poll, command translation |
| `src/vera/backend.ts` | Backend selection (Luup now; Ezlo later) |
| `src/accessories/*` | One class per HomeKit accessory type |

## Lifecycle

1. **`configureAccessory`** caches each accessory Homebridge restores from disk (before launch).
2. On **`didFinishLaunching`** the platform starts the backend, which performs discovery, then
   `discoverDevices()` runs.
3. **`discoverDevices()`** reuses a cached accessory when its stable UUID
   (`hap.uuid.generate("homebridge-vera2:device:<id>")`) matches, registers new ones with
   `registerPlatformAccessories`, and removes anything not rediscovered with
   `unregisterPlatformAccessories`.
4. The backend emits **`deviceState`** patches which the platform routes to the matching
   handler(s) → `updateCharacteristic`. **`topologyChanged`** triggers re-discovery.
5. On **`shutdown`** the backend's long-poll is aborted.

## Vera Luup API (local, port 3480)

All requests are `GET http://<ip>:3480/data_request?id=<id>&...`. The `lu_` prefix on ids is
optional. Always use `output_format=json` (XML conversion is CPU-heavy on the controller).

### Discovery
- `id=sdata` → categories, rooms, names, **scenes**, house **mode**, temperature **unit**,
  device list (id/name/category/subcategory/room).
- `id=status` → authoritative per-device service-variable state (`states[]` of
  `{service, variable, value}`).
- `id=user_data&ns=1` → device_type / device_file / manufacturer / model (best effort).

`LuupBackend` merges these by device id. `status` is the source of truth for state; `sdata`
provides topology and names.

### Incremental long-poll
`id=status` with `DataVersion`, `LoadTime`, `Timeout`, `MinimumDelay`. The controller blocks
until a change (or timeout) and returns only changed devices' states, or the text
`NO_CHANGES`. An increase in `LoadTime` means the topology changed → re-discover. On error the
cursor resets and the loop backs off (≈9 s); a no-change response backs off ≈1 s to avoid a
hot loop if the controller does not honour blocking.

### Control actions
`id=action&output_format=json&DeviceNum=<n>&serviceId=<sid>&action=<name>&<arg>=<value>`.
Argument-name casing is inconsistent in Vera and is reproduced verbatim:

| Capability | serviceId | action | argument |
|---|---|---|---|
| On/off | `urn:upnp-org:serviceId:SwitchPower1` | `SetTarget` | `newTargetValue` (0/1) |
| Brightness / cover % | `urn:upnp-org:serviceId:Dimming1` | `SetLoadLevelTarget` | `newLoadlevelTarget` (0–100) |
| RGB colour | `urn:micasaverde-com:serviceId:Color1` | `SetColorRGB` | `newColorRGBTarget` (`"r,g,b"`) |
| Lock | `urn:micasaverde-com:serviceId:DoorLock1` | `SetTarget` | `newTargetValue` (0/1) |
| Cover stop | `urn:upnp-org:serviceId:WindowCovering1` | `Stop` | — |
| HVAC mode | `urn:upnp-org:serviceId:HVAC_UserOperatingMode1` | `SetModeTarget` | `NewModeTarget` |
| Setpoint | `urn:upnp-org:serviceId:TemperatureSetpoint1` | `SetCurrentSetpoint` | `NewCurrentSetpoint` |
| Arm sensor | `urn:micasaverde-com:serviceId:SecuritySensor1` | `SetArmed` | `newArmedValue` (0/1) |
| Run scene | `urn:micasaverde-com:serviceId:HomeAutomationGateway1` | `RunScene` | `SceneNum` (DeviceNum 0) |
| House mode | `urn:micasaverde-com:serviceId:HomeAutomationGateway1` | `SetHouseMode` | `Mode` (1–4, DeviceNum 0) |

### Category → kind mapping
See `mapDeviceKind` in `src/vera/categories.ts`. Categories: 2 dimmable light (sub 4 / a
`Color1` service ⇒ RGB; fan device file ⇒ fan), 3 switch (sub 5 ⇒ garage), 4 security sensor
(sub 1 door, 2 leak, 3 motion, 4 smoke, 5 CO, 6 glass-break), 5 thermostat, 7 lock, 8 window
covering, 16 humidity, 17 temperature, 18 light, 32 garage door.

## Conversions & quirks

- **Brightness** is 0–100 in both Vera and HomeKit — no scaling (unlike Home Assistant's 0–255).
- **Temperature**: HomeKit requires Celsius; the controller's unit (from `sdata.temperature`)
  is used to convert readings to °C and setpoints back to the native unit.
- **Colour**: `Color1.CurrentColor` (`"idx=value,…"`) is decoded via `SupportedColors`
  (e.g. `"W,D,R,G,B"`) to RGB → HSV. HomeKit's two separate Hue/Saturation writes are
  debounced (≈60 ms) into one `SetColorRGB`.
- **Loose typing**: ids/levels/booleans arrive as strings (`"1"`, `"0.0"`, `"55%"`) and are
  parsed defensively in `transform.ts`.

## Testing

`vitest` with the **real** `@homebridge/hap-nodejs` types and a mocked `fetch`/backend:
- pure logic (`color`, `transform`, `categories`, `config`),
- the Luup client (URL building, JSON/empty/error handling, action args),
- the backend (discovery, every kind's `computeState`, commands, `refreshDevice`),
- accessories (both directions via `handleGetRequest`/`handleSetRequest`),
- the platform (discovery, cache reuse, pruning, include/exclude, event routing).

## Future: Ezlo backend

Native Ezlo hubs expose a JSON-RPC-over-WSS API on port 17000 (`hub.devices.list`,
`hub.item.value.set`, …). To support them, add an `EzloBackend implements VeraBackend` and
select it in `createBackend` based on config. No accessory or platform code changes required.
