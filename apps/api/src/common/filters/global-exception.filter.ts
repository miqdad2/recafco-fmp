import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { getRequestId } from '@recafco/observability';
import type { ApiErrorResponse } from '@recafco/shared';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const requestId = getRequestId() ?? 'unknown';

    let statusCode: number;
    let code: string;
    let message: string;
    let details: unknown;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        // Use explicit 'code' from domain errors; fall back to HttpStatus enum name (e.g. NOT_FOUND).
        // NestJS's built-in 'error' field contains human phrases ("Not Found") so it is intentionally skipped.
        code =
          typeof resp['code'] === 'string'
            ? resp['code']
            : (HttpStatus[statusCode] ?? 'HTTP_ERROR');
        message = typeof resp['message'] === 'string' ? resp['message'] : exception.message;
        details = 'details' in resp ? resp['details'] : undefined;
      } else {
        code = HttpStatus[statusCode] ?? 'HTTP_ERROR';
        message = exception.message;
      }
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'INTERNAL_SERVER_ERROR';
      message = 'An unexpected error occurred';
      this.logger.error({ event: 'unhandled_exception', requestId }, 'Unhandled exception');
    }

    const body: ApiErrorResponse = {
      data: null,
      meta: { requestId },
      error: { code, message, ...(details !== undefined ? { details } : {}) },
    };

    response.status(statusCode).json(body);
  }
}
