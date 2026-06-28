import type { CharacteristicValue, Service } from 'homebridge';
import { VeraDeviceAccessory } from './deviceAccessory.js';

/** A Vera binary switch -> HomeKit Switch. */
export class SwitchAccessory extends VeraDeviceAccessory {
  private service!: Service;

  protected setupServices(): void {
    this.service = this.getOrAddService(this.Service.Switch, this.device.name);
    this.service.setCharacteristic(this.Characteristic.Name, this.device.name);
    this.service
      .getCharacteristic(this.Characteristic.On)
      .onGet(this.getOn.bind(this))
      .onSet(this.setOn.bind(this));
  }

  protected pushState(): void {
    this.service.updateCharacteristic(this.Characteristic.On, this.state.on ?? false);
  }

  private getOn(): CharacteristicValue {
    this.assertOnline();
    return this.state.on ?? false;
  }

  private async setOn(value: CharacteristicValue): Promise<void> {
    await this.platform.backend.setSwitch(this.id, value as boolean);
    this.state.on = value as boolean;
  }
}
