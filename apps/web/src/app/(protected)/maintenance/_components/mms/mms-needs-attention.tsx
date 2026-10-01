import { AlertTriangle, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import type { MmsNeedsAttentionItem } from '@/lib/mms-api';
import { formatDateTime, formatRelative, priorityClasses, reasonClasses, reasonLabel, statusClasses, summarizeReasons } from '../../_lib/mms-format';

interface Props {
  items: MmsNeedsAttentionItem[];
  now: number;
}

// FMP-MAINT-01/02/03 — renders exactly the needsAttention items MMS returns
// (MMS ranks and limits them). Reasons are MMS's own wording; "Overdue" is
// shown as "Past start time" because MMS has no due-date field. FMP-MAINT-03
// adds a reason summary row (counted over the returned items only — labelled
// so) so a manager sees the shape of the problem before reading rows.
export function MmsNeedsAttention({ items, now }: Props): React.JSX.Element {
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-success/40 bg-success-light p-4 text-sm text-success">
        <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
        No open MMS job cards need attention right now.
      </div>
    );
  }

  const summary = summarizeReasons(items);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5" aria-label="Attention reasons in the items shown">
        {summary.map(({ reason, count }) => (
          <span key={reason} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${reasonClasses(reason)}`}>
            {reasonLabel(reason)}
            <span className="rounded-full bg-surface/70 px-1.5 text-[11px]">{count}</span>
          </span>
        ))}
        <span className="text-xs text-text-muted">in the {items.length} most urgent job card{items.length === 1 ? '' : 's'} from MMS</span>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-warning/40 bg-warning-light px-3.5 py-3 text-sm"
          >
            <div className="flex min-w-0 items-start gap-2.5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="font-semibold text-text-primary">{item.ref}</p>
                  <span
                    title={item.status}
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClasses(item.status)}`}
                  >
                    {item.statusLabel}
                  </span>
                  {item.priority && (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityClasses(item.priority)}`}>
                      {item.priority}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-text-secondary" title={item.title}>{item.title}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {item.reasons.map((reason) => (
                    <span key={reason} className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${reasonClasses(reason)}`}>
                      {reasonLabel(reason)}
                    </span>
                  ))}
                  <span className="text-xs text-text-muted" title={formatDateTime(item.updatedAt)}>
                    · Updated {formatRelative(item.updatedAt, now)}
                  </span>
                </div>
              </div>
            </div>
            <a
              href={item.openUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-warning/50 bg-surface px-2.5 py-1 text-xs font-semibold text-warning hover:bg-warning-light"
            >
              Open in MMS
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
