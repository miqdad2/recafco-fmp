import { describe, it, expect } from 'vitest';
import { runWithRequestContext, getRequestContext, getRequestId } from './request-context';

describe('runWithRequestContext / getRequestContext', () => {
  it('returns undefined outside a context', () => {
    expect(getRequestContext()).toBeUndefined();
    expect(getRequestId()).toBeUndefined();
  });

  it('returns the active context inside run()', () => {
    const ctx = { requestId: 'req-123', service: 'api', environment: 'test' };
    runWithRequestContext(ctx, () => {
      expect(getRequestContext()).toEqual(ctx);
      expect(getRequestId()).toBe('req-123');
    });
  });

  it('restores undefined after run() completes', () => {
    const ctx = { requestId: 'req-abc', service: 'api', environment: 'test' };
    runWithRequestContext(ctx, () => {});
    expect(getRequestContext()).toBeUndefined();
  });

  it('isolates concurrent contexts', async () => {
    const results: string[] = [];

    await Promise.all([
      new Promise<void>((resolve) => {
        const ctx = { requestId: 'req-A', service: 'api', environment: 'test' };
        runWithRequestContext(ctx, () => {
          setTimeout(() => {
            results.push(getRequestId() ?? 'none');
            resolve();
          }, 10);
        });
      }),
      new Promise<void>((resolve) => {
        const ctx = { requestId: 'req-B', service: 'api', environment: 'test' };
        runWithRequestContext(ctx, () => {
          setTimeout(() => {
            results.push(getRequestId() ?? 'none');
            resolve();
          }, 5);
        });
      }),
    ]);

    expect(results).toContain('req-A');
    expect(results).toContain('req-B');
    expect(results).toHaveLength(2);
  });
});
