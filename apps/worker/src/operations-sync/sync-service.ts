import { parseProgressReport, parseProjectList } from '@recafco/shared';
import { hashContent } from './publication';
import { nextDelaySeconds, SourceCircuitBreaker } from './resilience';
import type { OperationsSourceClient, ReportFetchResult } from './source-client';
import type {
  AttemptRecord,
  ClaimedProject,
  ConnectionState,
  OperationsSyncStore,
  SyncOutcome,
} from './store';

// ---------------------------------------------------------------------------
// FMP-OPS-01 — the background synchronization engine.
//
// Rules enforced here:
//  - Screens never call the source. Only this loop does, one request per due
//    project, with bounded concurrency.
//  - A project is claimed with a database lease, so two ticks / two workers
//    never synchronise the same project at once.
//  - Any invalid response leaves the previous accepted snapshot untouched.
//  - Sustained source failure opens a circuit breaker: all external calls stop
//    (no login retry loops) until the cooldown ends, then one probe is allowed.
//  - Missing records/fields are never read as zero or as a deletion.
// ---------------------------------------------------------------------------

export interface SyncServiceConfig {
  pollIntervalSeconds: number;
  maxBackoffSeconds: number;
  concurrency: number;
  requestTimeoutMs: number;
  /** How long between ticks of the scheduler loop. */
  tickIntervalMs: number;
  /** How long run-log rows are kept. */
  runRetentionDays: number;
  /** How the worker signs in. Reported to users; 'demo' depends on the source's demo access. */
  authMode: 'password' | 'demo';
  /** Delay between starting concurrent progress requests, so the source is never hit by a burst. */
  staggerMs: number;
  /** Project discovery: ONE request for the whole list, on its own slow schedule. */
  discovery: { enabled: boolean; intervalMs: number; excludedProjectIds: ReadonlySet<string> };
}

export interface SyncLogger {
  info(obj: Record<string, unknown>, msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
  error(obj: Record<string, unknown>, msg: string): void;
}

export class OperationsSyncService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking: Promise<void> | null = null;
  private readonly inFlight = new Set<string>();
  private lastStatusWriteMs = 0;
  private lastStatusKey = '';
  private lastPruneMs = 0;
  private lastLoginAt: Date | null = null;
  private everSucceeded = false;
  private lastMessage: string | null = null;

  constructor(
    private readonly deps: {
      store: OperationsSyncStore;
      /** null => credentials not configured: the service reports NOT_CONFIGURED and never calls out. */
      client: OperationsSourceClient | null;
      breaker: SourceCircuitBreaker;
      config: SyncServiceConfig;
      logger: SyncLogger;
      owner: string;
      now?: () => Date;
      random?: () => number;
    },
  ) {}

  private now(): Date {
    return this.deps.now ? this.deps.now() : new Date();
  }

