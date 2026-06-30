import { describe, it, expect, vi, afterEach } from 'vitest';
import { getApiHealth } from './api';

describe('getApiHealth', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns ok result when API responds with valid health data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { status: 'ok', service: 'recafco-fmp-api' } }),
      }),
    );

    const result = await getApiHealth('http://localhost:4000');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe('ok');
      expect(result.data.service).toBe('recafco-fmp-api');
    }
  });

  it('returns error result when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const result = await getApiHealth('http://localhost:4000');
    expect(result.ok).toBe(false);
  });

  it('returns error result when API returns non-ok status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );

    const result = await getApiHealth('http://localhost:4000');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('503');
  });

  it('returns error result when response shape is unexpected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { status: 'degraded' } }),
      }),
    );

    const result = await getApiHealth('http://localhost:4000');
    expect(result.ok).toBe(false);
  });
});
