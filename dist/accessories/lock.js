import { VeraDeviceAccessory } from './deviceAccessory.js';
/** A Vera door lock -> HomeKit LockMechanism. */
export class LockAccessory extends VeraDeviceAccessory {
    service;
    setupServices() {
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
            .onSet(async (value) => {
            const locked = value === this.Characteristic.LockTargetState.SECURED;
            await this.platform.backend.setLock(this.id, locked);
            this.state.locked = locked;
        });
    }
    pushState() {
        this.service.updateCharacteristic(this.Characteristic.LockCurrentState, this.currentState());
        this.service.updateCharacteristic(this.Characteristic.LockTargetState, this.targetState());
    }
    currentState() {
        const c = this.Characteristic.LockCurrentState;
        return this.state.locked ? c.SECURED : c.UNSECURED;
    }
    targetState() {
        const t = this.Characteristic.LockTargetState;
        return this.state.locked ? t.SECURED : t.UNSECURED;
    }
}
