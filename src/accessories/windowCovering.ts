import type { CharacteristicValue, Service } from 'homebridge';
import { VeraDeviceAccessory } from './deviceAccessory.js';

/** A Vera window covering / blind -> HomeKit WindowCovering (position 0-100). */
export class WindowCoveringAccessory extends VeraDeviceAccessory {
  private service!: Service;

  protected setupServices(): void {
    this.service = this.getOrAddService(this.Service.WindowCovering, this.device.name);
    this.service.setCharacteristic(this.Characteristic.Name, this.device.name);

    this.service
      .getCharacteristic(this.Characteristic.CurrentPosition)
      .onGet(() => {
        this.assertOnline();
        return this.state.position ?? 0;
      });

    this.service
      .getCharacteristic(this.Characteristic.TargetPosition)
      .onGet(() => {
        this.assertOnline();
        return this.state.position ?? 0;
      })
      .onSet(async (value: CharacteristicValue) => {
        await this.platform.backend.setCoverPosition(this.id, value as number);
        this.state.position = value as number;
      });

    this.service.setCharacteristic(
      this.Characteristic.PositionState,
      this.Characteristic.PositionState.STOPPED,
    );

    // HoldPosition (when supported by the Home app) stops movement.
    this.service.getCharacteristic(this.Characteristic.HoldPosition).onSet(async () => {
      await this.platform.backend.coverStop(this.id);
    });
  }

  protected pushState(): void {
    const position = this.state.position ?? 0;
    this.service.updateCharacteristic(this.Characteristic.CurrentPosition, position);
    this.service.updateCharacteristic(this.Characteristic.TargetPosition, position);
    this.service.updateCharacteristic(
      this.Characteristic.PositionState,
      this.Characteristic.PositionState.STOPPED,
    );
  }
}
