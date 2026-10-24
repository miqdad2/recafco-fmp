import { OPERATIONS_REPORT_COLUMNS, OPERATIONS_REPORT_GROUP_BY } from '@recafco/shared';

// ---------------------------------------------------------------------------
// FMP-OPS-01 — server-side client for the RECAFCO Operations source.
//
// Only the documented requests are ever made:
//   POST /api/login   {username, password}  -> sets the recafco_session cookie
//   GET  /api/projects/{id}/report?group_by=building&columns=...&format=json
//   POST /api/logout
// The session cookie lives in this object's memory ONLY. It is never written to
// the database, a snapshot, a log line or an error message, and it is only ever
// sent to the configured origin (redirects are never followed).
// ---------------------------------------------------------------------------

export const SESSION_COOKIE_NAME = 'recafco_session';
const LOGIN_PATH = '/api/login';
const DEMO_LOGIN_PATH = '/api/demo-login';
const PROJECT_LIST_PATH = '/api/projects';

/**
 * How FMP signs in. 'password' = POST /api/login with the dedicated integration account (the default).
 * 'demo' = POST /api/demo-login with a fixed {factory, role, workspace} payload: an EXPLICIT opt-in that depends on the
 * source keeping its demo access available. There is no fallback from one mode to the other.
 */
export type SourceAuth =
  | { kind: 'password'; username: string; password: string }
  | { kind: 'demo'; factory: string; role: string; workspace: string };

export interface SourceClientConfig {
  baseUrl: string;
  /** Preferred. When absent the legacy username/password fields below are used (password mode). */
  auth?: SourceAuth;
  username?: string;
  password?: string;
  requestTimeoutMs: number;
  maxResponseBytes: number;
  /** Cap for the project list (larger than a report). Defaults to maxResponseBytes. */
  listMaxBytes?: number;
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export type ReportFetchResult =
  | { kind: 'ok'; body: unknown; httpStatus: number; durationMs: number; bytes: number }
  /** Sign-in rejected, or the session was not accepted even after one renewal. */
  | { kind: 'auth_failed'; httpStatus: number | null; durationMs: number }
  /** The account cannot access this project (403). A per-project problem, not a source outage. */
  | { kind: 'forbidden'; durationMs: number }
  | { kind: 'not_found'; durationMs: number }
  /** 400: we sent a parameter the source rejects. A code/contract problem — never retried in a loop. */
  | { kind: 'bad_request'; durationMs: number }
  | { kind: 'rate_limited'; retryAfterSeconds: number | null; durationMs: number }
  | { kind: 'timeout'; durationMs: number }
  | { kind: 'network'; reason: string; durationMs: number }
  | { kind: 'server_error'; httpStatus: number; durationMs: number }
  /** Not JSON / not a JSON object / wrong content type. */
  | { kind: 'invalid_body'; reason: string; durationMs: number }
  | { kind: 'too_large'; durationMs: number };

type RawResult =
  | { kind: 'response'; res: Response; durationMs: number }
  | { kind: 'timeout'; durationMs: number }
  | { kind: 'network'; reason: string; durationMs: number };

export class OperationsSourceClient {
  private sessionCookie: string | null = null;
  private sessionExpiresAt: number | null = null;
  private loginInFlight: Promise<LoginOutcome> | null = null;

  constructor(
    private readonly config: SourceClientConfig,
    private readonly fetchImpl: FetchLike = (url, init) => fetch(url, init),
    private readonly now: () => number = () => Date.now(),
  ) {}

  hasSession(): boolean {
    return this.sessionCookie !== null && !this.sessionExpired();
  }

  /** Establishes (or reuses) the integration account's own session. Concurrent callers share one login. */
  async ensureSession(): Promise<LoginOutcome> {
    if (this.hasSession()) return { kind: 'ok', durationMs: 0 };
    if (this.loginInFlight) return this.loginInFlight;
    this.loginInFlight = this.login().finally(() => {
      this.loginInFlight = null;
    });
    return this.loginInFlight;
  }

