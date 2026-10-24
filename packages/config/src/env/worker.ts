import { z } from 'zod';
import { NodeEnvSchema, LogLevelSchema } from './shared';

const DEFAULT_HEARTBEAT_MS = 30_000;
const DEFAULT_STALE_MS = 60_000;

// FMP-OPS-01 — read-only Operations source synchronization. Everything is optional: with no
// credentials (or OPERATIONS_SYNC_ENABLED not 'true') the worker makes NO external call and
// records the connection as NOT_CONFIGURED.
const DEFAULT_OPERATIONS_BASE_URL = 'https://management.recafco.online';
const DEFAULT_OPERATIONS_POLL_SECONDS = 60;
/** Never poll a project faster than this, whatever the env says (source capacity is unconfirmed). */
export const MIN_OPERATIONS_POLL_SECONDS = 15;
const DEFAULT_OPERATIONS_TIMEOUT_MS = 15_000;
const DEFAULT_OPERATIONS_MAX_BYTES = 2_000_000;
const DEFAULT_OPERATIONS_CONCURRENCY = 2;
const MAX_OPERATIONS_CONCURRENCY = 4;
const DEFAULT_OPERATIONS_MAX_BACKOFF_SECONDS = 900;
// FMP-OPS-03 — optional demo authentication (the source's own demo sign-in) and project discovery.
export const OPERATIONS_AUTH_MODES = ['password', 'demo'] as const;
const DEFAULT_DEMO_FACTORY = 'precast';
const DEFAULT_DEMO_ROLE = 'manager';
const DEFAULT_DEMO_WORKSPACE = 'existing';
const DEFAULT_DISCOVERY_INTERVAL_SECONDS = 900;
/** Discovery is one request for the whole list; never run it more often than this. */
export const MIN_DISCOVERY_INTERVAL_SECONDS = 300;
const DEFAULT_LIST_MAX_BYTES = 5_000_000;
const DEFAULT_STAGGER_MS = 300;
/** A described test project that the source flags is_training=false. Excluded from linking, sync and reporting. */
const DEFAULT_EXCLUDED_PROJECT_IDS = 'project_b29b21f0f3fb';

