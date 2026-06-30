import { createLogger } from '@recafco/observability';
import type { WorkerEnv } from '@recafco/config';

export interface WorkerConfig {
  heartbeatIntervalMs: number;
  staleAfterMs: number;
  logLevel: string;
  environment: string;
}

export class WorkerApp {
  private readonly logger;
  private readonly config: WorkerConfig;
  private running = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private startedAt: Date | null = null;
  private lastHeartbeatAt: Date | null = null;

  constructor(config: WorkerConfig) {
    this.config = config;
    this.logger = createLogger('worker', {
      level: config.logLevel,
      environment: config.environment,
    });
  }

  static fromEnv(env: WorkerEnv): WorkerApp {
    return new WorkerApp({
      heartbeatIntervalMs: env.heartbeatIntervalMs,
      staleAfterMs: env.staleAfterMs,
      logLevel: env.logLevel,
      environment: env.nodeEnv,
    });
  }

  start(): void {
    this.running = true;
    this.startedAt = new Date();
    this.logger.info({ event: 'worker_started' }, 'Worker started.');
    this.heartbeatTimer = setInterval(() => this.heartbeat(), this.config.heartbeatIntervalMs);
  }

  stop(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.running = false;
    this.logger.info({ event: 'worker_stopped' }, 'Worker stopped gracefully.');
  }

  isRunning(): boolean {
    return this.running;
  }

  isStale(): boolean {
    if (!this.running) return false;
    const ref = this.lastHeartbeatAt ?? this.startedAt;
    if (ref === null) return false;
    return Date.now() - ref.getTime() > this.config.staleAfterMs;
  }

  getStartedAt(): Date | null {
    return this.startedAt;
  }

  getLastHeartbeatAt(): Date | null {
    return this.lastHeartbeatAt;
  }

  private heartbeat(): void {
    this.lastHeartbeatAt = new Date();
    this.logger.info({ event: 'worker_heartbeat' }, 'Worker heartbeat.');
  }
}
