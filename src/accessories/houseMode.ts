import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import type { VeraHomebridgePlatform } from '../platform.js';
import { HouseMode, type HouseModeValue } from '../vera/categories.js';
import { AccessoryBase } from './base.js';

/**
 * The Vera controller's House Mode -> a HomeKit Security System.
 *
 * Vera house modes map onto HomeKit security states as a bijection:
 *   Home -> Stay, Away -> Away, Night -> Night, Vacation -> Disarmed.
 */
export class HouseModeAccessory extends AccessoryBase {
  private service!: Service;
  private mode: HouseModeValue;

  constructor(platform: VeraHomebridgePlatform, accessory: PlatformAccessory, initialMode: HouseModeValue) {
    super(platform, accessory);
    this.mode = initialMode;
    this.setup();
  }

  private setup(): void {
    this.setupInformation({ manufacturer: 'Vera', model: 'House Mode', serial: 'vera-housemode' });
    this.service = this.getOrAddService(this.Service.SecuritySystem, 'House Mode');
    this.service.setCharacteristic(this.Characteristic.Name, 'House Mode');

    this.service
      .getCharacteristic(this.Characteristic.SecuritySystemCurrentState)
      .onGet(() => this.toCurrentState(this.mode));

    this.service
      .getCharacteristic(this.Characteristic.SecuritySystemTargetState)
      .onGet(() => this.toTargetState(this.mode))
      .onSet(async (value: CharacteristicValue) => {
        const houseMode = this.fromTargetState(value as number);
        await this.platform.backend.setHouseMode(houseMode);
        this.mode = houseMode;
      });
  }

  /** Called by the platform when the controller house mode changes. */
  updateHouseMode(mode: HouseModeValue): void {
    this.mode = mode;
    this.service.updateCharacteristic(this.Characteristic.SecuritySystemCurrentState, this.toCurrentState(mode));
    this.service.updateCharacteristic(this.Characteristic.SecuritySystemTargetState, this.toTargetState(mode));
  }

  private toCurrentState(mode: HouseModeValue): number {
    const c = this.Characteristic.SecuritySystemCurrentState;
    switch (mode) {
      case HouseMode.Away:
        return c.AWAY_ARM;
      case HouseMode.Night:
        return c.NIGHT_ARM;
      case HouseMode.Vacation:
        return c.DISARMED;
      default:
        return c.STAY_ARM;
    }
  }

  private toTargetState(mode: HouseModeValue): number {
    const t = this.Characteristic.SecuritySystemTargetState;
    switch (mode) {
      case HouseMode.Away:
        return t.AWAY_ARM;
      case HouseMode.Night:
        return t.NIGHT_ARM;
      case HouseMode.Vacation:
        return t.DISARM;
      default:
        return t.STAY_ARM;
    }
  }

  private fromTargetState(value: number): HouseModeValue {
    const t = this.Characteristic.SecuritySystemTargetState;
    switch (value) {
      case t.AWAY_ARM:
        return HouseMode.Away;
      case t.NIGHT_ARM:
        return HouseMode.Night;
      case t.DISARM:
        return HouseMode.Vacation;
      default:
        return HouseMode.Home;
    }
  }
}
