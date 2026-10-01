import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DepartmentAccessScope } from '@recafco/database';

const BASE = 'http://192.168.1.17:81';
vi.mock('../env', () => ({ getApiEnv: () => ({ mmsLiveRefreshSeconds: 30 }) }));

import {
  MmsDashboardService,
  parseMmsPayload,
  safeOpenUrl,
  ASSIGNED_TO_ME_NO_EMAIL,
  ASSIGNED_TO_ME_EMAIL_REJECTED,
} from './mms-dashboard.service';
import type { MmsLiveApiClient, MmsFetchResult } from './mms-live-api.client';
import type { DatabaseService } from '../database/database.service';
import type { DepartmentAccessService } from '../department-access/department-access.service';
import type { AuthUser } from '../common/types/auth-user';

const actor: AuthUser = {
  id: 'u-1',
  username: 'manager',
  displayName: 'Manager',
  roleId: 'r-1',
  roleCode: 'MANAGER',
  roleName: 'Manager',
  permissions: ['maintenance.read'],
  mustChangePassword: false,
  isActive: true,
  sessionId: 's-1',
  departmentId: 'd-1',
};

function mmsPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    source: 'MMS_LIVE',
    online: true,
    generatedAt: '2026-10-01T09:00:00.000Z',
    cacheTtlSeconds: 10,
    summary: { openRequests: 12, inProgress: 3, waitingForParts: 4, overdue: 2, assignedToMe: 5, completedThisMonth: 7 },
    needsAttention: [
      {
        id: 'wo-1',
        ref: 'JC-0001',
        title: 'Hydraulic leak',
        status: 'In Progress',
        statusLabel: 'Active',
        priority: 'Urgent',
        reasons: ['Overdue', 'Urgent priority'],
        updatedAt: '2026-10-01T08:00:00.000Z',
        openUrl: `${BASE}/maintenance/work-orders/wo-1`,
      },
    ],
    recentRequests: [
      {
        id: 'wo-2',
        ref: 'JC-0002',
        title: 'Belt change',
        assetOrLocation: 'PR-01 — Press 1',
        status: 'Closed',
        statusLabel: 'Closed',
        priority: 'Normal',
        assignedTo: 'Tech One',
        updatedAt: null,
        openUrl: `${BASE}/maintenance/work-orders/wo-2`,
      },
    ],
    ...overrides,
  };
}

const mockFetchLive = vi.fn<(email: string | null) => Promise<MmsFetchResult>>();
const mockUserFindUnique = vi.fn();
const mockGetScope = vi.fn();

function makeService(): MmsDashboardService {
  const mms = {
    fetchLiveDashboard: mockFetchLive,
    config: () => ({ baseUrl: BASE, endpoint: '/x', integrationKey: 'k', timeoutMs: 8000 }),
  } as unknown as MmsLiveApiClient;
  const db = { getClient: () => ({ user: { findUnique: mockUserFindUnique } }) } as unknown as DatabaseService;
  const deptAccess = { getScope: mockGetScope } as unknown as DepartmentAccessService;
  return new MmsDashboardService(mms, db, deptAccess);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetScope.mockResolvedValue(DepartmentAccessScope.ALL_DEPARTMENTS);
  mockUserFindUnique.mockResolvedValue({ email: 'Manager@Recafco.com' });
  mockFetchLive.mockResolvedValue({ kind: 'ok', body: mmsPayload() });
});

