import { describe, it, expect } from 'vitest';
import { DatabaseEnvSchema } from './database';

const VALID_URL = 'postgresql://recafco_fmp_app:secret@localhost:5432/recafco_fmp_dev';

describe('DatabaseEnvSchema', () => {
  it('accepts a valid postgresql:// URL and applies defaults', () => {
    const result = DatabaseEnvSchema.parse({ DATABASE_URL: VALID_URL });
    expect(result.databaseUrl).toBe(VALID_URL);
    expect(result.databaseConnectionTimeoutMs).toBe(10_000);
    expect(result.databaseStatementTimeoutMs).toBe(30_000);
    expect(result.databasePoolMax).toBe(10);
  });

  it('accepts a postgres:// URL', () => {
    const url = 'postgres://user:pass@localhost:5432/db';
    const result = DatabaseEnvSchema.parse({ DATABASE_URL: url });
    expect(result.databaseUrl).toBe(url);
  });

  it('rejects missing DATABASE_URL', () => {
    expect(() => DatabaseEnvSchema.parse({})).toThrow();
  });

  it('rejects a non-postgres scheme', () => {
    expect(() =>
      DatabaseEnvSchema.parse({ DATABASE_URL: 'mysql://user:pass@localhost/db' }),
    ).toThrow();
  });

  it('rejects an empty DATABASE_URL', () => {
    expect(() => DatabaseEnvSchema.parse({ DATABASE_URL: '' })).toThrow();
  });

  it('parses custom connection timeout', () => {
    const result = DatabaseEnvSchema.parse({
      DATABASE_URL: VALID_URL,
      DATABASE_CONNECTION_TIMEOUT_MS: '5000',
    });
    expect(result.databaseConnectionTimeoutMs).toBe(5_000);
  });

  it('parses custom statement timeout', () => {
    const result = DatabaseEnvSchema.parse({
      DATABASE_URL: VALID_URL,
      DATABASE_STATEMENT_TIMEOUT_MS: '15000',
    });
    expect(result.databaseStatementTimeoutMs).toBe(15_000);
  });

  it('parses custom pool max', () => {
    const result = DatabaseEnvSchema.parse({
      DATABASE_URL: VALID_URL,
      DATABASE_POOL_MAX: '5',
    });
    expect(result.databasePoolMax).toBe(5);
  });

  it('error message does not include the URL value when scheme is invalid', () => {
    try {
      DatabaseEnvSchema.parse({ DATABASE_URL: 'mysql://secret-user:secret-pass@prod-host/db' });
      expect.fail('should have thrown');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).not.toContain('secret-pass');
      expect(msg).not.toContain('prod-host');
      expect(msg).toContain('DATABASE_URL');
    }
  });
});
