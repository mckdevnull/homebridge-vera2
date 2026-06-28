import { VeraDeviceAccessory } from './deviceAccessory.js';
/** A Vera door lock -> HomeKit LockMechanism. */
export declare class LockAccessory extends VeraDeviceAccessory {
    private service;
    protected setupServices(): void;
    protected pushState(): void;
    private currentState;
    private targetState;
}
