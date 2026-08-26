import Link from 'next/link';
import { RefreshCcw, MessageSquare, Paperclip } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { StaffRecentUpdate, StaffRecentUpdateType } from '@/lib/contracts-api';

interface Props {
  updates: StaffRecentUpdate[];
  /** CM-48 — caps visible rows for the single-window dashboard layout; a "View My Tasks" link replaces the rest. Omit to show every update, unchanged from CM-47. */
  limit?: number;
}

const TYPE_ICON: Record<StaffRecentUpdateType, LucideIcon> = {
  STATUS_UPDATE: RefreshCcw,
  COMMENT: MessageSquare,
  ATTACHMENT: Paperclip,
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function StaffRecentUpdates({ updates, limit }: Props): React.JSX.Element {
  if (updates.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <p className="text-sm text-text-secondary">No recent task updates.</p>
        <p className="text-xs text-text-muted mt-1">Status changes, comments and attachments will appear here.</p>
      </div>
    );
  }

  const visibleUpdates = limit !== undefined ? updates.slice(0, limit) : updates;
  const remaining = updates.length - visibleUpdates.length;

  return (
    <div className="rounded-lg border border-border bg-surface divide-y divide-border">
      {visibleUpdates.map((u) => {
        const Icon = TYPE_ICON[u.type];
        return (
          <Link
            key={u.key}
            href={`/contracts/workflow?mode=my-tasks&taskId=${u.taskId}`}
            className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-surface-secondary"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Icon className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-text-primary truncate">
                  {u.description} — <span className="text-text-secondary">{u.taskName}</span>
                </p>
                <p className="text-xs text-text-muted">{u.contractReference}</p>
              </div>
            </div>
            <span className="text-xs text-text-muted shrink-0">{formatDateTime(u.date)}</span>
          </Link>
        );
      })}

      {remaining > 0 && (
        <Link href="/contracts/workflow?mode=my-tasks" className="block text-center text-xs font-medium text-accent hover:underline px-4 py-2">
          View My Tasks — {remaining} more update{remaining === 1 ? '' : 's'}
        </Link>
      )}
    </div>
  );
}
