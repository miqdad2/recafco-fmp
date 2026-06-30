import { loadWorkerEnv } from './env';
import { WorkerApp } from './worker-app';

const env = loadWorkerEnv();
const worker = WorkerApp.fromEnv(env);

function shutdown(signal: string): void {
  console.log(`Received ${signal}. Shutting down worker gracefully.`);
  worker.stop();
  process.exitCode = 0;
  process.exit();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

worker.start();
