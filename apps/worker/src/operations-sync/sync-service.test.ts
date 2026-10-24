import { describe, it, expect } from 'vitest';
import { OperationsSyncService, type SyncLogger } from './sync-service';
import { SourceCircuitBreaker } from './resilience';
import { OperationsSourceClient, type FetchLike } from './source-client';
import { FakeStore, jsonResponse, reportBody, TEST_PASSWORD } from './test-support';

const ID = 'shapoorji-2025-92';

const silent: SyncLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };
const logged: unknown[] = [];
const recording: SyncLogger = {
  info: (o, m) => logged.push([o, m]),
  warn: (o, m) => logged.push([o, m]),
  error: (o, m) => logged.push([o, m]),
};

interface Setup {
  service: OperationsSyncService;
  store: FakeStore;
  breaker: SourceCircuitBreaker;
  setNow(d: Date): void;
  fetchCalls: string[];
  responses: { report: () => Response };
}

function setup(opts: { report?: () => Response | Promise<Response>; loginResponse?: () => Response; withClient?: boolean; logger?: SyncLogger } = {}): Setup {
  let nowDate = new Date('2026-10-21T10:30:00.000Z');
  const fetchCalls: string[] = [];
  const responses = { report: opts.report ?? (() => jsonResponse(reportBody())) };
  const fetchImpl: FetchLike = async (url) => {
    fetchCalls.push(url);
    if (url.endsWith('/api/login')) return opts.loginResponse ? opts.loginResponse() : jsonResponse({}, { headers: { 'set-cookie': 'recafco_session=COOKIE-VALUE-XYZ; Max-Age=3600' } });
    return responses.report();
  };
  const store = new FakeStore();
  const breaker = new SourceCircuitBreaker({ threshold: 3, baseCooldownMs: 60_000, maxCooldownMs: 600_000, authCooldownMs: 1_800_000 }, () => nowDate.getTime());
  const client =
    opts.withClient === false
      ? null
      : new OperationsSourceClient(
          { baseUrl: 'https://source.example', username: 'u', password: TEST_PASSWORD, requestTimeoutMs: 5_000, maxResponseBytes: 100_000 },
          fetchImpl,
          () => nowDate.getTime(),
        );
  const service = new OperationsSyncService({
    store,
    client,
    breaker,
    config: { pollIntervalSeconds: 60, maxBackoffSeconds: 900, concurrency: 2, requestTimeoutMs: 5_000, tickIntervalMs: 5_000, runRetentionDays: 30, authMode: 'password', staggerMs: 0, discovery: { enabled: false, intervalMs: 900_000, excludedProjectIds: new Set(['project_b29b21f0f3fb']) } },
    logger: opts.logger ?? silent,
    owner: 'test',
    now: () => nowDate,
    random: () => 0.5,
  });
  return { service, store, breaker, setNow: (d) => (nowDate = d), fetchCalls, responses: responses as Setup['responses'] };
}

/** Runs one sync of a freshly claimed project. */
async function syncOnce(s: Setup, id = 'p1'): Promise<void> {
  const project = s.store.projects.get(id)?.claimed;
  if (!project) throw new Error('no project');
  await s.service.syncProject({ ...project });
}

