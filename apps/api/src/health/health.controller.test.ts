import { describe, it, expect } from 'vitest';
import { HealthController } from './health.controller';

describe('HealthController', () => {
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

  it('meta is present', () => {
    const controller = new HealthController();
    expect(controller.getHealth().meta).toBeDefined();
  });
});
