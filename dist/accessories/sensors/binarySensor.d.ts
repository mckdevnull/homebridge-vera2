import { VeraDeviceAccessory } from '../deviceAccessory.js';
/**
 * A Vera security sensor -> the matching HomeKit sensor service. The service and
 * "detected" characteristic are selected from the device kind; the `tripped`
 * state drives the characteristic value.
 */
export declare class BinarySensorAccessory extends VeraDeviceAccessory {
    private service;
    private detectedChar;
    private valueFor;
    protected setupServices(): void;
    protected pushState(): void;
}
