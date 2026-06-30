import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

const REQUEST_ID_HEADER = 'x-request-id';
const MAX_LENGTH = 64;
const SAFE_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function resolveRequestId(incoming: string | undefined): string {
  if (
    incoming !== undefined &&
    incoming.length > 0 &&
    incoming.length <= MAX_LENGTH &&
    SAFE_PATTERN.test(incoming)
  ) {
    return incoming;
  }
  return crypto.randomUUID();
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const raw = req.headers[REQUEST_ID_HEADER];
    const incoming = Array.isArray(raw) ? raw[0] : raw;
    const requestId = resolveRequestId(incoming);
    req.headers[REQUEST_ID_HEADER] = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  }
}
