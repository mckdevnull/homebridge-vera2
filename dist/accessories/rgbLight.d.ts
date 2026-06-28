import { VeraDeviceAccessory } from './deviceAccessory.js';
/**
 * A Vera RGB(W) light -> HomeKit Lightbulb with On/Brightness/Hue/Saturation.
 *
 * HomeKit sets Hue and Saturation as two separate writes; we coalesce them with
 * a short debounce into a single `Color1` command. Brightness is driven by the
 * separate `Dimming1` service, so colour is computed at full value.
 */
export declare class RgbLightAccessory extends VeraDeviceAccessory {
    private service;
    private pendingHue?;
    private pendingSaturation?;
    private colorTimer?;
    protected setupServices(): void;
    protected pushState(): void;
    /** Coalesce the Hue+Saturation writes that the Home app sends back-to-back. */
    private scheduleColor;
    private applyColor;
}
