import { VeraDeviceAccessory } from './deviceAccessory.js';
/** A Vera fan -> HomeKit Fan, with optional variable speed (Dimming1). */
export declare class FanAccessory extends VeraDeviceAccessory {
    private service;
    private hasSpeed;
    protected setupServices(): void;
    /** Idempotently add the RotationSpeed characteristic + handlers. */
    private wireSpeed;
    protected pushState(): void;
}