  /**
   * Fetches the documented project report. A 401 (or login redirect) triggers exactly ONE
   * session renewal and one retry; a second failure is reported as auth_failed.
   */
  async fetchReport(sourceProjectId: string): Promise<ReportFetchResult> {
    const query = new URLSearchParams({
      group_by: OPERATIONS_REPORT_GROUP_BY,
      columns: OPERATIONS_REPORT_COLUMNS,
      format: 'json',
    });
    const path = `/api/projects/${encodeURIComponent(sourceProjectId)}/report?${query.toString()}`;
    return this.withSession(path, this.config.maxResponseBytes);
  }

  /** GET /api/projects — the whole project list in one request (project discovery). */
  async fetchProjectList(): Promise<ReportFetchResult> {
    return this.withSession(PROJECT_LIST_PATH, this.config.listMaxBytes ?? this.config.maxResponseBytes);
  }

  /** Same session rules for every read: one renewal and one retry on an unaccepted session. */
  private async withSession(path: string, maxBytes: number): Promise<ReportFetchResult> {
    const started = this.now();
    const session = await this.ensureSession();
    if (session.kind !== 'ok') return mapLoginFailure(session, this.now() - started);

    let attempt = await this.getJson(path, maxBytes);
    if (attempt.kind === 'auth_failed') {
      this.dropSession();
      const renewed = await this.ensureSession();
      if (renewed.kind !== 'ok') return mapLoginFailure(renewed, this.now() - started);
      attempt = await this.getJson(path, maxBytes);
      if (attempt.kind === 'auth_failed') this.dropSession();
    }
    return attempt;
  }

  /** Best-effort sign-out (worker shutdown). Never throws. */
  async logout(): Promise<void> {
    if (this.sessionCookie === null) return;
    try {
      await this.send('POST', '/api/logout', {}, true);
    } catch {
      // The session expires on its own.
    } finally {
      this.dropSession();
    }
  }

  private dropSession(): void {
    this.sessionCookie = null;
    this.sessionExpiresAt = null;
  }

  private sessionExpired(): boolean {
    return this.sessionExpiresAt !== null && this.now() >= this.sessionExpiresAt;
  }

  private async login(): Promise<LoginOutcome> {
    const auth: SourceAuth = this.config.auth ?? { kind: 'password', username: this.config.username ?? '', password: this.config.password ?? '' };
    const raw =
      auth.kind === 'demo'
        ? await this.send('POST', DEMO_LOGIN_PATH, { factory: auth.factory, role: auth.role, workspace: auth.workspace }, false)
        : await this.send('POST', LOGIN_PATH, { username: auth.username, password: auth.password }, false);
    if (raw.kind === 'timeout') return { kind: 'timeout', durationMs: raw.durationMs };
    if (raw.kind === 'network') return { kind: 'network', reason: raw.reason, durationMs: raw.durationMs };
    const { res, durationMs } = raw;
    // Drain the body (bounded) so the socket is released; its content is never used or logged.
    await discardBody(res, this.config.maxResponseBytes);

    if (res.status === 429) return { kind: 'rate_limited', retryAfterSeconds: parseRetryAfter(res), durationMs };
    if (res.status === 401 || res.status === 403) return { kind: 'rejected', httpStatus: res.status, durationMs };
    if (res.status >= 300 && res.status < 400) return { kind: 'rejected', httpStatus: res.status, durationMs };
    if (res.status >= 500) return { kind: 'server_error', httpStatus: res.status, durationMs };
    if (!res.ok) return { kind: 'rejected', httpStatus: res.status, durationMs };

    const parsed = extractSessionCookie(res, this.now());
    if (parsed === null) return { kind: 'no_session', durationMs };
    this.sessionCookie = parsed.value;
    this.sessionExpiresAt = parsed.expiresAt;
    return { kind: 'ok', durationMs };
  }

