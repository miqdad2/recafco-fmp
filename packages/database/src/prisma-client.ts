import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from './generated/prisma/client';

export interface DatabaseClientConfig {
  databaseUrl: string;
  poolMax: number;
  connectionTimeoutMs: number;
  statementTimeoutMs: number;
}

export function createPrismaClient(config: DatabaseClientConfig): PrismaClient {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: config.poolMax,
    connectionTimeoutMillis: config.connectionTimeoutMs,
    // statement_timeout is set as a PostgreSQL session parameter on each connection.
    // This is a server-enforced timeout for individual statements.
    options: `-c statement_timeout=${config.statementTimeoutMs}`,
    idleTimeoutMillis: 30_000,
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter });
}
