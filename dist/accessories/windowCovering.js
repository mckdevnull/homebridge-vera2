import { VeraDeviceAccessory } from './deviceAccessory.js';
/** A Vera window covering / blind -> HomeKit WindowCovering (position 0-100). */
export class WindowCoveringAccessory extends VeraDeviceAccessory {
    service;
    setupServices() {
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
            .onSet(async (value) => {
            await this.platform.backend.setCoverPosition(this.id, value);
            this.state.position = value;
        });
        this.service.setCharacteristic(this.Characteristic.PositionState, this.Characteristic.PositionState.STOPPED);
        // HoldPosition (when supported by the Home app) stops movement.
        this.service.getCharacteristic(this.Characteristic.HoldPosition).onSet(async () => {
            await this.platform.backend.coverStop(this.id);
        });
    }
    pushState() {
        const position = this.state.position ?? 0;
        this.service.updateCharacteristic(this.Characteristic.CurrentPosition, position);
        this.service.updateCharacteristic(this.Characteristic.TargetPosition, position);
        this.service.updateCharacteristic(this.Characteristic.PositionState, this.Characteristic.PositionState.STOPPED);
    }
}
//# sourceMappingURL=windowCovering.js.map