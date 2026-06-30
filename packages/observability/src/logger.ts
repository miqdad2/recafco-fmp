import pino from 'pino';

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const VALID_LEVELS: readonly LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

function resolveLogLevel(): LogLevel {
  const raw = process.env['LOG_LEVEL'];
  if (raw !== undefined && (VALID_LEVELS as readonly string[]).includes(raw)) {
    return raw as LogLevel;
  }
  return 'info';
}

export function createLogger(name: string): pino.Logger {
  return pino({ name, level: resolveLogLevel() });
}
