import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { IpThrottleGuard } from './ip-throttle.guard';

function makeContext(ip: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ ip }),
    }),
  } as unknown as ExecutionContext;
}

describe('IpThrottleGuard', () => {
  let guard: IpThrottleGuard;

  beforeEach(() => {
    guard = new IpThrottleGuard();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true for the first request from an IP', () => {
    expect(guard.canActivate(makeContext('10.0.0.1'))).toBe(true);
  });

  it('returns true for requests below the rate limit', () => {
    for (let i = 0; i < 9; i++) {
      expect(guard.canActivate(makeContext('10.0.0.2'))).toBe(true);
    }
  });

  it('throws 429 on the 11th request within the window', () => {
    for (let i = 0; i < 10; i++) {
      guard.canActivate(makeContext('10.0.0.3'));
    }
    expect(() => guard.canActivate(makeContext('10.0.0.3'))).toThrow(HttpException);
  });

  it('does not throttle different IPs independently', () => {
    for (let i = 0; i < 10; i++) {
      guard.canActivate(makeContext('10.0.0.4'));
    }
    // A different IP should still be allowed
    expect(guard.canActivate(makeContext('10.0.0.5'))).toBe(true);
  });

  it('resets count after the window expires', () => {
    for (let i = 0; i < 10; i++) {
      guard.canActivate(makeContext('10.0.0.6'));
    }
    // Advance past the 1-minute window
    vi.advanceTimersByTime(61_000);
    // Should now be allowed again
    expect(guard.canActivate(makeContext('10.0.0.6'))).toBe(true);
  });
});
