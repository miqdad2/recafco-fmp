import { describe, it, expect, vi } from 'vitest';
import { checkDatabaseHealth } from './database-health';
import type { PrismaClient } from './generated/prisma/client';

function makeMockClient(overrides?: Partial<{ $executeRaw: unknown }>) {
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    ...overrides,
  } as unknown as PrismaClient;
}

describe('checkDatabaseHealth', () => {
  it('returns ok when SELECT 1 succeeds', async () => {
    const client = makeMockClient();
    const result = await checkDatabaseHealth(client);
    expect(result.status).toBe('ok');
    expect(typeof result.durationMs).toBe('number');
  });

  it('returns unavailable with connection_refused category on ECONNREFUSED', async () => {
    const client = makeMockClient({
      $executeRaw: vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432')),
    });
    const result = await checkDatabaseHealth(client);
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') {
      expect(result.category).toBe('connection_refused');
    }
  });

  it('returns unavailable with timeout category when check times out', async () => {
    const client = makeMockClient({
      $executeRaw: vi.fn().mockImplementation(
        () => new Promise<never>((_, reject) => setTimeout(() => reject(new Error('health check timeout')), 10)),
      ),
    });
    const result = await checkDatabaseHealth(client, 5);
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') {
      expect(result.category).toBe('timeout');
    }
  });

  it('returns unavailable with unknown category for generic errors', async () => {
    const client = makeMockClient({
      $executeRaw: vi.fn().mockRejectedValue(new Error('some other error')),
    });
    const result = await checkDatabaseHealth(client);
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') {
      expect(result.category).toBe('unknown');
    }
  });

  it('does not expose error message details in the result', async () => {
    const client = makeMockClient({
      $executeRaw: vi.fn().mockRejectedValue(
        new Error('password authentication failed for user "recafco_fmp_app"'),
      ),
    });
    const result = await checkDatabaseHealth(client);
    expect(result.status).toBe('unavailable');
    const resultStr = JSON.stringify(result);
    expect(resultStr).not.toContain('recafco_fmp_app');
    expect(resultStr).not.toContain('password authentication failed');
  });

  it('records durationMs on failure', async () => {
    const client = makeMockClient({
      $executeRaw: vi.fn().mockRejectedValue(new Error('connection failed')),
    });
    const result = await checkDatabaseHealth(client);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
