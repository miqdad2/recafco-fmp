import Link from 'next/link';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { AttentionItem, AttentionSeverity } from '../_lib/contract-overview-helpers';
import { ATTENTION_EMPTY_MESSAGE, attentionTitle, attentionTone } from '../_lib/contract-overview-display-helpers';

const DOT_CLASS: Record<AttentionSeverity, string> = {
  high: 'bg-error',
  medium: 'bg-warning',
  low: 'bg-info',
};

interface Props {
  items: AttentionItem[];
}

/**
 * CM-57 — Section 7 "Attention Required". Every row comes from a real
 * count > 0 (overdue workflow tasks, overdue payment follow-ups, open
 * claims, open issues, a pending closeout request, or a real
 * forecast/end-date overdue-or-closing-soon condition) — see
 * buildAttentionItems() in contract-overview-helpers.ts. Deliberately never
 * shows expiring performance bonds/insurance/documents — no document-expiry
 * tracking exists in this schema, so faking that row would violate the
 * unit's data-honesty requirement.
 *
 * FMP-CONTRACT-08 — the title is "No Attention Required" when nothing is open.
 * FMP-CONTRACT-07 — the orange warning treatment is used only when there is
 * at least one open item; with none, the card is neutral with a positive check.
 */
export function ContractOverviewAttentionCard({ items }: Props): React.JSX.Element {
  const isWarning = attentionTone(items.length) === 'warning';
  return (
    <section
      className={`rounded-lg border p-5 h-full ${isWarning ? 'border-warning/30 bg-warning-light' : 'border-border bg-surface shadow-sm'}`}
      data-tone={isWarning ? 'warning' : 'neutral'}
    >
      <div className={`flex items-center gap-2 mb-4 pb-3 border-b ${isWarning ? 'border-warning/20' : 'border-border'}`}>
        {isWarning ? (
          <AlertTriangle className="size-4 text-warning shrink-0" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="size-4 text-success shrink-0" aria-hidden="true" />
        )}
        <h2 className="text-sm font-semibold text-text-primary">{attentionTitle(items.length)}</h2>
        {items.length > 0 && (
          <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-warning text-white text-[11px] font-semibold">
            {items.length}
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-text-secondary">{ATTENTION_EMPTY_MESSAGE}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                href={item.actionHref}
                className="flex items-center justify-between gap-3 text-sm rounded-md bg-surface/70 hover:bg-surface px-3 py-2 transition-colors"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className={`size-2 rounded-full shrink-0 ${DOT_CLASS[item.severity]}`} aria-hidden="true" />
                  <span className="text-text-primary truncate">{item.text}</span>
                </span>
                <span className="shrink-0 text-xs font-medium text-accent">{item.actionLabel} →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
