import type { CharacteristicValue, Service } from 'homebridge';
import { VeraDeviceAccessory } from './deviceAccessory.js';

/** A Vera door lock -> HomeKit LockMechanism. */
export class LockAccessory extends VeraDeviceAccessory {
  private service!: Service;

  protected setupServices(): void {
    this.service = this.getOrAddService(this.Service.LockMechanism, this.device.name);
    this.service.setCharacteristic(this.Characteristic.Name, this.device.name);

    this.service
      .getCharacteristic(this.Characteristic.LockCurrentState)
      .onGet(() => {
        this.assertOnline();
        return this.currentState();
      });

    this.service
      .getCharacteristic(this.Characteristic.LockTargetState)
      .onGet(() => {
        this.assertOnline();
        return this.targetState();
      })
      .onSet(async (value: CharacteristicValue) => {
        const locked = value === this.Characteristic.LockTargetState.SECURED;
        await this.platform.backend.setLock(this.id, locked);
        this.state.locked = locked;
      });
  }

  protected pushState(): void {
    this.service.updateCharacteristic(this.Characteristic.LockCurrentState, this.currentState());
    this.service.updateCharacteristic(this.Characteristic.LockTargetState, this.targetState());
  }

  private currentState(): number {
    const c = this.Characteristic.LockCurrentState;
    return this.state.locked ? c.SECURED : c.UNSECURED;
  }

  private targetState(): number {
    const t = this.Characteristic.LockTargetState;
    return this.state.locked ? t.SECURED : t.UNSECURED;
  }
}
