import { ArrowUpRight, CheckCircle2 } from 'lucide-react';
import type { MmsLinks, MmsManagerAttentionSection, MmsNeedsAttentionItem } from '@/lib/mms-api';
import { attentionTypeClasses, attentionTypeLabel, reasonClasses, reasonLabel } from '../../_lib/mms-format';

/** The one-screen layout shows the most urgent items only; MMS has the full lists. */
export const ATTENTION_LIMIT = 5;

interface Props {
  /** MMS's cross-module Manager Attention; null when this MMS build does not send it. */
  attention: MmsManagerAttentionSection | null;
  /** MMS's job-card attention list — used only when `attention` is null. */
  jobCardAttention: MmsNeedsAttentionItem[];
  links: MmsLinks;
}

interface Row {
  key: string;
  tag: string;
  tagClasses: string;
  ref: string;
  title: string;
  detail: string;
  openUrl: string;
}

/** The text-color class of a tag's badge classes ("bg-error-light text-error" → "text-error"), used to color its dot. */
export function tagDotColor(tagClasses: string): string {
  return tagClasses.split(' ').find((c) => c.startsWith('text-')) ?? 'text-text-muted';
}

export function attentionRows(attention: MmsManagerAttentionSection | null, jobCardAttention: MmsNeedsAttentionItem[]): Row[] {
  if (attention) {
    return attention.attentionItems.slice(0, ATTENTION_LIMIT).map((item, i) => ({
      key: `${item.type}-${item.ref}-${i}`,
      tag: attentionTypeLabel(item.type),
      tagClasses: attentionTypeClasses(item.type),
      ref: item.ref,
      title: item.title,
      detail: item.reason,
      openUrl: item.openUrl,
    }));
  }
  return jobCardAttention.slice(0, ATTENTION_LIMIT).map((item) => {
    const [first, ...rest] = item.reasons;
    return {
      key: item.id,
      tag: first ? reasonLabel(first) : item.statusLabel,
      tagClasses: first ? reasonClasses(first) : 'bg-surface-secondary text-text-secondary',
      ref: item.ref,
      title: item.title,
      detail: rest.map(reasonLabel).join(' · '),
      openUrl: item.openUrl,
    };
  });
}

// FMP-MAINT-05 — compact Manager Attention: one wrapped row of MMS's six
// category counts (each a link to the real MMS page), then at most five
// single-line items. Replaces MAINT-04's two stacked attention blocks (the
// cross-module list plus a separate job-card list): when MMS sends its own
// Manager Attention that is shown; only an older MMS build without it falls
// back to the job-card attention list. Counts MMS did not send show "—".
export function MmsManagerAttention({ attention, jobCardAttention, links }: Props): React.JSX.Element {
  const rows = attentionRows(attention, jobCardAttention);
  const counts = attention
    ? [
        { label: 'Closure', value: attention.counts.closureRequests, href: `${links.jobCards}?status=ClosureRequested` },
        { label: 'Vehicle expiry', value: attention.counts.vehicleExpiryAlerts, href: links.vehicles },
        { label: 'Past start', value: attention.counts.overdueJobs, href: `${links.jobCards}?status=Active` },
        { label: 'Materials', value: attention.counts.waitingMaterials, href: links.materialsRequests },
        { label: 'Low stock', value: attention.counts.lowStock, href: links.inventory },
        { label: 'Unassigned', value: attention.counts.unassignedJobs, href: `${links.jobCards}?status=Active` },
      ]
    : [];

  return (
    <div className="flex flex-1 flex-col">
      {counts.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 border-b border-border px-3.5 py-1.5">
          {counts.map(({ label, value, href }) => (
            <li key={label}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-focus ${
                  value !== null && value > 0 ? 'bg-warning-light text-warning' : 'bg-surface-secondary text-text-secondary'
                }`}
              >
                {label}
                <span className="font-bold">{value ?? '—'}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {rows.length === 0 ? (
        <p className="flex flex-1 items-center justify-center gap-2 px-3.5 py-4 text-sm font-medium text-success">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          No open MMS items need attention right now.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.key}>
              <a
                href={row.openUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={row.detail ? `${row.title} — ${row.detail}` : row.title}
                className="group flex items-center gap-2.5 px-3.5 py-1.5 text-[13px] hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-inset focus:ring-focus"
              >
                {/* FMP-MAINT-06 — the reason is a small colored dot + quiet label, not a
                    filled pill: five identical red "Vehicle expiry" pills in a row
                    outweighed the content. The dot keeps the color cue; fixed-width
                    tag and ref columns line the rows up for scanning. */}
                <span className="flex w-32 shrink-0 items-center gap-1.5 text-xs font-medium text-text-secondary">
                  <span className={`size-2 shrink-0 rounded-full bg-current ${tagDotColor(row.tagClasses)}`} aria-hidden="true" />
                  <span className="truncate">{row.tag}</span>
                </span>
                <span className="w-32 shrink-0 truncate font-bold text-text-primary">{row.ref}</span>
                <span className="min-w-0 flex-1 truncate text-text-primary">
                  {row.title}
                  {row.detail && <span className="text-text-secondary"> — {row.detail}</span>}
                </span>
                <ArrowUpRight className="size-4 shrink-0 text-text-muted group-hover:text-accent" aria-label="Open in Maintenance Management System" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
