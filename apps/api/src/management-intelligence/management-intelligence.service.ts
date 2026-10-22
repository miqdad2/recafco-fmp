import { Injectable } from '@nestjs/common';

/**
 * FMP-MIC-01 — the Factory Management source this Center will read from once an approved,
 * server-side, read-only credential exists. Nothing here calls that system: the status is
 * static until integration is built. FMP's own database is never a source of these figures.
 */
export const MANAGEMENT_SOURCE_LABEL = 'RECAFCO Factory Management (192.168.0.12:8080)';

export interface ManagementConnectionStatus {
  state: 'NOT_CONFIGURED';
  source: string;
  message: string;
}

@Injectable()
export class ManagementIntelligenceService {
  getConnectionStatus(): ManagementConnectionStatus {
    return {
      state: 'NOT_CONFIGURED',
      source: MANAGEMENT_SOURCE_LABEL,
      message: 'Live reporting will be available after the Factory Management integration is connected.',
    };
  }
}
