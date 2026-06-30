import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RuntimeStateService } from './health/runtime-state.service';
import { loadApiEnv } from './env';
import { createLogger } from '@recafco/observability';

async function bootstrap(): Promise<void> {
  const env = loadApiEnv();
  const logger = createLogger('api', { level: env.logLevel, environment: env.nodeEnv });

  const app = await NestFactory.create(AppModule, { logger: false });

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.enableCors({ origin: env.corsAllowedOrigins });

  await app.listen(env.port);

  const runtimeState = app.get(RuntimeStateService);
  runtimeState.markInitialized();

  logger.info(
    { event: 'api_started', port: env.port, environment: env.nodeEnv },
    `RECAFCO FMP API listening on port ${env.port}`,
  );
}

void bootstrap().catch((err: unknown) => {
  console.error('[startup] Fatal error during bootstrap:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
  process.exit();
});
