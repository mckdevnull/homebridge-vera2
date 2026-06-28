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
    service;
    pendingHue;
    pendingSaturation;
    colorTimer;
    setupServices() {
        this.service = this.getOrAddService(this.Service.Lightbulb, this.device.name);
        this.service.setCharacteristic(this.Characteristic.Name, this.device.name);
        this.service
            .getCharacteristic(this.Characteristic.On)
            .onGet(() => {
            this.assertOnline();
            return this.state.on ?? false;
        })
            .onSet(async (value) => {
            await this.platform.backend.setSwitch(this.id, value);
            this.state.on = value;
        });
        this.service
            .getCharacteristic(this.Characteristic.Brightness)
            .onGet(() => {
            this.assertOnline();
            return this.state.brightness ?? 0;
        })
            .onSet(async (value) => {
            await this.platform.backend.setBrightness(this.id, value);
            this.state.brightness = value;
        });
        this.service
            .getCharacteristic(this.Characteristic.Hue)
            .onGet(() => {
            this.assertOnline();
            return this.state.hue ?? 0;
        })
            .onSet((value) => {
            this.pendingHue = value;
            this.scheduleColor();
        });
        this.service
            .getCharacteristic(this.Characteristic.Saturation)
            .onGet(() => {
            this.assertOnline();
            return this.state.saturation ?? 0;
        })
            .onSet((value) => {
            this.pendingSaturation = value;
            this.scheduleColor();
        });
    }
    pushState() {
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
    dispose() {
        if (this.colorTimer) {
            clearTimeout(this.colorTimer);
            this.colorTimer = undefined;
        }
    }
    /** Coalesce the Hue+Saturation writes that the Home app sends back-to-back. */
    scheduleColor() {
        if (this.colorTimer) {
            clearTimeout(this.colorTimer);
        }
        this.colorTimer = setTimeout(() => {
            void this.applyColor();
        }, 60);
    }
    async applyColor() {
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
