/**
 * Luup HTTP backend: discovers devices over `sdata`/`status`/`user_data`, keeps
 * an authoritative per-device service-variable map up to date with an incremental
 * `status` long-poll, and translates semantic commands into UPnP actions.
 *
 * Discovery sources:
 *  - `sdata`     -> categories, rooms, names, scenes, house mode, temperature unit
 *  - `status`    -> full service-variable state per device (authoritative)
 *  - `user_data` -> device_type / device_file / manufacturer / model (best effort)
 *
 * Live updates use `status` with `DataVersion`/`LoadTime`/`Timeout`/`MinimumDelay`,
 * which returns only changed devices' full states. A change in `LoadTime` means
 * the topology changed (device/scene/room added, removed or renamed) and triggers
 * a full re-discovery.
 */
import { DeviceKind, HouseMode, HvacMode, ServiceId, mapDeviceKind, } from './categories.js';
import { LuupClient, NO_CHANGES } from './luupClient.js';
import { clampPercent, fromCelsius, parseVeraColor, toBool, toCelsius, toIdString, toInt, toNumber, } from './transform.js';
import { ThermostatMode, TypedEmitter, } from './types.js';
import { rgbToHsv } from '../color.js';
/** How long after a no-change poll before re-polling, when the controller does
 * not honour the blocking `Timeout` (prevents a hot loop). */
