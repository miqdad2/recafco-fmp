import { Controller, Get } from '@nestjs/common';
import { getRequestId } from '@recafco/observability';
import type { ApiSuccessResponse } from '@recafco/shared';

interface HealthData {
  status: 'ok';
  service: string;
}

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): ApiSuccessResponse<HealthData> {
    const requestId = getRequestId();
    return {
      data: { status: 'ok', service: 'recafco-fmp-api' },
      meta: requestId !== undefined ? { requestId } : {},
      error: null,
    };
  }
}
