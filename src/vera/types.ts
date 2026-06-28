/**
 * Backend-agnostic domain model and the pluggable backend contract.
 *
 * The HomeKit layer (platform + accessories) depends ONLY on these types — never
 * on Luup specifics. A future Ezlo (WSS / JSON-RPC) backend can implement the
 * same {@link VeraBackend} interface without touching the accessory code.
 */

import { EventEmitter } from 'node:events';
import type { Rgb } from '../color.js';
import type { DeviceKind, HouseModeValue } from './categories.js';

/** Normalised thermostat mode. */
export enum ThermostatMode {
  Off = 'off',
  Heat = 'heat',
  Cool = 'cool',
  Auto = 'auto',
}

/** Normalised, unit-consistent device state. Every field is optional; only the
 * fields relevant to a device's {@link DeviceKind} are populated. */
export interface DeviceState {
  /** False when the controller reports a communication failure for the device. */
  online: boolean;
  on?: boolean;
  /** 0-100 (matches both Vera `LoadLevelStatus` and HomeKit Brightness). */
  brightness?: number;
  hue?: number; // 0-360
  saturation?: number; // 0-100
  locked?: boolean;
  /** Cover position 0-100, where 100 = fully open. */
  position?: number;
  tripped?: boolean;
  armed?: boolean;
  /** Always Celsius. */
  currentTemperature?: number;
  targetTemperature?: number; // Celsius
  mode?: ThermostatMode;
  operatingState?: 'idle' | 'heating' | 'cooling';
  humidity?: number; // %RH
  lightLevel?: number; // lux
  batteryLevel?: number; // %
  lowBattery?: boolean;
}

export interface NormalizedDevice {
  /** Stable unique id (the Vera device number as a string). */
  id: string;
  name: string;
  kind: DeviceKind;
  room?: string;
  manufacturer?: string;
  model?: string;
  hasBattery: boolean;
  /** True for security sensors that support arm/disarm. */
  armable: boolean;
  category: number;
  subcategory: number;
  deviceType?: string;
  state: DeviceState;
}

export interface NormalizedScene {
  id: string;
  name: string;
  room?: string;
}

/** Events emitted by a backend. */
export type BackendEventMap = {
  /** Initial discovery finished; devices/scenes are available. */
  ready: [];
  /** Connectivity to the controller changed. */
  connection: [connected: boolean];
  /** Devices or scenes were added/removed/renamed — platform should re-discover. */
  topologyChanged: [];
  /** A device's state changed (partial patch merged into the cached state). */
  deviceState: [deviceId: string, state: Partial<DeviceState>];
  /** The controller house mode changed. */
  houseMode: [mode: HouseModeValue];
  /** A non-fatal backend error (e.g. a failed poll). */
  error: [error: Error];
};

/**
 * A minimal strongly-typed wrapper around Node's EventEmitter so backends get
 * compile-checked event names and payloads.
 */
export class TypedEmitter<M extends Record<string, unknown[]>> extends EventEmitter {
  override on<K extends keyof M & string>(event: K, listener: (...args: M[K]) => void): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  override once<K extends keyof M & string>(event: K, listener: (...args: M[K]) => void): this {
    return super.once(event, listener as (...args: unknown[]) => void);
  }

  override off<K extends keyof M & string>(event: K, listener: (...args: M[K]) => void): this {
    return super.off(event, listener as (...args: unknown[]) => void);
  }

  override emit<K extends keyof M & string>(event: K, ...args: M[K]): boolean {
    return super.emit(event, ...args);
  }
}

/**
 * The pluggable controller backend. Implemented by {@link LuupBackend} today;
 * an Ezlo backend can implement the same surface later.
 */
export interface VeraBackend extends TypedEmitter<BackendEventMap> {
  /** Native temperature unit reported by the controller. */
  readonly temperatureUnit: 'C' | 'F';

  /** Connect and perform initial discovery, then begin the update loop. */
  start(): Promise<void>;
  /** Stop the update loop and release resources. */
  stop(): Promise<void>;

  getDevices(): NormalizedDevice[];
  getScenes(): NormalizedScene[];
  getHouseMode(): HouseModeValue | undefined;
  /** Force an immediate refresh of one device's full state. */
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
}
