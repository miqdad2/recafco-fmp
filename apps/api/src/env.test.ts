import { describe, it, expect } from 'vitest';
import { ApiEnvSchema } from '@recafco/config';

const JWT_SECRET = 'test-jwt-access-secret-at-least-32-chars-long!';

const validDb = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_ACCESS_SECRET: JWT_SECRET,
};

describe('ApiEnvSchema', () => {
  it('applies defaults when optional vars are absent', () => {
    const result = ApiEnvSchema.parse({ NODE_ENV: 'development', ...validDb });
    expect(result.nodeEnv).toBe('development');
    expect(result.port).toBe(4000);
    expect(result.logLevel).toBe('info');
    expect(result.corsAllowedOrigins).toContain('http://localhost:3000');
    expect(result.databaseConnectionTimeoutMs).toBe(10_000);
    expect(result.databaseStatementTimeoutMs).toBe(30_000);
    expect(result.databasePoolMax).toBe(10);
  });

  it('parses a custom port', () => {
    const result = ApiEnvSchema.parse({ NODE_ENV: 'development', API_PORT: '5000', ...validDb });
    expect(result.port).toBe(5000);
  });

  it('parses multiple CORS origins', () => {
    const result = ApiEnvSchema.parse({
      NODE_ENV: 'development',
      CORS_ALLOWED_ORIGINS: 'http://localhost:3000,http://localhost:3001',
      ...validDb,
    });
    expect(result.corsAllowedOrigins).toContain('http://localhost:3000');
    expect(result.corsAllowedOrigins).toContain('http://localhost:3001');
  });

  it('rejects wildcard CORS in production', () => {
    expect(() =>
      ApiEnvSchema.parse({
        NODE_ENV: 'production',
        CORS_ALLOWED_ORIGINS: '*',
        ...validDb,
      }),
    ).toThrow();
  });

  it('rejects invalid NODE_ENV', () => {
    expect(() => ApiEnvSchema.parse({ NODE_ENV: 'staging', ...validDb })).toThrow();
  });

  it('rejects invalid LOG_LEVEL', () => {
    expect(() =>
      ApiEnvSchema.parse({ NODE_ENV: 'development', LOG_LEVEL: 'verbose', ...validDb }),
    ).toThrow();
  });

  it('rejects missing DATABASE_URL', () => {
    expect(() => ApiEnvSchema.parse({ NODE_ENV: 'development' })).toThrow();
  });

  it('rejects non-postgresql DATABASE_URL scheme', () => {
    expect(() =>
      ApiEnvSchema.parse({ NODE_ENV: 'development', DATABASE_URL: 'mysql://user:pass@localhost/db' }),
    ).toThrow();
  });

  it('accepts postgres:// scheme', () => {
    const result = ApiEnvSchema.parse({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
      JWT_ACCESS_SECRET: JWT_SECRET,
    });
    expect(result.databaseUrl).toBe('postgres://user:pass@localhost:5432/db');
  });

  it('parses custom database timeout and pool settings', () => {
    const result = ApiEnvSchema.parse({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      JWT_ACCESS_SECRET: JWT_SECRET,
      DATABASE_CONNECTION_TIMEOUT_MS: '5000',
      DATABASE_STATEMENT_TIMEOUT_MS: '15000',
      DATABASE_POOL_MAX: '20',
    });
    expect(result.databaseConnectionTimeoutMs).toBe(5000);
    expect(result.databaseStatementTimeoutMs).toBe(15000);
    expect(result.databasePoolMax).toBe(20);
  });

  it('validation error does not contain DATABASE_URL value', () => {
    let thrownMessage = '';
    try {
      ApiEnvSchema.parse({ NODE_ENV: 'development', DATABASE_URL: 'mysql://secret:password@host/db' });
    } catch (err) {
      if (err instanceof Error) thrownMessage = err.message;
    }
    expect(thrownMessage).not.toContain('secret');
    expect(thrownMessage).not.toContain('password');
  });

  // FMP-MAINT-02 — MMS live dashboard API config
  it('defaults MMS config: base URL + endpoint set, key not configured', () => {
    const result = ApiEnvSchema.parse({ NODE_ENV: 'development', ...validDb });
    expect(result.mmsBaseUrl).toBe('http://192.168.1.17:81');
    expect(result.mmsLiveDashboardEndpoint).toBe('/api/integrations/fmp/maintenance-dashboard/live');
    expect(result.mmsIntegrationKey).toBeNull();
    expect(result.mmsQueryTimeoutMs).toBe(8_000);
    expect(result.mmsLiveRefreshSeconds).toBe(30);
  });

  it('parses MMS config, strips trailing slash, trims key', () => {
    const result = ApiEnvSchema.parse({
      NODE_ENV: 'development',
      ...validDb,
      MMS_BASE_URL: 'http://mms.local:81/',
      MMS_LIVE_DASHBOARD_ENDPOINT: '/api/custom/live',
      MMS_INTEGRATION_KEY: '  k'.padEnd(40, 'x') + '  ',
      MMS_QUERY_TIMEOUT_MS: '5000',
      MMS_LIVE_REFRESH_SECONDS: '45',
    });
    expect(result.mmsBaseUrl).toBe('http://mms.local:81');
    expect(result.mmsLiveDashboardEndpoint).toBe('/api/custom/live');
    expect(result.mmsIntegrationKey).toBe('k'.padEnd(38, 'x'));
    expect(result.mmsQueryTimeoutMs).toBe(5000);
    expect(result.mmsLiveRefreshSeconds).toBe(45);
  });

  it('never polls MMS faster than 15 seconds', () => {
    const result = ApiEnvSchema.parse({ NODE_ENV: 'development', ...validDb, MMS_LIVE_REFRESH_SECONDS: '5' });
    expect(result.mmsLiveRefreshSeconds).toBe(15);
  });

  it('treats an empty MMS_INTEGRATION_KEY as not configured', () => {
    const result = ApiEnvSchema.parse({ NODE_ENV: 'development', ...validDb, MMS_INTEGRATION_KEY: '   ' });
    expect(result.mmsIntegrationKey).toBeNull();
  });

  it('rejects a non-http MMS_BASE_URL and a relative-less endpoint', () => {
    expect(() =>
      ApiEnvSchema.parse({ NODE_ENV: 'development', ...validDb, MMS_BASE_URL: 'ftp://mms' }),
    ).toThrow();
    expect(() =>
      ApiEnvSchema.parse({ NODE_ENV: 'development', ...validDb, MMS_LIVE_DASHBOARD_ENDPOINT: 'http://evil/x' }),
    ).toThrow();
  });
});
