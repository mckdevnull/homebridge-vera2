import { describe, expect, it } from 'vitest';
import { hsvToRgb, rgbToHsv } from '../src/color.js';

describe('color conversions', () => {
  it('converts primary hues to RGB', () => {
    expect(hsvToRgb({ hue: 0, saturation: 100, value: 100 })).toEqual({ r: 255, g: 0, b: 0 });
    expect(hsvToRgb({ hue: 120, saturation: 100, value: 100 })).toEqual({ r: 0, g: 255, b: 0 });
    expect(hsvToRgb({ hue: 240, saturation: 100, value: 100 })).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('treats zero saturation as white/grey', () => {
    expect(hsvToRgb({ hue: 0, saturation: 0, value: 100 })).toEqual({ r: 255, g: 255, b: 255 });
    expect(hsvToRgb({ hue: 200, saturation: 0, value: 50 })).toEqual({ r: 128, g: 128, b: 128 });
  });

  it('converts RGB back to HSV', () => {
    expect(rgbToHsv({ r: 255, g: 0, b: 0 })).toEqual({ hue: 0, saturation: 100, value: 100 });
    expect(rgbToHsv({ r: 0, g: 255, b: 0 })).toEqual({ hue: 120, saturation: 100, value: 100 });
    expect(rgbToHsv({ r: 0, g: 0, b: 0 })).toEqual({ hue: 0, saturation: 0, value: 0 });
  });

  it('round-trips hue/saturation', () => {
    for (const hue of [30, 90, 150, 210, 300]) {
      const rgb = hsvToRgb({ hue, saturation: 100, value: 100 });
      const hsv = rgbToHsv(rgb);
      expect(Math.abs(hsv.hue - hue)).toBeLessThanOrEqual(1);
      expect(hsv.saturation).toBe(100);
    }
  });

  it('clamps out-of-range input', () => {
    expect(hsvToRgb({ hue: 360, saturation: 150, value: 200 })).toEqual({ r: 255, g: 0, b: 0 });
  });
});
