import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { HardHat } from 'lucide-react';
import { contractsApi } from '@/lib/contracts-api';
import type { ErectionDashboardData } from '@/lib/contracts-api';
import { authApi } from '@/lib/auth-api';
import { ExecutiveModuleNav } from '../../_components/executive-module-nav';
import { ExecutiveModuleTitle } from '../../_components/executive-module-title';
import { ErectionWorkflowStatusDashboard } from '../erection-dashboard/_components/erection-workflow-status-dashboard';

export const metadata: Metadata = { title: 'Erection Dashboard — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

/**
 * FMP-UI-07 — Executive Module Landing Page for Erection, originally its own
 * simplified summary (KPI grid + Needs Attention + a raw Recent Activity
 * list) built separately from the module's own Erection Manager Dashboard.
 *
 * FMP-UI-19B — that separate summary is exactly what a real user report
 * flagged: opening Erection as Executive Manager (via the platform dashboard
 * card, the Executive sidebar item, or Previous/Next/Switch module — all 3
 * of which have only ever pointed at this one route, `/contracts/erection-
 * executive`) still showed an old 7-metric KPI grid and, worse, a hand-rolled
 * Recent Activity list that rendered `row.event` directly with no label
 * mapping at all — a raw-technical-key regression the module's own dashboard
 * had already fixed, but this separate page never shared that fix because it
 * never shared any code with that page. Fixed by Option A (replace content
 * in place, same route, same nav/access rules — no href changed anywhere):
 * this page renders the exact same `ErectionWorkflowStatusDashboard` shared
 * component the full dashboard uses — one dashboard design, never two to
 * maintain. `ExecutiveModuleNav` (Back to Platform Dashboard / Previous /
 * Next / Switch module) is kept exactly as before.
 *
 * FMP-UI-19D — subtitle shortened to match the redesigned dashboard's own
 * new copy. `showAll={false}` always — the Executive Manager's summary never
 * expands to a full list in place; its "View all…" links (rendered by the
 * shared component) go to the full dashboard route's own `?view=full`
 * instead, so there is still exactly one place a full Erection list lives.
 */
export default async function ErectionExecutivePage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const [dashboardResult, meResult] = await Promise.allSettled([
    contractsApi.erectionDashboard(),
    authApi.me(accessToken),
  ]);

  const permissions: string[] =
    meResult.status === 'fulfilled' && meResult.value.ok ? meResult.value.data.permissions : [];
  if (!permissions.includes('contracts.read')) notFound();

  const data: ErectionDashboardData | null = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-5 py-5 lg:px-6">
      <ExecutiveModuleNav code="ERECTION" permissions={permissions} />

      <ExecutiveModuleTitle
        title="Erection Dashboard"
        description="Summary of erection workflow status, pending actions and site readiness."
        icon={HardHat}
        accent="erection"
      />

      <ErectionWorkflowStatusDashboard data={data} showAll={false} viewAllHref="/contracts/erection-dashboard?view=full" />
    </div>
  );
}
