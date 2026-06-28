import { VeraDeviceAccessory } from './deviceAccessory.js';
/**
 * A Vera garage door (switch-based: on = open) -> HomeKit GarageDoorOpener.
 * Vera reports only open/closed, so opening/closing transitional states are not
 * modelled.
 */
export declare class GarageDoorAccessory extends VeraDeviceAccessory {
    private service;
    protected setupServices(): void;
    protected pushState(): void;
    private currentDoorState;
    private targetDoorState;
}
