import { HouseMode } from '../vera/categories.js';
import { AccessoryBase } from './base.js';
/**
 * The Vera controller's House Mode -> a HomeKit Security System.
 *
 * Vera house modes map onto HomeKit security states as a bijection:
 *   Home -> Stay, Away -> Away, Night -> Night, Vacation -> Disarmed.
 */
export class HouseModeAccessory extends AccessoryBase {
    service;
    mode;
    constructor(platform, accessory, initialMode) {
        super(platform, accessory);
        this.mode = initialMode;
        this.setup();
    }
    setup() {
        this.setupInformation({ manufacturer: 'Vera', model: 'House Mode', serial: 'vera-housemode' });
        this.service = this.getOrAddService(this.Service.SecuritySystem, 'House Mode');
        this.service.setCharacteristic(this.Characteristic.Name, 'House Mode');
        this.service
            .getCharacteristic(this.Characteristic.SecuritySystemCurrentState)
            .onGet(() => this.toCurrentState(this.mode));
        this.service
            .getCharacteristic(this.Characteristic.SecuritySystemTargetState)
            .onGet(() => this.toTargetState(this.mode))
            .onSet(async (value) => {
            const houseMode = this.fromTargetState(value);
            await this.platform.backend.setHouseMode(houseMode);
            this.mode = houseMode;
        });
    }
    /** Called by the platform when the controller house mode changes. */
    updateHouseMode(mode) {
        this.mode = mode;
        this.service.updateCharacteristic(this.Characteristic.SecuritySystemCurrentState, this.toCurrentState(mode));
        this.service.updateCharacteristic(this.Characteristic.SecuritySystemTargetState, this.toTargetState(mode));
    }
    toCurrentState(mode) {
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
    toTargetState(mode) {
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
    fromTargetState(value) {
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
