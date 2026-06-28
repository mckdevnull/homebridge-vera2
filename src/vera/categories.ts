/**
 * Vera/Luup category numbers, service ids and the mapping to normalised device
 * kinds. Sourced from the MiOS "Luup Device Categories" and "Luup UPnP Variables
 * and Actions" references, cross-checked against pyvera and openLuup.
 */

/** Normalised device kind, independent of any specific Vera/Ezlo backend. */
export enum DeviceKind {
  Switch = 'switch',
  Dimmer = 'dimmer',
  RgbLight = 'rgb-light',
  Fan = 'fan',
  Lock = 'lock',
  GarageDoor = 'garage-door',
  Thermostat = 'thermostat',
  WindowCovering = 'window-covering',
  MotionSensor = 'motion-sensor',
  ContactSensor = 'contact-sensor',
  LeakSensor = 'leak-sensor',
  SmokeSensor = 'smoke-sensor',
  CoSensor = 'co-sensor',
  GlassBreakSensor = 'glass-break-sensor',
  TemperatureSensor = 'temperature-sensor',
  HumiditySensor = 'humidity-sensor',
  LightSensor = 'light-sensor',
  Unsupported = 'unsupported',
}

/** Vera `category_num` values we care about. */
export const Category = {
  DimmableLight: 2,
  Switch: 3,
  SecuritySensor: 4,
  Thermostat: 5,
  Camera: 6,
  DoorLock: 7,
  WindowCovering: 8,
  HumiditySensor: 16,
  TemperatureSensor: 17,
  LightSensor: 18,
  GarageDoor: 32,
} as const;

/** `subcategory_num` for category 2 (Dimmable Light). */
const DimmerSubcat = { Bulb: 1, Plugged: 2, InWall: 3, Rgb: 4 } as const;

/** `subcategory_num` for category 3 (Switch). */
const SwitchSubcat = { GarageDoor: 5 } as const;

/** `subcategory_num` for category 4 (Security Sensor). */
const SensorSubcat = {
  Door: 1,
  Leak: 2,
  Motion: 3,
  Smoke: 4,
  Co: 5,
  GlassBreak: 6,
} as const;

/** UPnP service ids used for reading state and issuing actions. */
export const ServiceId = {
  SwitchPower: 'urn:upnp-org:serviceId:SwitchPower1',
  Dimming: 'urn:upnp-org:serviceId:Dimming1',
  Color: 'urn:micasaverde-com:serviceId:Color1',
  DoorLock: 'urn:micasaverde-com:serviceId:DoorLock1',
  WindowCovering: 'urn:upnp-org:serviceId:WindowCovering1',
  SecuritySensor: 'urn:micasaverde-com:serviceId:SecuritySensor1',
  TemperatureSensor: 'urn:upnp-org:serviceId:TemperatureSensor1',
  HumiditySensor: 'urn:micasaverde-com:serviceId:HumiditySensor1',
  LightSensor: 'urn:micasaverde-com:serviceId:LightSensor1',
  HaDevice: 'urn:micasaverde-com:serviceId:HaDevice1',
  HvacUserMode: 'urn:upnp-org:serviceId:HVAC_UserOperatingMode1',
  HvacFanMode: 'urn:upnp-org:serviceId:HVAC_FanOperatingMode1',
  HvacOperatingState: 'urn:micasaverde-com:serviceId:HVAC_OperatingState1',
  TemperatureSetpoint: 'urn:upnp-org:serviceId:TemperatureSetpoint1',
  TemperatureSetpointHeat: 'urn:upnp-org:serviceId:TemperatureSetpoint1_Heat',
  TemperatureSetpointCool: 'urn:upnp-org:serviceId:TemperatureSetpoint1_Cool',
  HomeAutomationGateway: 'urn:micasaverde-com:serviceId:HomeAutomationGateway1',
} as const;

/** Vera HVAC operating modes (`HVAC_UserOperatingMode1.ModeStatus`). */
export const HvacMode = {
  Off: 'Off',
  Heat: 'HeatOn',
  Cool: 'CoolOn',
  Auto: 'AutoChangeOver',
} as const;

export type VeraHvacMode = (typeof HvacMode)[keyof typeof HvacMode];

/** Vera house modes (`HomeAutomationGateway1.SetHouseMode`). */
export const HouseMode = { Home: 1, Away: 2, Night: 3, Vacation: 4 } as const;
export type HouseModeValue = (typeof HouseMode)[keyof typeof HouseMode];

/** True when a security sensor kind. */
export function isSensorKind(kind: DeviceKind): boolean {
  return [
    DeviceKind.MotionSensor,
    DeviceKind.ContactSensor,
    DeviceKind.LeakSensor,
    DeviceKind.SmokeSensor,
    DeviceKind.CoSensor,
    DeviceKind.GlassBreakSensor,
  ].includes(kind);
}

export interface KindHints {
  category: number;
  subcategory: number;
  deviceType?: string;
  deviceFile?: string;
  /** True when the device exposes the `Color1` service. */
  hasColor?: boolean;
}

const matches = (haystack: string | undefined, needle: string): boolean =>
  !!haystack && haystack.toLowerCase().includes(needle);

/**
 * Map a Vera device's category/subcategory (plus optional device_type/file hints)
 * to a normalised {@link DeviceKind}.
 */
export function mapDeviceKind(hints: KindHints): DeviceKind {
  const { category, subcategory, deviceType, deviceFile, hasColor } = hints;

  switch (category) {
    case Category.DimmableLight:
      if (matches(deviceType, 'fan') || matches(deviceFile, 'fan')) {
        return DeviceKind.Fan;
      }
      if (subcategory === DimmerSubcat.Rgb || hasColor) {
        return DeviceKind.RgbLight;
      }
      return DeviceKind.Dimmer;

    case Category.Switch:
      if (subcategory === SwitchSubcat.GarageDoor) {
        return DeviceKind.GarageDoor;
      }
      if (matches(deviceType, 'fan') || matches(deviceFile, 'fan')) {
        return DeviceKind.Fan;
      }
      return DeviceKind.Switch;

    case Category.SecuritySensor:
      switch (subcategory) {
        case SensorSubcat.Door:
          return DeviceKind.ContactSensor;
        case SensorSubcat.Leak:
          return DeviceKind.LeakSensor;
        case SensorSubcat.Motion:
          return DeviceKind.MotionSensor;
        case SensorSubcat.Smoke:
          return DeviceKind.SmokeSensor;
        case SensorSubcat.Co:
          return DeviceKind.CoSensor;
        case SensorSubcat.GlassBreak:
          return DeviceKind.GlassBreakSensor;
        default:
          // Unknown security subcategory: a contact sensor is the safest generic.
          return DeviceKind.ContactSensor;
      }

    case Category.Thermostat:
      return DeviceKind.Thermostat;

    case Category.DoorLock:
      return DeviceKind.Lock;

    case Category.WindowCovering:
      return DeviceKind.WindowCovering;

    case Category.GarageDoor:
      return DeviceKind.GarageDoor;

    case Category.HumiditySensor:
      return DeviceKind.HumiditySensor;

    case Category.TemperatureSensor:
      return DeviceKind.TemperatureSensor;

    case Category.LightSensor:
      return DeviceKind.LightSensor;

    default:
      return DeviceKind.Unsupported;
  }
}
