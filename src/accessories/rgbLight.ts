import type { CharacteristicValue, Service } from 'homebridge';
import { hsvToRgb } from '../color.js';
import { VeraDeviceAccessory } from './deviceAccessory.js';

/**
 * A Vera RGB(W) light -> HomeKit Lightbulb with On/Brightness/Hue/Saturation.
 *
 * HomeKit sets Hue and Saturation as two separate writes; we coalesce them with
 * a short debounce into a single `Color1` command. Brightness is driven by the
 * separate `Dimming1` service, so colour is computed at full value.
 */
export class RgbLightAccessory extends VeraDeviceAccessory {
  private service!: Service;
  private pendingHue?: number;
  private pendingSaturation?: number;
  private colorTimer?: NodeJS.Timeout;

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

    this.service
      .getCharacteristic(this.Characteristic.Hue)
      .onGet(() => {
        this.assertOnline();
        return this.state.hue ?? 0;
      })
      .onSet((value: CharacteristicValue) => {
        this.pendingHue = value as number;
        this.scheduleColor();
      });

    this.service
      .getCharacteristic(this.Characteristic.Saturation)
      .onGet(() => {
        this.assertOnline();
        return this.state.saturation ?? 0;
      })
      .onSet((value: CharacteristicValue) => {
        this.pendingSaturation = value as number;
        this.scheduleColor();
      });
  }

  protected pushState(): void {
    this.service.updateCharacteristic(this.Characteristic.On, this.state.on ?? false);
    if (this.state.brightness !== undefined) {
      this.service.updateCharacteristic(this.Characteristic.Brightness, this.state.brightness);
    }
    if (this.state.hue !== undefined) {
      this.service.updateCharacteristic(this.Characteristic.Hue, this.state.hue);
    }
    if (this.state.saturation !== undefined) {
      this.service.updateCharacteristic(this.Characteristic.Saturation, this.state.saturation);
    }
  }

  /** Coalesce the Hue+Saturation writes that the Home app sends back-to-back. */
  private scheduleColor(): void {
    if (this.colorTimer) {
      clearTimeout(this.colorTimer);
    }
    this.colorTimer = setTimeout(() => {
      void this.applyColor();
    }, 60);
  }

  private async applyColor(): Promise<void> {
    const hue = this.pendingHue ?? this.state.hue ?? 0;
    const saturation = this.pendingSaturation ?? this.state.saturation ?? 0;
    this.pendingHue = undefined;
    this.pendingSaturation = undefined;
    this.state.hue = hue;
    this.state.saturation = saturation;
    const rgb = hsvToRgb({ hue, saturation, value: 100 });
    await this.platform.backend.setColorRgb(this.id, rgb);
  }
}
