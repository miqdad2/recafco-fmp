/**
 * cleanup-sessions.ts
 *
 * Deletes expired UserSession rows from the database.
 * Run with: pnpm --filter @recafco/api cleanup:sessions
 *
 * This script is safe to run at any time (idempotent).
 * Schedule it via cron or on-demand via an operator when session table grows large.
 * Does not affect active sessions.
 */

import 'reflect-metadata';
import { createPrismaClient } from '@recafco/database';

async function main(): Promise<void> {
  const dbUrl = process.env['DATABASE_URL'];
  if (!dbUrl) {
    console.error('[cleanup-sessions] ERROR: DATABASE_URL is not set.');
    process.exitCode = 1;
    return;
  }

  const db = createPrismaClient({
    databaseUrl: dbUrl,
    poolMax: 1,
    connectionTimeoutMs: 10_000,
    statementTimeoutMs: 30_000,
  });

  try {
    await db.$connect();

    const result = await db.userSession.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    console.log(`[cleanup-sessions] Deleted ${result.count} expired session(s).`);
  } finally {
    await db.$disconnect();
  }
}

void main().catch((err: unknown) => {
  console.error('[cleanup-sessions] Fatal error:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
