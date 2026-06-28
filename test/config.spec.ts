import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config.js';

describe('parseConfig', () => {
  it('throws when host is missing', () => {
    expect(() => parseConfig({})).toThrow(/host/);
  });

  it('applies defaults', () => {
    const c = parseConfig({ host: '192.168.1.50' });
    expect(c).toMatchObject({
      host: '192.168.1.50',
      port: 3480,
      pollTimeoutSeconds: 30,
      pollMinimumDelayMs: 200,
      requestTimeoutSeconds: 10,
      hideScenes: false,
      hideHouseMode: false,
      exposeArmDisarm: false,
      includeDeviceIds: [],
      excludeDeviceIds: [],
      debug: false,
      name: 'Vera2',
    });
  });

  it('clamps out-of-range numbers', () => {
    const c = parseConfig({ host: 'vera', port: 999999, pollTimeoutSeconds: 1, requestTimeoutSeconds: 9999 });
    expect(c.port).toBe(65535);
    expect(c.pollTimeoutSeconds).toBe(5);
    expect(c.requestTimeoutSeconds).toBe(60);
  });

  it('normalises device id lists to strings', () => {
    const c = parseConfig({ host: 'vera', includeDeviceIds: [5, '6', ' 7 '], excludeDeviceIds: [8] });
    expect(c.includeDeviceIds).toEqual(['5', '6', '7']);
    expect(c.excludeDeviceIds).toEqual(['8']);
  });
});
