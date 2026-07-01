import { z } from 'zod';
import { NodeEnvSchema, LogLevelSchema } from './shared';

const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;
const DEFAULT_STATEMENT_TIMEOUT_MS = 30_000;
const DEFAULT_POOL_MAX = 10;

function parsePortString(val: string | undefined, defaultPort: number): number {
  if (val === undefined || val === '') return defaultPort;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultPort : parsed;
}

function parseIntWithDefault(val: string | undefined, defaultVal: number): number {
  if (val === undefined || val === '') return defaultVal;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultVal : parsed;
}

function parseCorsOrigins(val: string | undefined, nodeEnv: string): readonly string[] {
  const defaultOrigin = 'http://localhost:3000';
  const raw = val ?? (nodeEnv === 'production' ? '' : defaultOrigin);
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function isDatabaseUrl(url: string): boolean {
  return url.startsWith('postgresql://') || url.startsWith('postgres://');
}

const DEFAULT_JWT_ACCESS_EXPIRES_SECONDS = 900; // 15 minutes
const DEFAULT_REFRESH_TOKEN_EXPIRES_DAYS = 7;

export const ApiEnvSchema = z
  .object({
    NODE_ENV: NodeEnvSchema.default('development'),
    API_PORT: z.string().optional(),
    LOG_LEVEL: LogLevelSchema.default('info'),
    CORS_ALLOWED_ORIGINS: z.string().optional(),
    DATABASE_URL: z
      .string()
      .min(1, 'DATABASE_URL is required')
      .refine(isDatabaseUrl, {
        message: 'DATABASE_URL must use postgresql:// or postgres:// scheme',
      }),
    DATABASE_CONNECTION_TIMEOUT_MS: z.string().optional(),
    DATABASE_STATEMENT_TIMEOUT_MS: z.string().optional(),
    DATABASE_POOL_MAX: z.string().optional(),
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_ACCESS_EXPIRES_SECONDS: z.string().optional(),
    REFRESH_TOKEN_EXPIRES_DAYS: z.string().optional(),
  })
  .transform((raw) => {
    const origins = parseCorsOrigins(raw.CORS_ALLOWED_ORIGINS, raw.NODE_ENV);
    if (raw.NODE_ENV === 'production' && origins.includes('*')) {
      throw new Error('Wildcard CORS origin (*) is not permitted in production');
    }
    return {
      nodeEnv: raw.NODE_ENV,
      port: parsePortString(raw.API_PORT, 4000),
      logLevel: raw.LOG_LEVEL,
      corsAllowedOrigins: origins,
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
      jwtAccessSecret: raw.JWT_ACCESS_SECRET,
      jwtAccessExpiresSeconds: parseIntWithDefault(
        raw.JWT_ACCESS_EXPIRES_SECONDS,
        DEFAULT_JWT_ACCESS_EXPIRES_SECONDS,
      ),
      refreshTokenExpiresDays: parseIntWithDefault(
        raw.REFRESH_TOKEN_EXPIRES_DAYS,
        DEFAULT_REFRESH_TOKEN_EXPIRES_DAYS,
      ),
    };
  });

export type ApiEnv = z.infer<typeof ApiEnvSchema>;
