import Link from 'next/link';
import type { ErectionWorkQueueRow, ErectionRecentActivityRow } from '@/lib/contracts-api';
import { ErectionMethodStatementStatusBadge } from './erection-method-statement-status-badge';
import { ErectionAttentionBadge } from './erection-attention-badge';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const ACTIVITY_EVENT_LABELS: Record<string, string> = {
  erection_method_statement_created: 'Draft created',
  erection_method_statement_updated: 'Draft updated',
  erection_method_statement_issued: 'Issued to client for approval',
  erection_method_statement_attachment_uploaded: 'Attachment uploaded',
  erection_method_statement_attachment_deleted: 'Attachment removed',
};

interface RowListProps {
  rows: ErectionWorkQueueRow[];
  emptyMessage: string;
}

function WorkQueueRowList({ rows, emptyMessage }: RowListProps): React.JSX.Element {
  if (rows.length === 0) {
    return <p className="text-xs text-text-muted">{emptyMessage}</p>;
  }
  return (
    <ul className="space-y-2 max-h-64 overflow-y-auto">
      {rows.map((r) => (
        <li key={r.contractId} className="rounded-md border border-border bg-surface-secondary/40 p-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <Link href={`/contracts/${r.contractId}`} className="font-mono text-accent hover:underline font-medium">{r.contractReference}</Link>
            <ErectionAttentionBadge attention={r.attention} />
          </div>
          <p className="text-text-secondary mt-1 truncate" title={r.projectName}>{r.projectName}</p>
          <div className="flex items-center justify-between gap-2 mt-1.5">
            <ErectionMethodStatementStatusBadge status={r.methodStatementStatus} />
            <span className="text-text-muted">{formatDate(r.plannedIssueDate)}</span>
          </div>
          {/* CM-71H — same viewer-relative label downgrade as the main work queue table: assigned Erection Manager keeps the real next-action label, a monitoring manager-tier viewer sees "View Status", everyone else gets no link at all. */}
          {r.viewerActionMode === 'READ_ONLY' ? (
            <span className="mt-1.5 inline-block text-[11px] text-text-muted">Read Only</span>
          ) : (
            <Link
              href={r.nextAction.href}
              className="mt-1.5 inline-block text-accent hover:underline text-[11px] font-medium"
            >
              {r.viewerActionMode === 'MONITOR' ? 'View Status' : r.nextAction.label} →
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

/** CM-71B — Section 1: method statements due today or overdue and not yet submitted/issued. */
export function ErectionTodaysActionsPanel({ rows }: { rows: ErectionWorkQueueRow[] }): React.JSX.Element {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Today&apos;s Erection Actions</h2>
      <WorkQueueRowList rows={rows} emptyMessage="Nothing due today or overdue." />
    </section>
  );
}

/** CM-71B — Section 2: submitted for approval / issued records awaiting the next action. */
export function ErectionPendingApprovalPanel({ rows }: { rows: ErectionWorkQueueRow[] }): React.JSX.Element {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Pending Method Statement Approval</h2>
      <WorkQueueRowList rows={rows} emptyMessage="No method statements are currently awaiting approval." />
    </section>
  );
}

/** CM-71B — Section 3: planned issue date has passed but not submitted/issued. */
export function ErectionOverdueAttentionPanel({ rows }: { rows: ErectionWorkQueueRow[] }): React.JSX.Element {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Overdue / Attention Required</h2>
      <WorkQueueRowList rows={rows} emptyMessage="No overdue erection contracts right now." />
    </section>
  );
}

/** CM-71B — Section 4: real ContractActivity rows, filtered to this feature's own events (CM-71A's logContractActivity calls) — never fabricated. */
export function ErectionRecentActivityPanel({ rows }: { rows: ErectionRecentActivityRow[] }): React.JSX.Element {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Recent Erection Activity</h2>
      {rows.length === 0 ? (
        <p className="text-xs text-text-muted">No erection method statement activity yet.</p>
      ) : (
        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {rows.map((a) => (
            <li key={a.id} className="text-xs border-b border-border/60 pb-1.5 last:border-0">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/contracts/${a.contractId}`} className="font-mono text-accent hover:underline">{a.contractReference}</Link>
                <span className="text-text-muted text-[11px]">{formatDateTime(a.createdAt)}</span>
              </div>
              <p className="text-text-secondary mt-0.5">
                {ACTIVITY_EVENT_LABELS[a.event] ?? a.event}{a.actorName ? ` · ${a.actorName}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
