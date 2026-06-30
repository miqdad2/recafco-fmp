import { WorkerEnvSchema, EnvironmentValidationError } from '@recafco/config';
import type { WorkerEnv } from '@recafco/config';

let _env: WorkerEnv | null = null;

export function loadWorkerEnv(): WorkerEnv {
  try {
    _env = Object.freeze(WorkerEnvSchema.parse(process.env));
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

export function getWorkerEnv(): WorkerEnv {
  if (_env === null) {
    throw new Error('Worker env not initialized. Call loadWorkerEnv() before accessing getWorkerEnv().');
  }
  return _env;
}
