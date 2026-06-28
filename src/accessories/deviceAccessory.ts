/**
 * Base class for accessories that represent a Vera device. Owns the cached
 * {@link DeviceState}, an optional Battery service, and the contract subclasses
 * implement: {@link setupServices} (wire characteristics once) and
 * {@link pushState} (reflect the current cached state to HomeKit).
 */

import type { PlatformAccessory, Service } from 'homebridge';
import type { VeraHomebridgePlatform } from '../platform.js';
import type { DeviceState, NormalizedDevice } from '../vera/types.js';
import { AccessoryBase } from './base.js';

export abstract class VeraDeviceAccessory extends AccessoryBase {
  protected readonly device: NormalizedDevice;
  protected state: DeviceState;
  private batteryService?: Service;

  constructor(platform: VeraHomebridgePlatform, accessory: PlatformAccessory, device: NormalizedDevice) {
    super(platform, accessory);
    this.device = device;
    this.state = device.state;
  }

  /**
   * Wire services and push initial state. Must run AFTER construction completes,
   * not from the base constructor: with `useDefineForClassFields`, subclass field
   * declarations re-initialise after `super()`, which would wipe anything set by
   * `setupServices()` during construction. The factory calls this.
   */
  init(): this {
    this.setupInformation({
      manufacturer: this.device.manufacturer,
      model: this.device.model || this.device.deviceType || 'Vera Device',
      serial: `vera-${this.device.id}`,
    });

    this.setupServices();

    if (this.device.hasBattery) {
      this.batteryService = this.getOrAddService(this.Service.Battery);
    }

    this.updateBattery();
    this.pushState();
    return this;
  }

  get id(): string {
    return this.device.id;
  }

  /** Wire up services and their get/set handlers. Called once at construction. */
  protected abstract setupServices(): void;

  /** Push the current cached {@link state} to HomeKit characteristics. */
  protected abstract pushState(): void;

  /** Merge a state patch from the backend and refresh HomeKit. */
  updateState(patch: Partial<DeviceState>): void {
    this.state = { ...this.state, ...patch };
    this.device.state = this.state;
    this.updateBattery();
    this.pushState();
  }

  /** Surface "Not Responding" in the Home app when the device is offline. */
  protected assertOnline(): void {
    if (!this.state.online) {
      this.notResponding();
    }
  }

  private updateBattery(): void {
    if (!this.batteryService) {
      return;
    }
    if (this.state.batteryLevel !== undefined) {
      this.batteryService.updateCharacteristic(this.Characteristic.BatteryLevel, this.state.batteryLevel);
    }
    this.batteryService.updateCharacteristic(
      this.Characteristic.StatusLowBattery,
      this.state.lowBattery
        ? this.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
        : this.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL,
    );
  }
}
