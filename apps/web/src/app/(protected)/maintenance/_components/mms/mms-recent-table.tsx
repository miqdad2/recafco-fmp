import { ArrowUpRight } from 'lucide-react';
import type { MmsRecentRequestItem } from '@/lib/mms-api';
import { formatDateTime, formatRelative, statusClasses } from '../../_lib/mms-format';

/** The one-screen layout shows the latest few; MMS's Job Cards page has the full list. */
export const RECENT_LIMIT = 5;

interface Props {
  rows: MmsRecentRequestItem[];
  now: number;
}

// FMP-MAINT-05 — compact latest-5 table of MMS's recentRequests (drafts are
// excluded by MMS). Dense rows, the whole ref is the "Open in MMS" link, and
// the lower-priority columns drop out on narrower screens (Assigned To below
// 2xl, Asset / Location below xl) instead of the table scrolling sideways —
// both remain one click away in MMS.
export function MmsRecentTable({ rows, now }: Props): React.JSX.Element {
  if (rows.length === 0) {
    return <p className="px-3.5 py-3 text-center text-sm text-text-secondary">No maintenance job cards in MMS yet.</p>;
  }

  return (
    <table className="w-full table-fixed text-[13px]">
      <thead className="text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
        <tr className="border-b border-border">
          <th scope="col" className="w-40 px-3.5 py-1.5">Ref</th>
          <th scope="col" className="truncate px-2 py-1.5">Request / Work Order</th>
          <th scope="col" className="hidden w-36 px-2 py-1.5 xl:table-cell">Asset / Location</th>
          <th scope="col" className="w-32 px-2 py-1.5">Status</th>
          <th scope="col" className="hidden w-28 px-2 py-1.5 2xl:table-cell">Assigned To</th>
          <th scope="col" className="w-24 px-3.5 py-1.5 text-right">Updated</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.slice(0, RECENT_LIMIT).map((row) => (
          <tr key={row.id} className="hover:bg-surface-hover">
            <td className="whitespace-nowrap px-3.5 py-1.5">
              <a
                href={row.openUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in Maintenance Management System"
                className="inline-flex items-center gap-0.5 font-semibold text-accent hover:underline"
              >
                {row.ref}
                <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
              </a>
            </td>
            <td className="truncate px-2 py-1.5 text-text-primary" title={row.title}>{row.title}</td>
            <td className="hidden truncate px-2 py-1.5 text-text-secondary xl:table-cell" title={row.assetOrLocation ?? undefined}>
              {row.assetOrLocation ?? '—'}
            </td>
            <td className="px-2 py-1.5">
              <span title={row.status} className={`inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-xs font-semibold ${statusClasses(row.status)}`}>
                {row.statusLabel}
              </span>
            </td>
            <td className="hidden truncate px-2 py-1.5 text-text-secondary 2xl:table-cell" title={row.assignedTo ?? undefined}>
              {row.assignedTo ?? <span className="text-text-muted">Unassigned</span>}
            </td>
            <td className="whitespace-nowrap px-3.5 py-1.5 text-right text-text-secondary" title={formatDateTime(row.updatedAt)}>
              {formatRelative(row.updatedAt, now)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
