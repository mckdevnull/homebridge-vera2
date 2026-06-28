/**
 * Defensive value parsing and unit conversion for raw Vera/Luup values.
 *
 * The Luup API is loosely typed: numbers arrive as strings, booleans as
 * "0"/"1", levels occasionally as "10", "0.0" or "0%", and device ids/categories
 * can switch between string and integer between full and incremental responses.
 * Everything that touches a raw Vera value goes through here.
 */
import type { Rgb } from '../color.js';
/** Parse a Luup value into an integer, tolerating strings, floats and `%`. */
export declare function toInt(value: unknown, fallback?: number): number;
/** Parse a Luup value into a float. */
export declare function toNumber(value: unknown, fallback?: number): number;
/** Parse a Luup boolean-ish value ("1"/"0"/1/0/true/false). */
export declare function toBool(value: unknown): boolean;
/** Parse a Luup id/category that may be a string or number into a string key. */
export declare function toIdString(value: unknown): string;
/** Clamp a 0-100 percentage. */
export declare function clampPercent(n: number): number;
/** Fahrenheit -> Celsius. */
export declare function fToC(f: number): number;
/** Celsius -> Fahrenheit. */
export declare function cToF(c: number): number;
/** Normalise a controller temperature to Celsius (HomeKit requires Celsius). */
export declare function toCelsius(value: unknown, unit: 'C' | 'F'): number;
/** Convert a HomeKit Celsius value to the controller's native unit for a setpoint. */
export declare function fromCelsius(celsius: number, unit: 'C' | 'F'): number;
/**
 * Parse Vera `Color1` colour into RGB.
 *
 * `CurrentColor` looks like `"0=0,1=0,2=255,3=0,4=128"` where each entry is
 * `channelIndex=value`. `SupportedColors` names the channels in order, e.g.
 * `"W,D,R,G,B"`. We locate the R/G/B channels by name and read their values.
 * Returns `undefined` if the device does not expose R/G/B channels.
 */
export declare function parseVeraColor(currentColor: string | undefined, supportedColors: string | undefined): Rgb | undefined;
