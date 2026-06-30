import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import {
  createPrismaClient,
  checkDatabaseHealth,
  type DatabaseHealthResult,
} from '@recafco/database';
import { getApiEnv } from '../env';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly client: ReturnType<typeof createPrismaClient>;

  constructor() {
    const env = getApiEnv();
    this.client = createPrismaClient({
      databaseUrl: env.databaseUrl,
      poolMax: env.databasePoolMax,
      connectionTimeoutMs: env.databaseConnectionTimeoutMs,
      statementTimeoutMs: env.databaseStatementTimeoutMs,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.$connect();
      this.logger.log('Database connection established');
    } catch (err) {
      const category = categorizeError(err);
      this.logger.warn(`Database unavailable on startup: ${category}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.$disconnect();
    } catch {
      // Ignore disconnect errors during shutdown
    }
  }

  getClient(): ReturnType<typeof createPrismaClient> {
    return this.client;
  }

  async checkHealth(timeoutMs = 3_000): Promise<DatabaseHealthResult> {
    const result = await checkDatabaseHealth(this.client, timeoutMs);
    if (result.status === 'unavailable') {
      this.logger.warn(`Database health check failed: ${result.category}`);
    }
    return result;
  }
}

function categorizeError(err: unknown): string {
  if (!(err instanceof Error)) return 'unknown';
  const msg = err.message.toLowerCase();
  if (msg.includes('timeout') || err.name === 'TimeoutError') return 'timeout';
  if (
    msg.includes('connect econnrefused') ||
    msg.includes('connection refused') ||
    msg.includes('enotfound')
  )
    return 'connection_refused';
  if (msg.includes('password') || msg.includes('authentication') || msg.includes('role'))
    return 'authentication';
  return 'unknown';
}
