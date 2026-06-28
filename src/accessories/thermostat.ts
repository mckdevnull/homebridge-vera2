import type { CharacteristicValue, Service } from 'homebridge';
import { ThermostatMode } from '../vera/types.js';
import { VeraDeviceAccessory } from './deviceAccessory.js';

/** A Vera HVAC thermostat -> HomeKit Thermostat. */
export class ThermostatAccessory extends VeraDeviceAccessory {
  private service!: Service;

  protected setupServices(): void {
    this.service = this.getOrAddService(this.Service.Thermostat, this.device.name);
    this.service.setCharacteristic(this.Characteristic.Name, this.device.name);

    this.service
      .getCharacteristic(this.Characteristic.CurrentHeatingCoolingState)
      .onGet(() => this.currentHeatingCoolingState());

    this.service
      .getCharacteristic(this.Characteristic.TargetHeatingCoolingState)
      .onGet(() => this.targetHeatingCoolingState())
      .onSet(async (value: CharacteristicValue) => {
        const mode = this.toThermostatMode(value as number);
        await this.platform.backend.setThermostatMode(this.id, mode);
        this.state.mode = mode;
      });

    this.service
      .getCharacteristic(this.Characteristic.CurrentTemperature)
      .onGet(() => {
        this.assertOnline();
        return this.state.currentTemperature ?? 0;
      });

    this.service
      .getCharacteristic(this.Characteristic.TargetTemperature)
      .setProps({ minValue: 4, maxValue: 38, minStep: 0.5 })
      .onGet(() => this.state.targetTemperature ?? 20)
      .onSet(async (value: CharacteristicValue) => {
        await this.platform.backend.setThermostatSetpoint(this.id, value as number);
        this.state.targetTemperature = value as number;
      });

    const units =
      this.platform.backend.temperatureUnit === 'F'
        ? this.Characteristic.TemperatureDisplayUnits.FAHRENHEIT
        : this.Characteristic.TemperatureDisplayUnits.CELSIUS;
    this.service
      .getCharacteristic(this.Characteristic.TemperatureDisplayUnits)
      .onGet(() => units)
      .onSet(() => {
        // Display unit is controlled by the Vera controller; ignore changes.
      });
  }

  protected pushState(): void {
    this.service.updateCharacteristic(
      this.Characteristic.CurrentHeatingCoolingState,
      this.currentHeatingCoolingState(),
    );
    this.service.updateCharacteristic(
      this.Characteristic.TargetHeatingCoolingState,
      this.targetHeatingCoolingState(),
    );
    if (this.state.currentTemperature !== undefined) {
      this.service.updateCharacteristic(this.Characteristic.CurrentTemperature, this.state.currentTemperature);
    }
    if (this.state.targetTemperature !== undefined) {
      this.service.updateCharacteristic(this.Characteristic.TargetTemperature, this.state.targetTemperature);
    }
  }

  private currentHeatingCoolingState(): number {
    const c = this.Characteristic.CurrentHeatingCoolingState;
    switch (this.state.operatingState) {
      case 'heating':
        return c.HEAT;
      case 'cooling':
        return c.COOL;
      default:
        return c.OFF;
    }
  }

  private targetHeatingCoolingState(): number {
    const t = this.Characteristic.TargetHeatingCoolingState;
    switch (this.state.mode) {
      case ThermostatMode.Heat:
        return t.HEAT;
      case ThermostatMode.Cool:
        return t.COOL;
      case ThermostatMode.Auto:
        return t.AUTO;
      default:
        return t.OFF;
    }
  }

  private toThermostatMode(value: number): ThermostatMode {
    const t = this.Characteristic.TargetHeatingCoolingState;
    switch (value) {
      case t.HEAT:
        return ThermostatMode.Heat;
      case t.COOL:
        return ThermostatMode.Cool;
      case t.AUTO:
        return ThermostatMode.Auto;
      default:
        return ThermostatMode.Off;
    }
  }
}