  private async getJson(path: string, maxBytes: number): Promise<ReportFetchResult> {
    const raw = await this.send('GET', path, undefined, true);
    if (raw.kind === 'timeout') return { kind: 'timeout', durationMs: raw.durationMs };
    if (raw.kind === 'network') return { kind: 'network', reason: raw.reason, durationMs: raw.durationMs };

    const { res, durationMs } = raw;
    const status = res.status;
    if (status >= 300 && status < 400) {
      // Redirect (typically to a sign-in page): treated as an unaccepted session, never followed.
      await discardBody(res, this.config.maxResponseBytes);
      return { kind: 'auth_failed', httpStatus: status, durationMs };
    }
    if (status === 401) {
      await discardBody(res, this.config.maxResponseBytes);
      return { kind: 'auth_failed', httpStatus: 401, durationMs };
    }
    if (status === 403) {
      await discardBody(res, this.config.maxResponseBytes);
      return { kind: 'forbidden', durationMs };
    }
    if (status === 404) {
      await discardBody(res, this.config.maxResponseBytes);
      return { kind: 'not_found', durationMs };
    }
    if (status === 400) {
      await discardBody(res, this.config.maxResponseBytes);
      return { kind: 'bad_request', durationMs };
    }
    if (status === 429) {
      await discardBody(res, this.config.maxResponseBytes);
      return { kind: 'rate_limited', retryAfterSeconds: parseRetryAfter(res), durationMs };
    }
    if (status >= 500) {
      await discardBody(res, this.config.maxResponseBytes);
      return { kind: 'server_error', httpStatus: status, durationMs };
    }
    if (status !== 200) {
      await discardBody(res, this.config.maxResponseBytes);
      return { kind: 'invalid_body', reason: `unexpected HTTP ${status}`, durationMs };
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!/json/i.test(contentType)) {
      await discardBody(res, this.config.maxResponseBytes);
      return { kind: 'invalid_body', reason: 'response is not JSON', durationMs };
    }

    const declared = Number(res.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) {
      await cancelBody(res);
      return { kind: 'too_large', durationMs };
    }

    const read = await readBounded(res, maxBytes);
    if (read.kind === 'too_large') return { kind: 'too_large', durationMs };
    if (read.kind === 'error') return { kind: 'network', reason: 'connection lost while reading the response', durationMs };
    let parsed: unknown;
    try {
      parsed = JSON.parse(read.text);
    } catch {
      return { kind: 'invalid_body', reason: 'response is not valid JSON', durationMs };
    }
    return { kind: 'ok', body: parsed, httpStatus: status, durationMs, bytes: read.bytes };
  }

