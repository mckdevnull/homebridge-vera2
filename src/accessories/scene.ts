import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import type { VeraHomebridgePlatform } from '../platform.js';
import type { NormalizedScene } from '../vera/types.js';
import { AccessoryBase } from './base.js';

/** A Vera scene -> a momentary HomeKit Switch that runs the scene when turned on. */
export class SceneAccessory extends AccessoryBase {
  private service!: Service;
  private offTimer?: ReturnType<typeof setTimeout>;

  constructor(
    platform: VeraHomebridgePlatform,
    accessory: PlatformAccessory,
    private readonly scene: NormalizedScene,
  ) {
    super(platform, accessory);
    this.setup();
  }

  private setup(): void {
    this.setupInformation({ manufacturer: 'Vera', model: 'Scene', serial: `vera-scene-${this.scene.id}` });
    this.service = this.getOrAddService(this.Service.Switch, this.scene.name);
    this.service.setCharacteristic(this.Characteristic.Name, this.scene.name);
    this.service
      .getCharacteristic(this.Characteristic.On)
      .onGet(() => false)
      .onSet(async (value: CharacteristicValue) => {
        if (!(value as boolean)) {
          return;
        }
        await this.platform.backend.runScene(this.scene.id);
        // Momentary: flip back off shortly after (clear any prior pending timer).
        if (this.offTimer) {
          clearTimeout(this.offTimer);
        }
        this.offTimer = setTimeout(() => {
          try {
            this.service.updateCharacteristic(this.Characteristic.On, false);
          } catch {
            /* ignore — never throw from a timer callback */
          }
        }, 800);
      });
  }
}
