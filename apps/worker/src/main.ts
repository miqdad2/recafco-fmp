import { WorkerApp } from './worker-app';

const worker = new WorkerApp();

function shutdown(signal: string): void {
  console.log(`Received ${signal}. Shutting down worker gracefully.`);
  worker.stop();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

worker.start();
