import { VeraDeviceAccessory } from './deviceAccessory.js';
/** A Vera dimmable light -> HomeKit Lightbulb with Brightness. */
export declare class DimmerAccessory extends VeraDeviceAccessory {
    private service;
    protected setupServices(): void;
    protected pushState(): void;
}
