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

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        code = typeof resp['error'] === 'string' ? resp['error'] : HttpStatus[statusCode] ?? 'HTTP_ERROR';
        message = typeof resp['message'] === 'string' ? resp['message'] : exception.message;
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
      error: { code, message },
    };

    response.status(statusCode).json(body);
  }
}
