import { createPrismaClient } from '@recafco/database';
import { createLogger } from '@recafco/observability';
import type { WorkerEnv } from '@recafco/config';
import { SourceCircuitBreaker } from './resilience';
import { OperationsSourceClient } from './source-client';
import { PrismaOperationsStore } from './prisma-store';
import { OperationsSyncService } from './sync-service';

export interface RunningOperationsSync {
  stop(): Promise<void>;
}

/**
 * Starts the Operations synchronization loop if (and only if) the worker has a
 * database. Without credentials, or with OPERATIONS_SYNC_ENABLED not 'true', the
 * service still runs but makes NO external call: it only records the connection
 * as NOT_CONFIGURED so the screens can say so honestly.
 */
export function startOperationsSync(env: WorkerEnv): RunningOperationsSync | null {
  const logger = createLogger('operations-sync', { level: env.logLevel, environment: env.nodeEnv });
  if (env.databaseUrl === null) {
    logger.info({ event: 'operations_sync_skipped' }, 'DATABASE_URL is not set for the worker; Operations sync is not started.');
    return null;
  }
  const ops = env.operations;
  const db = createPrismaClient({
    databaseUrl: env.databaseUrl,
    poolMax: env.databasePoolMax,
    connectionTimeoutMs: 10_000,
    statementTimeoutMs: 30_000,
  });

  // 'password' needs the dedicated account; 'demo' is an explicit opt-in and needs no credentials. Neither falls back to the other.
  const configured = ops.enabled && (ops.authMode === 'demo' || (ops.username !== null && ops.password !== null));
  const client = configured
    ? new OperationsSourceClient({
        baseUrl: ops.baseUrl,
        auth:
          ops.authMode === 'demo'
            ? { kind: 'demo', factory: ops.demo.factory, role: ops.demo.role, workspace: ops.demo.workspace }
            : { kind: 'password', username: ops.username as string, password: ops.password as string },
        requestTimeoutMs: ops.requestTimeoutMs,
        maxResponseBytes: ops.maxResponseBytes,
        listMaxBytes: ops.projectListMaxBytes,
      })
    : null;

  logger.info(
    { event: 'operations_sync_starting', enabled: ops.enabled, authMode: ops.authMode, credentialsPresent: ops.username !== null && ops.password !== null, discovery: ops.discovery.enabled, pollIntervalSeconds: ops.pollIntervalSeconds },
    configured ? 'Operations sync starting (live).' : 'Operations sync starting with live synchronization DISABLED.',
  );

  const service = new OperationsSyncService({
    store: new PrismaOperationsStore(db),
    client,
    breaker: new SourceCircuitBreaker({
      threshold: 5,
      baseCooldownMs: 60_000,
      maxCooldownMs: ops.maxBackoffSeconds * 1000,
      authCooldownMs: 30 * 60_000,
    }),
    config: {
      pollIntervalSeconds: ops.pollIntervalSeconds,
      maxBackoffSeconds: ops.maxBackoffSeconds,
      concurrency: ops.concurrency,
      requestTimeoutMs: ops.requestTimeoutMs,
      tickIntervalMs: 5_000,
      runRetentionDays: 30,
      authMode: ops.authMode,
      staggerMs: ops.staggerMs,
      discovery: {
        enabled: ops.discovery.enabled,
        intervalMs: ops.discovery.intervalSeconds * 1000,
        excludedProjectIds: new Set(ops.discovery.excludedProjectIds),
      },
    },
    logger,
    owner: `worker-${process.pid}`,
  });
  service.start();

  return {
    async stop(): Promise<void> {
      await service.stop();
      await db.$disconnect().catch(() => undefined);
    },
  };
}
