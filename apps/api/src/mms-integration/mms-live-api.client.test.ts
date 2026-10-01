import { describe, it, expect, vi, beforeEach } from 'vitest';

const KEY = 'test-integration-key-0123456789-abcdefghij';
const env = {
  mmsBaseUrl: 'http://192.168.1.17:81',
  mmsLiveDashboardEndpoint: '/api/integrations/fmp/maintenance-dashboard/live',
  mmsIntegrationKey: KEY as string | null,
  mmsQueryTimeoutMs: 8000,
};
vi.mock('../env', () => ({ getApiEnv: () => env }));

import { MmsLiveApiClient, MMS_INTEGRATION_KEY_HEADER, describeFetchError } from './mms-live-api.client';

const mockFetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();

function client(): MmsLiveApiClient {
  const c = new MmsLiveApiClient();
  (c as unknown as { fetchImpl: typeof mockFetch }).fetchImpl = mockFetch;
  return c;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  vi.clearAllMocks();
  env.mmsIntegrationKey = KEY;
});

describe('MmsLiveApiClient.fetchLiveDashboard', () => {
  it('does not call MMS when the integration key is not configured', async () => {
    env.mmsIntegrationKey = null;
    expect(await client().fetchLiveDashboard('a@b.com')).toEqual({ kind: 'not_configured' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('GETs the configured endpoint with the key header, userEmail, and no redirect following', async () => {
    mockFetch.mockResolvedValue(json({ source: 'MMS_LIVE' }));
    const result = await client().fetchLiveDashboard('mgr@recafco.com');
    expect(result).toEqual({ kind: 'ok', body: { source: 'MMS_LIVE' } });

    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe('http://192.168.1.17:81/api/integrations/fmp/maintenance-dashboard/live?userEmail=mgr%40recafco.com');
    expect(init.method).toBe('GET');
    expect(init.redirect).toBe('manual');
    expect((init.headers as Record<string, string>)[MMS_INTEGRATION_KEY_HEADER]).toBe(KEY);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('omits userEmail when the FMP user has none', async () => {
    mockFetch.mockResolvedValue(json({}));
    await client().fetchLiveDashboard(null);
    expect(mockFetch.mock.calls[0]![0]).not.toContain('userEmail');
  });

  it.each([
    [401, { kind: 'auth_error', httpStatus: 401 }],
    [403, { kind: 'auth_error', httpStatus: 403 }],
    [400, { kind: 'bad_request' }],
  ])('maps HTTP %i', async (status, expected) => {
    mockFetch.mockResolvedValue(json({ error: 'x' }, status));
    expect(await client().fetchLiveDashboard(null)).toEqual(expected);
  });

  it('maps 503 / 404 / redirect-to-login to not_enabled', async () => {
    mockFetch.mockResolvedValueOnce(json({ error: 'FMP integration is not configured.' }, 503));
    expect((await client().fetchLiveDashboard(null)).kind).toBe('not_enabled');
    mockFetch.mockResolvedValueOnce(json({}, 404));
    expect((await client().fetchLiveDashboard(null)).kind).toBe('not_enabled');
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 307, headers: { Location: '/login' } }));
    const redirected = await client().fetchLiveDashboard(null);
    expect(redirected.kind).toBe('not_enabled');
    expect(JSON.stringify(redirected)).toContain('live endpoint not deployed on MMS yet');
  });

  it('maps 500, non-JSON, network failure, and timeout to unavailable', async () => {
    mockFetch.mockResolvedValueOnce(json({ source: 'MMS_LIVE', online: false }, 500));
    expect(await client().fetchLiveDashboard(null)).toEqual({ kind: 'unavailable', reason: 'MMS returned HTTP 500' });

    mockFetch.mockResolvedValueOnce(new Response('<html>', { status: 200 }));
    expect(await client().fetchLiveDashboard(null)).toEqual({ kind: 'unavailable', reason: 'MMS returned a non-JSON response' });

    mockFetch.mockRejectedValueOnce(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }));
    expect(await client().fetchLiveDashboard(null)).toEqual({ kind: 'unavailable', reason: 'connection refused' });

    mockFetch.mockRejectedValueOnce(Object.assign(new Error('timeout'), { name: 'TimeoutError' }));
    expect(await client().fetchLiveDashboard(null)).toEqual({ kind: 'unavailable', reason: 'request timed out' });
  });

  it('never includes the key in any failure result', async () => {
    const failures = [
      json({}, 401),
      json({}, 403),
      json({}, 500),
      json({}, 503),
      new Response(null, { status: 307 }),
    ];
    for (const res of failures) {
      mockFetch.mockResolvedValueOnce(res);
      expect(JSON.stringify(await client().fetchLiveDashboard(null))).not.toContain(KEY);
    }
  });
});

describe('describeFetchError', () => {
  it('returns a credential-free category', () => {
    expect(describeFetchError({ cause: { code: 'ENOTFOUND' } })).toBe('host not found');
    expect(describeFetchError({ cause: { code: 'EHOSTUNREACH' } })).toBe('host unreachable');
    expect(describeFetchError(new Error(`bad ${KEY}`))).toBe('network error');
  });
});
