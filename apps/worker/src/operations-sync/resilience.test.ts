import { describe, it, expect } from 'vitest';
import { nextDelaySeconds, SourceCircuitBreaker } from './resilience';

describe('nextDelaySeconds', () => {
  const mid = () => 0.5; // zero jitter
  it('uses the poll interval when healthy', () => {
    expect(nextDelaySeconds(0, 60, 900, mid)).toBe(60);
  });
  it('backs off exponentially and caps', () => {
    expect(nextDelaySeconds(1, 60, 900, mid)).toBe(120);
    expect(nextDelaySeconds(2, 60, 900, mid)).toBe(240);
    expect(nextDelaySeconds(3, 60, 900, mid)).toBe(480);
    expect(nextDelaySeconds(4, 60, 900, mid)).toBe(900);
    expect(nextDelaySeconds(50, 60, 900, mid)).toBe(900);
  });
  it('never goes below the poll interval', () => {
    expect(nextDelaySeconds(1, 60, 900, () => 0)).toBeGreaterThanOrEqual(60);
  });
});

describe('SourceCircuitBreaker', () => {
  const opts = { threshold: 3, baseCooldownMs: 60_000, maxCooldownMs: 600_000, authCooldownMs: 1_800_000 };

  it('stays closed below the threshold and opens at it', () => {
    let t = 0;
    const b = new SourceCircuitBreaker(opts, () => t);
    b.recordFailure('SOURCE');
    b.recordFailure('SOURCE');
    expect(b.isOpen()).toBe(false);
    b.recordFailure('SOURCE');
    expect(b.isOpen()).toBe(true);
    t = 59_999;
    expect(b.isOpen()).toBe(true);
    t = 60_000;
    expect(b.isOpen()).toBe(false); // probe allowed
  });

  it('doubles the cooldown when the probe fails again, up to the cap', () => {
    let t = 0;
    const b = new SourceCircuitBreaker(opts, () => t);
    for (let i = 0; i < 3; i++) b.recordFailure('SOURCE');
    t = 60_000;
    b.recordFailure('SOURCE'); // probe failed
    expect(b.state().openUntil?.getTime()).toBe(60_000 + 120_000);
    t = 180_000;
    b.recordFailure('SOURCE');
    expect(b.state().openUntil?.getTime()).toBe(180_000 + 240_000);
    t = 420_000;
    b.recordFailure('SOURCE');
    b.recordFailure('SOURCE');
    expect((b.state().openUntil?.getTime() ?? 0) - 420_000).toBeLessThanOrEqual(600_000);
  });

  it('opens immediately and for long on an authentication failure (no login retry loop)', () => {
    const b = new SourceCircuitBreaker(opts, () => 0);
    b.recordFailure('AUTH');
    expect(b.isOpen()).toBe(true);
    expect(b.state().reason).toBe('AUTH');
    expect(b.state().openUntil?.getTime()).toBe(1_800_000);
  });

  it('honours Retry-After', () => {
    const b = new SourceCircuitBreaker(opts, () => 0);
    b.recordFailure('SOURCE', 300);
    expect(b.state().openUntil?.getTime()).toBe(300_000);
  });

  it('closes fully after a success', () => {
    const b = new SourceCircuitBreaker(opts, () => 0);
    for (let i = 0; i < 3; i++) b.recordFailure('SOURCE');
    b.recordSuccess();
    expect(b.isOpen()).toBe(false);
    expect(b.state().consecutiveFailures).toBe(0);
  });
});
