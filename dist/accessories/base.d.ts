/**
 * Common accessory plumbing shared by device, scene and house-mode accessories:
 * convenient access to HAP types, a `getOrAddService` helper, and the standard
 * Accessory Information service.
 */
import type { PlatformAccessory, Service, WithUUID } from 'homebridge';
import type { VeraHomebridgePlatform } from '../platform.js';
export declare abstract class AccessoryBase {
    protected readonly platform: VeraHomebridgePlatform;
    protected readonly accessory: PlatformAccessory;
    constructor(platform: VeraHomebridgePlatform, accessory: PlatformAccessory);
    protected get hap(): typeof import("@homebridge/hap-nodejs");
    protected get Service(): typeof Service;
    protected get Characteristic(): typeof import("homebridge").Characteristic;
    protected get log(): import("homebridge").Logging;
    /** Get an existing service (optionally by subtype) or add it. */
    protected getOrAddService(type: WithUUID<typeof Service>, name?: string, subtype?: string): Service;
    /** Populate the Accessory Information service. */
    protected setupInformation(opts: {
        manufacturer?: string;
        model?: string;
        serial: string;
    }): void;
    /** Throw the HomeKit "Not Responding" error. */
    protected notResponding(): never;
}
