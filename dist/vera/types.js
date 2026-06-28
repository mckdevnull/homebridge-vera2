/**
 * Backend-agnostic domain model and the pluggable backend contract.
 *
 * The HomeKit layer (platform + accessories) depends ONLY on these types — never
 * on Luup specifics. A future Ezlo (WSS / JSON-RPC) backend can implement the
 * same {@link VeraBackend} interface without touching the accessory code.
 */
import { EventEmitter } from 'node:events';
/** Normalised thermostat mode. */
export var ThermostatMode;
(function (ThermostatMode) {
    ThermostatMode["Off"] = "off";
    ThermostatMode["Heat"] = "heat";
    ThermostatMode["Cool"] = "cool";
    ThermostatMode["Auto"] = "auto";
})(ThermostatMode || (ThermostatMode = {}));
/**
 * A minimal strongly-typed wrapper around Node's EventEmitter so backends get
 * compile-checked event names and payloads.
 */
export class TypedEmitter extends EventEmitter {
    on(event, listener) {
        return super.on(event, listener);
    }
    once(event, listener) {
        return super.once(event, listener);
    }
    off(event, listener) {
        return super.off(event, listener);
    }
    emit(event, ...args) {
        return super.emit(event, ...args);
    }
}
