import { VeraDeviceAccessory } from './deviceAccessory.js';
/**
 * A Vera garage door (switch-based: on = open) -> HomeKit GarageDoorOpener.
 * Vera reports only open/closed, so opening/closing transitional states are not
 * modelled.
 */
export class GarageDoorAccessory extends VeraDeviceAccessory {
    service;
    setupServices() {
        this.service = this.getOrAddService(this.Service.GarageDoorOpener, this.device.name);
        this.service.setCharacteristic(this.Characteristic.Name, this.device.name);
        this.service
            .getCharacteristic(this.Characteristic.CurrentDoorState)
            .onGet(() => {
            this.assertOnline();
            return this.currentDoorState();
        });
        this.service
            .getCharacteristic(this.Characteristic.TargetDoorState)
            .onGet(() => {
            this.assertOnline();
            return this.targetDoorState();
        })
            .onSet(async (value) => {
            const open = value === this.Characteristic.TargetDoorState.OPEN;
            await this.platform.backend.setSwitch(this.id, open);
            this.state.on = open;
        });
        this.service.setCharacteristic(this.Characteristic.ObstructionDetected, false);
    }
    pushState() {
        this.service.updateCharacteristic(this.Characteristic.CurrentDoorState, this.currentDoorState());
        this.service.updateCharacteristic(this.Characteristic.TargetDoorState, this.targetDoorState());
    }
    currentDoorState() {
        const c = this.Characteristic.CurrentDoorState;
        return this.state.on ? c.OPEN : c.CLOSED;
    }
    targetDoorState() {
        const t = this.Characteristic.TargetDoorState;
        return this.state.on ? t.OPEN : t.CLOSED;
    }
}
//# sourceMappingURL=garageDoor.js.map