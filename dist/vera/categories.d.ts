/**
 * Vera/Luup category numbers, service ids and the mapping to normalised device
 * kinds. Sourced from the MiOS "Luup Device Categories" and "Luup UPnP Variables
 * and Actions" references, cross-checked against pyvera and openLuup.
 */
/** Normalised device kind, independent of any specific Vera/Ezlo backend. */
export declare enum DeviceKind {
    Switch = "switch",
    Dimmer = "dimmer",
    RgbLight = "rgb-light",
    Fan = "fan",
    Lock = "lock",
    GarageDoor = "garage-door",
    Thermostat = "thermostat",
    WindowCovering = "window-covering",
    MotionSensor = "motion-sensor",
    ContactSensor = "contact-sensor",
    LeakSensor = "leak-sensor",
    SmokeSensor = "smoke-sensor",
    CoSensor = "co-sensor",
    GlassBreakSensor = "glass-break-sensor",
    TemperatureSensor = "temperature-sensor",
    HumiditySensor = "humidity-sensor",
    LightSensor = "light-sensor",
    Unsupported = "unsupported"
}
/** Vera `category_num` values we care about. */
export declare const Category: {
    readonly DimmableLight: 2;
    readonly Switch: 3;
    readonly SecuritySensor: 4;
    readonly Thermostat: 5;
    readonly Camera: 6;
    readonly DoorLock: 7;
    readonly WindowCovering: 8;
    readonly HumiditySensor: 16;
    readonly TemperatureSensor: 17;
    readonly LightSensor: 18;
    readonly GarageDoor: 32;
};
/** UPnP service ids used for reading state and issuing actions. */
export declare const ServiceId: {
    readonly SwitchPower: "urn:upnp-org:serviceId:SwitchPower1";
    readonly Dimming: "urn:upnp-org:serviceId:Dimming1";
    readonly Color: "urn:micasaverde-com:serviceId:Color1";
    readonly DoorLock: "urn:micasaverde-com:serviceId:DoorLock1";
    readonly WindowCovering: "urn:upnp-org:serviceId:WindowCovering1";
    readonly SecuritySensor: "urn:micasaverde-com:serviceId:SecuritySensor1";
    readonly TemperatureSensor: "urn:upnp-org:serviceId:TemperatureSensor1";
    readonly HumiditySensor: "urn:micasaverde-com:serviceId:HumiditySensor1";
    readonly LightSensor: "urn:micasaverde-com:serviceId:LightSensor1";
    readonly HaDevice: "urn:micasaverde-com:serviceId:HaDevice1";
    readonly HvacUserMode: "urn:upnp-org:serviceId:HVAC_UserOperatingMode1";
    readonly HvacFanMode: "urn:upnp-org:serviceId:HVAC_FanOperatingMode1";
    readonly HvacOperatingState: "urn:micasaverde-com:serviceId:HVAC_OperatingState1";
    readonly TemperatureSetpoint: "urn:upnp-org:serviceId:TemperatureSetpoint1";
    readonly TemperatureSetpointHeat: "urn:upnp-org:serviceId:TemperatureSetpoint1_Heat";
    readonly TemperatureSetpointCool: "urn:upnp-org:serviceId:TemperatureSetpoint1_Cool";
    readonly HomeAutomationGateway: "urn:micasaverde-com:serviceId:HomeAutomationGateway1";
};
/** Vera HVAC operating modes (`HVAC_UserOperatingMode1.ModeStatus`). */
export declare const HvacMode: {
    readonly Off: "Off";
    readonly Heat: "HeatOn";
    readonly Cool: "CoolOn";
    readonly Auto: "AutoChangeOver";
};
export type VeraHvacMode = (typeof HvacMode)[keyof typeof HvacMode];
/** Vera house modes (`HomeAutomationGateway1.SetHouseMode`). */
export declare const HouseMode: {
    readonly Home: 1;
    readonly Away: 2;
    readonly Night: 3;
    readonly Vacation: 4;
};
export type HouseModeValue = (typeof HouseMode)[keyof typeof HouseMode];
/** True when a security sensor kind. */
export declare function isSensorKind(kind: DeviceKind): boolean;
export interface KindHints {
    category: number;
    subcategory: number;
    deviceType?: string;
    deviceFile?: string;
    /** True when the device exposes the `Color1` service. */
    hasColor?: boolean;
}
/**
 * Map a Vera device's category/subcategory (plus optional device_type/file hints)
 * to a normalised {@link DeviceKind}.
 */
export declare function mapDeviceKind(hints: KindHints): DeviceKind;
