import { describe, it, expect, afterEach } from 'vitest';
import { WorkerApp } from './worker-app';

describe('WorkerApp', () => {
  let app: WorkerApp;

  afterEach(() => {
    if (app.isRunning()) {
      app.stop();
    }
  });

  it('is not running before start()', () => {
    app = new WorkerApp();
    expect(app.isRunning()).toBe(false);
  });

  it('reports running after start()', () => {
    app = new WorkerApp();
    app.start();
    expect(app.isRunning()).toBe(true);
  });

  it('reports not running after stop()', () => {
    app = new WorkerApp();
    app.start();
    app.stop();
    expect(app.isRunning()).toBe(false);
  });

  it('stop() is safe to call when already stopped', () => {
    app = new WorkerApp();
    expect(() => app.stop()).not.toThrow();
  });

  it('start() followed by stop() does not throw', () => {
    app = new WorkerApp();
    expect(() => {
      app.start();
      app.stop();
    }).not.toThrow();
  });
});
