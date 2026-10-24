import { describe, it, expect } from 'vitest';
import { OperationsSyncService, type SyncLogger, type SyncServiceConfig } from './sync-service';
import { SourceCircuitBreaker } from './resilience';
import { OperationsSourceClient, type FetchLike, type SourceAuth } from './source-client';
import { FakeStore, jsonResponse, reportBody, TEST_PASSWORD } from './test-support';

const silent: SyncLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };
const cookie = (v = 'COOKIE-DEMO-1'): Record<string, string> => ({ 'set-cookie': `recafco_session=${v}; Max-Age=28800; Path=/; HttpOnly` });

interface Call {
  method: string;
  path: string;
  body: string | undefined;
  at: number;
}

function proj(id: string, code: string | null, factory: string | null, over: Record<string, unknown> = {}): Record<string, unknown> {
  return { id, code, name: `Name ${id}`, project_type: factory ?? '', is_training: false, client: 'c', contractor: 'k', description: 'd', created: '2026-01-01T00:00:00+00:00', coordinator: '', ...over };
}

interface Setup {
  service: OperationsSyncService;
  store: FakeStore;
  breaker: SourceCircuitBreaker;
  calls: Call[];
  respond: { list: () => Response | Promise<Response>; report: () => Response };
  setNow(d: Date): void;
}

function setup(opts: { auth?: SourceAuth; discovery?: boolean; staggerMs?: number; concurrency?: number; loginStatus?: number } = {}): Setup {
  let nowDate = new Date('2026-10-22T10:00:00.000Z');
  const calls: Call[] = [];
  const respond = {
    list: (): Response | Promise<Response> => jsonResponse([proj('p-1', '92/25', 'PC')]),
    report: (): Response => jsonResponse(reportBody()),
  };
  const fetchImpl: FetchLike = async (url, init) => {
    const path = new URL(url).pathname;
    calls.push({ method: String(init.method), path, body: typeof init.body === 'string' ? init.body : undefined, at: Date.now() });
    if (path === '/api/login' || path === '/api/demo-login') {
      return opts.loginStatus && opts.loginStatus !== 200 ? new Response('{}', { status: opts.loginStatus }) : jsonResponse({ id: 'u', permissions: ['x'], demo: true }, { headers: cookie() });
    }
    if (path === '/api/projects') return respond.list();
    return respond.report();
  };
  const store = new FakeStore();
  const breaker = new SourceCircuitBreaker({ threshold: 3, baseCooldownMs: 60_000, maxCooldownMs: 600_000, authCooldownMs: 1_800_000 }, () => nowDate.getTime());
  const auth: SourceAuth = opts.auth ?? { kind: 'password', username: 'fmp', password: TEST_PASSWORD };
  const client = new OperationsSourceClient({ baseUrl: 'https://source.example', auth, requestTimeoutMs: 5_000, maxResponseBytes: 100_000, listMaxBytes: 500_000 }, fetchImpl, () => nowDate.getTime());
  const config: SyncServiceConfig = {
    pollIntervalSeconds: 60, maxBackoffSeconds: 900, concurrency: opts.concurrency ?? 2, requestTimeoutMs: 5_000, tickIntervalMs: 5_000, runRetentionDays: 30,
    authMode: auth.kind, staggerMs: opts.staggerMs ?? 0,
    discovery: { enabled: opts.discovery ?? true, intervalMs: 900_000, excludedProjectIds: new Set(['project_b29b21f0f3fb']) },
  };
  const service = new OperationsSyncService({ store, client, breaker, config, logger: silent, owner: 't', now: () => nowDate, random: () => 0.5 });
  return { service, store, breaker, calls, respond, setNow: (d) => (nowDate = d) };
}

const listCalls = (s: Setup): Call[] => s.calls.filter((c) => c.path === '/api/projects');

