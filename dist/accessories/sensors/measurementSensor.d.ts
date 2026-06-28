import { VeraDeviceAccessory } from '../deviceAccessory.js';
/** Vera temperature / humidity / light sensors -> the matching HomeKit sensor. */
export declare class MeasurementSensorAccessory extends VeraDeviceAccessory {
    private service;
    private valueChar;
    private read;
    protected setupServices(): void;
    protected pushState(): void;
}
