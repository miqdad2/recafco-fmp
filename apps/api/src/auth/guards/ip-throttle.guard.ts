import { Injectable, CanActivate, type ExecutionContext, HttpException } from '@nestjs/common';
import type { Request } from 'express';

// Simple in-memory per-IP throttle for auth endpoints.
// Limitation: state is not shared across multiple Node.js processes.
// Use a distributed store (Redis) when running clustered deployments.
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 10;

interface ThrottleRecord {
  count: number;
  resetAt: number;
}

@Injectable()
export class IpThrottleGuard implements CanActivate {
  private readonly store = new Map<string, ThrottleRecord>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const ip = req.ip ?? (req.socket as { remoteAddress?: string })?.remoteAddress ?? 'unknown';
    const now = Date.now();

    let record = this.store.get(ip);
    if (!record || record.resetAt <= now) {
      record = { count: 0, resetAt: now + WINDOW_MS };
      this.store.set(ip, record);
    }

    record.count += 1;
    if (record.count > MAX_REQUESTS) {
      throw new HttpException(
        { code: 'TOO_MANY_REQUESTS', message: 'Too many requests. Please try again later.' },
        429,
      );
    }

    return true;
  }
}
