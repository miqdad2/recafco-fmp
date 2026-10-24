// ---------------------------------------------------------------------------
// FMP-OPS-01 — retry spacing and the source-level circuit breaker. Both are
// pure (injectable clock / random) so they are unit-testable.
// ---------------------------------------------------------------------------

/**
 * Delay before the next attempt for a project.
 *  failures = 0  -> the normal poll interval (± small jitter so projects do not synchronise).
 *  failures >= 1 -> exponential backoff from the poll interval, capped at maxBackoffSeconds.
 */
export function nextDelaySeconds(
  consecutiveFailures: number,
  pollIntervalSeconds: number,
  maxBackoffSeconds: number,
  random: () => number = Math.random,
): number {
  const jitter = 1 + (random() * 0.2 - 0.1); // ±10%
  if (consecutiveFailures <= 0) return Math.max(1, Math.round(pollIntervalSeconds * jitter));
  const exp = pollIntervalSeconds * 2 ** Math.min(consecutiveFailures, 16);
  return Math.max(pollIntervalSeconds, Math.round(Math.min(maxBackoffSeconds, exp) * jitter));
}

export type BreakerReason = 'AUTH' | 'SOURCE';

export interface BreakerState {
  open: boolean;
  openUntil: Date | null;
  consecutiveFailures: number;
  reason: BreakerReason | null;
}

/**
 * Pauses ALL external calls after sustained source-level failure.
 *  - AUTH failures (sign-in rejected) open at once for a long cooldown: repeated bad logins
 *    can lock the integration account and must never turn into a retry loop.
 *  - SOURCE failures (network, timeout, 5xx) open after `threshold` in a row, with a cooldown
 *    that doubles each time the probe after a cooldown fails again, up to `maxCooldownMs`.
 * Per-project problems (403, 404, invalid body) must NOT be reported here: one bad project
 * must not stop the others.
 */
export class SourceCircuitBreaker {
  private failures = 0;
  private openUntilMs: number | null = null;
  private reason: BreakerReason | null = null;
  private trips = 0;

  constructor(
    private readonly opts: { threshold: number; baseCooldownMs: number; maxCooldownMs: number; authCooldownMs: number },
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** True while calls must not be made. After the cooldown the next call is a single probe. */
  isOpen(): boolean {
    if (this.openUntilMs === null) return false;
    if (this.now() >= this.openUntilMs) return false;
    return true;
  }

  state(): BreakerState {
    return {
      open: this.isOpen(),
      openUntil: this.openUntilMs !== null && this.isOpen() ? new Date(this.openUntilMs) : null,
      consecutiveFailures: this.failures,
      reason: this.reason,
    };
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openUntilMs = null;
    this.reason = null;
    this.trips = 0;
  }

  recordFailure(reason: BreakerReason, retryAfterSeconds?: number | null): void {
    this.failures += 1;
    if (reason === 'AUTH') {
      this.open(this.opts.authCooldownMs, 'AUTH');
      return;
    }
    if (typeof retryAfterSeconds === 'number') {
      this.open(Math.max(retryAfterSeconds * 1000, this.opts.baseCooldownMs), 'SOURCE');
      return;
    }
    if (this.failures >= this.opts.threshold) {
      const cooldown = Math.min(this.opts.maxCooldownMs, this.opts.baseCooldownMs * 2 ** this.trips);
      this.open(cooldown, 'SOURCE');
    }
  }

  private open(cooldownMs: number, reason: BreakerReason): void {
    this.openUntilMs = this.now() + cooldownMs;
    this.reason = reason;
    this.trips += 1;
  }
}
