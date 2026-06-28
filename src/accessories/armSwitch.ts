import type { CharacteristicValue, Service } from 'homebridge';
import { VeraDeviceAccessory } from './deviceAccessory.js';

/**
 * Optional companion accessory for an armable security sensor: a Switch that
 * arms/disarms the sensor (enabled via the `exposeArmDisarm` config option).
 */
export class ArmSwitchAccessory extends VeraDeviceAccessory {
  private service!: Service;

  protected setupServices(): void {
    const name = `${this.device.name} Arm`;
    this.service = this.getOrAddService(this.Service.Switch, name);
    this.service.setCharacteristic(this.Characteristic.Name, name);
    this.service
      .getCharacteristic(this.Characteristic.On)
      .onGet(() => this.state.armed ?? false)
      .onSet(async (value: CharacteristicValue) => {
        await this.platform.backend.setArmed(this.id, value as boolean);
        this.state.armed = value as boolean;
      });
  }

  protected pushState(): void {
    this.service.updateCharacteristic(this.Characteristic.On, this.state.armed ?? false);
  }
}
