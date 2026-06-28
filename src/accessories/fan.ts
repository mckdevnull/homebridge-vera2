import type { CharacteristicValue, Service } from 'homebridge';
import { VeraDeviceAccessory } from './deviceAccessory.js';

/** A Vera fan -> HomeKit Fan, with optional variable speed (Dimming1). */
export class FanAccessory extends VeraDeviceAccessory {
  private service!: Service;
  private hasSpeed = false;

  protected setupServices(): void {
    this.hasSpeed = this.state.brightness !== undefined;
    this.service = this.getOrAddService(this.Service.Fan, this.device.name);
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

    if (this.hasSpeed) {
      this.service
        .getCharacteristic(this.Characteristic.RotationSpeed)
        .onGet(() => {
          this.assertOnline();
          return this.state.brightness ?? 0;
        })
        .onSet(async (value: CharacteristicValue) => {
          await this.platform.backend.setBrightness(this.id, value as number);
          this.state.brightness = value as number;
        });
    }
  }

  protected pushState(): void {
    this.service.updateCharacteristic(this.Characteristic.On, this.state.on ?? false);
    if (this.hasSpeed && this.state.brightness !== undefined) {
      this.service.updateCharacteristic(this.Characteristic.RotationSpeed, this.state.brightness);
    }
  }
}
