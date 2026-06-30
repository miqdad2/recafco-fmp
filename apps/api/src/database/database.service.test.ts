import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockConnect, mockDisconnect, mockCreatePrismaClient, mockCheckDatabaseHealth } = vi.hoisted(
  () => {
    const mockConnect = vi.fn().mockResolvedValue(undefined);
    const mockDisconnect = vi.fn().mockResolvedValue(undefined);
    const mockClient = {
      $connect: mockConnect,
      $disconnect: mockDisconnect,
      $executeRaw: vi.fn().mockResolvedValue(1),
    };
    const mockCreatePrismaClient = vi.fn(() => mockClient);
    const mockCheckDatabaseHealth = vi
      .fn()
      .mockResolvedValue({ status: 'ok' as const, durationMs: 5 });
    return { mockConnect, mockDisconnect, mockCreatePrismaClient, mockCheckDatabaseHealth };
  },
);

vi.mock('../env', () => ({
  getApiEnv: vi.fn(() => ({
    databaseUrl: 'postgresql://test:pass@localhost:5432/test_db',
    databasePoolMax: 5,
    databaseConnectionTimeoutMs: 5_000,
    databaseStatementTimeoutMs: 10_000,
  })),
}));

vi.mock('@recafco/database', () => ({
  createPrismaClient: mockCreatePrismaClient,
  checkDatabaseHealth: mockCheckDatabaseHealth,
}));

import { DatabaseService } from './database.service';

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
    mockDisconnect.mockResolvedValue(undefined);
    mockCheckDatabaseHealth.mockResolvedValue({ status: 'ok' as const, durationMs: 5 });
    service = new DatabaseService();
  });

  it('constructs the Prisma client from getApiEnv() config', () => {
    expect(mockCreatePrismaClient).toHaveBeenCalledWith({
      databaseUrl: 'postgresql://test:pass@localhost:5432/test_db',
      poolMax: 5,
      connectionTimeoutMs: 5_000,
      statementTimeoutMs: 10_000,
    });
  });

  it('calls $connect on onModuleInit', async () => {
    await service.onModuleInit();
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it('does not throw when $connect fails on onModuleInit', async () => {
    mockConnect.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:5432'));
    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });

  it('calls $disconnect on onModuleDestroy', async () => {
    await service.onModuleDestroy();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('does not throw when $disconnect fails on onModuleDestroy', async () => {
    mockDisconnect.mockRejectedValueOnce(new Error('disconnect failed'));
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });

  it('delegates to checkDatabaseHealth with the supplied timeout', async () => {
    const result = await service.checkHealth(2_000);
    expect(mockCheckDatabaseHealth).toHaveBeenCalledWith(expect.anything(), 2_000);
    expect(result.status).toBe('ok');
  });

  it('checkHealth result contains no connection URL or credentials', async () => {
    mockCheckDatabaseHealth.mockResolvedValueOnce({
      status: 'unavailable' as const,
      durationMs: 10,
      category: 'authentication' as const,
    });
    const result = await service.checkHealth();
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('postgresql://');
    expect(serialized).not.toContain('test:pass');
    expect(serialized).not.toContain('localhost');
  });
});
