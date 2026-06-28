/**
 * Base class for accessories that represent a Vera device. Owns the cached
 * {@link DeviceState}, an optional Battery service, and the contract subclasses
 * implement: {@link setupServices} (wire characteristics once) and
 * {@link pushState} (reflect the current cached state to HomeKit).
 */
import type { PlatformAccessory } from 'homebridge';
import type { VeraHomebridgePlatform } from '../platform.js';
import type { DeviceState, NormalizedDevice } from '../vera/types.js';
import { AccessoryBase } from './base.js';
export declare abstract class VeraDeviceAccessory extends AccessoryBase {
    protected readonly device: NormalizedDevice;
    protected state: DeviceState;
    private batteryService?;
    constructor(platform: VeraHomebridgePlatform, accessory: PlatformAccessory, device: NormalizedDevice);
    /**
     * Wire services and push initial state. Must run AFTER construction completes,
     * not from the base constructor: with `useDefineForClassFields`, subclass field
     * declarations re-initialise after `super()`, which would wipe anything set by
     * `setupServices()` during construction. The factory calls this.
     */
    init(): this;
    get id(): string;
    /** Wire up services and their get/set handlers. Called once at construction. */
    protected abstract setupServices(): void;
    /** Push the current cached {@link state} to HomeKit characteristics. */
    protected abstract pushState(): void;
    /** Merge a state patch from the backend and refresh HomeKit. */
    updateState(patch: Partial<DeviceState>): void;
    /** Surface "Not Responding" in the Home app when the device is offline. */
    protected assertOnline(): void;
    /** Cancel any pending work (timers) before this handler is dropped during a
     * re-discovery. Overridden by accessories that schedule timers. */
    dispose(): void;
    private updateBattery;
}
