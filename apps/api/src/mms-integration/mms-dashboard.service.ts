import { Injectable, Logger } from '@nestjs/common';
import { DepartmentAccessScope, ModuleIdentifier } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import { getApiEnv } from '../env';
import { MmsLiveApiClient } from './mms-live-api.client';
import type { MmsFetchResult } from './mms-live-api.client';
import type { AuthUser } from '../common/types/auth-user';

// ---------------------------------------------------------------------------
// FMP-MAINT-02 — live Maintenance dashboard sourced from MMS's own read-only
// integration API (MMS-FMP-INTEGRATION-01). MMS computes every count and
// list. FMP only checks access, adds the user's email for "Assigned To Me",
// validates/sanitizes the payload, and maps MMS's HTTP outcomes to a display
// status. Replaces FMP-MAINT-01's direct read-only DB mode (removed).
// ---------------------------------------------------------------------------

/** Short FMP-side cache so many FMP tabs polling at once become one MMS call per user email. */
const CACHE_TTL_MS = 10_000;
const CACHE_MAX_ENTRIES = 50;

export const ASSIGNED_TO_ME_NO_EMAIL = 'Unavailable — FMP user email not set';
export const ASSIGNED_TO_ME_EMAIL_REJECTED = 'Unavailable — FMP user email not accepted by MMS';
export const ASSIGNED_TO_ME_NOT_RETURNED = 'Unavailable from MMS';

export type MmsLiveStatus =
  | 'ONLINE'
  | 'OFFLINE'
  | 'NOT_CONFIGURED'
  | 'AUTH_ERROR'
  | 'NOT_ENABLED'
  | 'SCOPE_RESTRICTED';

export interface MmsSummary {
  openRequests: number;
  inProgress: number;
  waitingForParts: number;
  /** MMS rule: in-flight job cards whose start date/time has passed (MMS has no due-date field). */
  overdue: number;
  /** null = could not be mapped (no FMP email) — never shown as 0. */
  assignedToMe: number | null;
  completedThisMonth: number;
}

export interface MmsNeedsAttentionItem {
  id: string;
  ref: string;
  title: string;
  status: string;
  statusLabel: string;
  priority: string | null;
  reasons: string[];
  updatedAt: string | null;
  openUrl: string;
}

export interface MmsRecentRequestItem {
  id: string;
  ref: string;
  title: string;
  assetOrLocation: string | null;
  status: string;
  statusLabel: string;
  priority: string | null;
  assignedTo: string | null;
  updatedAt: string | null;
  openUrl: string;
}

export interface MmsLiveDashboard {
  status: MmsLiveStatus;
  message: string | null;
  mmsBaseUrl: string;
  /** How often the browser should auto-refresh (env MMS_LIVE_REFRESH_SECONDS, min 15). */
  refreshSeconds: number;
  /** MMS's own generatedAt for the data shown (null when no data). */
  generatedAt: string | null;
  /** When FMP attempted/received this data. */
  fetchedAt: string;
  cacheTtlSeconds: number | null;
  summary: MmsSummary | null;
  assignedToMeNote: string | null;
  needsAttention: MmsNeedsAttentionItem[];
  recentRequests: MmsRecentRequestItem[];
}

interface ValidPayload {
  generatedAt: string;
  cacheTtlSeconds: number | null;
  summary: MmsSummary;
  needsAttention: MmsNeedsAttentionItem[];
  recentRequests: MmsRecentRequestItem[];
}

// ── Payload validation (MMS is a separate system — never trust its shape) ────

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);
const optStr = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);
const count = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null);

/**
 * Use MMS's openUrl, but only as an http(s) URL on the configured MMS origin.
 * Anything else (javascript:, another host, MMS misconfigured to localhost) is
 * rebuilt on MMS_BASE_URL with the same path, or MMS's job-card route.
 */
export function safeOpenUrl(raw: unknown, id: string, mmsBaseUrl: string): string {
  const base = new URL(mmsBaseUrl);
  if (typeof raw === 'string') {
    try {
      const u = new URL(raw);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        if (u.origin === base.origin) return u.toString();
        return new URL(`${u.pathname}${u.search}`, base.origin).toString();
      }
    } catch {
      // fall through
    }
  }
  return `${base.origin}/maintenance/work-orders/${encodeURIComponent(id)}`;
}

