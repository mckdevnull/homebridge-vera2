import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config.js';
import { noopLogger } from '../src/util/logger.js';
import { createBackend } from '../src/vera/backend.js';
import { LuupBackend } from '../src/vera/luupBackend.js';

describe('createBackend', () => {
  it('returns a Luup backend for local config', () => {
    const config = parseConfig({ host: '10.0.0.1' });
    const backend = createBackend(config, noopLogger);
    expect(backend).toBeInstanceOf(LuupBackend);
    expect(backend.temperatureUnit).toBe('C');
  });
});
