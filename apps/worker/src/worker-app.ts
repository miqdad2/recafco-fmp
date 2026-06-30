import { createLogger } from '@recafco/observability';

const logger = createLogger('worker');

const HEARTBEAT_INTERVAL_MS = 30_000;

export class WorkerApp {
  private running = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    this.running = true;
    logger.info({ event: 'worker_started' }, 'Worker started. No business work assigned in this unit.');
    this.heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_INTERVAL_MS);
  }

  stop(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.running = false;
    logger.info({ event: 'worker_stopped' }, 'Worker stopped gracefully.');
  }

  isRunning(): boolean {
    return this.running;
  }

  private heartbeat(): void {
    logger.info({ event: 'worker_heartbeat' }, 'Worker heartbeat.');
  }
}
