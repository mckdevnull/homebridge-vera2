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
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
/**
 * Convert HomeKit HSV (hue 0-360, saturation 0-100, value 0-100) to RGB 0-255.
 */
export function hsvToRgb({ hue, saturation, value }) {
    const h = ((hue % 360) + 360) % 360;
    const s = clamp(saturation, 0, 100) / 100;
    const v = clamp(value, 0, 100) / 100;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r1 = 0;
    let g1 = 0;
    let b1 = 0;
    if (h < 60) {
        [r1, g1, b1] = [c, x, 0];
    }
    else if (h < 120) {
        [r1, g1, b1] = [x, c, 0];
    }
    else if (h < 180) {
        [r1, g1, b1] = [0, c, x];
    }
    else if (h < 240) {
        [r1, g1, b1] = [0, x, c];
    }
    else if (h < 300) {
        [r1, g1, b1] = [x, 0, c];
    }
    else {
        [r1, g1, b1] = [c, 0, x];
    }
    return {
        r: Math.round((r1 + m) * 255),
        g: Math.round((g1 + m) * 255),
        b: Math.round((b1 + m) * 255),
    };
}
/**
 * Convert RGB 0-255 to HomeKit HSV. Note that `value` (brightness) is returned
 * for completeness; for Vera RGBW devices the actual brightness is normally read
 * from the separate `Dimming1` service, not from the colour.
 */
export function rgbToHsv({ r, g, b }) {
    const rn = clamp(r, 0, 255) / 255;
    const gn = clamp(g, 0, 255) / 255;
    const bn = clamp(b, 0, 255) / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const delta = max - min;
    let hue = 0;
    if (delta !== 0) {
        if (max === rn) {
            hue = 60 * (((gn - bn) / delta) % 6);
        }
        else if (max === gn) {
            hue = 60 * ((bn - rn) / delta + 2);
        }
        else {
            hue = 60 * ((rn - gn) / delta + 4);
        }
    }
    if (hue < 0) {
        hue += 360;
    }
    const saturation = max === 0 ? 0 : delta / max;
    return {
        hue: Math.round(hue),
        saturation: Math.round(saturation * 100),
        value: Math.round(max * 100),
    };
}
//# sourceMappingURL=color.js.map