function parseBaseItem(v: unknown, mmsBaseUrl: string) {
  if (!isObj(v)) return null;
  const id = str(v['id']);
  const ref = str(v['ref']);
  const status = str(v['status']);
  if (!id || !ref || !status) return null;
  return {
    id,
    ref,
    title: str(v['title']) ?? 'Job Card',
    status,
    statusLabel: str(v['statusLabel']) ?? status,
    priority: optStr(v['priority']),
    updatedAt: optStr(v['updatedAt']),
    openUrl: safeOpenUrl(v['openUrl'], id, mmsBaseUrl),
  };
}

export function parseMmsPayload(body: unknown, mmsBaseUrl: string): ValidPayload | null {
  if (!isObj(body) || body['source'] !== 'MMS_LIVE' || body['online'] !== true) return null;
  const s = body['summary'];
  if (!isObj(s)) return null;
  const openRequests = count(s['openRequests']);
  const inProgress = count(s['inProgress']);
  const waitingForParts = count(s['waitingForParts']);
  const overdue = count(s['overdue']);
  const completedThisMonth = count(s['completedThisMonth']);
  if (openRequests === null || inProgress === null || waitingForParts === null || overdue === null || completedThisMonth === null) {
    return null;
  }
  const assignedToMe = s['assignedToMe'] === null ? null : count(s['assignedToMe']);

  const needsAttention = (Array.isArray(body['needsAttention']) ? body['needsAttention'] : []).flatMap((v): MmsNeedsAttentionItem[] => {
    const base = parseBaseItem(v, mmsBaseUrl);
    if (!base || !isObj(v)) return [];
    const reasons = Array.isArray(v['reasons']) ? v['reasons'].filter((r): r is string => typeof r === 'string') : [];
    return [{ ...base, reasons }];
  });
  const recentRequests = (Array.isArray(body['recentRequests']) ? body['recentRequests'] : []).flatMap((v): MmsRecentRequestItem[] => {
    const base = parseBaseItem(v, mmsBaseUrl);
    if (!base || !isObj(v)) return [];
    return [{ ...base, assetOrLocation: optStr(v['assetOrLocation']), assignedTo: optStr(v['assignedTo']) }];
  });

  const ttl = count(body['cacheTtlSeconds']);
  return {
    generatedAt: str(body['generatedAt']) ?? new Date().toISOString(),
    cacheTtlSeconds: ttl,
    summary: { openRequests, inProgress, waitingForParts, overdue, assignedToMe, completedThisMonth },
    needsAttention,
    recentRequests,
  };
}

// ── Service ─────────────────────────────────────────────────────────────────

type Outcome =
  | { ok: true; payload: ValidPayload; emailRejected: boolean }
  | { ok: false; result: Exclude<MmsFetchResult, { kind: 'ok' }> | { kind: 'invalid' } };

@Injectable()
export class MmsDashboardService {
  private readonly logger = new Logger(MmsDashboardService.name);
  private readonly cache = new Map<string, { value: Outcome; expiresAt: number }>();
  private readonly inFlight = new Map<string, Promise<Outcome>>();

  constructor(
    private readonly mms: MmsLiveApiClient,
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
  ) {}

