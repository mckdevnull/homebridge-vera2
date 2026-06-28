import type { PlatformAccessory } from 'homebridge';
import type { VeraHomebridgePlatform } from '../platform.js';
import { type HouseModeValue } from '../vera/categories.js';
import { AccessoryBase } from './base.js';
/**
 * The Vera controller's House Mode -> a HomeKit Security System.
 *
 * Vera house modes map onto HomeKit security states as a bijection:
 *   Home -> Stay, Away -> Away, Night -> Night, Vacation -> Disarmed.
 */
export declare class HouseModeAccessory extends AccessoryBase {
    private service;
    private mode;
    constructor(platform: VeraHomebridgePlatform, accessory: PlatformAccessory, initialMode: HouseModeValue);
    private setup;
    /** Called by the platform when the controller house mode changes. */
    updateHouseMode(mode: HouseModeValue): void;
    private toCurrentState;
    private toTargetState;
    private fromTargetState;
}
