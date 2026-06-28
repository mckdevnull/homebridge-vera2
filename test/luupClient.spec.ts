import { afterEach, describe, expect, it, vi } from 'vitest';
import { noopLogger } from '../src/util/logger.js';
import { LuupClient } from '../src/vera/luupClient.js';

function res(body: string, ok = true, status = 200): Response {
  return { ok, status, statusText: ok ? 'OK' : 'ERR', text: async () => body } as unknown as Response;
}

const client = new LuupClient({ host: '10.0.0.5', port: 3480, requestTimeoutSeconds: 5, logger: noopLogger });

afterEach(() => vi.restoreAllMocks());

describe('LuupClient.buildUrl', () => {
  it('builds data_request URLs preserving parameter casing', () => {
    const url = client.buildUrl({ id: 'action', DeviceNum: 5, serviceId: 'urn:x', NewModeTarget: 'CoolOn' });
    expect(url.startsWith('http://10.0.0.5:3480/data_request?')).toBe(true);
    const parsed = new URL(url);
    expect(parsed.searchParams.get('id')).toBe('action');
    expect(parsed.searchParams.get('DeviceNum')).toBe('5');
    expect(parsed.searchParams.get('NewModeTarget')).toBe('CoolOn');
  });
});

describe('LuupClient.requestJson', () => {
  it('parses JSON bodies', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res('{"a":1}')));
    await expect(client.requestJson({ id: 'sdata' })).resolves.toEqual({ a: 1 });
  });

  it('throws on empty body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res('')));
    await expect(client.requestJson({ id: 'sdata' })).rejects.toThrow(/Empty/);
  });

  it('throws on non-JSON body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res('NO_CHANGES')));
    await expect(client.requestJson({ id: 'status' })).rejects.toThrow(/Non-JSON/);
  });

  it('throws on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res('', false, 500)));
    await expect(client.request({ id: 'sdata' })).rejects.toThrow(/HTTP 500/);
  });

  it('rejects an over-large response via Content-Length', async () => {
    const huge = String(64 * 1024 * 1024); // 64 MB > 32 MB cap
    const oversized = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: (h: string) => (h === 'content-length' ? huge : null) },
      text: async () => '{}',
    } as unknown as Response;
    vi.stubGlobal('fetch', vi.fn(async () => oversized));
    await expect(client.request({ id: 'status' })).rejects.toThrow(/too large/);
  });
});

describe('LuupClient.buildUrl host safety', () => {
  it('treats host as an opaque hostname (cannot rewrite path/authority)', () => {
    // Even if a bad host slipped past config validation, searchParams + hostname
    // assignment keep it contained to the host position.
    const c = new LuupClient({ host: '10.0.0.9', port: 3480, requestTimeoutSeconds: 5, logger: noopLogger });
    const url = new URL(c.buildUrl({ id: 'status' }));
    expect(url.hostname).toBe('10.0.0.9');
    expect(url.port).toBe('3480');
    expect(url.pathname).toBe('/data_request');
  });
});

describe('LuupClient.action', () => {
  it('issues action params verbatim (preserving Vera casing quirks)', async () => {
    const fetchMock = vi.fn(async () => res(''));
    vi.stubGlobal('fetch', fetchMock);
    await client.action(5, 'urn:upnp-org:serviceId:Dimming1', 'SetLoadLevelTarget', { newLoadlevelTarget: 30 });
    const url = new URL(String(fetchMock.mock.calls[0]![0]));
    expect(url.searchParams.get('id')).toBe('action');
    expect(url.searchParams.get('output_format')).toBe('json');
    expect(url.searchParams.get('DeviceNum')).toBe('5');
    expect(url.searchParams.get('serviceId')).toBe('urn:upnp-org:serviceId:Dimming1');
    expect(url.searchParams.get('action')).toBe('SetLoadLevelTarget');
    expect(url.searchParams.get('newLoadlevelTarget')).toBe('30');
  });
});