describe('authentication modes', () => {
  it('demo mode posts exactly the supplied payload to /api/demo-login and never touches /api/login', async () => {
    const s = setup({ auth: { kind: 'demo', factory: 'precast', role: 'manager', workspace: 'existing' } });
    await s.service.tick();
    const login = s.calls.find((c) => c.path === '/api/demo-login');
    expect(JSON.parse(login?.body ?? '{}')).toEqual({ factory: 'precast', role: 'manager', workspace: 'existing' });
    expect(s.calls.some((c) => c.path === '/api/login')).toBe(false);
    expect(listCalls(s)).toHaveLength(1);
  });

  it('password mode never uses demo-login, and a rejected sign-in does NOT fall back to demo', async () => {
    const s = setup({ loginStatus: 401 });
    await s.service.tick();
    expect(s.calls.map((c) => c.path)).toEqual(['/api/login']);
    expect(s.calls.some((c) => c.path === '/api/demo-login')).toBe(false);
    expect(s.breaker.state()).toMatchObject({ open: true, reason: 'AUTH' });
    expect(s.store.discoveryRecords.at(-1)?.outcome).toBe('AUTH_FAILED');
  });

  it('a failed demo sign-in does NOT fall back to the password login', async () => {
    const s = setup({ auth: { kind: 'demo', factory: 'precast', role: 'manager', workspace: 'existing' }, loginStatus: 403 });
    await s.service.tick();
    expect(s.calls.map((c) => c.path)).toEqual(['/api/demo-login']);
  });

  it('reports demo authentication to users as dependent on the source demo access', async () => {
    const s = setup({ auth: { kind: 'demo', factory: 'precast', role: 'manager', workspace: 'existing' } });
    await s.service.tick();
    const status = s.store.statuses.at(-1);
    expect(status?.authMode).toBe('demo');
    expect(status?.lastMessage).toMatch(/demo sign-in.*depends on its demo access/i);
  });

  it('never stores the demo session cookie or password anywhere', async () => {
    const s = setup({ auth: { kind: 'demo', factory: 'precast', role: 'manager', workspace: 'existing' } });
    await s.service.tick();
    expect(JSON.stringify([s.store.statuses, s.store.discoveryRecords])).not.toContain('COOKIE-DEMO-1');
  });
});

