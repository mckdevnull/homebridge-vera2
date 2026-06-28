import { AccessoryBase } from './base.js';
/** A Vera scene -> a momentary HomeKit Switch that runs the scene when turned on. */
export class SceneAccessory extends AccessoryBase {
    scene;
    service;
    constructor(platform, accessory, scene) {
        super(platform, accessory);
        this.scene = scene;
        this.setup();
    }
    setup() {
        this.setupInformation({ manufacturer: 'Vera', model: 'Scene', serial: `vera-scene-${this.scene.id}` });
        this.service = this.getOrAddService(this.Service.Switch, this.scene.name);
        this.service.setCharacteristic(this.Characteristic.Name, this.scene.name);
        this.service
            .getCharacteristic(this.Characteristic.On)
            .onGet(() => false)
            .onSet(async (value) => {
            if (!value) {
                return;
            }
            await this.platform.backend.runScene(this.scene.id);
            // Momentary: flip back off shortly after.
            setTimeout(() => this.service.updateCharacteristic(this.Characteristic.On, false), 800);
        });
    }
}
//# sourceMappingURL=scene.js.map