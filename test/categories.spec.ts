import { describe, expect, it } from 'vitest';
import { DeviceKind, isSensorKind, mapDeviceKind } from '../src/vera/categories.js';

describe('mapDeviceKind', () => {
  it('maps dimmable lights, RGB and fans', () => {
    expect(mapDeviceKind({ category: 2, subcategory: 1 })).toBe(DeviceKind.Dimmer);
    expect(mapDeviceKind({ category: 2, subcategory: 4 })).toBe(DeviceKind.RgbLight);
    expect(mapDeviceKind({ category: 2, subcategory: 1, hasColor: true })).toBe(DeviceKind.RgbLight);
    expect(mapDeviceKind({ category: 2, subcategory: 1, deviceFile: 'D_FanSpeed1.xml' })).toBe(DeviceKind.Fan);
  });

  it('maps switches and garage doors', () => {
    expect(mapDeviceKind({ category: 3, subcategory: 1 })).toBe(DeviceKind.Switch);
    expect(mapDeviceKind({ category: 3, subcategory: 5 })).toBe(DeviceKind.GarageDoor);
    expect(mapDeviceKind({ category: 32, subcategory: 0 })).toBe(DeviceKind.GarageDoor);
  });

  it('maps the security-sensor subcategories', () => {
    expect(mapDeviceKind({ category: 4, subcategory: 1 })).toBe(DeviceKind.ContactSensor);
    expect(mapDeviceKind({ category: 4, subcategory: 2 })).toBe(DeviceKind.LeakSensor);
    expect(mapDeviceKind({ category: 4, subcategory: 3 })).toBe(DeviceKind.MotionSensor);
    expect(mapDeviceKind({ category: 4, subcategory: 4 })).toBe(DeviceKind.SmokeSensor);
    expect(mapDeviceKind({ category: 4, subcategory: 5 })).toBe(DeviceKind.CoSensor);
    expect(mapDeviceKind({ category: 4, subcategory: 6 })).toBe(DeviceKind.GlassBreakSensor);
    // Unknown security subcategory falls back to a contact sensor.
    expect(mapDeviceKind({ category: 4, subcategory: 99 })).toBe(DeviceKind.ContactSensor);
  });

  it('maps locks, covers, thermostats and measurement sensors', () => {
    expect(mapDeviceKind({ category: 7, subcategory: 0 })).toBe(DeviceKind.Lock);
    expect(mapDeviceKind({ category: 8, subcategory: 1 })).toBe(DeviceKind.WindowCovering);
    expect(mapDeviceKind({ category: 5, subcategory: 1 })).toBe(DeviceKind.Thermostat);
    expect(mapDeviceKind({ category: 16, subcategory: 0 })).toBe(DeviceKind.HumiditySensor);
    expect(mapDeviceKind({ category: 17, subcategory: 0 })).toBe(DeviceKind.TemperatureSensor);
    expect(mapDeviceKind({ category: 18, subcategory: 0 })).toBe(DeviceKind.LightSensor);
  });

  it('returns Unsupported for unknown categories', () => {
    expect(mapDeviceKind({ category: 999, subcategory: 0 })).toBe(DeviceKind.Unsupported);
  });

  it('identifies sensor kinds', () => {
    expect(isSensorKind(DeviceKind.MotionSensor)).toBe(true);
    expect(isSensorKind(DeviceKind.ContactSensor)).toBe(true);
    expect(isSensorKind(DeviceKind.Switch)).toBe(false);
    expect(isSensorKind(DeviceKind.TemperatureSensor)).toBe(false);
  });
});
