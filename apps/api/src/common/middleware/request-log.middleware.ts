import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { createLogger, runWithRequestContext } from '@recafco/observability';
import { getApiEnv } from '../../env';

const logger = createLogger('api');
const REQUEST_ID_HEADER = 'x-request-id';

@Injectable()
export class RequestLogMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    const method = req.method;
    const path = req.path;
    const startMs = Date.now();
    const env = getApiEnv();

    runWithRequestContext(
      { requestId, service: 'recafco-fmp-api', environment: env.nodeEnv },
      () => {
        res.on('finish', () => {
          logger.info({
            event: 'request_completed',
            method,
            path,
            statusCode: res.statusCode,
            durationMs: Date.now() - startMs,
            requestId,
            service: 'recafco-fmp-api',
            environment: env.nodeEnv,
          });
        });
        next();
      },
    );
  }
}
