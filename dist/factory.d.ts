/**
 * Maps a normalised device to the concrete accessory implementation. This is the
 * single dispatch point from {@link DeviceKind} to an accessory class.
 */
import type { PlatformAccessory } from 'homebridge';
import type { VeraDeviceAccessory } from './accessories/deviceAccessory.js';
import type { VeraHomebridgePlatform } from './platform.js';
import type { NormalizedDevice } from './vera/types.js';
export declare function createDeviceAccessory(platform: VeraHomebridgePlatform, accessory: PlatformAccessory, device: NormalizedDevice): VeraDeviceAccessory | undefined;
/** Create the optional arm/disarm companion switch for an armable sensor. */
export declare function createArmSwitchAccessory(platform: VeraHomebridgePlatform, accessory: PlatformAccessory, device: NormalizedDevice): VeraDeviceAccessory;