  /** One HTTP request. Never follows redirects; attaches the session cookie only when asked. */
  private async send(method: 'GET' | 'POST', path: string, body: unknown, withSession: boolean): Promise<RawResult> {
    const started = this.now();
    const headers: Record<string, string> = { Accept: 'application/json', 'Cache-Control': 'no-cache' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (withSession && this.sessionCookie !== null) headers['Cookie'] = `${SESSION_COOKIE_NAME}=${this.sessionCookie}`;
    try {
      const res = await this.fetchImpl(`${this.config.baseUrl}${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        redirect: 'manual',
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      });
      return { kind: 'response', res, durationMs: this.now() - started };
    } catch (err) {
      const durationMs = this.now() - started;
      if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) return { kind: 'timeout', durationMs };
      return { kind: 'network', reason: describeNetworkError(err), durationMs };
    }
  }
}

export type LoginOutcome =
  | { kind: 'ok'; durationMs: number }
  | { kind: 'rejected'; httpStatus: number; durationMs: number }
  | { kind: 'no_session'; durationMs: number }
  | { kind: 'rate_limited'; retryAfterSeconds: number | null; durationMs: number }
  | { kind: 'server_error'; httpStatus: number; durationMs: number }
  | { kind: 'timeout'; durationMs: number }
  | { kind: 'network'; reason: string; durationMs: number };

function mapLoginFailure(outcome: Exclude<LoginOutcome, { kind: 'ok' }>, durationMs: number): ReportFetchResult {
  switch (outcome.kind) {
    case 'rejected':
      return { kind: 'auth_failed', httpStatus: outcome.httpStatus, durationMs };
    case 'no_session':
      return { kind: 'auth_failed', httpStatus: null, durationMs };
    case 'rate_limited':
      return { kind: 'rate_limited', retryAfterSeconds: outcome.retryAfterSeconds, durationMs };
    case 'server_error':
      return { kind: 'server_error', httpStatus: outcome.httpStatus, durationMs };
    case 'timeout':
      return { kind: 'timeout', durationMs };
    case 'network':
      return { kind: 'network', reason: outcome.reason, durationMs };
  }
}

/** Reads `recafco_session` from Set-Cookie. Only its value and expiry are kept — nothing else. */
export function extractSessionCookie(res: Response, nowMs: number): { value: string; expiresAt: number | null } | null {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const lines = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : splitSetCookie(res.headers.get('set-cookie'));
  for (const line of lines) {
    const parts = line.split(';').map((p) => p.trim());
    const first = parts[0] ?? '';
    const eq = first.indexOf('=');
    if (eq <= 0) continue;
    if (first.slice(0, eq) !== SESSION_COOKIE_NAME) continue;
    const value = first.slice(eq + 1);
    if (value === '') return null; // an empty value is the source clearing the cookie
    let expiresAt: number | null = null;
    for (const attr of parts.slice(1)) {
      const lower = attr.toLowerCase();
      if (lower.startsWith('max-age=')) {
        const secs = parseInt(attr.slice(8), 10);
        if (!Number.isNaN(secs)) expiresAt = nowMs + secs * 1000;
      } else if (lower.startsWith('expires=') && expiresAt === null) {
        const t = Date.parse(attr.slice(8));
        if (!Number.isNaN(t)) expiresAt = t;
      }
    }
    // Renew a little early so a request never races the expiry.
    return { value, expiresAt: expiresAt === null ? null : expiresAt - 30_000 };
  }
  return null;
}

function splitSetCookie(header: string | null): string[] {
  if (!header) return [];
  // Commas also appear inside Expires=...; split only where a new "name=" starts.
  return header.split(/,(?=\s*[A-Za-z0-9_-]+=)/);
}

function parseRetryAfter(res: Response): number | null {
  const v = res.headers.get('retry-after');
  if (v === null) return null;
  const secs = parseInt(v, 10);
  if (!Number.isNaN(secs) && secs >= 0) return Math.min(secs, 3600);
  const when = Date.parse(v);
  if (!Number.isNaN(when)) return Math.max(0, Math.min(3600, Math.round((when - Date.now()) / 1000)));
  return null;
}

type BoundedRead =
  | { kind: 'ok'; text: string; bytes: number }
  | { kind: 'too_large' }
  | { kind: 'error' };

/** Reads a body but stops (and cancels the stream) as soon as it exceeds `max` bytes. */
async function readBounded(res: Response, max: number): Promise<BoundedRead> {
  if (res.body === null) return { kind: 'ok', text: '', bytes: 0 };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
        await reader.cancel().catch(() => undefined);
        return { kind: 'too_large' };
      }
      chunks.push(value);
    }
  } catch {
    return { kind: 'error' };
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return { kind: 'ok', text: new TextDecoder('utf-8').decode(merged), bytes: total };
}

async function discardBody(res: Response, max: number): Promise<void> {
  await readBounded(res, Math.min(max, 64_000)).catch(() => undefined);
}

async function cancelBody(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    // ignore
  }
}

/** Credential-free description of a network failure. */
export function describeNetworkError(err: unknown): string {
  const cause = (err as { cause?: { code?: unknown; errors?: { code?: unknown }[] } } | null)?.cause;
  const code = cause?.code ?? cause?.errors?.[0]?.code;
  if (code === 'ECONNREFUSED') return 'connection refused';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'host not found';
  if (code === 'ETIMEDOUT' || code === 'EHOSTUNREACH' || code === 'ENETUNREACH') return 'host unreachable';
  if (code === 'ECONNRESET') return 'connection reset';
  if (typeof code === 'string' && code.startsWith('CERT')) return 'TLS certificate problem';
  return 'network error';
}
