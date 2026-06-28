import type { PlatformAccessory } from 'homebridge';
import type { VeraHomebridgePlatform } from '../platform.js';
import type { NormalizedScene } from '../vera/types.js';
import { AccessoryBase } from './base.js';
/** A Vera scene -> a momentary HomeKit Switch that runs the scene when turned on. */
export declare class SceneAccessory extends AccessoryBase {
    private readonly scene;
    private service;
    private offTimer?;
    constructor(platform: VeraHomebridgePlatform, accessory: PlatformAccessory, scene: NormalizedScene);
    private setup;
}
