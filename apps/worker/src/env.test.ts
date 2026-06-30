import { describe, it, expect } from 'vitest';
import { WorkerEnvSchema } from '@recafco/config';

describe('WorkerEnvSchema', () => {
  it('applies defaults when optional vars are absent', () => {
    const result = WorkerEnvSchema.parse({ NODE_ENV: 'development' });
    expect(result.nodeEnv).toBe('development');
    expect(result.logLevel).toBe('info');
    expect(result.heartbeatIntervalMs).toBe(30_000);
    expect(result.staleAfterMs).toBe(60_000);
  });

  it('parses custom heartbeat and stale values', () => {
    const result = WorkerEnvSchema.parse({
      NODE_ENV: 'development',
      WORKER_HEARTBEAT_INTERVAL_MS: '5000',
      WORKER_STALE_AFTER_MS: '15000',
    });
    expect(result.heartbeatIntervalMs).toBe(5_000);
    expect(result.staleAfterMs).toBe(15_000);
  });

  it('rejects stale < heartbeat * 2', () => {
    expect(() =>
      WorkerEnvSchema.parse({
        NODE_ENV: 'development',
        WORKER_HEARTBEAT_INTERVAL_MS: '10000',
        WORKER_STALE_AFTER_MS: '10000',
      }),
    ).toThrow();
  });

  it('accepts stale == heartbeat * 2', () => {
    const result = WorkerEnvSchema.parse({
      NODE_ENV: 'development',
      WORKER_HEARTBEAT_INTERVAL_MS: '10000',
      WORKER_STALE_AFTER_MS: '20000',
    });
    expect(result.staleAfterMs).toBe(20_000);
  });
});
