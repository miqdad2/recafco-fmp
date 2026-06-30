import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the generated Prisma client and adapter before imports
vi.mock('./generated/prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $executeRaw: vi.fn().mockResolvedValue(1),
  })),
}));

vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({ end: vi.fn() })),
}));

import { createPrismaClient } from './prisma-client';
import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const testConfig = {
  databaseUrl: 'postgresql://user:pass@localhost:5432/test_db',
  poolMax: 5,
  connectionTimeoutMs: 5_000,
  statementTimeoutMs: 10_000,
};

describe('createPrismaClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a pg Pool with the supplied connection string', () => {
    createPrismaClient(testConfig);
    expect(Pool).toHaveBeenCalledWith(
      expect.objectContaining({ connectionString: testConfig.databaseUrl }),
    );
  });

  it('applies poolMax to the Pool config', () => {
    createPrismaClient(testConfig);
    expect(Pool).toHaveBeenCalledWith(expect.objectContaining({ max: testConfig.poolMax }));
  });

  it('applies connectionTimeoutMs to the Pool config', () => {
    createPrismaClient(testConfig);
    expect(Pool).toHaveBeenCalledWith(
      expect.objectContaining({ connectionTimeoutMillis: testConfig.connectionTimeoutMs }),
    );
  });

  it('applies statementTimeoutMs as a PostgreSQL session parameter', () => {
    createPrismaClient(testConfig);
    expect(Pool).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.stringContaining(String(testConfig.statementTimeoutMs)),
      }),
    );
  });

  it('wraps the pool in a PrismaPg adapter', () => {
    createPrismaClient(testConfig);
    expect(PrismaPg).toHaveBeenCalledTimes(1);
  });

  it('returns a PrismaClient instance', () => {
    const client = createPrismaClient(testConfig);
    expect(PrismaClient).toHaveBeenCalledTimes(1);
    expect(client).toBeDefined();
  });

  it('passes the adapter to PrismaClient constructor', () => {
    createPrismaClient(testConfig);
    expect(PrismaClient).toHaveBeenCalledWith(expect.objectContaining({ adapter: expect.anything() }));
  });
});