function intOr(v: string | undefined, fallback: number): number {
  if (v === undefined || v === '') return fallback;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

export const WorkerEnvSchema = z
  .object({
    NODE_ENV: NodeEnvSchema.default('development'),
    LOG_LEVEL: LogLevelSchema.default('info'),
    WORKER_HEARTBEAT_INTERVAL_MS: z
      .string()
      .optional()
      .transform((v) => (v !== undefined && v !== '' ? parseInt(v, 10) : DEFAULT_HEARTBEAT_MS)),
    WORKER_STALE_AFTER_MS: z
      .string()
      .optional()
      .transform((v) => (v !== undefined && v !== '' ? parseInt(v, 10) : DEFAULT_STALE_MS)),
    DATABASE_URL: z.string().optional(),
    DATABASE_POOL_MAX: z.string().optional(),
    OPERATIONS_SYNC_ENABLED: z.string().optional(),
    OPERATIONS_SOURCE_BASE_URL: z.string().optional(),
    OPERATIONS_SOURCE_USERNAME: z.string().optional(),
    OPERATIONS_SOURCE_PASSWORD: z.string().optional(),
    OPERATIONS_SYNC_POLL_INTERVAL_SECONDS: z.string().optional(),
    OPERATIONS_SYNC_REQUEST_TIMEOUT_MS: z.string().optional(),
    OPERATIONS_SYNC_MAX_RESPONSE_BYTES: z.string().optional(),
    OPERATIONS_SYNC_CONCURRENCY: z.string().optional(),
    OPERATIONS_SYNC_MAX_BACKOFF_SECONDS: z.string().optional(),
    OPERATIONS_SOURCE_AUTH_MODE: z.string().optional(),
    OPERATIONS_SOURCE_DEMO_FACTORY: z.string().optional(),
    OPERATIONS_SOURCE_DEMO_ROLE: z.string().optional(),
    OPERATIONS_SOURCE_DEMO_WORKSPACE: z.string().optional(),
    OPERATIONS_DISCOVERY_ENABLED: z.string().optional(),
    OPERATIONS_DISCOVERY_INTERVAL_SECONDS: z.string().optional(),
    OPERATIONS_EXCLUDED_PROJECT_IDS: z.string().optional(),
    OPERATIONS_PROJECT_LIST_MAX_BYTES: z.string().optional(),
    OPERATIONS_SYNC_STAGGER_MS: z.string().optional(),
  })
  // An unknown authentication mode is a configuration error, never silently treated as another mode.
  .refine(
    (data) => data.OPERATIONS_SOURCE_AUTH_MODE === undefined || data.OPERATIONS_SOURCE_AUTH_MODE === '' || (OPERATIONS_AUTH_MODES as readonly string[]).includes(data.OPERATIONS_SOURCE_AUTH_MODE),
    { message: "OPERATIONS_SOURCE_AUTH_MODE must be 'password' or 'demo'", path: ['OPERATIONS_SOURCE_AUTH_MODE'] },
  )
  .refine(
    (data) => data.WORKER_STALE_AFTER_MS >= data.WORKER_HEARTBEAT_INTERVAL_MS * 2,
    (data) => ({
      message: `WORKER_STALE_AFTER_MS (${data.WORKER_STALE_AFTER_MS}) must be >= WORKER_HEARTBEAT_INTERVAL_MS * 2 (${data.WORKER_HEARTBEAT_INTERVAL_MS * 2})`,
      path: ['WORKER_STALE_AFTER_MS'],
    }),
  )
  .transform((raw) => ({
    nodeEnv: raw.NODE_ENV,
    logLevel: raw.LOG_LEVEL,
    heartbeatIntervalMs: raw.WORKER_HEARTBEAT_INTERVAL_MS,
    staleAfterMs: raw.WORKER_STALE_AFTER_MS,
    databaseUrl: raw.DATABASE_URL !== undefined && raw.DATABASE_URL !== '' ? raw.DATABASE_URL : null,
    databasePoolMax: intOr(raw.DATABASE_POOL_MAX, 4),
    operations: {
      enabled: raw.OPERATIONS_SYNC_ENABLED === 'true',
      baseUrl: (raw.OPERATIONS_SOURCE_BASE_URL?.trim() || DEFAULT_OPERATIONS_BASE_URL).replace(/\/+$/, ''),
      username: raw.OPERATIONS_SOURCE_USERNAME?.trim() || null,
      password: raw.OPERATIONS_SOURCE_PASSWORD !== undefined && raw.OPERATIONS_SOURCE_PASSWORD !== '' ? raw.OPERATIONS_SOURCE_PASSWORD : null,
      pollIntervalSeconds: Math.max(
        MIN_OPERATIONS_POLL_SECONDS,
        intOr(raw.OPERATIONS_SYNC_POLL_INTERVAL_SECONDS, DEFAULT_OPERATIONS_POLL_SECONDS),
      ),
      requestTimeoutMs: Math.max(1_000, intOr(raw.OPERATIONS_SYNC_REQUEST_TIMEOUT_MS, DEFAULT_OPERATIONS_TIMEOUT_MS)),
      maxResponseBytes: Math.max(10_000, intOr(raw.OPERATIONS_SYNC_MAX_RESPONSE_BYTES, DEFAULT_OPERATIONS_MAX_BYTES)),
      concurrency: Math.min(
        MAX_OPERATIONS_CONCURRENCY,
        Math.max(1, intOr(raw.OPERATIONS_SYNC_CONCURRENCY, DEFAULT_OPERATIONS_CONCURRENCY)),
      ),
      maxBackoffSeconds: Math.max(
        60,
        intOr(raw.OPERATIONS_SYNC_MAX_BACKOFF_SECONDS, DEFAULT_OPERATIONS_MAX_BACKOFF_SECONDS),
      ),
      // 'password' (default) uses the dedicated integration account. 'demo' is an explicit opt-in that depends on the
      // source's demo sign-in staying available; there is no fallback from one mode to the other.
      authMode: (raw.OPERATIONS_SOURCE_AUTH_MODE === 'demo' ? 'demo' : 'password') as 'password' | 'demo',
      demo: {
        factory: raw.OPERATIONS_SOURCE_DEMO_FACTORY?.trim() || DEFAULT_DEMO_FACTORY,
        role: raw.OPERATIONS_SOURCE_DEMO_ROLE?.trim() || DEFAULT_DEMO_ROLE,
        workspace: raw.OPERATIONS_SOURCE_DEMO_WORKSPACE?.trim() || DEFAULT_DEMO_WORKSPACE,
      },
      discovery: {
        enabled: raw.OPERATIONS_DISCOVERY_ENABLED === 'true',
        intervalSeconds: Math.max(MIN_DISCOVERY_INTERVAL_SECONDS, intOr(raw.OPERATIONS_DISCOVERY_INTERVAL_SECONDS, DEFAULT_DISCOVERY_INTERVAL_SECONDS)),
        excludedProjectIds: (raw.OPERATIONS_EXCLUDED_PROJECT_IDS === undefined ? DEFAULT_EXCLUDED_PROJECT_IDS : raw.OPERATIONS_EXCLUDED_PROJECT_IDS)
          .split(',')
          .map((x) => x.trim())
          .filter((x) => x !== ''),
      },
      projectListMaxBytes: Math.max(100_000, intOr(raw.OPERATIONS_PROJECT_LIST_MAX_BYTES, DEFAULT_LIST_MAX_BYTES)),
      staggerMs: Math.max(0, intOr(raw.OPERATIONS_SYNC_STAGGER_MS, DEFAULT_STAGGER_MS)),
    },
  }));

export type WorkerEnv = z.infer<typeof WorkerEnvSchema>;
