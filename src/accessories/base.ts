/**
 * Common accessory plumbing shared by device, scene and house-mode accessories:
 * convenient access to HAP types, a `getOrAddService` helper, and the standard
 * Accessory Information service.
 */

import type { PlatformAccessory, Service, WithUUID } from 'homebridge';
import type { VeraHomebridgePlatform } from '../platform.js';

export abstract class AccessoryBase {
  constructor(
    protected readonly platform: VeraHomebridgePlatform,
    protected readonly accessory: PlatformAccessory,
  ) {}

  protected get hap() {
    return this.platform.api.hap;
  }

  protected get Service() {
    return this.platform.Service;
  }

  protected get Characteristic() {
    return this.platform.Characteristic;
  }

  protected get log() {
    return this.platform.log;
  }

  /** Get an existing service (optionally by subtype) or add it. */
  protected getOrAddService(type: WithUUID<typeof Service>, name?: string, subtype?: string): Service {
    const displayName = name ?? this.accessory.displayName;
    // `type` is the generic Service base here; the concrete constructor args are
    // not statically known, so the add call is cast.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const add = this.accessory.addService.bind(this.accessory) as any;
    if (subtype) {
      return this.accessory.getServiceById(type, subtype) ?? (add(type, displayName, subtype) as Service);
    }
    return this.accessory.getService(type) ?? (add(type, displayName) as Service);
  }

  /** Populate the Accessory Information service. */
  protected setupInformation(opts: { manufacturer?: string; model?: string; serial: string }): void {
    const info =
      this.accessory.getService(this.Service.AccessoryInformation) ??
      this.accessory.addService(this.Service.AccessoryInformation);
    info
      .setCharacteristic(this.Characteristic.Manufacturer, opts.manufacturer || 'Vera')
      .setCharacteristic(this.Characteristic.Model, opts.model || 'Vera Device')
      .setCharacteristic(this.Characteristic.SerialNumber, opts.serial);
  }

  /** Throw the HomeKit "Not Responding" error. */
  protected notResponding(): never {
    throw new this.hap.HapStatusError(this.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
  }
}
