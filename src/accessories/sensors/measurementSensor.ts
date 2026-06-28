import type { Characteristic, CharacteristicValue, Service, WithUUID } from 'homebridge';
import { DeviceKind } from '../../vera/categories.js';
import { VeraDeviceAccessory } from '../deviceAccessory.js';

type CharCtor = WithUUID<{ new (): Characteristic }>;

/** Vera temperature / humidity / light sensors -> the matching HomeKit sensor. */
export class MeasurementSensorAccessory extends VeraDeviceAccessory {
  private service!: Service;
  private valueChar!: CharCtor;
  private read!: () => CharacteristicValue;

  protected setupServices(): void {
    const C = this.Characteristic;
    const S = this.Service;

    switch (this.device.kind) {
      case DeviceKind.HumiditySensor:
        this.service = this.getOrAddService(S.HumiditySensor, this.device.name);
        this.valueChar = C.CurrentRelativeHumidity;
        this.read = () => this.state.humidity ?? 0;
        break;
      case DeviceKind.LightSensor:
        this.service = this.getOrAddService(S.LightSensor, this.device.name);
        this.valueChar = C.CurrentAmbientLightLevel;
        this.read = () => Math.max(0.0001, this.state.lightLevel ?? 0.0001);
        break;
      case DeviceKind.TemperatureSensor:
      default:
        this.service = this.getOrAddService(S.TemperatureSensor, this.device.name);
        this.valueChar = C.CurrentTemperature;
        this.read = () => this.state.currentTemperature ?? 0;
        break;
    }

    this.service.setCharacteristic(this.Characteristic.Name, this.device.name);
    this.service.getCharacteristic(this.valueChar).onGet(() => this.read());
    this.service.getCharacteristic(this.Characteristic.StatusActive).onGet(() => this.state.online);
  }

  protected pushState(): void {
    this.service.updateCharacteristic(this.valueChar, this.read());
    this.service.updateCharacteristic(this.Characteristic.StatusActive, this.state.online);
  }
}
