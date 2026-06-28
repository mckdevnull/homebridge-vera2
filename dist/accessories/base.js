/**
 * Common accessory plumbing shared by device, scene and house-mode accessories:
 * convenient access to HAP types, a `getOrAddService` helper, and the standard
 * Accessory Information service.
 */
export class AccessoryBase {
    platform;
    accessory;
    constructor(platform, accessory) {
        this.platform = platform;
        this.accessory = accessory;
    }
    get hap() {
        return this.platform.api.hap;
    }
    get Service() {
        return this.platform.Service;
    }
    get Characteristic() {
        return this.platform.Characteristic;
    }
    get log() {
        return this.platform.log;
    }
    /** Get an existing service (optionally by subtype) or add it. */
    getOrAddService(type, name, subtype) {
        const displayName = name ?? this.accessory.displayName;
        // `type` is the generic Service base here; the concrete constructor args are
        // not statically known, so the add call is cast.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const add = this.accessory.addService.bind(this.accessory);
        if (subtype) {
            return this.accessory.getServiceById(type, subtype) ?? add(type, displayName, subtype);
        }
        return this.accessory.getService(type) ?? add(type, displayName);
    }
    /** Populate the Accessory Information service. */
    setupInformation(opts) {
        const info = this.accessory.getService(this.Service.AccessoryInformation) ??
            this.accessory.addService(this.Service.AccessoryInformation);
        info
            .setCharacteristic(this.Characteristic.Manufacturer, opts.manufacturer || 'Vera')
            .setCharacteristic(this.Characteristic.Model, opts.model || 'Vera Device')
            .setCharacteristic(this.Characteristic.SerialNumber, opts.serial);
    }
    /** Throw the HomeKit "Not Responding" error. */
    notResponding() {
        throw new this.hap.HapStatusError(-70402 /* this.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE */);
    }
}
