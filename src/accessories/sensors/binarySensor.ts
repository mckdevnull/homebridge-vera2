import type { Characteristic, CharacteristicValue, Service, WithUUID } from 'homebridge';
import { DeviceKind } from '../../vera/categories.js';
import { VeraDeviceAccessory } from '../deviceAccessory.js';

type CharCtor = WithUUID<{ new (): Characteristic }>;

/**
 * A Vera security sensor -> the matching HomeKit sensor service. The service and
 * "detected" characteristic are selected from the device kind; the `tripped`
 * state drives the characteristic value.
 */
export class BinarySensorAccessory extends VeraDeviceAccessory {
  private service!: Service;
  private detectedChar!: CharCtor;
  private valueFor!: (tripped: boolean) => CharacteristicValue;

  protected setupServices(): void {
    const C = this.Characteristic;
    const S = this.Service;

    switch (this.device.kind) {
      case DeviceKind.ContactSensor:
        this.service = this.getOrAddService(S.ContactSensor, this.device.name);
        this.detectedChar = C.ContactSensorState;
        this.valueFor = (t) =>
          t ? C.ContactSensorState.CONTACT_NOT_DETECTED : C.ContactSensorState.CONTACT_DETECTED;
        break;
      case DeviceKind.LeakSensor:
        this.service = this.getOrAddService(S.LeakSensor, this.device.name);
        this.detectedChar = C.LeakDetected;
        this.valueFor = (t) => (t ? C.LeakDetected.LEAK_DETECTED : C.LeakDetected.LEAK_NOT_DETECTED);
        break;
      case DeviceKind.SmokeSensor:
        this.service = this.getOrAddService(S.SmokeSensor, this.device.name);
        this.detectedChar = C.SmokeDetected;
        this.valueFor = (t) => (t ? C.SmokeDetected.SMOKE_DETECTED : C.SmokeDetected.SMOKE_NOT_DETECTED);
        break;
      case DeviceKind.CoSensor:
        this.service = this.getOrAddService(S.CarbonMonoxideSensor, this.device.name);
        this.detectedChar = C.CarbonMonoxideDetected;
        this.valueFor = (t) =>
          t ? C.CarbonMonoxideDetected.CO_LEVELS_ABNORMAL : C.CarbonMonoxideDetected.CO_LEVELS_NORMAL;
        break;
      case DeviceKind.MotionSensor:
      case DeviceKind.GlassBreakSensor:
      default:
        this.service = this.getOrAddService(S.MotionSensor, this.device.name);
        this.detectedChar = C.MotionDetected;
        this.valueFor = (t) => t;
        break;
    }

    this.service.setCharacteristic(this.Characteristic.Name, this.device.name);
    this.service.getCharacteristic(this.detectedChar).onGet(() => this.valueFor(this.state.tripped ?? false));
    this.service
      .getCharacteristic(this.Characteristic.StatusActive)
      .onGet(() => this.state.online);
  }

  protected pushState(): void {
    this.service.updateCharacteristic(this.detectedChar, this.valueFor(this.state.tripped ?? false));
    this.service.updateCharacteristic(this.Characteristic.StatusActive, this.state.online);
  }
}