const NO_CHANGE_BACKOFF_MS = 1000;
/** Backoff after a failed poll. */
const ERROR_BACKOFF_MS = 9000;
/** Coerce a possibly-missing Vera name into a safe, non-empty display name. */
function safeName(name, fallback) {
    return typeof name === 'string' && name.trim() ? name.trim() : fallback;
}
export class LuupBackend extends TypedEmitter {
    #client;
    #log;
    #opts;
    /** deviceId -> serviceId -> variable -> value */
    #vars = new Map();
    #devices = new Map();
    #scenes = new Map();
    #rooms = new Map();
    /** Every device id seen at discovery (supported AND skipped/unsupported, plus
     * the controller) so that updates for non-exposed devices don't look "new". */
    #knownDeviceIds = new Set();
    #temperatureUnit = 'C';
    #houseMode;
    #loadTime = 0;
    #dataVersion = 0;
    #running = false;
    #stopController = new AbortController();
    constructor(opts) {
        super();
        this.#opts = opts;
        this.#log = opts.logger;
        this.#client = new LuupClient({
            host: opts.host,
            port: opts.port,
            requestTimeoutSeconds: opts.requestTimeoutSeconds,
            logger: opts.logger,
        });
    }
    get temperatureUnit() {
        return this.#temperatureUnit;
    }
    async start() {
        await this.discover();
        this.emit('ready');
        this.emit('connection', true);
        this.#running = true;
        // The loop catches its own per-iteration errors; this guard is a final
        // backstop so it can never surface as an unhandled rejection / crash.
        this.pollLoop().catch((err) => this.#log.error(`Vera update loop stopped unexpectedly: ${err.message}`));
    }
    async stop() {
        this.#running = false;
        this.#stopController.abort();
    }
    /**
     * One-shot discovery WITHOUT starting the update loop. Used by the config UI to
     * list devices; leaves no background work or timers running afterwards.
     */
    async probe() {
        await this.discover();
    }
    getDevices() {
        return [...this.#devices.values()];
    }
    getScenes() {
        return [...this.#scenes.values()];
    }
    getHouseMode() {
        return this.#houseMode;
    }
    // ---------------------------------------------------------------------------
    // Discovery
    // ---------------------------------------------------------------------------
    async discover() {
        const sdata = await this.#client.requestJson({ id: 'sdata', output_format: 'json' });
        this.#temperatureUnit = sdata.temperature === 'F' ? 'F' : 'C';
        // The live long-poll runs on `lu_sdata`, so track sdata's own loadtime/dataversion.
        this.#loadTime = toInt(sdata.loadtime, this.#loadTime);
        this.#dataVersion = toInt(sdata.dataversion, this.#dataVersion);
        this.#rooms.clear();
        for (const room of sdata.rooms ?? []) {
            this.#rooms.set(room.id, room.name);
        }
        // Scenes -> momentary switches.
        this.#scenes.clear();
        for (const scene of sdata.scenes ?? []) {
            const id = toIdString(scene.id);
            this.#scenes.set(id, {
                id,
                name: safeName(scene.name, `Scene ${id}`),
                room: scene.room !== undefined ? this.#rooms.get(scene.room) : undefined,
            });
        }
        // Authoritative service variables (full snapshot, used to seed #vars).
        const status = await this.#client.requestJson({ id: 'status', output_format: 'json' });
        this.ingestStatusDevices(status);
        this.updateHouseMode(status.Mode ?? sdata.mode);
        // Best-effort metadata (manufacturer/model/device_type) for nicer accessories.
        const meta = await this.fetchUserDataMeta();
        // Record every device id present on the controller — supported or not — so the
        // long-poll can tell a genuinely new device from a known but non-exposed one.
        this.#knownDeviceIds.clear();
        for (const dev of sdata.devices ?? []) {
            this.#knownDeviceIds.add(toIdString(dev.id));
        }
        for (const sd of status.devices ?? status.Devices ?? []) {
            this.#knownDeviceIds.add(toIdString(sd.id));
        }
        // Drop cached service variables for devices no longer on the controller.
        for (const id of this.#vars.keys()) {
            if (!this.#knownDeviceIds.has(id)) {
                this.#vars.delete(id);
            }
        }
        this.#devices.clear();
        for (const dev of sdata.devices ?? []) {
            const id = toIdString(dev.id);
            const category = toInt(dev.category);
            const subcategory = toInt(dev.subcategory);
            const kind = mapDeviceKind({
                category,
                subcategory,
                deviceType: meta.get(id)?.deviceType,
                deviceFile: meta.get(id)?.deviceFile,
                hasColor: this.hasService(id, ServiceId.Color),
            });
            if (kind === DeviceKind.Unsupported) {
                this.#log.debug(`Skipping unsupported device ${id} (${dev.name}) cat=${category}/${subcategory}`);
                continue;
            }
            this.#devices.set(id, {
                id,
                name: safeName(dev.name, `Device ${id}`),
                kind,
                room: dev.room !== undefined ? this.#rooms.get(dev.room) : undefined,
                manufacturer: meta.get(id)?.manufacturer,
                model: meta.get(id)?.model,
                hasBattery: this.getVar(id, ServiceId.HaDevice, 'BatteryLevel') !== undefined,
                armable: this.getVar(id, ServiceId.SecuritySensor, 'Armed') !== undefined,
                category,
                subcategory,
                deviceType: meta.get(id)?.deviceType,
                state: this.computeState(id, kind),
            });
        }
        this.#log.info(`Discovered ${this.#devices.size} supported device(s) and ${this.#scenes.size} scene(s) on Vera (${this.#temperatureUnit}).`);
    }
    async fetchUserDataMeta() {
        const meta = new Map();
        try {
            const ud = await this.#client.requestJson({ id: 'user_data', output_format: 'json', ns: 1 });
            for (const dev of ud.devices ?? []) {
                meta.set(toIdString(dev.id), {
                    deviceType: dev.device_type,
                    deviceFile: dev.device_file,
                    manufacturer: dev.manufacturer,
                    model: dev.model,
                });
            }
        }
        catch (err) {
            this.#log.debug(`user_data metadata fetch failed (continuing without): ${err.message}`);
        }
        return meta;
    }
    // ---------------------------------------------------------------------------
    // Incremental long-poll
    // ---------------------------------------------------------------------------
    async pollLoop() {
        while (this.#running) {
            try {
                const changed = await this.pollOnce();
                if (!changed) {
                    await this.sleep(NO_CHANGE_BACKOFF_MS);
                }
            }
            catch (err) {
                if (!this.#running) {
                    break;
                }
                const error = err;
                this.#log.warn(`Vera poll failed: ${error.message}`);
                this.emit('error', error);
                this.emit('connection', false);
                // Reset cursors so the next poll does a clean re-sync (pyvera issue #89).
                this.#dataVersion = 0;
                await this.sleep(ERROR_BACKOFF_MS);
            }
        }
    }
    /**
     * One incremental long-poll on `lu_sdata`. This is the live update mechanism:
     * the controller holds the request open and returns the instant a device
     * changes (subject to MinimumDelay), so HomeKit reflects changes promptly.
     * Returns true if any exposed device changed.
     */
    async pollOnce() {
        const timeoutMs = (this.#opts.pollTimeoutSeconds + 15) * 1000;
        const body = await this.#client.request({
            id: 'sdata',
            output_format: 'json',
            loadtime: this.#loadTime,
            dataversion: this.#dataVersion,
            timeout: this.#opts.pollTimeoutSeconds,
            minimumdelay: this.#opts.pollMinimumDelayMs,
        }, { timeoutMs, signal: this.#stopController.signal });
        const trimmed = body.trim();
        if (trimmed.length === 0 || trimmed === NO_CHANGES) {
            return false;
        }
        let sdata;
        try {
            sdata = JSON.parse(trimmed);
        }
        catch {
            this.#log.debug('Ignoring non-JSON poll response');
            return false;
        }
        this.emit('connection', true);
        // A full payload means the controller config changed (device added/removed/
        // renamed) — re-discover to pick it up.
        if (sdata.full === 1 && this.#loadTime !== 0) {
            this.#log.info('Vera topology changed; re-discovering devices.');
            await this.discover();
            this.emit('topologyChanged');
            return true;
        }
        this.#loadTime = toInt(sdata.loadtime, this.#loadTime);
        this.#dataVersion = toInt(sdata.dataversion, this.#dataVersion);
        this.updateHouseMode(sdata.mode);
        let changed = false;
        let needsRediscover = false;
        for (const dev of sdata.devices ?? []) {
            const id = toIdString(dev.id);
            const device = this.#devices.get(id);
            if (!device) {
                // A device we don't expose (unsupported type, or the controller itself)
                // reporting state is normal — ignore it. Only an id we've never seen at
                // discovery means the topology actually changed.
                if (!this.#knownDeviceIds.has(id)) {
                    needsRediscover = true;
                }
                continue;
            }
            this.applySdataShortcuts(id, dev);
            // The sdata summary doesn't carry colour or thermostat mode/setpoint, so
            // pull the authoritative service variables for those kinds when they change.
            if (device.kind === DeviceKind.Thermostat || device.kind === DeviceKind.RgbLight) {
                try {
                    await this.refreshDeviceVars(id);
                }
                catch (err) {
                    this.#log.debug(`Refreshing device ${id} failed: ${err.message}`);
                }
            }
            device.state = this.computeState(id, device.kind);
            this.emit('deviceState', id, device.state);
            changed = true;
        }
        if (needsRediscover) {
            this.#log.info('A new device appeared on Vera; re-discovering.');
            await this.discover();
            this.emit('topologyChanged');
            return true;
        }
        return changed;
    }
    /** Map an sdata summary device's shortcut fields onto the service-variable map. */
    applySdataShortcuts(id, dev) {
        const set = (svc, variable, value) => {
            if (value !== undefined) {
                this.setVar(id, svc, variable, String(value));
            }
        };
        set(ServiceId.SwitchPower, 'Status', dev.status);
        set(ServiceId.Dimming, 'LoadLevelStatus', dev.level);
        set(ServiceId.DoorLock, 'Status', dev.locked);
        set(ServiceId.SecuritySensor, 'Tripped', dev.tripped);
        set(ServiceId.SecuritySensor, 'Armed', dev.armed);
        set(ServiceId.TemperatureSensor, 'CurrentTemperature', dev.temperature);
        set(ServiceId.HumiditySensor, 'CurrentLevel', dev.humidity);
        set(ServiceId.LightSensor, 'CurrentLevel', dev.light);
        set(ServiceId.HaDevice, 'BatteryLevel', dev.batterylevel);
    }
    /** Refresh one device's full service variables from `status` (no event emitted). */
    async refreshDeviceVars(id) {
        const status = await this.#client.requestJson({
            id: 'status',
            output_format: 'json',
            DeviceNum: id,
        });
        for (const sd of status.devices ?? status.Devices ?? []) {
            if (toIdString(sd.id) === id) {
                this.applyStatusStates(id, sd);
            }
        }
    }
    /** Force an immediate full refresh of one device and emit its new state. */
    async refreshDevice(id) {
        await this.refreshDeviceVars(id);
        const device = this.#devices.get(id);
        if (device) {
            device.state = this.computeState(id, device.kind);
            this.emit('deviceState', id, device.state);
        }
    }
    // ---------------------------------------------------------------------------
    // Commands
    // ---------------------------------------------------------------------------
    async setSwitch(id, on) {
        await this.#client.action(id, ServiceId.SwitchPower, 'SetTarget', { newTargetValue: on ? 1 : 0 });
    }
    async setBrightness(id, percent) {
        await this.#client.action(id, ServiceId.Dimming, 'SetLoadLevelTarget', {
            newLoadlevelTarget: clampPercent(percent),
        });
    }
    async setColorRgb(id, rgb) {
        await this.#client.action(id, ServiceId.Color, 'SetColorRGB', {
            newColorRGBTarget: `${Math.round(rgb.r)},${Math.round(rgb.g)},${Math.round(rgb.b)}`,
        });
    }
    async setLock(id, locked) {
        await this.#client.action(id, ServiceId.DoorLock, 'SetTarget', { newTargetValue: locked ? 1 : 0 });
    }
    async setCoverPosition(id, percent) {
        await this.#client.action(id, ServiceId.Dimming, 'SetLoadLevelTarget', {
            newLoadlevelTarget: clampPercent(percent),
        });
    }
    async coverStop(id) {
        await this.#client.action(id, ServiceId.WindowCovering, 'Stop');
    }
    async setThermostatMode(id, mode) {
        const veraMode = this.toVeraHvacMode(mode);
        await this.#client.action(id, ServiceId.HvacUserMode, 'SetModeTarget', { NewModeTarget: veraMode });
    }
    async setThermostatSetpoint(id, celsius) {
        const value = fromCelsius(celsius, this.#temperatureUnit);
        await this.#client.action(id, ServiceId.TemperatureSetpoint, 'SetCurrentSetpoint', {
            NewCurrentSetpoint: value,
        });
    }
    async setArmed(id, armed) {
        await this.#client.action(id, ServiceId.SecuritySensor, 'SetArmed', { newArmedValue: armed ? 1 : 0 });
    }
    async runScene(sceneId) {
        await this.#client.action(0, ServiceId.HomeAutomationGateway, 'RunScene', { SceneNum: sceneId });
    }
    async setHouseMode(mode) {
        await this.#client.action(0, ServiceId.HomeAutomationGateway, 'SetHouseMode', { Mode: mode });
    }
    // ---------------------------------------------------------------------------
    // State plumbing
    // ---------------------------------------------------------------------------
    ingestStatusDevices(status) {
        for (const sd of status.devices ?? status.Devices ?? []) {
            this.applyStatusStates(toIdString(sd.id), sd);
        }
    }
    applyStatusStates(id, sd) {
        for (const s of sd.states ?? sd.States ?? []) {
            this.setVar(id, s.service, s.variable, s.value);
        }
    }
    setVar(id, serviceId, variable, value) {
        let svc = this.#vars.get(id);
        if (!svc) {
            svc = new Map();
            this.#vars.set(id, svc);
        }
        let vmap = svc.get(serviceId);
        if (!vmap) {
            vmap = new Map();
            svc.set(serviceId, vmap);
        }
        vmap.set(variable, value);
    }
    getVar(id, serviceId, variable) {
        return this.#vars.get(id)?.get(serviceId)?.get(variable);
    }
    hasService(id, serviceId) {
        return (this.#vars.get(id)?.get(serviceId)?.size ?? 0) > 0;
    }
    updateHouseMode(raw) {
        if (raw === undefined) {
            return;
        }
        const mode = toInt(raw);
        if (mode < 1 || mode > 4) {
            return;
        }
        const value = mode;
        if (value !== this.#houseMode) {
            this.#houseMode = value;
            this.emit('houseMode', value);
        }
    }
    toVeraHvacMode(mode) {
        switch (mode) {
            case ThermostatMode.Heat:
                return HvacMode.Heat;
            case ThermostatMode.Cool:
                return HvacMode.Cool;
            case ThermostatMode.Auto:
                return HvacMode.Auto;
            default:
                return HvacMode.Off;
        }
    }
    fromVeraHvacMode(raw) {
        switch (raw) {
            case HvacMode.Heat:
                return ThermostatMode.Heat;
            case HvacMode.Cool:
                return ThermostatMode.Cool;
            case HvacMode.Auto:
                return ThermostatMode.Auto;
            default:
                return ThermostatMode.Off;
        }
    }
    /** Build the normalised state for a device from its current variable map. */
    computeState(id, kind) {
        const commFailure = this.getVar(id, ServiceId.HaDevice, 'CommFailure');
        const state = {
            online: commFailure === undefined ? true : !toBool(commFailure),
        };
        const battery = this.getVar(id, ServiceId.HaDevice, 'BatteryLevel');
        if (battery !== undefined) {
            state.batteryLevel = clampPercent(toInt(battery));
            state.lowBattery = state.batteryLevel <= 20;
        }
        const status = this.getVar(id, ServiceId.SwitchPower, 'Status');
        const level = this.getVar(id, ServiceId.Dimming, 'LoadLevelStatus');
        switch (kind) {
            case DeviceKind.Switch:
            case DeviceKind.GarageDoor:
                state.on = toBool(status);
                break;
            case DeviceKind.Fan:
                state.on = status !== undefined ? toBool(status) : toInt(level) > 0;
                if (level !== undefined) {
                    state.brightness = clampPercent(toInt(level));
                }
                break;
            case DeviceKind.Dimmer:
                state.on = status !== undefined ? toBool(status) : toInt(level) > 0;
                state.brightness = clampPercent(toInt(level));
                break;
            case DeviceKind.RgbLight: {
                state.on = status !== undefined ? toBool(status) : toInt(level) > 0;
                state.brightness = clampPercent(toInt(level));
                const rgb = parseVeraColor(this.getVar(id, ServiceId.Color, 'CurrentColor'), this.getVar(id, ServiceId.Color, 'SupportedColors'));
                if (rgb) {
                    const hsv = rgbToHsv(rgb);
                    state.hue = hsv.hue;
                    state.saturation = hsv.saturation;
                }
                break;
            }
            case DeviceKind.Lock:
                state.locked = toBool(this.getVar(id, ServiceId.DoorLock, 'Status'));
                break;
            case DeviceKind.WindowCovering:
                state.position = clampPercent(toInt(level));
                break;
            case DeviceKind.Thermostat:
                this.computeThermostatState(id, state);
                break;
            case DeviceKind.MotionSensor:
            case DeviceKind.ContactSensor:
            case DeviceKind.LeakSensor:
            case DeviceKind.SmokeSensor:
            case DeviceKind.CoSensor:
            case DeviceKind.GlassBreakSensor:
                state.tripped = toBool(this.getVar(id, ServiceId.SecuritySensor, 'Tripped'));
                state.armed = toBool(this.getVar(id, ServiceId.SecuritySensor, 'Armed'));
                break;
            case DeviceKind.TemperatureSensor:
                state.currentTemperature = toCelsius(this.getVar(id, ServiceId.TemperatureSensor, 'CurrentTemperature'), this.#temperatureUnit);
                break;
            case DeviceKind.HumiditySensor:
                state.humidity = clampPercent(toInt(this.getVar(id, ServiceId.HumiditySensor, 'CurrentLevel')));
                break;
            case DeviceKind.LightSensor:
                state.lightLevel = Math.max(0.0001, toNumber(this.getVar(id, ServiceId.LightSensor, 'CurrentLevel')));
                break;
            case DeviceKind.Unsupported:
                break;
        }
        return state;
    }
    computeThermostatState(id, state) {
        const temp = this.getVar(id, ServiceId.TemperatureSensor, 'CurrentTemperature');
        if (temp !== undefined) {
            state.currentTemperature = toCelsius(temp, this.#temperatureUnit);
        }
        state.mode = this.fromVeraHvacMode(this.getVar(id, ServiceId.HvacUserMode, 'ModeStatus'));
        const setpoint = this.resolveSetpoint(id, state.mode);
        if (setpoint !== undefined) {
            state.targetTemperature = toCelsius(setpoint, this.#temperatureUnit);
        }
        state.operatingState = this.inferOperatingState(id, state);
    }
    /**
     * Determine whether the thermostat is actively heating/cooling. Prefer the
     * explicit `HVAC_OperatingState1.ModeState`; when the device doesn't report it,
     * infer from the selected mode and setpoint vs current temperature so a heating
     * thermostat isn't shown as OFF.
     */
    inferOperatingState(id, state) {
        const opState = this.getVar(id, ServiceId.HvacOperatingState, 'ModeState');
        if (opState === 'Heating') {
            return 'heating';
        }
        if (opState === 'Cooling') {
            return 'cooling';
        }
        if (opState !== undefined) {
            return 'idle';
        }
        const { mode, currentTemperature: cur, targetTemperature: tgt } = state;
        if (cur !== undefined && tgt !== undefined) {
            if (mode === ThermostatMode.Heat && cur < tgt) {
                return 'heating';
            }
            if (mode === ThermostatMode.Cool && cur > tgt) {
                return 'cooling';
            }
        }
        return 'idle';
    }
    /** Pick the relevant setpoint: the plain one if present, else heat/cool by mode. */
    resolveSetpoint(id, mode) {
        const plain = this.getVar(id, ServiceId.TemperatureSetpoint, 'CurrentSetpoint');
        if (plain !== undefined) {
            return plain;
        }
        if (mode === ThermostatMode.Cool) {
            return this.getVar(id, ServiceId.TemperatureSetpointCool, 'CurrentSetpoint');
        }
        return this.getVar(id, ServiceId.TemperatureSetpointHeat, 'CurrentSetpoint');
    }
    sleep(ms) {
        return new Promise((resolve) => {
            const signal = this.#stopController.signal;
            if (signal.aborted) {
                resolve();
                return;
            }
            let timer;
            const onAbort = () => {
                clearTimeout(timer);
                resolve();
            };
            timer = setTimeout(() => {
                // Normal wake-up: detach the abort listener so it can't accumulate.
                signal.removeEventListener('abort', onAbort);
                resolve();
            }, ms);
            signal.addEventListener('abort', onAbort, { once: true });
        });
    }
}
/** Bare reference to the standard house-mode values for callers. */
export { HouseMode };
