import Link from 'next/link';
import { ATTENTION_ROW_CAP, type AttentionDisplayRow } from '../../_lib/contract-dashboard-attention';

interface Props {
  rows: AttentionDisplayRow[];
}

const PRIORITY_STYLES: Record<AttentionDisplayRow['priority'], string> = {
  HIGH: 'bg-danger-light text-danger',
  MEDIUM: 'bg-warning-light text-warning',
  LOW: 'bg-surface-secondary text-text-secondary',
};

const REGISTER_LINKS: { label: string; href: string }[] = [
  { label: 'Draft Contracts', href: '/contracts?status=DRAFT' },
  { label: 'Workflow', href: '/contracts/workflow' },
  { label: 'Issues', href: '/contracts/issues' },
  { label: 'Claims', href: '/contracts/claims' },
  { label: 'Payments', href: '/contracts/payments' },
  { label: 'Closeout', href: '/contracts/closeouts?pendingOnly=true' },
];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDueOrAge(row: AttentionDisplayRow): string {
  if (row.isOverdue && row.overdueDays !== null) return `${row.overdueDays}d overdue`;
  return formatDate(row.date);
}

/**
 * CM-39B — `rows` arrive from buildAttentionRows() already grouped (repeated
 * draft-activation / unassign-task rows collapsed to one summary row each)
 * and sorted urgent-first. This component only caps the visible list to
 * ATTENTION_ROW_CAP and renders a "View all actions" footer of register
 * links so a longer backlog is still reachable without an unbounded table.
 * CM-39C — column wording softened (Type → Action Needed, "What needs
 * attention" → Details), priority badge and contract reference made
 * visually stronger, and the per-row action is now a small pill button
 * instead of a plain text link.
 */
export function ManagerAttentionTable({ rows }: Props): React.JSX.Element {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <p className="text-sm text-text-secondary">No priority actions pending.</p>
        <p className="text-xs text-text-muted mt-1">
          Contracts in your scope are clear of urgent workflow, issue, claim, payment or closeout actions.
        </p>
      </div>
    );
  }

  const visible = rows.slice(0, ATTENTION_ROW_CAP);
  const hiddenCount = rows.length - visible.length;

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] divide-y divide-border text-xs">
          <thead className="border-b-2 border-border-strong">
            <tr className="bg-surface-secondary">
              {['Priority', 'Action Needed', 'Contract', 'Details', 'Due / Age', 'Action'].map((col) => (
                <th key={col} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {visible.map((row) => (
              <tr key={row.key} className={row.isOverdue ? 'bg-danger-light/20' : undefined}>
                <td className="px-3 py-1.5 whitespace-nowrap align-top">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${PRIORITY_STYLES[row.priority]}`}>
                    {row.priority}
                  </span>
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap align-top">{row.typeLabel}</td>
                <td className="px-3 py-1.5 max-w-[190px] align-top">
                  {row.contractHref ? (
                    <>
                      <Link href={row.contractHref} className="block font-semibold text-accent hover:underline">
                        {row.contractLabel}
                      </Link>
                      {row.contractTitle && (
                        <span className="block truncate text-[11px] text-text-muted" title={row.contractTitle}>
                          {row.contractTitle}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="block font-semibold text-text-primary">{row.contractLabel}</span>
                  )}
                </td>
                <td className="px-3 py-1.5 max-w-[260px] truncate align-top" title={row.description}>{row.description}</td>
                <td className="px-3 py-1.5 whitespace-nowrap align-top">
                  {row.isOverdue ? <span className="text-danger font-medium">{formatDueOrAge(row)}</span> : formatDueOrAge(row)}
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap align-top">
                  <Link
                    href={row.actionUrl}
                    className="inline-flex items-center rounded-md bg-accent/10 px-2.5 py-1 font-semibold text-accent hover:bg-accent/20"
                  >
                    {row.actionLabel}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border bg-surface-secondary px-3 py-2 text-[11px]">
        <span className="text-text-muted">
          {hiddenCount > 0 ? `Showing ${visible.length} of ${rows.length} actions. ` : ''}
          Open related registers:
        </span>
        {REGISTER_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="text-accent hover:underline font-medium">
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
