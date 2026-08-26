import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { ScheduleItem, ScheduleItemType } from '@/lib/contracts-api';
import { ScheduleItemTypeBadge } from './schedule-item-type-badge';
import { ScheduleStatusBadge } from './schedule-status-badge';

interface Props {
  items: ScheduleItem[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const GROUPS: { label: string; types: ScheduleItemType[] }[] = [
  { label: 'Contract Dates', types: ['CONTRACT_START', 'CONTRACT_END', 'FORECAST_COMPLETION'] },
  { label: 'Workflow Tasks', types: ['WORKFLOW_TASK'] },
  { label: 'Payments', types: ['PAYMENT_DUE'] },
  { label: 'Issues', types: ['ISSUE_DUE'] },
  { label: 'Claims', types: ['CLAIM_DUE'] },
  { label: 'Closeout', types: ['CLOSEOUT_REQUEST', 'CLOSEOUT_APPROVAL', 'CLOSEOUT_CLOSED'] },
];

export function ScheduleTimelineView({ items }: Props): React.JSX.Element {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-12 text-center">
        <p className="text-sm text-text-secondary">No schedule items found.</p>
        <p className="text-sm text-text-muted mt-1">
          Dates will appear here from contracts, workflow tasks, payments, issues, claims and closeout activity.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {GROUPS.map((group) => {
        const groupItems = items.filter((i) => group.types.includes(i.sourceType));
        if (groupItems.length === 0) return null;
        return (
          <section key={group.label}>
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">{group.label}</h3>
            <ol className="relative border-l border-border ml-2 space-y-4">
              {groupItems.map((item) => (
                <li key={item.id} className="ml-4">
                  <span
                    className={`absolute -left-[5px] mt-1.5 size-2.5 rounded-full ${item.isOverdue ? 'bg-danger' : 'bg-accent'}`}
                    aria-hidden="true"
                  />
                  <div className="rounded-md border border-border bg-surface p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-text-muted">{formatDate(item.date)}</span>
                        <ScheduleItemTypeBadge type={item.sourceType} />
                        {item.isOverdue && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-danger-light px-2 py-0.5 text-[11px] font-medium text-danger">
                            <AlertTriangle className="size-3" aria-hidden="true" />
                            Overdue{item.overdueDays !== null ? ` ${item.overdueDays}d` : ''}
                          </span>
                        )}
                      </div>
                      <ScheduleStatusBadge status={item.status} isOverdue={item.isOverdue} />
                    </div>
                    <p className="text-sm font-medium text-text-primary">{item.title}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-1.5">
                      <p className="text-xs text-text-muted">{item.responsibleUser?.displayName ?? 'Unassigned'}</p>
                      <Link href={item.actionUrl} className="text-xs text-accent hover:underline">
                        Open source →
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