describe('MmsDashboardService.getLiveDashboard', () => {
  it('returns SCOPE_RESTRICTED without calling MMS for department-scoped users', async () => {
    mockGetScope.mockResolvedValue(DepartmentAccessScope.OWN_DEPARTMENT);
    const r = await makeService().getLiveDashboard(actor);
    expect(r.status).toBe('SCOPE_RESTRICTED');
    expect(r.summary).toBeNull();
    expect(mockFetchLive).not.toHaveBeenCalled();
  });

  it('returns live MMS data when ONLINE, passing the lower-cased FMP email', async () => {
    const r = await makeService().getLiveDashboard(actor);
    expect(mockFetchLive).toHaveBeenCalledWith('manager@recafco.com');
    expect(r.status).toBe('ONLINE');
    expect(r.summary).toEqual({ openRequests: 12, inProgress: 3, waitingForParts: 4, overdue: 2, assignedToMe: 5, completedThisMonth: 7 });
    expect(r.assignedToMeNote).toBeNull();
    expect(r.generatedAt).toBe('2026-10-01T09:00:00.000Z');
    expect(r.cacheTtlSeconds).toBe(10);
    expect(r.refreshSeconds).toBe(30);
    expect(r.needsAttention[0]?.reasons).toEqual(['Overdue', 'Urgent priority']);
    expect(r.recentRequests[0]?.openUrl).toBe(`${BASE}/maintenance/work-orders/wo-2`);
    expect(r.mmsBaseUrl).toBe(BASE);
  });

  it('keeps an MMS assignedToMe of 0 as 0', async () => {
    mockFetchLive.mockResolvedValue({ kind: 'ok', body: mmsPayload({ summary: { ...(mmsPayload()['summary'] as object), assignedToMe: 0 } }) });
    const r = await makeService().getLiveDashboard(actor);
    expect(r.summary?.assignedToMe).toBe(0);
    expect(r.assignedToMeNote).toBeNull();
  });

  it('omits userEmail and explains a null Assigned To Me when the FMP user has no email', async () => {
    mockUserFindUnique.mockResolvedValue({ email: null });
    mockFetchLive.mockResolvedValue({ kind: 'ok', body: mmsPayload({ summary: { ...(mmsPayload()['summary'] as object), assignedToMe: null } }) });
    const r = await makeService().getLiveDashboard(actor);
    expect(mockFetchLive).toHaveBeenCalledWith(null);
    expect(r.summary?.assignedToMe).toBeNull();
    expect(r.assignedToMeNote).toBe(ASSIGNED_TO_ME_NO_EMAIL);
  });

  it('retries without userEmail when MMS rejects the email (400)', async () => {
    mockFetchLive
      .mockResolvedValueOnce({ kind: 'bad_request' })
      .mockResolvedValueOnce({ kind: 'ok', body: mmsPayload({ summary: { ...(mmsPayload()['summary'] as object), assignedToMe: null } }) });
    const r = await makeService().getLiveDashboard(actor);
    expect(mockFetchLive.mock.calls.map((c) => c[0])).toEqual(['manager@recafco.com', null]);
    expect(r.status).toBe('ONLINE');
    expect(r.assignedToMeNote).toBe(ASSIGNED_TO_ME_EMAIL_REJECTED);
  });

  it.each<[MmsFetchResult, string]>([
    [{ kind: 'not_configured' }, 'NOT_CONFIGURED'],
    [{ kind: 'auth_error', httpStatus: 403 }, 'AUTH_ERROR'],
    [{ kind: 'not_enabled', reason: 'MMS integration key is not configured on the MMS server' }, 'NOT_ENABLED'],
    [{ kind: 'unavailable', reason: 'request timed out' }, 'OFFLINE'],
    [{ kind: 'ok', body: { source: 'SOMETHING_ELSE' } }, 'OFFLINE'],
  ])('maps %o to %s with no data', async (result, status) => {
    mockFetchLive.mockResolvedValue(result);
    const r = await makeService().getLiveDashboard(actor);
    expect(r.status).toBe(status);
    expect(r.summary).toBeNull();
    expect(r.needsAttention).toEqual([]);
    expect(r.recentRequests).toEqual([]);
    expect(r.message).toBeTruthy();
    expect(r.mmsBaseUrl).toBe(BASE);
  });

  it('shows the required offline wording', async () => {
    mockFetchLive.mockResolvedValue({ kind: 'unavailable', reason: 'connection refused' });
    const r = await makeService().getLiveDashboard(actor);
    expect(r.message).toContain('Live data could not be loaded');
  });

  it('caches successful results per email for 10s, but never caches failures', async () => {
    const service = makeService();
    await service.getLiveDashboard(actor);
    await service.getLiveDashboard(actor);
    expect(mockFetchLive).toHaveBeenCalledTimes(1);

    mockUserFindUnique.mockResolvedValue({ email: 'other@recafco.com' });
    mockFetchLive.mockResolvedValue({ kind: 'unavailable', reason: 'connection refused' });
    await service.getLiveDashboard(actor);
    await service.getLiveDashboard(actor);
    expect(mockFetchLive).toHaveBeenCalledTimes(3);
  });
});

describe('parseMmsPayload', () => {
  it('rejects payloads that are not MMS_LIVE/online or have bad counts', () => {
    expect(parseMmsPayload(null, BASE)).toBeNull();
    expect(parseMmsPayload(mmsPayload({ online: false }), BASE)).toBeNull();
    expect(parseMmsPayload(mmsPayload({ summary: { openRequests: -1 } }), BASE)).toBeNull();
    expect(parseMmsPayload(mmsPayload({ summary: { ...(mmsPayload()['summary'] as object), overdue: '2' } }), BASE)).toBeNull();
  });

  it('drops malformed items and tolerates missing optional fields', () => {
    const p = parseMmsPayload(
      mmsPayload({
        needsAttention: [{ id: 'x' }, { id: 'wo-9', ref: 'JC-9', status: 'Assigned', reasons: ['Unassigned', 5] }],
        recentRequests: 'nope',
      }),
      BASE,
    );
    expect(p?.needsAttention).toHaveLength(1);
    expect(p?.needsAttention[0]).toMatchObject({ ref: 'JC-9', title: 'Job Card', statusLabel: 'Assigned', reasons: ['Unassigned'], priority: null, updatedAt: null });
    expect(p?.recentRequests).toEqual([]);
  });
});

describe('safeOpenUrl', () => {
  it('keeps an MMS openUrl on the configured MMS origin', () => {
    expect(safeOpenUrl(`${BASE}/maintenance/work-orders/abc`, 'abc', BASE)).toBe(`${BASE}/maintenance/work-orders/abc`);
  });

  it('re-homes another origin (e.g. MMS misconfigured to localhost) onto MMS_BASE_URL', () => {
    expect(safeOpenUrl('http://localhost:3000/maintenance/work-orders/abc', 'abc', BASE)).toBe(`${BASE}/maintenance/work-orders/abc`);
  });

  it('replaces non-http and missing URLs with the MMS job-card route', () => {
    expect(safeOpenUrl('javascript:alert(1)', 'a b', BASE)).toBe(`${BASE}/maintenance/work-orders/a%20b`);
    expect(safeOpenUrl(undefined, 'abc', BASE)).toBe(`${BASE}/maintenance/work-orders/abc`);
  });
});