describe('OperationsSyncService', () => {
  it('accepts the first response and publishes a snapshot atomically with its figures', async () => {
    const s = setup();
    s.store.addProject('p1', ID);
    await syncOnce(s);
    expect(s.store.attempts.at(-1)).toMatchObject({ outcome: 'ACCEPTED', retrieved: true, consecutiveFailures: 0 });
    expect(s.store.projects.get('p1')?.current?.totals.produced).toBe(2219);
    expect(s.store.projects.get('p1')?.snapshots).toHaveLength(1);
  });

  it('treats a repeat of the same content as a duplicate: no second snapshot, still a successful retrieval', async () => {
    const s = setup();
    s.store.addProject('p1', ID);
    await syncOnce(s);
    s.responses.report = () => jsonResponse(reportBody({ generated_at: '2026-10-21T10:26:00+00:00' }));
    await syncOnce(s);
    expect(s.store.attempts.at(-1)).toMatchObject({ outcome: 'UNCHANGED', retrieved: true });
    expect(s.store.projects.get('p1')?.snapshots).toHaveLength(1);
    expect(s.store.projects.get('p1')?.lastGeneratedAt?.toISOString()).toBe('2026-10-21T10:26:00.000Z');
  });

  it('accepts a legitimate correction that LOWERS figures, and flags it (not rejects it)', async () => {
    const s = setup();
    s.store.addProject('p1', ID);
    await syncOnce(s);
    s.responses.report = () => jsonResponse(reportBody({ totals: { total: 2700, issued: 2700, produced: 2150 }, generated_at: '2026-10-21T10:30:00+00:00' }));
    await syncOnce(s);
    const p = s.store.projects.get('p1');
    expect(s.store.attempts.at(-1)?.outcome).toBe('ACCEPTED');
    expect(p?.current?.totals.total).toBe(2700);
    expect(p?.snapshots.at(-1)?.flags).toContain('FIGURE_DECREASED');
  });

  it('ignores an OLDER response and keeps the newer accepted data', async () => {
    const s = setup();
    s.store.addProject('p1', ID);
    s.responses.report = () => jsonResponse(reportBody({ totals: { produced: 2300 }, generated_at: '2026-10-21T10:29:00+00:00' }));
    await syncOnce(s);
    s.responses.report = () => jsonResponse(reportBody({ totals: { produced: 2000 }, generated_at: '2026-10-21T10:10:00+00:00' }));
    await syncOnce(s);
    expect(s.store.attempts.at(-1)?.outcome).toBe('REJECTED_OLDER');
    expect(s.store.projects.get('p1')?.current?.totals.produced).toBe(2300);
    expect(s.store.projects.get('p1')?.snapshots).toHaveLength(1);
  });

  it('keeps the previous snapshot when the response is malformed, and counts a failure', async () => {
    const s = setup();
    s.store.addProject('p1', ID);
    await syncOnce(s);
    const before = s.store.projects.get('p1')?.current;
    s.responses.report = () => jsonResponse({ project: { id: ID }, totals: { total: 5 }, generated_at: '2026-10-21T10:40:00+00:00' });
    await syncOnce(s);
    expect(s.store.attempts.at(-1)).toMatchObject({ outcome: 'REJECTED_INVALID', consecutiveFailures: 1, retrieved: false });
    expect(s.store.projects.get('p1')?.current).toEqual(before);
    expect(s.store.projects.get('p1')?.snapshots).toHaveLength(1);
  });

  it('does not use a response that belongs to another project (project isolation)', async () => {
    const s = setup();
    s.store.addProject('p1', ID);
    s.responses.report = () => jsonResponse(reportBody({ project: { id: 'another-project' } }));
    await syncOnce(s);
    expect(s.store.attempts.at(-1)?.outcome).toBe('REJECTED_INVALID');
    expect(s.store.projects.get('p1')?.current).toBeNull();
  });

  it('never turns a failed request into zero progress', async () => {
    const s = setup();
    s.store.addProject('p1', ID);
    await syncOnce(s);
    s.responses.report = () => new Response('', { status: 502 });
    await syncOnce(s);
    expect(s.store.projects.get('p1')?.current?.totals.produced).toBe(2219);
    expect(s.store.attempts.at(-1)).toMatchObject({ outcome: 'SOURCE_ERROR', retrieved: false });
  });

  it('recovers from an expired session transparently', async () => {
    let n = 0;
    const s = setup({ report: () => (++n === 1 ? new Response('', { status: 401 }) : jsonResponse(reportBody())) });
    s.store.addProject('p1', ID);
    await syncOnce(s);
    expect(s.store.attempts.at(-1)?.outcome).toBe('ACCEPTED');
    expect(s.fetchCalls.filter((u) => u.endsWith('/api/login'))).toHaveLength(2);
  });

  it('records a timeout, backs off, and recovers on the next success', async () => {
    const hang: FetchLike = (_u, init) =>
      new Promise((_r, reject) => init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('t'), { name: 'TimeoutError' }))));
    // Build a service whose client times out quickly.
    const store = new FakeStore();
    store.addProject('p1', ID);
    let nowMs = Date.parse('2026-10-21T10:30:00Z');
    const breaker = new SourceCircuitBreaker({ threshold: 3, baseCooldownMs: 60_000, maxCooldownMs: 600_000, authCooldownMs: 1_800_000 }, () => nowMs);
    let fetchImpl: FetchLike = hang;
    const client = new OperationsSourceClient({ baseUrl: 'https://s', username: 'u', password: 'p', requestTimeoutMs: 20, maxResponseBytes: 100_000 }, (u, i) => fetchImpl(u, i), () => nowMs);
    const service = new OperationsSyncService({
      store, client, breaker,
      config: { pollIntervalSeconds: 60, maxBackoffSeconds: 900, concurrency: 2, requestTimeoutMs: 20, tickIntervalMs: 5_000, runRetentionDays: 30, authMode: 'password', staggerMs: 0, discovery: { enabled: false, intervalMs: 900_000, excludedProjectIds: new Set(['project_b29b21f0f3fb']) } },
      logger: silent, owner: 't', now: () => new Date(nowMs), random: () => 0.5,
    });
    const claimed = store.projects.get('p1')?.claimed;
    if (!claimed) throw new Error('x');
    await service.syncProject({ ...claimed });
    const failed = store.attempts.at(-1);
    expect(failed).toMatchObject({ outcome: 'TIMEOUT', consecutiveFailures: 1 });
    expect((failed?.nextAttemptAt.getTime() ?? 0) - nowMs).toBe(120_000); // first backoff step

    fetchImpl = async (url) => (url.endsWith('/api/login') ? jsonResponse({}, { headers: { 'set-cookie': 'recafco_session=a; Max-Age=3600' } }) : jsonResponse(reportBody()));
    nowMs += 120_000;
    const again = store.projects.get('p1')?.claimed;
    if (!again) throw new Error('x');
    await service.syncProject({ ...again });
    expect(store.attempts.at(-1)).toMatchObject({ outcome: 'ACCEPTED', consecutiveFailures: 0 });
    expect(breaker.isOpen()).toBe(false);
  });

  it('pauses ALL calls after sustained failure and resumes with one probe', async () => {
    const s = setup({ report: () => new Response('', { status: 503 }) });
    for (const id of ['p1', 'p2', 'p3', 'p4']) s.store.addProject(id, `${ID}-${id}`);
    await syncOnce(s, 'p1');
    await syncOnce(s, 'p2');
    await syncOnce(s, 'p3');
    expect(s.breaker.isOpen()).toBe(true);
    const callsBefore = s.fetchCalls.length;
    await syncOnce(s, 'p4'); // breaker open: no external call, lease released
    expect(s.fetchCalls.length).toBe(callsBefore);
    expect(s.store.releasedLeases).toContain('p4');
    // After the cooldown a probe goes out again.
    s.setNow(new Date('2026-10-21T10:32:00.000Z'));
    s.responses.report = () => jsonResponse(reportBody({ project: { id: `${ID}-p4` } }));
    await syncOnce(s, 'p4');
    expect(s.store.attempts.at(-1)?.outcome).toBe('ACCEPTED');
    expect(s.breaker.isOpen()).toBe(false);
  });

  it('stops after a rejected sign-in: no login retry loop', async () => {
    const s = setup({ loginResponse: () => new Response('', { status: 401 }) });
    s.store.addProject('p1', ID);
    s.store.addProject('p2', `${ID}-2`);
    await syncOnce(s, 'p1');
    expect(s.store.attempts.at(-1)?.outcome).toBe('AUTH_FAILED');
    expect(s.breaker.state()).toMatchObject({ open: true, reason: 'AUTH' });
    const logins = s.fetchCalls.filter((u) => u.endsWith('/api/login')).length;
    await syncOnce(s, 'p2');
    expect(s.fetchCalls.filter((u) => u.endsWith('/api/login')).length).toBe(logins);
  });

  it('a 403 or 404 on one project does not pause the others', async () => {
    const s = setup({ report: () => new Response('', { status: 403 }) });
    s.store.addProject('p1', ID);
    await syncOnce(s);
    expect(s.store.attempts.at(-1)?.outcome).toBe('FORBIDDEN');
    expect(s.breaker.isOpen()).toBe(false);
    s.responses.report = () => new Response('', { status: 404 });
    await syncOnce(s);
    expect(s.store.attempts.at(-1)?.outcome).toBe('NOT_FOUND');
    expect(s.breaker.isOpen()).toBe(false);
  });

  it('does not run the same project twice at once', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    const s = setup({ report: async () => { await gate; return jsonResponse(reportBody()); } });
    s.store.addProject('p1', ID);
    const claimed = s.store.projects.get('p1')?.claimed;
    if (!claimed) throw new Error('x');
    const a = s.service.syncProject({ ...claimed });
    const b = s.service.syncProject({ ...claimed });
    release();
    await Promise.all([a, b]);
    expect(s.store.attempts).toHaveLength(1);
  });

  it('attempts an automatic link only for projects that are not linked yet', async () => {
    const s = setup();
    s.store.addProject('p1', ID, null);
    s.store.addProject('p2', `${ID}-2`, 'contract-1');
    s.responses.report = () => jsonResponse(reportBody({ project: { id: ID } }));
    await syncOnce(s, 'p1');
    s.responses.report = () => jsonResponse(reportBody({ project: { id: `${ID}-2` } }));
    await syncOnce(s, 'p2');
    expect(s.store.autoLinkCalls).toEqual(['p1']);
  });

  it('makes NO external call and reports NOT_CONFIGURED without credentials', async () => {
    const s = setup({ withClient: false });
    s.store.addProject('p1', ID);
    await s.service.tick();
    expect(s.fetchCalls).toHaveLength(0);
    expect(s.store.attempts).toHaveLength(0);
    expect(s.store.statuses.at(-1)).toMatchObject({ connectionState: 'NOT_CONFIGURED' });
  });

  it('tick claims due projects, respects concurrency, and writes an OK status', async () => {
    const s = setup();
    for (const id of ['p1', 'p2', 'p3']) s.store.addProject(id, id === 'p1' ? ID : `${ID}-${id}`);
    s.responses.report = () => jsonResponse(reportBody());
    await s.service.tick();
    // concurrency = 2: only two were claimed this tick (p2/p3 answers belong to other ids -> rejected_invalid)
    expect(s.store.attempts).toHaveLength(2);
    expect(s.store.due).toEqual(['p3']);
    expect(s.store.statuses.at(-1)?.connectionState).toBe('OK');
  });

  it('never writes the password or session cookie into stored attempts, statuses or logs', async () => {
    const s = setup({ logger: recording, report: () => new Response('boom', { status: 500 }) });
    s.store.addProject('p1', ID);
    await syncOnce(s);
    await s.service.tick();
    const dump = JSON.stringify([s.store.attempts, s.store.statuses, logged]);
    expect(dump).not.toContain(TEST_PASSWORD);
    expect(dump).not.toContain('recafco_session');
    expect(dump).not.toContain('COOKIE-VALUE-XYZ');
  });
});
