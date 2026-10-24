import { loadWorkerEnv } from './env';
import { WorkerApp } from './worker-app';
import { startOperationsSync, type RunningOperationsSync } from './operations-sync/bootstrap';

const env = loadWorkerEnv();
const worker = WorkerApp.fromEnv(env);
let operationsSync: RunningOperationsSync | null = null;

function shutdown(signal: string): void {
  console.log(`Received ${signal}. Shutting down worker gracefully.`);
  worker.stop();
  const finish = (): void => {
    process.exitCode = 0;
    process.exit();
  };
  if (operationsSync === null) return finish();
  // Let an in-flight sync attempt end and sign the source session out (bounded wait).
  const timeout = setTimeout(finish, 10_000);
  operationsSync.stop().finally(() => {
    clearTimeout(timeout);
    finish();
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

worker.start();
operationsSync = startOperationsSync(env);
