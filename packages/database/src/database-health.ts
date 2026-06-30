import type { PrismaClient } from './generated/prisma/client';

export interface DatabaseHealthOk {
  status: 'ok';
  durationMs: number;
}

export interface DatabaseHealthUnavailable {
  status: 'unavailable';
  durationMs: number;
  category: 'timeout' | 'connection_refused' | 'authentication' | 'unknown';
}

export type DatabaseHealthResult = DatabaseHealthOk | DatabaseHealthUnavailable;

function categorizeError(err: unknown): DatabaseHealthUnavailable['category'] {
  if (!(err instanceof Error)) return 'unknown';
  const msg = err.message.toLowerCase();
  if (msg.includes('timeout') || err.name === 'TimeoutError') return 'timeout';
  if (
    msg.includes('connect econnrefused') ||
    msg.includes('connection refused') ||
    msg.includes('enotfound')
  )
    return 'connection_refused';
  if (msg.includes('password') || msg.includes('authentication') || msg.includes('role')) {
    return 'authentication';
  }
  return 'unknown';
}

export async function checkDatabaseHealth(
  client: PrismaClient,
  timeoutMs: number = 3_000,
): Promise<DatabaseHealthResult> {
  const startMs = Date.now();

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('health check timeout')), timeoutMs),
  );

  try {
    await Promise.race([client.$executeRaw`SELECT 1`, timeoutPromise]);
    return { status: 'ok', durationMs: Date.now() - startMs };
  } catch (err) {
    return {
      status: 'unavailable',
      durationMs: Date.now() - startMs,
      category: categorizeError(err),
    };
  }
}