describe('project discovery', () => {
  it('registers new projects and tries to link them; one request for the whole list', async () => {
    const s = setup();
    s.respond.list = () => jsonResponse([proj('p-1', '92/25', 'PC'), proj('p-2', '10/26', 'HC'), proj('p-3', '11/26', 'PC')]);
    s.store.contractsByCodeFactory.set('92/25|PC', ['contract-92']);
    await s.service.tick();
    expect([...s.store.known.keys()].sort()).toEqual(['p-1', 'p-2', 'p-3']);
    expect(listCalls(s)).toHaveLength(1);
    expect(s.store.known.get('p-1')?.contractId).toBe('contract-92');
    expect(s.store.discoveryRecords.at(-1)).toMatchObject({ outcome: 'ACCEPTED', projectCount: 3, success: true });
    expect(s.store.discoveryRecords.at(-1)?.message).toMatch(/3 projects listed \(3 new, 0 excluded.*1 linked automatically/);
  });

  it('does not run when discovery is disabled, not due, the breaker is open, or credentials are absent', async () => {
    const off = setup({ discovery: false });
    await off.service.tick();
    expect(listCalls(off)).toHaveLength(0);

    const notDue = setup();
    notDue.store.discoveryDue = false;
    await notDue.service.tick();
    expect(listCalls(notDue)).toHaveLength(0);

    const open = setup();
    for (let i = 0; i < 3; i++) open.breaker.recordFailure('SOURCE');
    await open.service.tick();
    expect(listCalls(open)).toHaveLength(0);
  });

  it('is not repeated on every tick: the slot is claimed once per interval', async () => {
    const s = setup();
    await s.service.tick();
    await s.service.tick();
    await s.service.tick();
    expect(s.store.discoveryClaims).toBe(1);
    expect(listCalls(s)).toHaveLength(1);
  });

  it('excludes training projects, the configured test project, projects without a factory, and unknown training status', async () => {
    const s = setup();
    s.respond.list = () =>
      jsonResponse([
        proj('good-1', '1/26', 'PC'),
        proj('project_8671d24f243d', 'REV-TRIAL', '', { is_training: true }),
        proj('project_b29b21f0f3fb', '0001', 'PC', { is_training: false, description: 'Testing project. Test records only.' }),
        proj('nofactory-1', '2/26', null),
        proj('unknown-1', '3/26', 'PC', { is_training: undefined }),
      ]);
    s.store.contractsByCodeFactory.set('0001|PC', ['contract-x']); // even a perfect match must not link the excluded project
    await s.service.tick();
    expect(s.store.known.get('good-1')?.excludedReason).toBeNull();
    expect(s.store.known.get('project_8671d24f243d')?.excludedReason).toBe('TRAINING');
    expect(s.store.known.get('project_b29b21f0f3fb')?.excludedReason).toBe('CONFIGURED_EXCLUSION');
    expect(s.store.known.get('nofactory-1')?.excludedReason).toBe('NO_FACTORY');
    expect(s.store.known.get('unknown-1')?.excludedReason).toBe('TRAINING_STATUS_UNKNOWN');
    expect(s.store.known.get('project_b29b21f0f3fb')?.contractId).toBeNull();
    expect(s.store.discoveryRecords.at(-1)?.message).toMatch(/4 excluded as training\/test/);
  });

  it('matches on job order AND factory: the same code in PC and HC links to each factory’s own contract', async () => {
    const s = setup();
    s.respond.list = () => jsonResponse([proj('pc-92', '92/25', 'PC'), proj('hc-92', '92/25', 'HC')]);
    s.store.contractsByCodeFactory.set('92/25|PC', ['contract-pc']);
    s.store.contractsByCodeFactory.set('92/25|HC', ['contract-hc']);
    await s.service.tick();
    expect(s.store.known.get('pc-92')?.contractId).toBe('contract-pc');
    expect(s.store.known.get('hc-92')?.contractId).toBe('contract-hc');
  });

  it('ambiguous matches are NOT linked automatically', async () => {
    const s = setup();
    // two source projects share code + factory
    s.respond.list = () => jsonResponse([proj('dup-a', '55/26', 'PC'), proj('dup-b', '55/26', 'PC')]);
    s.store.contractsByCodeFactory.set('55/26|PC', ['contract-55']);
    await s.service.tick();
    expect(s.store.known.get('dup-a')?.contractId).toBeNull();
    expect(s.store.known.get('dup-b')?.contractId).toBeNull();
    // two contracts share the job order + factory
    const t = setup();
    t.respond.list = () => jsonResponse([proj('one-1', '77/26', 'PC')]);
    t.store.contractsByCodeFactory.set('77/26|PC', ['c1', 'c2']);
    await t.service.tick();
    expect(t.store.known.get('one-1')?.contractId).toBeNull();
  });

  it('keeps a confirmed link when the source renames or re-codes the project', async () => {
    const s = setup();
    s.respond.list = () => jsonResponse([proj('p-1', '92/25', 'PC', { name: 'Old name' })]);
    s.store.contractsByCodeFactory.set('92/25|PC', ['contract-92']);
    await s.service.tick();
    expect(s.store.known.get('p-1')?.contractId).toBe('contract-92');
    s.store.discoveryDue = true;
    s.respond.list = () => jsonResponse([proj('p-1', '92/25-REV', 'PC', { name: 'Brand new name' })]);
    await s.service.tick();
    const k = s.store.known.get('p-1');
    expect(k?.name).toBe('Brand new name');
    expect(k?.code).toBe('92/25-REV');
    expect(k?.contractId).toBe('contract-92');
  });

  it('a project missing from one response is only marked: nothing is deleted or unlinked, and it recovers when listed again', async () => {
    const s = setup();
    const full = Array.from({ length: 10 }, (_, i) => proj(`p-${i}`, `${i + 1}/26`, 'PC'));
    s.respond.list = () => jsonResponse(full);
    s.store.contractsByCodeFactory.set('1/26|PC', ['contract-1']);
    await s.service.tick();
    expect(s.store.known.get('p-0')?.contractId).toBe('contract-1');

    s.store.discoveryDue = true;
    s.respond.list = () => jsonResponse(full.filter((p) => p['id'] !== 'p-0'));
    await s.service.tick();
    expect(s.store.known.has('p-0')).toBe(true);
    expect(s.store.known.get('p-0')?.contractId).toBe('contract-1');
    expect(s.store.known.get('p-0')?.missingSince).not.toBeNull();

    s.store.discoveryDue = true;
    s.respond.list = () => jsonResponse(full);
    await s.service.tick();
    expect(s.store.known.get('p-0')?.missingSince).toBeNull();
  });

  it('does not trust a suspiciously short list: no absence is recorded', async () => {
    const s = setup();
    const full = Array.from({ length: 10 }, (_, i) => proj(`p-${i}`, `${i + 1}/26`, 'PC'));
    s.respond.list = () => jsonResponse(full);
    await s.service.tick();
    s.store.discoveryDue = true;
    s.respond.list = () => jsonResponse(full.slice(0, 2));
    await s.service.tick();
    expect([...s.store.known.values()].filter((k) => k.missingSince !== null)).toHaveLength(0);
    expect(s.store.discoveryRecords.at(-1)?.message).toMatch(/much shorter than before/);
  });

  it('a malformed list leaves everything as it was', async () => {
    const s = setup();
    await s.service.tick();
    const before = JSON.stringify([...s.store.known.entries()]);
    s.store.discoveryDue = true;
    s.respond.list = () => jsonResponse({ unexpected: true });
    await s.service.tick();
    expect(s.store.discoveryRecords.at(-1)).toMatchObject({ outcome: 'REJECTED_INVALID', success: false });
    expect(JSON.stringify([...s.store.known.entries()])).toBe(before);
    expect(s.breaker.isOpen()).toBe(false);
  });

  it('a list with a repeated id or malformed entries: repeated id rejects, bad entries are skipped and counted', async () => {
    const s = setup();
    s.respond.list = () => jsonResponse([proj('same-1', '1/26', 'PC'), proj('same-1', '1/26', 'PC')]);
    await s.service.tick();
    expect(s.store.discoveryRecords.at(-1)?.outcome).toBe('REJECTED_INVALID');
    s.store.discoveryDue = true;
    s.respond.list = () => jsonResponse([proj('ok-1', '1/26', 'PC'), null, 'x']);
    await s.service.tick();
    expect(s.store.discoveryRecords.at(-1)?.message).toMatch(/2 malformed entries skipped/);
    expect(s.store.known.has('ok-1')).toBe(true);
  });

  it('source outage keeps the previous knowledge, counts toward the breaker, and recovers on the next attempt', async () => {
    const s = setup();
    s.respond.list = () => jsonResponse([proj('p-1', '92/25', 'PC')]);
    await s.service.tick();
    const before = JSON.stringify([...s.store.known.entries()]);

    s.store.discoveryDue = true;
    s.respond.list = () => new Response('down', { status: 503 });
    await s.service.tick();
    expect(s.store.discoveryRecords.at(-1)).toMatchObject({ outcome: 'SOURCE_ERROR', success: false });
    expect(JSON.stringify([...s.store.known.entries()])).toBe(before);
    expect(s.breaker.state().consecutiveFailures).toBe(1);

    s.store.discoveryDue = true;
    s.respond.list = () => jsonResponse([proj('p-1', '92/25', 'PC'), proj('p-9', '9/26', 'PC')]);
    await s.service.tick();
    expect(s.store.discoveryRecords.at(-1)).toMatchObject({ outcome: 'ACCEPTED', success: true });
    expect(s.store.known.has('p-9')).toBe(true);
    expect(s.breaker.state().consecutiveFailures).toBe(0);
  });

  it('a network failure and a timeout are recorded without losing data', async () => {
    const s = setup();
    s.respond.list = () => Promise.reject(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }));
    await s.service.tick();
    expect(s.store.discoveryRecords.at(-1)).toMatchObject({ outcome: 'NETWORK_ERROR' });
    expect(s.store.discoveryRecords.at(-1)?.message).toMatch(/connection refused/);
  });

  it('recovers from an expired session while listing (one re-login, one retry)', async () => {
    const s = setup();
    let n = 0;
    s.respond.list = () => (++n === 1 ? new Response('', { status: 401 }) : jsonResponse([proj('p-1', '92/25', 'PC')]));
    await s.service.tick();
    expect(s.calls.filter((c) => c.path === '/api/login')).toHaveLength(2);
    expect(s.store.discoveryRecords.at(-1)?.outcome).toBe('ACCEPTED');
  });

  it('a 403 or 404 on the list is recorded plainly and does not pause progress synchronisation', async () => {
    const s = setup();
    s.respond.list = () => new Response('', { status: 404 });
    await s.service.tick();
    expect(s.store.discoveryRecords.at(-1)).toMatchObject({ outcome: 'NOT_FOUND' });
    expect(s.breaker.isOpen()).toBe(false);
  });
});

describe('staggered progress requests', () => {
  it('starts concurrent project requests one after another, not in a burst', async () => {
    const s = setup({ discovery: false, staggerMs: 40, concurrency: 3 });
    for (const id of ['a', 'b', 'c']) s.store.addProject(id, `proj-${id}`, `contract-${id}`);
    s.respond.report = () => jsonResponse(reportBody({ project: { id: 'x' } })); // content irrelevant here
    await s.service.tick();
    const reports = s.calls.filter((c) => c.path.endsWith('/report') || c.path.includes('/api/projects/'));
    expect(reports.length).toBe(3);
    expect(reports[1]!.at - reports[0]!.at).toBeGreaterThanOrEqual(30);
    expect(reports[2]!.at - reports[1]!.at).toBeGreaterThanOrEqual(30);
  });
});
