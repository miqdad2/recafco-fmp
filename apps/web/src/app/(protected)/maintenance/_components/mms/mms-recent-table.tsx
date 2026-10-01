import { ArrowUpRight, ClipboardList } from 'lucide-react';
import type { MmsRecentRequestItem } from '@/lib/mms-api';
import { formatDateTime, formatRelative, statusClasses } from '../../_lib/mms-format';

interface Props {
  rows: MmsRecentRequestItem[];
  now: number;
}

// FMP-MAINT-01/02/03 — MMS's recentRequests, as returned (drafts are excluded by MMS).
export function MmsRecentTable({ rows, now }: Props): React.JSX.Element {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <ClipboardList className="mx-auto size-7 text-text-muted" aria-hidden="true" />
        <p className="mt-2 text-sm font-medium text-text-primary">No maintenance job cards in MMS yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
      <table className="w-full min-w-215 text-sm">
        <thead className="bg-surface-secondary text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
          <tr>
            <th scope="col" className="px-4 py-2.5">Ref</th>
            <th scope="col" className="px-4 py-2.5">Request / Work Order</th>
            <th scope="col" className="px-4 py-2.5">Asset / Location</th>
            <th scope="col" className="px-4 py-2.5">Status</th>
            <th scope="col" className="px-4 py-2.5">Assigned To</th>
            <th scope="col" className="px-4 py-2.5">Updated</th>
            <th scope="col" className="px-4 py-2.5 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-surface-hover">
              <td className="whitespace-nowrap px-4 py-3 font-semibold text-text-primary">{row.ref}</td>
              <td className="max-w-72 px-4 py-3">
                <p className="truncate text-text-primary" title={row.title}>{row.title}</p>
                {row.priority && (row.priority === 'High' || row.priority === 'Urgent') && (
                  <p className="text-[11px] font-semibold text-warning">{row.priority} priority</p>
                )}
              </td>
              <td className="max-w-56 px-4 py-3 text-text-secondary">
                <p className="truncate" title={row.assetOrLocation ?? undefined}>{row.assetOrLocation ?? '—'}</p>
              </td>
              <td className="px-4 py-3">
                <span
                  title={row.status}
                  className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClasses(row.status)}`}
                >
                  {row.statusLabel}
                </span>
              </td>
              <td className="max-w-48 px-4 py-3 text-text-secondary">
                <p className="truncate" title={row.assignedTo ?? undefined}>
                  {row.assignedTo ?? <span className="text-text-muted">Unassigned</span>}
                </p>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-text-secondary" title={formatDateTime(row.updatedAt)}>
                {formatRelative(row.updatedAt, now)}
              </td>
              <td className="px-4 py-3 text-right">
                <a
                  href={row.openUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-accent hover:underline"
                >
                  Open in MMS
                  <ArrowUpRight className="size-3" aria-hidden="true" />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
