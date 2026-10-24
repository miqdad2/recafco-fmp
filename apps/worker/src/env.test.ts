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

  describe('Operations sync settings (FMP-OPS-01)', () => {
    it('is OFF by default and holds no credentials', () => {
      const r = WorkerEnvSchema.parse({ NODE_ENV: 'development' });
      expect(r.operations.enabled).toBe(false);
      expect(r.operations.username).toBeNull();
      expect(r.operations.password).toBeNull();
      expect(r.databaseUrl).toBeNull();
      expect(r.operations.pollIntervalSeconds).toBe(60);
      expect(r.operations.baseUrl).toBe('https://management.recafco.online');
    });

    it('only enables on the literal string true', () => {
      expect(WorkerEnvSchema.parse({ NODE_ENV: 'development', OPERATIONS_SYNC_ENABLED: 'yes' }).operations.enabled).toBe(false);
      expect(WorkerEnvSchema.parse({ NODE_ENV: 'development', OPERATIONS_SYNC_ENABLED: 'true' }).operations.enabled).toBe(true);
    });

    it('never polls faster than 15 s and caps concurrency at 4', () => {
      const r = WorkerEnvSchema.parse({
        NODE_ENV: 'development',
        OPERATIONS_SYNC_POLL_INTERVAL_SECONDS: '1',
        OPERATIONS_SYNC_CONCURRENCY: '50',
      });
      expect(r.operations.pollIntervalSeconds).toBe(15);
      expect(r.operations.concurrency).toBe(4);
    });

    it('authentication defaults to the dedicated account; demo is an explicit opt-in', () => {
      const d = WorkerEnvSchema.parse({ NODE_ENV: 'development' });
      expect(d.operations.authMode).toBe('password');
      expect(WorkerEnvSchema.parse({ NODE_ENV: 'development', OPERATIONS_SOURCE_AUTH_MODE: 'demo' }).operations.authMode).toBe('demo');
    });

    it('an unknown authentication mode is an error, never silently another mode', () => {
      expect(() => WorkerEnvSchema.parse({ NODE_ENV: 'development', OPERATIONS_SOURCE_AUTH_MODE: 'Demo ' })).toThrow();
      expect(() => WorkerEnvSchema.parse({ NODE_ENV: 'development', OPERATIONS_SOURCE_AUTH_MODE: 'auto' })).toThrow();
    });

    it('demo sign-in payload defaults to exactly the supplied values and can be configured', () => {
      expect(WorkerEnvSchema.parse({ NODE_ENV: 'development' }).operations.demo).toEqual({ factory: 'precast', role: 'manager', workspace: 'existing' });
      const r = WorkerEnvSchema.parse({ NODE_ENV: 'development', OPERATIONS_SOURCE_DEMO_FACTORY: 'hollowcore' });
      expect(r.operations.demo.factory).toBe('hollowcore');
    });

    it('discovery is OFF by default, never faster than every 5 minutes, and excludes the described test project by default', () => {
      const d = WorkerEnvSchema.parse({ NODE_ENV: 'development' }).operations.discovery;
      expect(d.enabled).toBe(false);
      expect(d.intervalSeconds).toBe(900);
      expect(d.excludedProjectIds).toEqual(['project_b29b21f0f3fb']);
      const fast = WorkerEnvSchema.parse({ NODE_ENV: 'development', OPERATIONS_DISCOVERY_ENABLED: 'true', OPERATIONS_DISCOVERY_INTERVAL_SECONDS: '5' }).operations.discovery;
      expect(fast).toMatchObject({ enabled: true, intervalSeconds: 300 });
    });

    it('the exclusion list is configurable (an empty value clears it)', () => {
      expect(WorkerEnvSchema.parse({ NODE_ENV: 'development', OPERATIONS_EXCLUDED_PROJECT_IDS: 'a, b ,,c' }).operations.discovery.excludedProjectIds).toEqual(['a', 'b', 'c']);
      expect(WorkerEnvSchema.parse({ NODE_ENV: 'development', OPERATIONS_EXCLUDED_PROJECT_IDS: '' }).operations.discovery.excludedProjectIds).toEqual([]);
    });

    it('stagger and list-size limits have safe defaults', () => {
      const o = WorkerEnvSchema.parse({ NODE_ENV: 'development' }).operations;
      expect(o.staggerMs).toBe(300);
      expect(o.projectListMaxBytes).toBe(5_000_000);
    });

    it('trims a trailing slash from the base URL', () => {
      const r = WorkerEnvSchema.parse({ NODE_ENV: 'development', OPERATIONS_SOURCE_BASE_URL: 'https://x.example/' });
      expect(r.operations.baseUrl).toBe('https://x.example');
    });
  });
});
