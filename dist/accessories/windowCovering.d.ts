import { VeraDeviceAccessory } from './deviceAccessory.js';
/** A Vera window covering / blind -> HomeKit WindowCovering (position 0-100). */
export declare class WindowCoveringAccessory extends VeraDeviceAccessory {
    private service;
    protected setupServices(): void;
    protected pushState(): void;
}
