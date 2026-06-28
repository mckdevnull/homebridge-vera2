/**
 * Maps a normalised device to the concrete accessory implementation. This is the
 * single dispatch point from {@link DeviceKind} to an accessory class.
 */

import type { PlatformAccessory } from 'homebridge';
import { ArmSwitchAccessory } from './accessories/armSwitch.js';
import type { VeraDeviceAccessory } from './accessories/deviceAccessory.js';
import { DimmerAccessory } from './accessories/dimmer.js';
import { FanAccessory } from './accessories/fan.js';
import { GarageDoorAccessory } from './accessories/garageDoor.js';
import { LockAccessory } from './accessories/lock.js';
import { RgbLightAccessory } from './accessories/rgbLight.js';
import { BinarySensorAccessory } from './accessories/sensors/binarySensor.js';
import { MeasurementSensorAccessory } from './accessories/sensors/measurementSensor.js';
import { SwitchAccessory } from './accessories/switch.js';
import { ThermostatAccessory } from './accessories/thermostat.js';
import { WindowCoveringAccessory } from './accessories/windowCovering.js';
import type { VeraHomebridgePlatform } from './platform.js';
import { DeviceKind } from './vera/categories.js';
import type { NormalizedDevice } from './vera/types.js';

export function createDeviceAccessory(
  platform: VeraHomebridgePlatform,
  accessory: PlatformAccessory,
  device: NormalizedDevice,
): VeraDeviceAccessory | undefined {
  switch (device.kind) {
    case DeviceKind.Switch:
      return new SwitchAccessory(platform, accessory, device).init();
    case DeviceKind.Dimmer:
      return new DimmerAccessory(platform, accessory, device).init();
    case DeviceKind.RgbLight:
      return new RgbLightAccessory(platform, accessory, device).init();
    case DeviceKind.Fan:
      return new FanAccessory(platform, accessory, device).init();
    case DeviceKind.Lock:
      return new LockAccessory(platform, accessory, device).init();
    case DeviceKind.GarageDoor:
      return new GarageDoorAccessory(platform, accessory, device).init();
    case DeviceKind.Thermostat:
      return new ThermostatAccessory(platform, accessory, device).init();
    case DeviceKind.WindowCovering:
      return new WindowCoveringAccessory(platform, accessory, device).init();
    case DeviceKind.MotionSensor:
    case DeviceKind.ContactSensor:
    case DeviceKind.LeakSensor:
    case DeviceKind.SmokeSensor:
    case DeviceKind.CoSensor:
    case DeviceKind.GlassBreakSensor:
      return new BinarySensorAccessory(platform, accessory, device).init();
    case DeviceKind.TemperatureSensor:
    case DeviceKind.HumiditySensor:
    case DeviceKind.LightSensor:
      return new MeasurementSensorAccessory(platform, accessory, device).init();
    default:
      return undefined;
  }
}

/** Create the optional arm/disarm companion switch for an armable sensor. */
export function createArmSwitchAccessory(
  platform: VeraHomebridgePlatform,
  accessory: PlatformAccessory,
  device: NormalizedDevice,
): VeraDeviceAccessory {
  return new ArmSwitchAccessory(platform, accessory, device).init();
}
