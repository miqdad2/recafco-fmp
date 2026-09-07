import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { ScheduleItem } from '@/lib/contracts-api';
import { ScheduleItemTypeBadge } from '../../schedule/_components/schedule-item-type-badge';

interface Props {
  items: ScheduleItem[];
  emptyTitle: string;
  emptyDescription: string;
  /** CM-48 — caps visible rows for the staff dashboard's single-window layout; `moreHref`/`moreLabel` render a link for the rest. Omit (as the Manager Dashboard still does) to show every item, unchanged from before CM-48. */
  limit?: number;
  moreHref?: string;
  moreLabel?: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function UpcomingScheduleList({ items, emptyTitle, emptyDescription, limit, moreHref, moreLabel }: Props): React.JSX.Element {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <p className="text-sm text-text-secondary">{emptyTitle}</p>
        <p className="text-xs text-text-muted mt-1">{emptyDescription}</p>
      </div>
    );
  }

  const visibleItems = limit !== undefined ? items.slice(0, limit) : items;
  const remaining = items.length - visibleItems.length;

  return (
    <div className="rounded-lg border border-border bg-surface divide-y divide-border">
      {visibleItems.map((item) => (
        <Link
          key={item.id}
          href={item.actionUrl}
          className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-surface-secondary"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-medium text-text-muted whitespace-nowrap">{formatDate(item.date)}</span>
            <ScheduleItemTypeBadge type={item.sourceType} />
            <span className="truncate text-text-primary">{item.title}</span>
            <span className="text-xs text-text-muted whitespace-nowrap">{item.contractReference}</span>
          </div>
          {item.isOverdue && (
            <span className="inline-flex items-center gap-1 rounded-full bg-error-light px-2 py-0.5 text-[11px] font-medium text-error shrink-0">
              <AlertTriangle className="size-3" aria-hidden="true" />
              Overdue{item.overdueDays !== null ? ` ${item.overdueDays}d` : ''}
            </span>
          )}
        </Link>
      ))}

      {remaining > 0 && moreHref && (
        <Link href={moreHref} className="block text-center text-xs font-medium text-accent hover:underline px-4 py-2">
          {moreLabel ?? `View more — ${remaining} more`}
        </Link>
      )}
    </div>
  );
}