  start(): void {
    if (this.timer !== null) return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.deps.config.tickIntervalMs);
  }

  async stop(): Promise<void> {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.ticking) await this.ticking.catch(() => undefined);
    await this.deps.client?.logout();
  }

  /** One scheduler pass. Re-entrant calls while a pass is running are ignored (no overlapping passes). */
  tick(): Promise<void> {
    if (this.ticking) return this.ticking;
    this.ticking = this.runTick().finally(() => {
      this.ticking = null;
    });
    return this.ticking;
  }

  private async runTick(): Promise<void> {
    const { client, breaker, store, config, logger } = this.deps;
    try {
      if (client === null) {
        await this.writeStatus('NOT_CONFIGURED', 'Live synchronization is not active: it is not enabled or the source credentials are not configured.');
        return;
      }

      if (breaker.isOpen()) {
        await this.writeStatus(breaker.state().reason === 'AUTH' ? 'AUTH_FAILED' : 'PAUSED');
        return;
      }

      const slots = config.concurrency - this.inFlight.size;
      if (slots > 0) {
        const leaseMs = config.requestTimeoutMs * 3 + 30_000;
        const claimed = await store.claimDue(this.now(), slots, this.deps.owner, leaseMs);
        // Stagger the starts: limited concurrency AND no burst of simultaneous requests.
        await Promise.allSettled(
          claimed.map(async (p, i) => {
            if (i > 0 && config.staggerMs > 0) await delay(i * config.staggerMs);
            await this.syncProject(p);
          }),
        );
      }

      await this.maybeDiscover();

      await this.writeStatus(this.currentState());

      const nowMs = this.now().getTime();
      if (nowMs - this.lastPruneMs > 6 * 3_600_000) {
        this.lastPruneMs = nowMs;
        const cutoff = new Date(nowMs - config.runRetentionDays * 86_400_000);
        await store.pruneRuns(cutoff).catch(() => 0);
      }
    } catch (err) {
      // The loop must survive a database hiccup; the next tick tries again.
      logger.error({ event: 'operations_sync_tick_failed', error: describeError(err) }, 'Operations sync tick failed.');
    }
  }

  private currentState(): ConnectionState {
    const b = this.deps.breaker.state();
    if (b.open) return b.reason === 'AUTH' ? 'AUTH_FAILED' : 'PAUSED';
    if (b.consecutiveFailures > 0) return 'DEGRADED';
    return 'OK';
  }

  /**
   * Project discovery: reads the source's project list, upserts by source id, then links unique job-order + factory
   * matches. It never deletes or unlinks anything, never creates a contract and never edits commercial details. An
   * invalid or failed response leaves everything as it was.
   */
  private async maybeDiscover(): Promise<void> {
    const { client, breaker, store, config, logger } = this.deps;
    if (client === null || !config.discovery.enabled || breaker.isOpen()) return;
    const now = this.now();
    if (!(await store.claimDiscovery(now, config.discovery.intervalMs, this.deps.owner, config.requestTimeoutMs * 3 + 30_000))) return;

    const regular = new Date(now.getTime() + config.discovery.intervalMs);
    // After a failure try again sooner than the normal interval, but never faster than every five minutes.
    const retry = new Date(now.getTime() + Math.min(config.discovery.intervalMs, 300_000));
    const fail = async (outcome: string, message: string): Promise<void> => {
      await store.recordDiscovery({ outcome, message: message.slice(0, 500), projectCount: null, success: false, nextAt: retry });
      logger.warn({ event: 'operations_discovery_failed', outcome }, 'Operations project discovery did not complete.');
    };

    try {
      const result = await client.fetchProjectList();
      switch (result.kind) {
        case 'ok': {
          breaker.recordSuccess();
          const parsed = parseProjectList(result.body);
          if (!parsed.ok) return await fail('REJECTED_INVALID', parsed.message);
          const summary = { ...(await store.applyDiscovery(parsed.projects, this.now(), config.discovery.excludedProjectIds)), skipped: parsed.skipped };
          const linking = await store.autoLinkEligible(config.discovery.intervalMs / 1000);
          const excludedTotal = Object.values(summary.excluded).reduce((a, b) => a + b, 0);
          const message =
            `${summary.listed} projects listed (${summary.created} new, ${excludedTotal} excluded as training/test); ${linking.linked} linked automatically` +
            (summary.skipped > 0 ? `; ${summary.skipped} malformed entries skipped` : '') +
            (summary.shrankIgnored ? '; the list was much shorter than before, so absences were not recorded' : '') +
            '.';
          await store.recordDiscovery({ outcome: 'ACCEPTED', message, projectCount: summary.listed, success: true, nextAt: regular });
          logger.info({ event: 'operations_discovery_done', listed: summary.listed, created: summary.created, linked: linking.linked }, 'Operations project discovery finished.');
          return;
        }
        case 'auth_failed':
          breaker.recordFailure('AUTH');
          return await fail('AUTH_FAILED', 'The source rejected the integration sign-in. Calls are paused.');
        case 'rate_limited':
          breaker.recordFailure('SOURCE', result.retryAfterSeconds ?? config.pollIntervalSeconds);
          return await fail('RATE_LIMITED', 'The source asked us to slow down.');
        case 'timeout':
          breaker.recordFailure('SOURCE');
          return await fail('TIMEOUT', 'The source did not answer in time.');
        case 'network':
          breaker.recordFailure('SOURCE');
          return await fail('NETWORK_ERROR', `Cannot reach the source (${result.reason}).`);
        case 'server_error':
          breaker.recordFailure('SOURCE');
          return await fail('SOURCE_ERROR', `The source reported an error (HTTP ${result.httpStatus}).`);
        case 'forbidden':
          return await fail('FORBIDDEN', 'The integration account is not allowed to list projects.');
        case 'not_found':
          return await fail('NOT_FOUND', 'The source does not provide the project list endpoint.');
        case 'bad_request':
          return await fail('SOURCE_ERROR', 'The source rejected the project list request.');
        case 'invalid_body':
          return await fail('REJECTED_INVALID', `The project list could not be used (${result.reason}).`);
        case 'too_large':
          return await fail('REJECTED_INVALID', 'The project list exceeded the size limit and was discarded.');
      }
    } catch (err) {
      logger.error({ event: 'operations_discovery_error', error: describeError(err) }, 'Operations project discovery failed locally.');
      await store.recordDiscovery({ outcome: 'SOURCE_ERROR', message: 'Local processing error; project knowledge was kept.', projectCount: null, success: false, nextAt: retry }).catch(() => undefined);
    }
  }

  /** Synchronises one claimed project. Never throws. */
  async syncProject(project: ClaimedProject): Promise<void> {
    const { client, breaker, store, logger } = this.deps;
    if (client === null) return;
    if (this.inFlight.has(project.id)) return;
    this.inFlight.add(project.id);
    const startedAt = this.now();
    try {
      if (breaker.isOpen()) {
        await store.releaseLease(project.id, breaker.state().openUntil ?? new Date(startedAt.getTime() + 60_000));
        return;
      }

      const result = await client.fetchReport(project.sourceProjectId);
      const outcome = await this.handleResult(project, result, startedAt);
      logger.info(
        {
          event: 'operations_sync_attempt',
          sourceProjectId: project.sourceProjectId,
          outcome: outcome.outcome,
          httpStatus: outcome.httpStatus,
          durationMs: outcome.durationMs,
        },
        'Operations sync attempt finished.',
      );
    } catch (err) {
      // Unexpected local error (e.g. database). Record what we can, keep previous data.
      logger.error(
        { event: 'operations_sync_error', sourceProjectId: project.sourceProjectId, error: describeError(err) },
        'Operations sync attempt failed locally.',
      );
      await this.deps.store
        .recordAttempt(project, this.failureRecord(project, startedAt, 'SOURCE_ERROR', null, null, 'Local processing error; the previous data was kept.'))
        .catch(() => undefined);
    } finally {
      this.inFlight.delete(project.id);
    }
  }

  private async handleResult(
    project: ClaimedProject,
    result: ReportFetchResult,
    startedAt: Date,
  ): Promise<{ outcome: SyncOutcome; httpStatus: number | null; durationMs: number | null }> {
    const { breaker, store, config } = this.deps;

    switch (result.kind) {
      case 'ok': {
        breaker.recordSuccess();
        this.lastLoginAt = this.lastLoginAt ?? this.now();
        const parsed = parseProgressReport(result.body, project.sourceProjectId, this.now());
        if (!parsed.ok) {
          await store.recordAttempt(
            project,
            this.failureRecord(project, startedAt, 'REJECTED_INVALID', result.httpStatus, result.durationMs, parsed.message),
          );
          return { outcome: 'REJECTED_INVALID', httpStatus: result.httpStatus, durationMs: result.durationMs };
        }

        const published = await store.publish(project, {
          report: parsed.report,
          contentHash: hashContent(parsed.report),
          retrievedAt: this.now(),
          httpStatus: result.httpStatus,
          durationMs: result.durationMs,
          bytes: result.bytes,
          authMode: config.authMode,
        });

        if (published.kind === 'OLDER') {
          // A successful read of OLDER data: nothing is replaced; not counted as a failure either.
          await store.recordAttempt(project, {
            ...this.baseRecord(project, startedAt, 'REJECTED_OLDER', result.httpStatus, result.durationMs),
            message: 'The response was generated before data already accepted and was ignored.',
            retrieved: false,
            consecutiveFailures: project.consecutiveFailures,
            nextAttemptAt: this.nextAttempt(0),
          });
          return { outcome: 'REJECTED_OLDER', httpStatus: result.httpStatus, durationMs: result.durationMs };
        }

        const outcome: SyncOutcome = published.kind === 'PUBLISHED' ? 'ACCEPTED' : 'UNCHANGED';
        this.everSucceeded = true;
        this.lastMessage = null;
        await store.recordAttempt(project, {
          ...this.baseRecord(project, startedAt, outcome, result.httpStatus, result.durationMs),
          message: null,
          retrieved: true,
          consecutiveFailures: 0,
          nextAttemptAt: this.nextAttempt(0),
        });

        if (project.contractId === null) {
          try {
            await store.tryAutoLink(project.id);
          } catch (err) {
            this.deps.logger.warn({ event: 'operations_autolink_failed', error: describeError(err) }, 'Automatic link check failed.');
          }
        }
        return { outcome, httpStatus: result.httpStatus, durationMs: result.durationMs };
      }

      case 'auth_failed':
        breaker.recordFailure('AUTH');
        this.lastMessage = 'The source rejected the integration account sign-in or session. Calls are paused.';
        await store.recordAttempt(
          project,
          this.failureRecord(project, startedAt, 'AUTH_FAILED', result.httpStatus, result.durationMs, this.lastMessage),
        );
        return { outcome: 'AUTH_FAILED', httpStatus: result.httpStatus, durationMs: result.durationMs };

      case 'forbidden':
        await store.recordAttempt(
          project,
          this.failureRecord(project, startedAt, 'FORBIDDEN', 403, result.durationMs, 'The integration account cannot access this project.'),
        );
        return { outcome: 'FORBIDDEN', httpStatus: 403, durationMs: result.durationMs };

      case 'not_found':
        await store.recordAttempt(
          project,
          this.failureRecord(project, startedAt, 'NOT_FOUND', 404, result.durationMs, 'The source does not know this project id.'),
        );
        return { outcome: 'NOT_FOUND', httpStatus: 404, durationMs: result.durationMs };

      case 'bad_request':
        await store.recordAttempt(
          project,
          this.failureRecord(project, startedAt, 'SOURCE_ERROR', 400, result.durationMs, 'The source rejected the request parameters.'),
        );
        return { outcome: 'SOURCE_ERROR', httpStatus: 400, durationMs: result.durationMs };

      case 'rate_limited':
        breaker.recordFailure('SOURCE', result.retryAfterSeconds ?? config.pollIntervalSeconds);
        await store.recordAttempt(project, {
          ...this.failureRecord(project, startedAt, 'RATE_LIMITED', 429, result.durationMs, 'The source asked us to slow down.'),
          nextAttemptAt: this.nextAttempt(project.consecutiveFailures + 1, result.retryAfterSeconds),
        });
        return { outcome: 'RATE_LIMITED', httpStatus: 429, durationMs: result.durationMs };

      case 'timeout':
        breaker.recordFailure('SOURCE');
        await store.recordAttempt(
          project,
          this.failureRecord(project, startedAt, 'TIMEOUT', null, result.durationMs, 'The source did not answer in time.'),
        );
        return { outcome: 'TIMEOUT', httpStatus: null, durationMs: result.durationMs };

      case 'network':
        breaker.recordFailure('SOURCE');
        await store.recordAttempt(
          project,
          this.failureRecord(project, startedAt, 'NETWORK_ERROR', null, result.durationMs, `Cannot reach the source (${result.reason}).`),
        );
        return { outcome: 'NETWORK_ERROR', httpStatus: null, durationMs: result.durationMs };

      case 'server_error':
        breaker.recordFailure('SOURCE');
        await store.recordAttempt(
          project,
          this.failureRecord(project, startedAt, 'SOURCE_ERROR', result.httpStatus, result.durationMs, `The source reported an error (HTTP ${result.httpStatus}).`),
        );
        return { outcome: 'SOURCE_ERROR', httpStatus: result.httpStatus, durationMs: result.durationMs };

      case 'invalid_body':
        await store.recordAttempt(
          project,
          this.failureRecord(project, startedAt, 'REJECTED_INVALID', null, result.durationMs, `The source response could not be used (${result.reason}).`),
        );
        return { outcome: 'REJECTED_INVALID', httpStatus: null, durationMs: result.durationMs };

      case 'too_large':
        await store.recordAttempt(
          project,
          this.failureRecord(project, startedAt, 'REJECTED_INVALID', 200, result.durationMs, 'The source response exceeded the size limit and was discarded.'),
        );
        return { outcome: 'REJECTED_INVALID', httpStatus: 200, durationMs: result.durationMs };
    }
  }

  private nextAttempt(failures: number, retryAfterSeconds?: number | null): Date {
    const { pollIntervalSeconds, maxBackoffSeconds } = this.deps.config;
    let delay = nextDelaySeconds(failures, pollIntervalSeconds, maxBackoffSeconds, this.deps.random);
    if (typeof retryAfterSeconds === 'number') delay = Math.max(delay, retryAfterSeconds);
    return new Date(this.now().getTime() + delay * 1000);
  }

  private baseRecord(
    project: ClaimedProject,
    startedAt: Date,
    outcome: SyncOutcome,
    httpStatus: number | null,
    durationMs: number | null,
  ): AttemptRecord {
    return {
      outcome,
      trigger: project.trigger,
      startedAt,
      finishedAt: this.now(),
      httpStatus,
      durationMs,
      message: null,
      retrieved: false,
      consecutiveFailures: project.consecutiveFailures,
      nextAttemptAt: this.nextAttempt(0),
    };
  }

  private failureRecord(
    project: ClaimedProject,
    startedAt: Date,
    outcome: SyncOutcome,
    httpStatus: number | null,
    durationMs: number | null,
    message: string,
  ): AttemptRecord {
    const failures = project.consecutiveFailures + 1;
    return {
      ...this.baseRecord(project, startedAt, outcome, httpStatus, durationMs),
      message: message.slice(0, 500),
      retrieved: false,
      consecutiveFailures: failures,
      nextAttemptAt: this.nextAttempt(failures),
    };
  }

  private async writeStatus(state: ConnectionState, message?: string): Promise<void> {
    const b = this.deps.breaker.state();
    const msg =
      message ??
      (state === 'AUTH_FAILED'
        ? 'The source rejected the integration account. Calls are paused until the cooldown ends.'
        : state === 'PAUSED'
          ? 'The source is failing repeatedly. Calls are paused and will resume automatically.'
          : state === 'DEGRADED'
            ? (this.lastMessage ?? 'Some recent updates failed; previous data is shown as stale.')
            : state === 'OK' && this.deps.config.authMode === 'demo'
              ? 'Automatic updates are running through the source’s demo sign-in, which depends on its demo access staying available.'
              : null);
    const key = `${state}|${b.openUntil?.getTime() ?? ''}|${b.consecutiveFailures}|${msg ?? ''}`;
    const nowMs = this.now().getTime();
    // Write on change, and at least every 30 s as the worker heartbeat the API uses to detect a dead worker.
    if (key === this.lastStatusKey && nowMs - this.lastStatusWriteMs < 30_000) return;
    this.lastStatusKey = key;
    this.lastStatusWriteMs = nowMs;
    await this.deps.store.upsertStatus({
      connectionState: state,
      circuitOpenUntil: b.openUntil,
      consecutiveFailures: b.consecutiveFailures,
      ...(this.lastLoginAt ? { lastLoginAt: this.lastLoginAt } : {}),
      lastMessage: msg,
      pollIntervalSeconds: this.deps.config.pollIntervalSeconds,
      authMode: this.deps.config.authMode,
      discoveryEnabled: this.deps.config.discovery.enabled,
    });
  }

  /** Test hook. */
  hasEverSucceeded(): boolean {
    return this.everSucceeded;
  }
}

/** Error text that can never carry a credential: only the error class and a trimmed message. */
export function describeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`.slice(0, 300);
  return 'unknown error';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
