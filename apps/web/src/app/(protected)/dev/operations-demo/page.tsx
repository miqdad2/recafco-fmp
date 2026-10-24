import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getUserPermissions } from '../../contracts/_lib/get-user-permissions';
import { formatCount } from '../../contracts/_lib/operations-progress-helpers';
import { DemoControls } from './demo-controls';

export const metadata: Metadata = { title: 'Operations demonstration (development only) — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

interface DemoStatus {
  contractId: string | null;
  sourceProjectId: string;
  contractReference: string;
  hasSnapshot: boolean;
  lastOutcome: string | null;
  totals: { total: number; issued: number; produced: number; delivered: number; installed: number; pendingInputs: number } | null;
}

async function loadStatus(): Promise<DemoStatus | null> {
  try {
    const token = (await cookies()).get('recafco_access')?.value;
    const res = await fetch(`${API_BASE}/operations-demo/status`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return ((await res.json()) as { data: DemoStatus }).data;
  } catch {
    return null;
  }
}

/**
 * FMP-OPS-02 — DEVELOPMENT-ONLY controls for the Operations monitoring demonstration. Not linked from any manager
 * screen. It does not exist (404) in production or unless OPERATIONS_DEMO_ENABLED=true, and it needs the integration
 * permission. It only drives the isolated demonstration contract.
 */
export default async function OperationsDemoPage(): Promise<React.JSX.Element> {
  if (process.env['NODE_ENV'] === 'production' || process.env['OPERATIONS_DEMO_ENABLED'] !== 'true') notFound();
  const permissions = await getUserPermissions();
  if (!permissions.includes('contracts.operations_link')) notFound();
  const status = await loadStatus();

  return (
    <div className="mx-auto max-w-[900px] space-y-6 px-4 py-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-error">Development only</p>
        <h1 className="text-3xl font-semibold text-text-primary">Operations demonstration</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Drives an isolated demonstration contract with clearly labelled fixture figures, because the live source is not connected. It never touches real
          contracts.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-text-primary">Controls</h2>
        <div className="mt-3">
          <DemoControls />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm" aria-label="Demonstration state">
        <h2 className="text-lg font-semibold text-text-primary">Demonstration state</h2>
        {status === null ? (
          <p className="mt-2 text-sm text-error">The API did not answer. Is it running with OPERATIONS_DEMO_ENABLED=true?</p>
        ) : status.contractId === null ? (
          <p className="mt-2 text-sm text-text-secondary">The demonstration contract does not exist yet. Use “Create / check demo contract”.</p>
        ) : (
          <div className="mt-2 space-y-2 text-sm text-text-secondary">
            <p>
              Contract <span className="font-mono">{status.contractReference}</span> · source id <span className="font-mono">{status.sourceProjectId}</span> ·
              last result {status.lastOutcome ?? '—'}
            </p>
            {status.totals && (
              <p className="tabular-nums">
                Requirement {formatCount(status.totals.total)} · issued {formatCount(status.totals.issued)} · produced {formatCount(status.totals.produced)} ·
                delivered {formatCount(status.totals.delivered)} · erected {formatCount(status.totals.installed)} · pending inputs{' '}
                {formatCount(status.totals.pendingInputs)}
              </p>
            )}
            <ul className="list-disc pl-5">
              <li>
                <Link className="text-info hover:underline" target="_blank" href={`/contracts/${status.contractId}`}>
                  Open the demo contract Overview
                </Link>
              </li>
              <li>
                <Link className="text-info hover:underline" target="_blank" href={`/contracts/${status.contractId}/erection`}>
                  Open its Erection tab
                </Link>
              </li>
              <li>
                <Link className="text-info hover:underline" target="_blank" href="/contracts">
                  Open the Contract List
                </Link>
              </li>
            </ul>
            <p className="text-xs text-text-muted">
              Keep those pages open in other tabs and press the controls here: they update by themselves within a few seconds, without reloading.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
