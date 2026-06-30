import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { getRequestId } from '@recafco/observability';
import type { ApiSuccessResponse, ApiErrorResponse } from '@recafco/shared';
import { RuntimeStateService } from './runtime-state.service';
import { DatabaseService } from '../database/database.service';

interface ReadyChecks {
  environment: 'ok';
  logging: 'ok';
  requestContext: 'ok';
  database: 'ok' | 'unavailable';
}

interface ReadyData {
  status: 'ready';
  uptimeMs: number;
  checks: ReadyChecks;
}

@Controller('ready')
export class ReadinessController {
  constructor(
    private readonly runtimeState: RuntimeStateService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Get()
  async getReadiness(@Res() res: Response): Promise<void> {
    const requestId = getRequestId() ?? 'unknown';

    if (!this.runtimeState.isInitialized()) {
      const body: ApiErrorResponse = {
        data: null,
        meta: { requestId },
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Service is not yet ready' },
      };
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json(body);
      return;
    }

    const dbHealth = await this.databaseService.checkHealth();

    if (dbHealth.status !== 'ok') {
      const body: ApiErrorResponse = {
        data: null,
        meta: { requestId },
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Service is not ready',
          details: { database: 'unavailable' },
        },
      };
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json(body);
      return;
    }

    const body: ApiSuccessResponse<ReadyData> = {
      data: {
        status: 'ready',
        uptimeMs: this.runtimeState.getUptimeMs(),
        checks: {
          environment: 'ok',
          logging: 'ok',
          requestContext: 'ok',
          database: 'ok',
        },
      },
      meta: requestId !== undefined ? { requestId } : {},
      error: null,
    };
    res.status(HttpStatus.OK).json(body);
  }
}
