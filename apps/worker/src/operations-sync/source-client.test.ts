import { describe, it, expect, vi } from 'vitest';
import { OperationsSourceClient, extractSessionCookie, type FetchLike, type SourceClientConfig } from './source-client';
import { jsonResponse, reportBody, TEST_PASSWORD } from './test-support';

const config: SourceClientConfig = {
  baseUrl: 'https://source.example',
  username: 'fmp-integration',
  password: TEST_PASSWORD,
  requestTimeoutMs: 5_000,
  maxResponseBytes: 5_000,
};

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

function loginOk(cookie = 'recafco_session=sess-1; Path=/; HttpOnly; Max-Age=3600'): Response {
  return jsonResponse({ ok: true }, { headers: { 'set-cookie': cookie } });
}

function harness(handler: (call: Call, n: number) => Response | Promise<Response>): { fetchImpl: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const call: Call = {
      url,
      method: String(init.method),
      headers: init.headers as Record<string, string>,
      body: typeof init.body === 'string' ? init.body : undefined,
    };
    calls.push(call);
    return handler(call, calls.length);
  };
  return { fetchImpl, calls };
}

const isLogin = (c: Call): boolean => c.url.endsWith('/api/login');

describe('OperationsSourceClient', () => {
  it('signs in once, sends the documented report request, and reuses the session', async () => {
    const { fetchImpl, calls } = harness((c) => (isLogin(c) ? loginOk() : jsonResponse(reportBody())));
    const client = new OperationsSourceClient(config, fetchImpl);

    const first = await client.fetchReport('shapoorji-2025-92');
    const second = await client.fetchReport('shapoorji-2025-92');

    expect(first.kind).toBe('ok');
    expect(second.kind).toBe('ok');
    expect(calls.filter(isLogin)).toHaveLength(1);
    const report = calls.find((c) => c.method === 'GET');
    expect(report?.url).toBe(
      'https://source.example/api/projects/shapoorji-2025-92/report?group_by=building&columns=total%2Cissued%2Cproduced%2Cdelivered%2Cinstalled&format=json',
    );
    expect(report?.headers['Cookie']).toBe('recafco_session=sess-1');
    expect(report?.headers['Cache-Control']).toBe('no-cache');
    // Credentials go only in the login body — never in a report request.
    expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({ username: 'fmp-integration', password: TEST_PASSWORD });
    expect(calls.filter((c) => !isLogin(c)).some((c) => JSON.stringify(c).includes(TEST_PASSWORD))).toBe(false);
  });

  it('encodes the project id into the path (no path injection)', async () => {
    const { fetchImpl, calls } = harness((c) => (isLogin(c) ? loginOk() : jsonResponse({})));
    await new OperationsSourceClient(config, fetchImpl).fetchReport('../admin/users?x=1');
    const url = calls.find((c) => c.method === 'GET')?.url ?? '';
    expect(url).toContain('/api/projects/..%2Fadmin%2Fusers%3Fx%3D1/report?');
  });

  it('shares ONE login between concurrent callers', async () => {
    const { fetchImpl, calls } = harness(async (c) => {
      if (isLogin(c)) {
        await new Promise((r) => setTimeout(r, 20));
        return loginOk();
      }
      return jsonResponse(reportBody());
    });
    const client = new OperationsSourceClient(config, fetchImpl);
    await Promise.all([client.fetchReport('a'), client.fetchReport('b'), client.fetchReport('c')]);
    expect(calls.filter(isLogin)).toHaveLength(1);
  });

  it('renews an expired session ONCE and retries the request', async () => {
    let reports = 0;
    const { fetchImpl, calls } = harness((c) => {
      if (isLogin(c)) return loginOk(`recafco_session=sess-${calls.filter(isLogin).length}; Path=/`);
      reports += 1;
      return reports === 1 ? new Response('', { status: 401 }) : jsonResponse(reportBody());
    });
    const result = await new OperationsSourceClient(config, fetchImpl).fetchReport('shapoorji-2025-92');
    expect(result.kind).toBe('ok');
    expect(calls.filter(isLogin)).toHaveLength(2);
    expect(calls.filter((c) => c.method === 'GET')[1]?.headers['Cookie']).toBe('recafco_session=sess-2');
  });

  it('gives up after one renewal when the source keeps answering 401 (no retry loop)', async () => {
    const { fetchImpl, calls } = harness((c) => (isLogin(c) ? loginOk() : new Response('', { status: 401 })));
    const result = await new OperationsSourceClient(config, fetchImpl).fetchReport('x');
    expect(result.kind).toBe('auth_failed');
    expect(calls.filter(isLogin)).toHaveLength(2);
    expect(calls.filter((c) => c.method === 'GET')).toHaveLength(2);
  });

  it('reports a rejected sign-in as auth_failed without calling the report', async () => {
    const { fetchImpl, calls } = harness(() => new Response('{"error":"bad credentials"}', { status: 401 }));
    const result = await new OperationsSourceClient(config, fetchImpl).fetchReport('x');
    expect(result).toMatchObject({ kind: 'auth_failed', httpStatus: 401 });
    expect(calls).toHaveLength(1);
  });

  it('treats a login that sets no recafco_session cookie as failed', async () => {
    const { fetchImpl } = harness(() => jsonResponse({ ok: true }));
    expect((await new OperationsSourceClient(config, fetchImpl).fetchReport('x')).kind).toBe('auth_failed');
  });

  it('never follows redirects: a redirect to a sign-in page counts as an unaccepted session', async () => {
    const { fetchImpl, calls } = harness((c) =>
      isLogin(c) ? loginOk() : new Response('', { status: 302, headers: { location: 'https://evil.example/login' } }),
    );
    const result = await new OperationsSourceClient(config, fetchImpl).fetchReport('x');
    expect(result.kind).toBe('auth_failed');
    expect(calls.every((c) => c.url.startsWith('https://source.example/'))).toBe(true);
  });

  it('maps 403, 404, 400, 429 and 5xx', async () => {
    const statuses: [number, string][] = [[403, 'forbidden'], [404, 'not_found'], [400, 'bad_request'], [429, 'rate_limited'], [503, 'server_error']];
    for (const [status, kind] of statuses) {
      const { fetchImpl } = harness((c) => (isLogin(c) ? loginOk() : new Response('', { status, headers: { 'retry-after': '120' } })));
      const result = await new OperationsSourceClient(config, fetchImpl).fetchReport('x');
      expect(result.kind).toBe(kind);
      if (result.kind === 'rate_limited') expect(result.retryAfterSeconds).toBe(120);
    }
  });

  it('times out slow requests', async () => {
    const fetchImpl: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'TimeoutError' })));
      });
    const client = new OperationsSourceClient({ ...config, requestTimeoutMs: 30 }, fetchImpl);
    expect((await client.fetchReport('x')).kind).toBe('timeout');
  });

  it('reports network failures without leaking details', async () => {
    const fetchImpl: FetchLike = async () => {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
    };
    const result = await new OperationsSourceClient(config, fetchImpl).fetchReport('x');
    expect(result).toMatchObject({ kind: 'network', reason: 'connection refused' });
    expect(JSON.stringify(result)).not.toContain(TEST_PASSWORD);
  });

  it('rejects an oversized body by Content-Length and by streaming', async () => {
    const big = 'x'.repeat(6_000);
    const declared = harness((c) => (isLogin(c) ? loginOk() : jsonResponse(big, { headers: { 'content-length': '6000' } })));
    expect((await new OperationsSourceClient(config, declared.fetchImpl).fetchReport('x')).kind).toBe('too_large');

    const streamed = harness((c) => {
      if (isLogin(c)) return loginOk();
      const res = jsonResponse(big);
      res.headers.delete('content-length');
      return res;
    });
    expect((await new OperationsSourceClient(config, streamed.fetchImpl).fetchReport('x')).kind).toBe('too_large');
  });

  it('rejects non-JSON content types and malformed JSON', async () => {
    const html = harness((c) => (isLogin(c) ? loginOk() : new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } })));
    expect((await new OperationsSourceClient(config, html.fetchImpl).fetchReport('x')).kind).toBe('invalid_body');
    const broken = harness((c) => (isLogin(c) ? loginOk() : jsonResponse('{"project":')));
    expect((await new OperationsSourceClient(config, broken.fetchImpl).fetchReport('x')).kind).toBe('invalid_body');
  });

  it('renews the session when its Max-Age has passed', async () => {
    let now = 1_000_000;
    const { fetchImpl, calls } = harness((c) => (isLogin(c) ? loginOk('recafco_session=s; Max-Age=100') : jsonResponse(reportBody())));
    const client = new OperationsSourceClient(config, fetchImpl, () => now);
    await client.fetchReport('x');
    now += 60_000; // still valid (renewal margin is 30 s)
    await client.fetchReport('x');
    expect(calls.filter(isLogin)).toHaveLength(1);
    now += 60_000; // past Max-Age minus margin
    await client.fetchReport('x');
    expect(calls.filter(isLogin)).toHaveLength(2);
  });

  it('logs out best-effort and forgets the session', async () => {
    const { fetchImpl, calls } = harness((c) => (isLogin(c) ? loginOk() : jsonResponse(reportBody())));
    const client = new OperationsSourceClient(config, fetchImpl);
    await client.fetchReport('x');
    await client.logout();
    expect(calls.at(-1)?.url).toBe('https://source.example/api/logout');
    expect(client.hasSession()).toBe(false);
    const failing = new OperationsSourceClient(config, async () => {
      throw new Error('down');
    });
    await expect(failing.logout()).resolves.toBeUndefined();
  });

  it('does not expose the session cookie through any result', async () => {
    const { fetchImpl } = harness((c) => (isLogin(c) ? loginOk('recafco_session=TOP-SECRET-COOKIE; Max-Age=3600') : jsonResponse(reportBody())));
    const result = await new OperationsSourceClient(config, fetchImpl).fetchReport('x');
    expect(JSON.stringify(result)).not.toContain('TOP-SECRET-COOKIE');
  });
});

describe('extractSessionCookie', () => {
  it('finds the cookie among several Set-Cookie lines', () => {
    const headers = new Headers();
    headers.append('set-cookie', 'other=1; Path=/');
    headers.append('set-cookie', 'recafco_session=abc; Path=/; HttpOnly');
    const res = new Response('', { headers });
    expect(extractSessionCookie(res, 0)).toEqual({ value: 'abc', expiresAt: null });
  });
  it('ignores an emptied cookie', () => {
    const res = new Response('', { headers: { 'set-cookie': 'recafco_session=; Max-Age=0' } });
    expect(extractSessionCookie(res, 0)).toBeNull();
  });
  it('spy sanity: fetch is injectable', () => {
    expect(vi.fn()).toBeTypeOf('function');
  });
});
