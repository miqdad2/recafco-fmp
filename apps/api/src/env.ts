import { ApiEnvSchema, EnvironmentValidationError } from '@recafco/config';
import type { ApiEnv } from '@recafco/config';

let _env: ApiEnv | null = null;

export function loadApiEnv(): ApiEnv {
  try {
    _env = Object.freeze(ApiEnvSchema.parse(process.env));
    return _env;
  } catch (err) {
    if (err instanceof EnvironmentValidationError) {
      console.error(`[startup] ${err.message}`);
    } else if (err instanceof Error) {
      console.error(`[startup] Environment validation failed: ${err.message}`);
    } else {
      console.error('[startup] Environment validation failed with unknown error');
    }
    process.exitCode = 1;
    process.exit();
  }
}

export function getApiEnv(): ApiEnv {
  if (_env === null) {
    throw new Error('API env not initialized. Call loadApiEnv() before accessing getApiEnv().');
  }
  return _env;
}
