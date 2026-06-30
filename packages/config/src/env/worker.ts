import { z } from 'zod';
import { NodeEnvSchema, LogLevelSchema } from './shared';

const DEFAULT_HEARTBEAT_MS = 30_000;
const DEFAULT_STALE_MS = 60_000;

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
  })
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
  }));

export type WorkerEnv = z.infer<typeof WorkerEnvSchema>;
