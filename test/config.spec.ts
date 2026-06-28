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

  it('accepts bare IPs and hostnames', () => {
    expect(parseConfig({ host: '192.168.1.50' }).host).toBe('192.168.1.50');
    expect(parseConfig({ host: 'vera.local' }).host).toBe('vera.local');
    expect(parseConfig({ host: '[fe80::1]' }).host).toBe('[fe80::1]');
  });

  it('rejects malformed hosts (scheme, path, port, credentials, spaces)', () => {
    for (const host of [
      'http://192.168.1.50',
      '192.168.1.50/',
      '192.168.1.50:3480',
      'evil.com/@10.0.0.1',
      'attacker.com#@192.168.1.50',
      'user:pass@10.0.0.1',
      'has space',
    ]) {
      expect(() => parseConfig({ host }), host).toThrow(/Invalid "host"/);
    }
  });
});
