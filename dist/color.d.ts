/**
 * Pure colour conversion helpers.
 *
 * HomeKit exposes colour as Hue (0-360), Saturation (0-100) and Brightness
 * (0-100, a separate characteristic). Vera's `Color1` service stores colour as
 * RGB components. These functions bridge the two representations.
 *
 * All functions are pure and side-effect free so they can be unit-tested
 * without a controller or HomeKit runtime.
 */
export interface Rgb {
    r: number;
    g: number;
    b: number;
}
export interface Hsv {
    hue: number;
    saturation: number;
    value: number;
}
/**
 * Convert HomeKit HSV (hue 0-360, saturation 0-100, value 0-100) to RGB 0-255.
 */
export declare function hsvToRgb({ hue, saturation, value }: Hsv): Rgb;
/**
 * Convert RGB 0-255 to HomeKit HSV. Note that `value` (brightness) is returned
 * for completeness; for Vera RGBW devices the actual brightness is normally read
 * from the separate `Dimming1` service, not from the colour.
 */
export declare function rgbToHsv({ r, g, b }: Rgb): Hsv;
