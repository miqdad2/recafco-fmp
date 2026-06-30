import { z } from 'zod';

const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;
const DEFAULT_STATEMENT_TIMEOUT_MS = 30_000;
const DEFAULT_POOL_MAX = 10;

function isDatabaseUrl(url: string): boolean {
  return url.startsWith('postgresql://') || url.startsWith('postgres://');
}

function parseIntWithDefault(val: string | undefined, defaultVal: number): number {
  if (val === undefined || val === '') return defaultVal;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultVal : parsed;
}

export const DatabaseEnvSchema = z
  .object({
    DATABASE_URL: z
      .string()
      .min(1, 'DATABASE_URL is required')
      .refine(isDatabaseUrl, {
        message: 'DATABASE_URL must use postgresql:// or postgres:// scheme',
      }),
    DATABASE_CONNECTION_TIMEOUT_MS: z.string().optional(),
    DATABASE_STATEMENT_TIMEOUT_MS: z.string().optional(),
    DATABASE_POOL_MAX: z.string().optional(),
  })
  .transform((raw) => ({
    databaseUrl: raw.DATABASE_URL,
    databaseConnectionTimeoutMs: parseIntWithDefault(
      raw.DATABASE_CONNECTION_TIMEOUT_MS,
      DEFAULT_CONNECTION_TIMEOUT_MS,
    ),
    databaseStatementTimeoutMs: parseIntWithDefault(
      raw.DATABASE_STATEMENT_TIMEOUT_MS,
      DEFAULT_STATEMENT_TIMEOUT_MS,
    ),
    databasePoolMax: parseIntWithDefault(raw.DATABASE_POOL_MAX, DEFAULT_POOL_MAX),
  }));

export type DatabaseEnv = z.infer<typeof DatabaseEnvSchema>;
