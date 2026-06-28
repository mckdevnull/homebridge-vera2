import { describe, expect, it } from 'vitest';
import {
  cToF,
  clampPercent,
  fToC,
  fromCelsius,
  parseVeraColor,
  toBool,
  toCelsius,
  toIdString,
  toInt,
  toNumber,
} from '../src/vera/transform.js';

describe('numeric parsing', () => {
  it('parses ints defensively', () => {
    expect(toInt('10')).toBe(10);
    expect(toInt('0.0')).toBe(0);
    expect(toInt('55%')).toBe(55);
    expect(toInt(42)).toBe(42);
    expect(toInt(undefined, 7)).toBe(7);
    expect(toInt('garbage', 3)).toBe(3);
  });

  it('parses floats', () => {
    expect(toNumber('21.5')).toBe(21.5);
    expect(toNumber('nope', 1)).toBe(1);
  });

  it('parses booleans from Vera strings', () => {
    expect(toBool('1')).toBe(true);
    expect(toBool('0')).toBe(false);
    expect(toBool('true')).toBe(true);
    expect(toBool(1)).toBe(true);
    expect(toBool(undefined)).toBe(false);
  });

  it('stringifies ids consistently', () => {
    expect(toIdString(5)).toBe('5');
    expect(toIdString(' 6 ')).toBe('6');
  });

  it('clamps percentages', () => {
    expect(clampPercent(150)).toBe(100);
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(33.4)).toBe(33);
  });
});

describe('temperature conversion', () => {
  it('converts F<->C', () => {
    expect(fToC(68)).toBe(20);
    expect(fToC(32)).toBe(0);
    expect(cToF(20)).toBe(68);
  });

  it('normalises to Celsius by controller unit', () => {
    expect(toCelsius('68', 'F')).toBe(20);
    expect(toCelsius('20', 'C')).toBe(20);
  });

  it('converts back to controller unit for setpoints', () => {
    expect(fromCelsius(20, 'F')).toBe(68);
    expect(fromCelsius(20, 'C')).toBe(20);
  });
});

describe('parseVeraColor', () => {
  it('extracts RGB by channel name', () => {
    const rgb = parseVeraColor('0=0,1=0,2=255,3=128,4=64', 'W,D,R,G,B');
    expect(rgb).toEqual({ r: 255, g: 128, b: 64 });
  });

  it('returns undefined when no RGB channels', () => {
    expect(parseVeraColor('0=10,1=20', 'W,D')).toBeUndefined();
    expect(parseVeraColor(undefined, 'R,G,B')).toBeUndefined();
  });
});
