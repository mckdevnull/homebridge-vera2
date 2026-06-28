import { VeraDeviceAccessory } from './deviceAccessory.js';
/** A Vera fan -> HomeKit Fan, with optional variable speed (Dimming1). */
export class FanAccessory extends VeraDeviceAccessory {
    service;
    hasSpeed = false;
    setupServices() {
        this.service = this.getOrAddService(this.Service.Fan, this.device.name);
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
        // Expose speed when the device reports a level — now or later (see pushState).
        if (this.state.brightness !== undefined) {
            this.wireSpeed();
        }
    }
    /** Idempotently add the RotationSpeed characteristic + handlers. */
    wireSpeed() {
        if (this.hasSpeed) {
            return;
        }
        this.hasSpeed = true;
        this.service
            .getCharacteristic(this.Characteristic.RotationSpeed)
            .onGet(() => {
            this.assertOnline();
            return this.state.brightness ?? 0;
        })
            .onSet(async (value) => {
            await this.platform.backend.setBrightness(this.id, value);
            this.state.brightness = value;
        });
    }
    pushState() {
        this.service.updateCharacteristic(this.Characteristic.On, this.state.on ?? false);
        if (this.state.brightness !== undefined) {
            // A speed value appeared (possibly after startup) — ensure the characteristic exists.
            this.wireSpeed();
            this.service.updateCharacteristic(this.Characteristic.RotationSpeed, this.state.brightness);
        }
    }
}
