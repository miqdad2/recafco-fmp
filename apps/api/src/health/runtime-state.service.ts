import { Injectable } from '@nestjs/common';

interface RuntimeState {
  readonly startedAt: Date;
  initialized: boolean;
}

@Injectable()
export class RuntimeStateService {
  private readonly state: RuntimeState = {
    startedAt: new Date(),
    initialized: false,
  };

  markInitialized(): void {
    this.state.initialized = true;
  }

  isInitialized(): boolean {
    return this.state.initialized;
  }

  getStartedAt(): Date {
    return this.state.startedAt;
  }

  getUptimeMs(): number {
    return Date.now() - this.state.startedAt.getTime();
  }
}
