import Link from 'next/link';
import type { ScheduleItem } from '@/lib/contracts-api';
import { ScheduleItemTypeBadge } from './schedule-item-type-badge';
import { ScheduleStatusBadge } from './schedule-status-badge';
import { formatContractValue } from '../../_lib/contract-ui-helpers';

interface Props {
  items: ScheduleItem[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const COLUMNS = [
  'Date', 'Type', 'Contract ID', 'Contract Name', 'Company / Client', 'Schedule Item',
  'Responsible', 'Priority', 'Amount', 'Status', 'Overdue Days', 'Action',
];

export function ScheduleListTable({ items }: Props): React.JSX.Element {
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
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[1500px] divide-y divide-border text-xs">
        <thead className="border-b-2 border-border-strong">
          <tr className="bg-surface-secondary">
            {COLUMNS.map((col) => (
              <th key={col} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface">
          {items.map((item) => (
            <tr key={item.id} className={item.isOverdue ? 'bg-danger-light/20' : undefined}>
              <td className="px-3 py-2 whitespace-nowrap">{formatDate(item.date)}</td>
              <td className="px-3 py-2 whitespace-nowrap"><ScheduleItemTypeBadge type={item.sourceType} /></td>
              <td className="px-3 py-2 whitespace-nowrap">
                <Link href={`/contracts/${item.contractId}`} className="font-mono text-accent hover:underline">
                  {item.contractReference}
                </Link>
              </td>
              <td className="px-3 py-2 max-w-[180px] truncate" title={item.contractTitle}>{item.contractTitle}</td>
              <td className="px-3 py-2 max-w-[150px] truncate" title={item.companyName}>{item.companyName}</td>
              <td className="px-3 py-2 max-w-[220px] truncate" title={item.title}>{item.title}</td>
              <td className="px-3 py-2 whitespace-nowrap">{item.responsibleUser?.displayName ?? '—'}</td>
              <td className="px-3 py-2 whitespace-nowrap">{item.priority ?? '—'}</td>
              <td className="px-3 py-2 whitespace-nowrap">{item.amount ? formatContractValue(item.amount, item.currency ?? undefined) : '—'}</td>
              <td className="px-3 py-2 whitespace-nowrap"><ScheduleStatusBadge status={item.status} isOverdue={item.isOverdue} /></td>
              <td className="px-3 py-2 whitespace-nowrap">
                {item.overdueDays !== null ? (
                  <span className="text-danger font-medium">{item.overdueDays}d</span>
                ) : '—'}
              </td>
              <td className="px-3 py-2 whitespace-nowrap print:hidden">
                <div className="flex items-center gap-2">
                  <Link href={item.actionUrl} className="text-text-muted hover:text-text-primary" title="Open source">
                    View
                  </Link>
                  <Link href={`/contracts/${item.contractId}/schedule`} className="text-accent hover:underline" title="View contract timeline">
                    Timeline
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
