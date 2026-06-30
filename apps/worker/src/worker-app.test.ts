import { describe, it, expect, afterEach } from 'vitest';
import { WorkerApp } from './worker-app';

const testConfig = {
  heartbeatIntervalMs: 30_000,
  staleAfterMs: 60_000,
  logLevel: 'silent',
  environment: 'test',
};

describe('WorkerApp', () => {
  let app: WorkerApp;

  afterEach(() => {
    if (app.isRunning()) {
      app.stop();
    }
  });

  it('is not running before start()', () => {
    app = new WorkerApp(testConfig);
    expect(app.isRunning()).toBe(false);
  });

  it('reports running after start()', () => {
    app = new WorkerApp(testConfig);
    app.start();
    expect(app.isRunning()).toBe(true);
  });

  it('reports not running after stop()', () => {
    app = new WorkerApp(testConfig);
    app.start();
    app.stop();
    expect(app.isRunning()).toBe(false);
  });

  it('stop() is safe to call when already stopped', () => {
    app = new WorkerApp(testConfig);
    expect(() => app.stop()).not.toThrow();
  });

  it('start() followed by stop() does not throw', () => {
    app = new WorkerApp(testConfig);
    expect(() => {
      app.start();
      app.stop();
    }).not.toThrow();
  });

  it('getStartedAt() is null before start()', () => {
    app = new WorkerApp(testConfig);
    expect(app.getStartedAt()).toBeNull();
  });

  it('getStartedAt() is set after start()', () => {
    app = new WorkerApp(testConfig);
    app.start();
    expect(app.getStartedAt()).toBeInstanceOf(Date);
  });

  it('isStale() is false when not running', () => {
    app = new WorkerApp(testConfig);
    expect(app.isStale()).toBe(false);
  });
});
