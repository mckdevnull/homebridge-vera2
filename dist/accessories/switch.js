import { VeraDeviceAccessory } from './deviceAccessory.js';
/** A Vera binary switch -> HomeKit Switch. */
export class SwitchAccessory extends VeraDeviceAccessory {
    service;
    setupServices() {
        this.service = this.getOrAddService(this.Service.Switch, this.device.name);
        this.service.setCharacteristic(this.Characteristic.Name, this.device.name);
        this.service
            .getCharacteristic(this.Characteristic.On)
            .onGet(this.getOn.bind(this))
            .onSet(this.setOn.bind(this));
    }
    pushState() {
        this.service.updateCharacteristic(this.Characteristic.On, this.state.on ?? false);
    }
    getOn() {
        this.assertOnline();
        return this.state.on ?? false;
    }
    async setOn(value) {
        await this.platform.backend.setSwitch(this.id, value);
        this.state.on = value;
    }
}
