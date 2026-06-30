import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { ReadinessController } from './readiness.controller';
import { RuntimeStateService } from './runtime-state.service';
import type { DatabaseService } from '../database/database.service';

function makeMockResponse() {
  const jsonFn = vi.fn();
  const statusFn = vi.fn(() => ({ json: jsonFn }));
  return { res: { status: statusFn } as never, statusFn, jsonFn };
}

function makeMockDatabaseService(
  overrides?: Partial<Pick<DatabaseService, 'checkHealth'>>,
): DatabaseService {
  return {
    checkHealth: vi.fn().mockResolvedValue({ status: 'ok', durationMs: 5 }),
    ...overrides,
  } as unknown as DatabaseService;
}

describe('ReadinessController', () => {
  let runtimeState: RuntimeStateService;
  let dbService: DatabaseService;
  let controller: ReadinessController;

  beforeEach(() => {
    runtimeState = new RuntimeStateService();
    dbService = makeMockDatabaseService();
    controller = new ReadinessController(runtimeState, dbService);
  });

  it('returns 503 when service is not yet initialized', async () => {
    const { res, statusFn } = makeMockResponse();
    await controller.getReadiness(res);
    expect(statusFn).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('does not call checkHealth when service is not initialized', async () => {
    const { res } = makeMockResponse();
    await controller.getReadiness(res);
    expect(dbService.checkHealth).not.toHaveBeenCalled();
  });

  it('returns 503 when database is unavailable', async () => {
    runtimeState.markInitialized();
    dbService = makeMockDatabaseService({
      checkHealth: vi.fn().mockResolvedValue({
        status: 'unavailable',
        durationMs: 5,
        category: 'connection_refused',
      }),
    });
    controller = new ReadinessController(runtimeState, dbService);
    const { res, statusFn } = makeMockResponse();
    await controller.getReadiness(res);
    expect(statusFn).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('503 database-down body only exposes database unavailable in details', async () => {
    runtimeState.markInitialized();
    dbService = makeMockDatabaseService({
      checkHealth: vi.fn().mockResolvedValue({
        status: 'unavailable',
        durationMs: 10,
        category: 'authentication',
      }),
    });
    controller = new ReadinessController(runtimeState, dbService);
    const { res, jsonFn } = makeMockResponse();
    await controller.getReadiness(res);
    const body = (jsonFn.mock.calls[0] as [unknown])[0] as Record<string, unknown>;
    const error = body['error'] as Record<string, unknown>;
    const details = error['details'] as Record<string, unknown>;
    expect(details['database']).toBe('unavailable');
    expect(JSON.stringify(body)).not.toContain('authentication');
    expect(JSON.stringify(body)).not.toContain('connection_refused');
  });

  it('returns 200 when initialized and database is healthy', async () => {
    runtimeState.markInitialized();
    const { res, statusFn } = makeMockResponse();
    await controller.getReadiness(res);
    expect(statusFn).toHaveBeenCalledWith(HttpStatus.OK);
  });

  it('200 body includes status, uptimeMs, and checks', async () => {
    runtimeState.markInitialized();
    const { res, jsonFn } = makeMockResponse();
    await controller.getReadiness(res);
    const body = (jsonFn.mock.calls[0] as [unknown])[0] as Record<string, unknown>;
    const data = body['data'] as Record<string, unknown>;
    expect(data['status']).toBe('ready');
    expect(typeof data['uptimeMs']).toBe('number');
    expect(data['checks']).toMatchObject({
      environment: 'ok',
      logging: 'ok',
      requestContext: 'ok',
      database: 'ok',
    });
  });

  it('200 body error field is null', async () => {
    runtimeState.markInitialized();
    const { res, jsonFn } = makeMockResponse();
    await controller.getReadiness(res);
    const body = (jsonFn.mock.calls[0] as [unknown])[0] as Record<string, unknown>;
    expect(body['error']).toBeNull();
  });
});
