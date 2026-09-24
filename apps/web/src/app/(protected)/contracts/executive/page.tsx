import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { contractsApi } from '@/lib/contracts-api';
import type { ContractDashboardData } from '@/lib/contracts-api';
import { authApi } from '@/lib/auth-api';
import { ExecutiveModuleNav } from '../../_components/executive-module-nav';
import { ExecutiveKpiGrid } from '../../_components/executive-kpi-grid';
import { ExecutiveQuickLinks } from '../../_components/executive-quick-links';

export const metadata: Metadata = { title: 'Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

/**
 * FMP-UI-07 — Executive Module Landing Page for Contract Management. Reuses
 * the exact same /contracts/dashboard data (contractsApi.dashboard()) the
 * module's own full Manager/Staff dashboard already computes — that page
 * (and its rich KPI/financial/discipline views) stays completely untouched
 * at its own route; this is the simplified senior-friendly front door the
 * Executive Dashboard's card and sidebar now link to.
 *
 * FMP-UI-07C — KPIs are the 4 named figures (Total/Active/Pending Approvals/
 * Outstanding Payments, the same formula PlatformDashboardService's own card
 * uses) instead of the raw 7-field metrics object; Needs Attention shows 4
 * named real aggregate counts from `manager.summary`/`manager.insights`;
 * Quick Links include "Operational Dashboard" → /contracts/dashboard.
 *
 * FMP-UI-07D — polish pass fixing 5 concrete issues found by re-checking
 * this page's actual behavior:
 * 1. The wrong "Contract Management > Contract List > Contract Detail"
 *    breadcrumb TopHeader was rendering ABOVE this page's own correct one —
 *    a real bug in `_lib/contract-workspace-breadcrumb.ts` (this route
 *    wasn't in its known-module-segments list, so it fell through to "looks
 *    like a contract id"). Fixed there, not here — see that file.
 * 2. The duplicate displayName/roleName block (already shown in TopHeader,
 *    always) was removed from the shared `ExecutiveModuleTitle` component.
 * 3. Needs Attention now passes `showZeroCounts` so all 4 figures always
 *    render, including zero, instead of disappearing when nothing needs
 *    attention — this page reads as "4 status figures," not an alert list.
 * 4. Recent Activity is now "Recent Contract Updates," a purpose-built
 *    compact table (Contract No. / Project / Status / Last Updated) instead
 *    of the shared `DashboardRecentTable`, with CANCELLED contracts sorted
 *    after active ones and visually de-emphasized (opacity), never removed
 *    outright — still real data, just reordered/restyled for display, the
 *    exact "filtering display data already available" this unit's own
 *    constraint allows.
 * 5. Quick Links and the primary button used to be one "Actions" section at
 *    the very bottom of the page (superseded — see FMP-UI-16 below).
 *
 * FMP-UI-16 — compact executive layout, first applied to Contract
 * Management (this is the pilot; see progress-tracker.md for which other
 * Executive Module Landing Pages should follow the same pattern next):
 * moved actions off a bottom "Actions" section into `ExecutiveModuleTitle`'s
 * new `actions` slot; put Summary and Needs Attention side-by-side
 * (`lg:grid-cols-2`); trimmed Recent Contract Updates to 5 rows; widened the
 * container and tightened outer spacing.
 *
 * FMP-UI-16B — a second manager report ("title and actions feel
 * disconnected," "action buttons float," "Summary/Attention not visually
 * balanced," "Needs Attention is loose chips, not a structured panel")
 * refined the SAME layout further, all still Contract-Management-specific:
 * 1. The title+actions row from FMP-UI-16 is now wrapped in one actual
 *    "Module Header Card" (`rounded-xl border border-border bg-surface
 *    shadow-sm p-5 lg:p-6`) instead of floating directly on the page
 *    background — `ExecutiveModuleTitle` itself is unchanged (still a bare
 *    flex row with no card styling of its own), this page just wraps it.
 * 2. Summary/Needs Attention split changed from an even `lg:grid-cols-2`
 *    to an explicit ~65/35 split (`lg:grid-cols-[13fr_7fr]`) per this
 *    unit's own "Summary ~65%, Needs Attention ~35%" spec. `ExecutiveKpiGrid`
 *    gets a new `dense` prop (forwarded to `MetricCard`) so its 2×2 tiles
 *    stay comfortably sized in the now-narrower ~65% column instead of the
 *    previous even half.
 * 3. Needs Attention is no longer the shared `ExecutiveAttentionPanel`'s
 *    wrapping "chip row" — it's a bespoke row-list panel built directly in
 *    this file (same precedent as this page's own bespoke Recent Contract
 *    Updates table below: the shared component's exact shape didn't match
 *    what THIS page's own spec asked for, so this page renders its own,
 *    while every other module's landing page keeps using the shared
 *    component exactly as before — this change has zero effect on the
 *    other 9 pages). Each row is a full-width clickable `<Link>` with a
 *    label and a bold number, colored via the same "overdue/critical →
 *    error, open/pending → warning" name-based heuristic
 *    `ExecutiveKpiGrid`/`executive-kpi-grid.tsx` already uses elsewhere in
 *    this app (Overdue Workflow Tasks and Critical Contracts → error/red;
 *    Open Claims → warning/amber; Closing Soon → always neutral, per this
 *    unit's own explicit "Closing Soon can be neutral" instruction — a
 *    contract closing soon isn't inherently a problem the way the other 3
 *    are). A zero value still renders (never hidden), just in neutral
 *    muted text instead of the alert color.
 * 4. Recent Contract Updates trimmed to 3 rows (was 5), per this unit's own
 *    "show only latest 3 rows" instruction.
 *
 * FMP-UI-16D — a manager pointed out that the FMP-UI-16B "Module Header
 * Card" repeated information already obvious from the sidebar's active
 * item, the breadcrumb, and the module card the manager had just clicked:
 * a big icon, "Contract Management" as a title, and a one-line description
 * — none of it new information, just vertical space. Removed entirely
 * (this page no longer imports or renders `ExecutiveModuleTitle` at all —
 * that shared component itself is untouched, still used by the other 9
 * Executive Module Landing Pages exactly as before). The card that used to
 * hold the title+actions row now holds ONLY the actions, relabeled "Quick
 * Actions" — same primary "View Contract List" button + the same
 * `ExecutiveQuickLinks` row, unchanged content, now the first real section
 * after navigation instead of sharing space with a repeated title.
 */
export default async function ContractManagementExecutivePage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const [dashboardResult, meResult] = await Promise.allSettled([
    contractsApi.dashboard(),
    authApi.me(accessToken),
  ]);

  const permissions: string[] =
    meResult.status === 'fulfilled' && meResult.value.ok ? meResult.value.data.permissions : [];
  if (!permissions.includes('contracts.read')) notFound();

  const data: ContractDashboardData | null = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;

  // Same 4 figures as the Executive Dashboard's own Contract Management card
  // (PlatformDashboardService.buildContractManagementCard) — Total is the
  // sum of every real status count, Outstanding Payments stays null (honest
  // "Not available") for a Staff-tier viewer with no manager summary.
  const kpiMetrics = {
    totalContracts: data
      ? data.metrics.totalDraft +
        data.metrics.totalActive +
        data.metrics.totalExpiring +
        data.metrics.totalExpired +
        data.metrics.totalTerminated +
        data.metrics.totalClosed +
        data.metrics.totalCancelled
      : null,
    activeContracts: data?.metrics.totalActive ?? null,
    pendingApprovals: data?.metrics.totalDraft ?? null,
    outstandingPayments: data?.manager?.summary.outstandingPayments ?? null,
  };

  // Real records, just reordered for display: cancelled contracts sort after
  // active/working ones (stable sort keeps each group's own recency order),
  // so a manager scanning "recent updates" sees working contracts first —
  // never hidden, just not leading.
  const recentSorted = data
    ? [...data.recent].sort((a, b) => (a.status === 'CANCELLED' ? 1 : 0) - (b.status === 'CANCELLED' ? 1 : 0))
    : [];
  const recentToShow = recentSorted.slice(0, 3);

  // FMP-UI-16B — same 4 real figures as before (manager.summary/insights,
  // unchanged), now with an explicit color `tone` for the bespoke row-list
  // panel below: `error` for the 2 genuinely urgent figures (name contains
  // "overdue"/"critical" — the same heuristic `executive-kpi-grid.tsx`
  // already uses elsewhere in this app), `warning` for the one that's a
  // lesser but still real concern, and `neutral` for "Closing Soon" (a
  // contract closing soon isn't inherently a problem, per this unit's own
  // explicit instruction).
  const attentionItems: { label: string; value: number; href: string; tone: 'warning' | 'error' | 'neutral' }[] = [
    { label: 'Open Claims', value: data?.manager?.summary.openClaims ?? 0, href: '/contracts/claims', tone: 'warning' },
    { label: 'Overdue Workflow Tasks', value: data?.manager?.summary.overdueWorkflowTasks ?? 0, href: '/contracts/workflow?mode=overdue', tone: 'error' },
    { label: 'Critical Contracts', value: data?.manager?.insights.criticalProjectContracts ?? 0, href: '/contracts', tone: 'error' },
    { label: 'Closing Soon', value: data?.manager?.insights.contractsClosingSoon ?? 0, href: '/contracts', tone: 'neutral' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-5 py-5 lg:px-6">
      <ExecutiveModuleNav code="CONTRACTS_MANAGEMENT" permissions={permissions} />

      {/* FMP-UI-16D — no module icon/title/description here anymore (the
          manager already knows they're in Contract Management from the
          sidebar, the breadcrumb above, and the card they just clicked) —
          this card now holds ONLY the actions, as the first real section
          after navigation. */}
      <div className="rounded-xl border border-border bg-surface p-4 shadow-sm lg:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Quick Actions</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href="/contracts"
            className="inline-flex h-10 items-center rounded-lg bg-accent px-5 text-sm font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover hover:shadow-md focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
          >
            View Contract List
          </Link>
          <ExecutiveQuickLinks
            links={[
              { label: 'Operational Dashboard', href: '/contracts/dashboard' },
              { label: 'Schedule', href: '/contracts/schedule' },
              { label: 'Payments', href: '/contracts/payments' },
              { label: 'Claims', href: '/contracts/claims' },
              { label: 'Closeout Requests', href: '/contracts/closeouts' },
            ]}
          />
        </div>
      </div>

      {!data && (
        <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          Dashboard data unavailable. The API may be offline — please try again shortly.
        </div>
      )}

      {/* FMP-UI-16B — explicit ~65/35 split (was an even lg:grid-cols-2 in
          FMP-UI-16), per this unit's own "Summary ~65%, Needs Attention
          ~35%" spec. Stacked below `lg`, same as everything else on this
          page. */}
      <div className="grid gap-4 lg:grid-cols-[13fr_7fr]">
        <section aria-labelledby="contracts-exec-kpi-heading" className="space-y-3">
          <h2 id="contracts-exec-kpi-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Summary
          </h2>
          <ExecutiveKpiGrid metrics={kpiMetrics} icon={FileText} columns={2} dense />
        </section>

        <section aria-labelledby="contracts-exec-attention-heading" className="space-y-3">
          <h2 id="contracts-exec-attention-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Needs Attention
          </h2>
          {/* FMP-UI-16B — bespoke row-list panel (not the shared
              ExecutiveAttentionPanel's chip row) — see this file's own
              top-of-file doc comment for why. Each row is one full-width
              clickable Link; a zero value still renders, just in neutral
              muted text rather than an alert color. */}
          {data?.dashboardType === 'MANAGER' ? (
            <div className="rounded-xl border border-border bg-surface p-2 shadow-sm lg:p-2.5">
              <ul className="divide-y divide-border">
                {attentionItems.map((item) => {
                  const isAlert = item.tone !== 'neutral' && item.value > 0;
                  const valueClass = item.tone === 'neutral'
                    ? 'text-text-primary'
                    : isAlert
                      ? item.tone === 'error' ? 'text-error' : 'text-warning'
                      : 'text-text-secondary';
                  return (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        className="flex items-center justify-between gap-3 rounded-lg px-3 py-3 transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
                      >
                        <span className="text-sm font-medium text-text-secondary">{item.label}</span>
                        <span className={`text-lg font-bold ${valueClass}`}>{item.value}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-surface-secondary p-4 text-sm text-text-muted">
              Not available for your current access level — open the full Contract Dashboard for your assigned tasks.
            </div>
          )}
        </section>
      </div>

      <section aria-labelledby="contracts-exec-recent-heading" className="space-y-3">
        <h2 id="contracts-exec-recent-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Recent Contract Updates
        </h2>
        {recentToShow.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-text-muted">
            No recent contracts in scope.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  <th className="w-32 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                    Contract No.
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                    Project
                  </th>
                  <th className="w-36 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                    Status
                  </th>
                  <th className="hidden w-28 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-text-secondary sm:table-cell">
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentToShow.map((item, i) => {
                  const cancelled = item.status === 'CANCELLED';
                  return (
                    <tr
                      key={item.id}
                      className={[
                        i < recentToShow.length - 1 ? 'border-b border-border' : '',
                        cancelled ? 'opacity-60' : '',
                        'transition-colors hover:bg-surface-secondary',
                      ].join(' ')}
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-text-muted">
                        <Link
                          href={`/contracts/${item.id}`}
                          className="rounded hover:text-accent focus:outline-none focus:ring-1 focus:ring-focus"
                        >
                          {item.referenceNumber}
                        </Link>
                      </td>
                      <td className="max-w-xs px-4 py-2.5 text-text-primary">
                        <Link
                          href={`/contracts/${item.id}`}
                          className="block rounded hover:text-accent focus:outline-none focus:ring-1 focus:ring-focus"
                        >
                          {item.title}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-block whitespace-nowrap rounded border border-border bg-surface-secondary px-2 py-0.5 text-xs font-medium text-text-secondary">
                          {item.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-2.5 text-xs text-text-muted sm:table-cell">
                        {item.updatedAt.slice(0, 10)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
