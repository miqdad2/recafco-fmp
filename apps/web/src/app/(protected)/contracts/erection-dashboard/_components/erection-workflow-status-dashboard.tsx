import type { ErectionDashboardData } from '@/lib/contracts-api';
import { selectErectionNeedsAttention } from '../../_lib/contract-erection-dashboard-helpers';
import { ErectionOverviewCards } from './erection-overview-cards';
import { ErectionWorkflowStatusGrid } from './erection-workflow-status-grid';
import { ErectionNeedsAttentionPanel } from './erection-needs-attention-panel';
import { ErectionContractsSummary } from './erection-contracts-summary';

const PREVIEW_LIMIT = 3;

interface Props {
  data: ErectionDashboardData | null;
  /**
   * When true, Needs Attention / Contracts in Erection Workflow show every
   * row instead of just the top 3. Only the full dashboard route
   * (`/contracts/erection-dashboard?view=full`) ever passes true — the
   * Executive Manager's landing page always stays in the compact top-3
   * summary, per this unit's own "main dashboard fits on one screen" goal.
   */
  showAll: boolean;
  /** Where "View all…" links point when a list is truncated to the top 3. */
  viewAllHref: string;
}

/**
 * FMP-UI-19B — the ONE shared "Erection Workflow Status Dashboard" body
 * (Erection Overview → Workflow Status → Needs Attention → Contracts in
 * Erection Workflow), extracted out of `erection-dashboard/page.tsx` so the
 * Executive Manager's landing page (`contracts/erection-executive/page.tsx`)
 * can render the exact same real dashboard instead of maintaining a second,
 * different design. Both call sites pass the same
 * `ErectionDashboardData | null` from the same `contractsApi.erectionDashboard()`
 * call — no new endpoint, no new permission, no fabricated data.
 *
 * FMP-UI-19D — redesigned into a one-screen summary per direct user
 * feedback that the page still required scrolling, had a horizontally-
 * scrolling table, and used confusing labels:
 *   - Workflow Status and Needs Attention now sit side by side in a
 *     2-column row on desktop (`lg:grid-cols-2`) instead of 2 full-width
 *     stacked sections — the brief's own "left column / right column"
 *     layout, so neither needs its own full page width to read clearly.
 *   - Needs Attention and Contracts in Erection Workflow both cap to the
 *     top 3 rows by default (`showAll=false` → `PREVIEW_LIMIT`), with a
 *     "View all…" link to `viewAllHref` when there are more — never a long
 *     list on the main summary.
 *   - No Recent Activity anywhere in this component (it never was part of
 *     it) — Recent Updates stays a `erection-dashboard/page.tsx`-only
 *     disclosure, never shown on either "main" view.
 *
 * Deliberately does NOT include the "View My Erection Tasks" shortcut or a
 * Recent Activity section — neither belongs on a one-screen workflow-status
 * summary; both stay specific to `erection-dashboard/page.tsx` itself.
 *
 * FMP-UI-19E — section headings switched to the uppercase/tracked-wide
 * "eyebrow" style already used elsewhere in this app for a calmer, more
 * organized section rhythm (e.g. the old Executive Module Landing Page
 * panels this component replaced), instead of plain sentence-case text.
 */
const SECTION_HEADING_CLASS = 'text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2';

export function ErectionWorkflowStatusDashboard({ data, showAll, viewAllHref }: Props): React.JSX.Element {
  const status = data ? 'ok' : ('unavailable' as const);
  const needsAttentionRows = data ? selectErectionNeedsAttention(data.workQueue) : [];
  const limit = showAll ? null : PREVIEW_LIMIT;

  return (
    <div className="space-y-4">
      {!data && (
        <div className="rounded-md bg-error-light border border-error px-4 py-3 text-sm text-error">
          Dashboard data unavailable. The API may be offline or you may not have access.
        </div>
      )}

      <section>
        <h2 className={SECTION_HEADING_CLASS}>Erection Overview</h2>
        <ErectionOverviewCards data={data} status={status} needsAttentionCount={needsAttentionRows.length} />
      </section>

      {data && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section>
              <h2 className={SECTION_HEADING_CLASS}>Workflow Status</h2>
              <ErectionWorkflowStatusGrid rows={data.workQueue} />
            </section>

            <section>
              <h2 className={SECTION_HEADING_CLASS}>Needs Attention</h2>
              <ErectionNeedsAttentionPanel rows={needsAttentionRows} limit={limit} viewAllHref={viewAllHref} />
            </section>
          </div>

          <section>
            <h2 className={SECTION_HEADING_CLASS}>Contracts in Erection Workflow</h2>
            <ErectionContractsSummary rows={data.workQueue} limit={limit} viewAllHref={viewAllHref} />
          </section>
        </>
      )}
    </div>
  );
}
