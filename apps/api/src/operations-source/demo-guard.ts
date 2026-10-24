// FMP-OPS-02 — the single place that decides whether Operations DEMONSTRATION data may exist or be shown.
// Demonstration is development-only: never in production, and only when explicitly switched on.
// (Reads process.env directly so it also works at module-definition time, before the API env is loaded.)

/** Source project ids that belong to the demonstration. The worker never synchronises them. */
export const DEMO_PROJECT_ID_PREFIX = 'demo-';

export function operationsDemoAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env['NODE_ENV'] !== 'production' && env['OPERATIONS_DEMO_ENABLED'] === 'true';
}

export function isDemoSourceProjectId(sourceProjectId: string): boolean {
  return sourceProjectId.startsWith(DEMO_PROJECT_ID_PREFIX);
}
