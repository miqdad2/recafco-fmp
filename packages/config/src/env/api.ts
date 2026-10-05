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

// FMP-MAINT-01/02/06 — the live MMS (Maintenance Management System).
// MMS_BASE_URL is the INTERNAL address the FMP API uses to call MMS's
// read-only live dashboard API server-to-server; it is never shown to users.
// MMS_PUBLIC_BASE_URL is the address users open in their browser — every
// link FMP shows is built on it.
const DEFAULT_MMS_BASE_URL = 'http://192.168.1.17:81';
const DEFAULT_MMS_PUBLIC_BASE_URL = 'https://maintenance.recafco.online';
const DEFAULT_MMS_LIVE_DASHBOARD_ENDPOINT = '/api/integrations/fmp/maintenance-dashboard/live';
const DEFAULT_MMS_QUERY_TIMEOUT_MS = 8_000;
const DEFAULT_MMS_LIVE_REFRESH_SECONDS = 30;
/** Never poll MMS faster than this, whatever the env says. */
const MIN_MMS_LIVE_REFRESH_SECONDS = 15;

function isHttpUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
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
    WORKFLOW_ATTACHMENTS_DIR: z.string().optional(),
    CLOSEOUT_ATTACHMENTS_DIR: z.string().optional(),
    VARIATION_ATTACHMENTS_DIR: z.string().optional(),
    DOCUMENT_OBLIGATION_ATTACHMENTS_DIR: z.string().optional(),
    ERECTION_METHOD_STATEMENT_ATTACHMENTS_DIR: z.string().optional(),
    ERECTION_METHOD_STATEMENT_APPROVAL_ATTACHMENTS_DIR: z.string().optional(),
    ERECTION_SCHEDULE_ATTACHMENTS_DIR: z.string().optional(),
    ERECTION_DELIVERY_START_ATTACHMENTS_DIR: z.string().optional(),
    ERECTION_START_ATTACHMENTS_DIR: z.string().optional(),
    ERECTION_CHECKLIST_ATTACHMENTS_DIR: z.string().optional(),
    INCIDENT_ATTACHMENTS_DIR: z.string().optional(),
    TECHNICAL_DRAWING_ATTACHMENTS_DIR: z.string().optional(),
    // FMP-MAINT-02 — MMS live dashboard API. MMS_INTEGRATION_KEY is optional:
    // when absent, the Maintenance dashboard shows "MMS integration not
    // configured". It must equal MMS's own FMP_INTEGRATION_KEY and is only
    // ever sent server-to-server in the x-fmp-integration-key header.
    MMS_BASE_URL: z
      .string()
      .optional()
      .refine((v) => v === undefined || v === '' || isHttpUrl(v), {
        message: 'MMS_BASE_URL must use http:// or https:// scheme',
      }),
    MMS_PUBLIC_BASE_URL: z
      .string()
      .optional()
      .refine((v) => v === undefined || v === '' || isHttpUrl(v), {
        message: 'MMS_PUBLIC_BASE_URL must use http:// or https:// scheme',
      }),
    MMS_LIVE_DASHBOARD_ENDPOINT: z
      .string()
      .optional()
      .refine((v) => v === undefined || v === '' || v.startsWith('/'), {
        message: 'MMS_LIVE_DASHBOARD_ENDPOINT must be a path starting with /',
      }),
    MMS_INTEGRATION_KEY: z.string().optional(),
    MMS_QUERY_TIMEOUT_MS: z.string().optional(),
    MMS_LIVE_REFRESH_SECONDS: z.string().optional(),
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
      workflowAttachmentsDir: raw.WORKFLOW_ATTACHMENTS_DIR ?? './storage/workflow-attachments',
      closeoutAttachmentsDir: raw.CLOSEOUT_ATTACHMENTS_DIR ?? './storage/closeout-attachments',
      variationAttachmentsDir: raw.VARIATION_ATTACHMENTS_DIR ?? './storage/variation-attachments',
      documentObligationAttachmentsDir:
        raw.DOCUMENT_OBLIGATION_ATTACHMENTS_DIR ?? './storage/document-obligation-attachments',
      erectionMethodStatementAttachmentsDir:
        raw.ERECTION_METHOD_STATEMENT_ATTACHMENTS_DIR ?? './storage/erection-method-statement-attachments',
      erectionMethodStatementApprovalAttachmentsDir:
        raw.ERECTION_METHOD_STATEMENT_APPROVAL_ATTACHMENTS_DIR ?? './storage/erection-method-statement-approval-attachments',
      erectionScheduleAttachmentsDir: raw.ERECTION_SCHEDULE_ATTACHMENTS_DIR ?? './storage/erection-schedule-attachments',
      erectionDeliveryStartAttachmentsDir: raw.ERECTION_DELIVERY_START_ATTACHMENTS_DIR ?? './storage/erection-delivery-start-attachments',
      erectionStartAttachmentsDir: raw.ERECTION_START_ATTACHMENTS_DIR ?? './storage/erection-start-attachments',
      erectionChecklistAttachmentsDir: raw.ERECTION_CHECKLIST_ATTACHMENTS_DIR ?? './storage/erection-checklist-attachments',
      incidentAttachmentsDir: raw.INCIDENT_ATTACHMENTS_DIR ?? './storage/incident-attachments',
      technicalDrawingAttachmentsDir:
        raw.TECHNICAL_DRAWING_ATTACHMENTS_DIR ?? './storage/technical-drawing-attachments',
      mmsBaseUrl: (raw.MMS_BASE_URL || DEFAULT_MMS_BASE_URL).replace(/\/+$/, ''),
      mmsPublicBaseUrl: (raw.MMS_PUBLIC_BASE_URL || DEFAULT_MMS_PUBLIC_BASE_URL).replace(/\/+$/, ''),
      mmsLiveDashboardEndpoint: raw.MMS_LIVE_DASHBOARD_ENDPOINT || DEFAULT_MMS_LIVE_DASHBOARD_ENDPOINT,
      mmsIntegrationKey: raw.MMS_INTEGRATION_KEY?.trim() || null,
      mmsQueryTimeoutMs: parseIntWithDefault(raw.MMS_QUERY_TIMEOUT_MS, DEFAULT_MMS_QUERY_TIMEOUT_MS),
      mmsLiveRefreshSeconds: Math.max(
        MIN_MMS_LIVE_REFRESH_SECONDS,
        parseIntWithDefault(raw.MMS_LIVE_REFRESH_SECONDS, DEFAULT_MMS_LIVE_REFRESH_SECONDS),
      ),
    };
  });

export type ApiEnv = z.infer<typeof ApiEnvSchema>;