  async getLiveDashboard(actor: AuthUser): Promise<MmsLiveDashboard> {
    const mmsBaseUrl = this.mms.config().baseUrl;
    const base = {
      mmsBaseUrl,
      refreshSeconds: getApiEnv().mmsLiveRefreshSeconds,
      generatedAt: null,
      fetchedAt: new Date().toISOString(),
      cacheTtlSeconds: null,
      summary: null,
      assignedToMeNote: null,
      needsAttention: [],
      recentRequests: [],
    };

    // MMS returns company-wide data and MMS departments have no mapping to
    // FMP departments — only ALL_DEPARTMENTS Maintenance access sees it
    // (fail closed). MMS is not called otherwise.
    const scope = await this.deptAccess.getScope(actor, ModuleIdentifier.MAINTENANCE_REQUESTS);
    if (scope !== DepartmentAccessScope.ALL_DEPARTMENTS) {
      return {
        ...base,
        status: 'SCOPE_RESTRICTED',
        message:
          'Live MMS data covers all factory departments and is shown only to users with all-department Maintenance access. Open MMS directly to see the job cards available to you.',
      };
    }

    const user = await this.db.getClient().user.findUnique({ where: { id: actor.id }, select: { email: true } });
    const email = user?.email?.trim().toLowerCase() || null;

    const outcome = await this.load(email);
    if (!outcome.ok) return { ...base, ...this.describeFailure(outcome.result) };

    const { payload, emailRejected } = outcome;
    let assignedToMeNote: string | null = null;
    if (payload.summary.assignedToMe === null) {
      assignedToMeNote = !email ? ASSIGNED_TO_ME_NO_EMAIL : emailRejected ? ASSIGNED_TO_ME_EMAIL_REJECTED : ASSIGNED_TO_ME_NOT_RETURNED;
    }

    return {
      ...base,
      status: 'ONLINE',
      message: null,
      generatedAt: payload.generatedAt,
      cacheTtlSeconds: payload.cacheTtlSeconds,
      summary: payload.summary,
      assignedToMeNote,
      needsAttention: payload.needsAttention,
      recentRequests: payload.recentRequests,
    };
  }

  private async load(email: string | null): Promise<Outcome> {
    const key = email ?? '';
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value;
    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const promise = this.fetchOutcome(email)
      .then((value) => {
        // Only successes are cached — an outage is retried on the next poll.
        if (value.ok) {
          if (this.cache.size >= CACHE_MAX_ENTRIES) {
            const oldest = this.cache.keys().next().value;
            if (oldest !== undefined) this.cache.delete(oldest);
          }
          this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
        }
        return value;
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, promise);
    return promise;
  }

  private async fetchOutcome(email: string | null): Promise<Outcome> {
    const mmsBaseUrl = this.mms.config().baseUrl;
    let emailRejected = false;
    let result = await this.mms.fetchLiveDashboard(email);
    // MMS validates userEmail; if it rejects ours, still show the dashboard without Assigned To Me.
    if (result.kind === 'bad_request' && email) {
      emailRejected = true;
      result = await this.mms.fetchLiveDashboard(null);
    }
    if (result.kind !== 'ok') {
      this.logger.warn(`MMS live dashboard request failed: ${result.kind}${'reason' in result ? ` (${result.reason})` : ''}${'httpStatus' in result ? ` HTTP ${result.httpStatus}` : ''}`);
      return { ok: false, result };
    }
    const payload = parseMmsPayload(result.body, mmsBaseUrl);
    if (!payload) {
      this.logger.warn('MMS live dashboard returned an unexpected payload shape');
      return { ok: false, result: { kind: 'invalid' } };
    }
    return { ok: true, payload, emailRejected };
  }

  private describeFailure(result: Exclude<MmsFetchResult, { kind: 'ok' }> | { kind: 'invalid' }): {
    status: MmsLiveStatus;
    message: string;
  } {
    switch (result.kind) {
      case 'not_configured':
        return { status: 'NOT_CONFIGURED', message: 'MMS integration is not configured. Set MMS_INTEGRATION_KEY on the FMP API server.' };
      case 'auth_error':
        return {
          status: 'AUTH_ERROR',
          message: 'MMS rejected FMP’s integration credentials. An administrator must check that MMS_INTEGRATION_KEY matches MMS’s FMP_INTEGRATION_KEY.',
        };
      case 'not_enabled':
        return { status: 'NOT_ENABLED', message: `MMS live integration not enabled — ${result.reason}.` };
      case 'bad_request':
      case 'invalid':
        return { status: 'OFFLINE', message: 'Maintenance MMS returned an unexpected response. Live data could not be loaded.' };
      case 'unavailable':
        return { status: 'OFFLINE', message: `Maintenance MMS is currently unavailable (${result.reason}). Live data could not be loaded.` };
    }
  }
}
