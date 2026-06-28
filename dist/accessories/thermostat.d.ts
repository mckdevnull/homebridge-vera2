import { VeraDeviceAccessory } from './deviceAccessory.js';
/** A Vera HVAC thermostat -> HomeKit Thermostat. */
export declare class ThermostatAccessory extends VeraDeviceAccessory {
    private service;
    protected setupServices(): void;
    protected pushState(): void;
    private currentHeatingCoolingState;
    private targetHeatingCoolingState;
    private toThermostatMode;
}
