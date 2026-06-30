import { describe, it, expect } from 'vitest';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns the required health response shape', () => {
    const controller = new HealthController();
    const result = controller.getHealth();

    expect(result).toEqual({
      data: { status: 'ok', service: 'recafco-fmp-api' },
      meta: {},
      error: null,
    });
  });

  it('data.status is "ok"', () => {
    const controller = new HealthController();
    expect(controller.getHealth().data.status).toBe('ok');
  });

  it('data.service identifies the API', () => {
    const controller = new HealthController();
    expect(controller.getHealth().data.service).toBe('recafco-fmp-api');
  });

  it('error is null', () => {
    const controller = new HealthController();
    expect(controller.getHealth().error).toBeNull();
  });
});
