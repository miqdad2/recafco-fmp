import pino from 'pino';
import { getRequestId } from './request-context';

export interface LoggerOptions {
  level?: string;
  environment?: string;
}

export function createLogger(name: string, options: LoggerOptions = {}): pino.Logger {
  const level = options.level ?? 'info';
  const environment = options.environment;

  return pino({
    name,
    level,
    ...(environment !== undefined ? { base: { pid: process.pid, env: environment } } : {}),
    mixin() {
      const requestId = getRequestId();
      return requestId !== undefined ? { requestId } : {};
    },
  });
}
