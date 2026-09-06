import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { ChecklistItem, ChecklistProgress } from '../../../../_lib/contract-closeout-detail-helpers';
import { ContractCloseoutChecklistStatusBadge } from './contract-closeout-checklist-status-badge';

interface Props {
  items: ChecklistItem[];
  progress: ChecklistProgress;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TABLE_COLUMNS = ['Checklist Item', 'Required?', 'Status', 'Responsible', 'Completed Date', 'Action'];

/**
 * CM-67 — Final Completion Checklist: the 10 real closeout categories this
 * unit's spec lists, each derived from an already-real aggregate (workflow/
 * production/erection task counts, payments/claims/risks/issues open
 * counts, document-obligation counts, closeout attachment/approval state).
 * Responsible/Completed Date are only ever real stored values (the closeout
 * request's own approver/approvedAt) — every cross-module row honestly
 * shows "—" for both, since there is no single real owner for a
 * cross-cutting check.
 * CM-67B — added a mini status-count recap (same real ChecklistProgress
 * already computed for the header Progress card, just passed down — no new
 * calculation) so the counts stay visible once this card sits in a
 * side-by-side column away from the top header row; the table body scrolls
 * within a capped height instead of growing the whole page taller.
 * CM-67C — the recap now renders as colored chips (matching the header
 * Progress card's own chip treatment) instead of plain text, and rows
 * tightened slightly for a more compact card.
 */
export function ContractCloseoutChecklistPanel({ items, progress }: Props): React.JSX.Element {
  return (
    <section className="rounded-lg border border-border bg-surface shadow-sm p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-text-primary">Final Completion Checklist</h2>
        <div className="flex items-center gap-1.5 text-[11px] font-medium">
          <span className="rounded-full bg-success-light text-success px-2 py-0.5">{progress.completed} Completed</span>
          <span className="rounded-full bg-warning-light text-warning px-2 py-0.5">{progress.pending} Pending</span>
          <span className="rounded-full bg-surface-secondary text-text-muted px-2 py-0.5">{progress.notRequired} Not Req.</span>
          <span className="rounded-full bg-error-light text-error px-2 py-0.5">{progress.blocked} Blocked</span>
        </div>
      </div>

      <div className="overflow-auto rounded-lg border border-border max-h-80">
        <table className="w-full min-w-160 divide-y divide-border text-xs">
          <thead className="sticky top-0 z-10 border-b-2 border-border-strong">
            <tr className="bg-surface-secondary">
              {TABLE_COLUMNS.map((col) => (
                <th key={col} className="px-3 py-2 text-left font-bold uppercase tracking-wide text-text-primary whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {items.map((item) => (
              <tr key={item.key} className="hover:bg-surface-secondary/50 transition-colors">
                <td className="px-3 py-1 text-text-primary font-medium whitespace-nowrap">{item.label}</td>
                <td className="px-3 py-1 whitespace-nowrap text-text-secondary">{item.required ? 'Yes' : 'No'}</td>
                <td className="px-3 py-1 whitespace-nowrap"><ContractCloseoutChecklistStatusBadge status={item.status} /></td>
                <td className="px-3 py-1 whitespace-nowrap text-text-secondary">{item.responsible}</td>
                <td className="px-3 py-1 whitespace-nowrap text-text-secondary">{formatDate(item.completedDate)}</td>
                <td className="px-3 py-1 whitespace-nowrap">
                  <Link
                    href={item.actionHref}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-text-secondary hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus"
                    title="Open related section"
                  >
                    View
                    <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
