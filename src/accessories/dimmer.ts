import type { CharacteristicValue, Service } from 'homebridge';
import { VeraDeviceAccessory } from './deviceAccessory.js';

/** A Vera dimmable light -> HomeKit Lightbulb with Brightness. */
export class DimmerAccessory extends VeraDeviceAccessory {
  private service!: Service;

  protected setupServices(): void {
    this.service = this.getOrAddService(this.Service.Lightbulb, this.device.name);
    this.service.setCharacteristic(this.Characteristic.Name, this.device.name);

    this.service
      .getCharacteristic(this.Characteristic.On)
      .onGet(() => {
        this.assertOnline();
        return this.state.on ?? false;
      })
      .onSet(async (value: CharacteristicValue) => {
        await this.platform.backend.setSwitch(this.id, value as boolean);
        this.state.on = value as boolean;
      });

    this.service
      .getCharacteristic(this.Characteristic.Brightness)
      .onGet(() => {
        this.assertOnline();
        return this.state.brightness ?? 0;
      })
      .onSet(async (value: CharacteristicValue) => {
        await this.platform.backend.setBrightness(this.id, value as number);
        this.state.brightness = value as number;
      });
  }

  protected pushState(): void {
    this.service.updateCharacteristic(this.Characteristic.On, this.state.on ?? false);
    if (this.state.brightness !== undefined) {
      this.service.updateCharacteristic(this.Characteristic.Brightness, this.state.brightness);
    }
  }
}
