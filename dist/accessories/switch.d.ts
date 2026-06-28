import { VeraDeviceAccessory } from './deviceAccessory.js';
/** A Vera binary switch -> HomeKit Switch. */
export declare class SwitchAccessory extends VeraDeviceAccessory {
    private service;
    protected setupServices(): void;
    protected pushState(): void;
    private getOn;
    private setOn;
}
