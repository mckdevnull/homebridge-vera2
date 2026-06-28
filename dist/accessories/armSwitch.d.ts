import { VeraDeviceAccessory } from './deviceAccessory.js';
/**
 * Optional companion accessory for an armable security sensor: a Switch that
 * arms/disarms the sensor (enabled via the `exposeArmDisarm` config option).
 */
export declare class ArmSwitchAccessory extends VeraDeviceAccessory {
    private service;
    protected setupServices(): void;
    protected pushState(): void;
}
