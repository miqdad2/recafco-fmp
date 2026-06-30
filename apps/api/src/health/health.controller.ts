import { Controller, Get } from '@nestjs/common';

interface ApiResponse<T> {
  data: T;
  meta: Record<string, unknown>;
  error: null;
}

interface HealthData {
  status: 'ok';
  service: string;
}

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): ApiResponse<HealthData> {
    return {
      data: {
        status: 'ok',
        service: 'recafco-fmp-api',
      },
      meta: {},
      error: null,
    };
  }
}
