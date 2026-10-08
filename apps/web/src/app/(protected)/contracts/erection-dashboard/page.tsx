import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { HardHat } from 'lucide-react';
import { contractsApi } from '@/lib/contracts-api';
import type { ErectionDashboardData } from '@/lib/contracts-api';
import { authApi } from '@/lib/auth-api';
import { ACCENT_PALETTE } from '../../_lib/module-accent';
import { ErectionWorkflowStatusDashboard } from './_components/erection-workflow-status-dashboard';
import { ErectionMyTasksShortcut } from './_components/erection-my-tasks-shortcut';

export const metadata: Metadata = { title: 'Erection Dashboard — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

const FULL_VIEW_HREF = '/contracts/erection-dashboard?view=full';

interface PageProps {
  searchParams: Promise<{ view?: string }>;
}

/**
 * FMP-UI-19 — Erection Workflow Status Dashboard. A ground-up redesign of
 * the CM-71B "Erection Manager Dashboard" per direct user feedback that the
 * old page (an 8-card KPI strip + a 23-column work-queue table + 4 side
 * panels) was confusing: too much raw detail, no clear "what should I do
 * next" story. This page keeps the exact same data source/access rules —
 * contractsApi.erectionDashboard() (Contract, CM-71A's
 * ContractErectionMethodStatement, the existing ERECTION-team
 * ContractWorkflowTask rows — no new table, no new permission, same
 * department-scoped visibility) — it only reshapes how that same payload is
 * presented.
 *
 * FMP-UI-19B — the core body moved into a shared component,
 * `ErectionWorkflowStatusDashboard`, so the Executive Manager's landing page
 * (`contracts/erection-executive/page.tsx`) renders the exact same real
 * dashboard instead of a second, different design.
 *
 * FMP-UI-19D — redesigned for "one screen, no scrolling" per direct user
 * feedback: header trimmed (shorter subtitle, tighter spacing), Needs
 * Attention/Contracts in Erection Workflow both cap to their top 3 rows by
 * default. This route is the ONE place the full (untruncated) lists can
 * still be reached — `?view=full` flips `showAll` on the shared component in
 * place (a URL query toggle, not a second page/route: bookmarkable, and
 * "View all…" links from the Executive Manager's summary land here too, so
 * there is still only one real "full list" experience for Erection). Recent
 * Activity is removed entirely (was a collapsed section here) — a "summary
 * of current status," per this unit's own framing, is not an audit log; the
 * old `ErectionRecentActivityPanel`/`erection-dashboard-panels.tsx` (now
 * unused anywhere) were deleted. No workflow save/submit logic lives here —
 * every action links out to the real CM-71A–G guided workflow screens.
 *
 * FMP-UI-19E — "make the title area feel more premium" per direct
 * management-review feedback: the plain `<h1>` is now wrapped in a subtle
 * bordered header card with an icon badge, reusing the exact same
 * `ACCENT_PALETTE.erection` amber tokens (literal hex, not a Tailwind class —
 * see that file's own doc comment for why) that `ExecutiveModuleTitle`
 * already uses for every Executive Module Landing Page's own header icon —
 * visual consistency with the rest of the app, not a new one-off treatment.
 */
export default async function ErectionDashboardPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const showAll = params.view === 'full';

  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const [data, meResult] = await Promise.all([
    contractsApi.erectionDashboard().catch(() => null) as Promise<ErectionDashboardData | null>,
    authApi.me(accessToken),
  ]);
  const currentUserId = meResult.ok ? meResult.data.id : null;
  const permissions: string[] = meResult.ok ? meResult.data.permissions : [];

  // FMP-UI-19 — "if user has assigned erection tasks" is scoped to the same
  // already-fetched work queue's own assignedToUserId (a real formal
  // ContractErectionWorkflowAssignment, per CM-71H) — no new fetch, no
  // fabricated count, just reusing data this page already has.
  const hasMyErectionTasks = Boolean(
    data && currentUserId && data.workQueue.some((r) => r.assignedToUserId === currentUserId),
  );

  return (
    <div className="px-6 lg:px-8 py-5 max-w-[1600px] mx-auto space-y-4">
      <div className="rounded-xl border border-border bg-surface px-5 py-4 shadow-sm flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: ACCENT_PALETTE.erection.light, color: ACCENT_PALETTE.erection.base }}
          >
            <HardHat className="size-5.5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">Erection Dashboard</h1>
            <p className="mt-1 text-sm text-text-secondary max-w-2xl">
              Summary of erection workflow status, pending actions and site readiness.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          {/* FMP-BOQ-09 — entry to the Piece Erection screen */}
          {permissions.includes('erection.read') && (
            <Link
              href="/erection/pieces"
              className="mb-1 inline-flex h-9 items-center rounded-md border border-accent/40 bg-accent/5 px-4 text-sm font-medium text-accent hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Piece Erection
            </Link>
          )}
          {hasMyErectionTasks ? (
            <ErectionMyTasksShortcut />
          ) : (
            <p className="text-xs text-text-muted">No assigned erection tasks</p>
          )}
          {showAll && (
            <Link href="/contracts/erection-dashboard" className="text-xs font-medium text-text-secondary hover:underline">
              Show top 3 summary only
            </Link>
          )}
        </div>
      </div>

      <ErectionWorkflowStatusDashboard data={data} showAll={showAll} viewAllHref={FULL_VIEW_HREF} />
    </div>
  );
}
