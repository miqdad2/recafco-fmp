import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
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
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const fields: Record<string, string[]> = {};
        for (const err of errors) {
          if (err.property && err.constraints) {
            fields[err.property] = Object.values(err.constraints);
          }
        }
        return new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: { fields },
        });
      },
    }),
  );
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
