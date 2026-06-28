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
export function toInt(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const cleaned = value.trim().replace(/%$/, '');
    const n = Number.parseFloat(cleaned);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
  }
  return fallback;
}

/** Parse a Luup value into a float. */
export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const n = Number.parseFloat(value.trim().replace(/%$/, ''));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/** Parse a Luup boolean-ish value ("1"/"0"/1/0/true/false). */
export function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'on';
  }
  return false;
}

/** Parse a Luup id/category that may be a string or number into a string key. */
export function toIdString(value: unknown): string {
  return String(value).trim();
}

/** Clamp a 0-100 percentage. */
export function clampPercent(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Fahrenheit -> Celsius. */
export function fToC(f: number): number {
  return round1(((f - 32) * 5) / 9);
}

/** Celsius -> Fahrenheit. */
export function cToF(c: number): number {
  return round1((c * 9) / 5 + 32);
}

/** Normalise a controller temperature to Celsius (HomeKit requires Celsius). */
export function toCelsius(value: unknown, unit: 'C' | 'F'): number {
  const n = toNumber(value);
  return unit === 'F' ? fToC(n) : round1(n);
}

/** Convert a HomeKit Celsius value to the controller's native unit for a setpoint. */
export function fromCelsius(celsius: number, unit: 'C' | 'F'): number {
  return unit === 'F' ? cToF(celsius) : round1(celsius);
}

/**
 * Parse Vera `Color1` colour into RGB.
 *
 * `CurrentColor` looks like `"0=0,1=0,2=255,3=0,4=128"` where each entry is
 * `channelIndex=value`. `SupportedColors` names the channels in order, e.g.
 * `"W,D,R,G,B"`. We locate the R/G/B channels by name and read their values.
 * Returns `undefined` if the device does not expose R/G/B channels.
 */
export function parseVeraColor(
  currentColor: string | undefined,
  supportedColors: string | undefined,
): Rgb | undefined {
  if (!currentColor || !supportedColors) {
    return undefined;
  }

  const channels = supportedColors.split(',').map((c) => c.trim().toUpperCase());
  const rIdx = channels.indexOf('R');
  const gIdx = channels.indexOf('G');
  const bIdx = channels.indexOf('B');
  if (rIdx < 0 || gIdx < 0 || bIdx < 0) {
    return undefined;
  }

  const values = new Map<number, number>();
  for (const part of currentColor.split(',')) {
    const [idxRaw, valRaw] = part.split('=');
    if (valRaw === undefined) {
      continue;
    }
    values.set(toInt(idxRaw), toInt(valRaw));
  }

  return {
    r: values.get(rIdx) ?? 0,
    g: values.get(gIdx) ?? 0,
    b: values.get(bIdx) ?? 0,
  };
}
