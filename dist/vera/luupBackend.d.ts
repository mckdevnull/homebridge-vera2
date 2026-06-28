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
import type { Rgb } from '../color.js';
import type { Logger } from '../util/logger.js';
import { HouseMode, type HouseModeValue } from './categories.js';
import { ThermostatMode, TypedEmitter, type BackendEventMap, type NormalizedDevice, type NormalizedScene, type VeraBackend } from './types.js';
export interface LuupBackendOptions {
    host: string;
    port: number;
    requestTimeoutSeconds: number;
    pollTimeoutSeconds: number;
    pollMinimumDelayMs: number;
    logger: Logger;
}
export declare class LuupBackend extends TypedEmitter<BackendEventMap> implements VeraBackend {
    #private;
    constructor(opts: LuupBackendOptions);
    get temperatureUnit(): 'C' | 'F';
    start(): Promise<void>;
    stop(): Promise<void>;
    /**
     * One-shot discovery WITHOUT starting the update loop. Used by the config UI to
     * list devices; leaves no background work or timers running afterwards.
     */
    probe(): Promise<void>;
    getDevices(): NormalizedDevice[];
    getScenes(): NormalizedScene[];
    getHouseMode(): HouseModeValue | undefined;
    private discover;
    private fetchUserDataMeta;
    private pollLoop;
    /** Performs one long-poll. Returns true if any device state changed. */
    private pollOnce;
    refreshDevice(id: string): Promise<void>;
    setSwitch(id: string, on: boolean): Promise<void>;
    setBrightness(id: string, percent: number): Promise<void>;
    setColorRgb(id: string, rgb: Rgb): Promise<void>;
    setLock(id: string, locked: boolean): Promise<void>;
    setCoverPosition(id: string, percent: number): Promise<void>;
    coverStop(id: string): Promise<void>;
    setThermostatMode(id: string, mode: ThermostatMode): Promise<void>;
    setThermostatSetpoint(id: string, celsius: number): Promise<void>;
    setArmed(id: string, armed: boolean): Promise<void>;
    runScene(sceneId: string): Promise<void>;
    setHouseMode(mode: HouseModeValue): Promise<void>;
    private ingestStatusDevices;
    private applyStatusStates;
    private setVar;
    private getVar;
    private hasService;
    private updateHouseMode;
    private toVeraHvacMode;
    private fromVeraHvacMode;
    /** Build the normalised state for a device from its current variable map. */
    private computeState;
    private computeThermostatState;
    /**
     * Determine whether the thermostat is actively heating/cooling. Prefer the
     * explicit `HVAC_OperatingState1.ModeState`; when the device doesn't report it,
     * infer from the selected mode and setpoint vs current temperature so a heating
     * thermostat isn't shown as OFF.
     */
    private inferOperatingState;
    /** Pick the relevant setpoint: the plain one if present, else heat/cool by mode. */
    private resolveSetpoint;
    private sleep;
}
/** Bare reference to the standard house-mode values for callers. */
export { HouseMode };
