'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

// FMP-OPS-02 — DEVELOPMENT ONLY. Each action re-checks that demonstration is allowed (not production AND explicitly
// enabled) before it calls FMP's own API, which checks again and requires the integration permission.
function demoAllowed(): boolean {
  return process.env['NODE_ENV'] !== 'production' && process.env['OPERATIONS_DEMO_ENABLED'] === 'true';
}

export interface DemoActionResult {
  error: string | null;
  message?: string;
}

const PATHS: Record<string, string> = {
  seed: '/operations-demo/seed',
  reset: '/operations-demo/reset',
  update: '/operations-demo/simulate/update',
  outage: '/operations-demo/simulate/outage',
  recovery: '/operations-demo/simulate/recovery',
};

const DONE: Record<string, string> = {
  seed: 'Demonstration contract is ready.',
  reset: 'Demonstration figures were reset to the starting values.',
  update: 'A new progress update was accepted (demonstration data).',
  outage: 'Source outage simulated: the last figures are kept and shown as delayed.',
  recovery: 'Recovery simulated: a new update was accepted and the delay cleared.',
};

export async function runOperationsDemoAction(action: string): Promise<DemoActionResult> {
  if (!demoAllowed()) return { error: 'Demonstration is not available in this environment.' };
  const path = PATHS[action];
  if (!path) return { error: 'Unknown action.' };
  let token: string | undefined;
  try {
    token = (await cookies()).get('recafco_access')?.value;
  } catch {
    token = undefined;
  }
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json()) as { error?: { message?: string } | null };
    if (!res.ok || json.error) return { error: json.error?.message ?? 'The action could not be completed.' };
    revalidatePath('/dev/operations-demo');
    return { error: null, message: DONE[action] ?? 'Done.' };
  } catch {
    return { error: 'The action could not be completed.' };
  }
}
