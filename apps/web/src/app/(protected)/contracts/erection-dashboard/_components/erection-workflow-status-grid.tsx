import { summarizeErectionWorkflowSteps } from '../../_lib/contract-erection-dashboard-helpers';
import type { ErectionWorkQueueRow } from '@/lib/contracts-api';

interface Props {
  rows: ErectionWorkQueueRow[];
}

/**
 * FMP-UI-19 — the 7 real Erection workflow steps (Method Statement →
 * Approval → Schedule → Delivery → Erection Start → Checklist → Payment) as
 * simple status cards, answering "which step is each contract currently
 * in?" / "what is pending now?" at a glance. Each card shows one honest
 * count (never fabricated — a real tally via computeErectionWorkflowStepKey
 * over the already-fetched work queue) plus a short status word and a
 * simple color indicator. Payment always reads "Not built yet" — Step 7 has
 * no dedicated model/screen yet.
 *
 * FMP-UI-19D — lives inside a half-width column (the dashboard's 2-column
 * Workflow Status / Needs Attention layout), so a 7-across single row would
 * either overflow or truncate labels like "Method Statement"/"Erection
 * Start". Compact 4-column grid (4 cards, then the remaining 3 wrap to a
 * second row) with no `truncate` anywhere on the label.
 *
 * FMP-UI-19E — restyled so ordering reads as an actual WORKFLOW, not a
 * scattered KPI strip, per direct feedback: each card now leads with a
 * numbered circular badge (1–7, the brief's own "Step 1 — Method Statement"
 * framing) that is solid amber when that step has a real pending count and
 * neutral gray otherwise — the same number that orders the cards also
 * doubles as the status color cue, so "which step, in what state" reads in
 * one glance without needing to also read the badge text. Cards themselves
 * gained `rounded-xl`/`shadow-sm` (was `rounded-lg`, no shadow) to match the
 * calmer, more premium card language used elsewhere on this page.
 */
export function ErectionWorkflowStatusGrid({ rows }: Props): React.JSX.Element {
  const summary = summarizeErectionWorkflowSteps(rows);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {summary.map((s, i) => {
        const isPending = s.step !== 'PAYMENT' && s.count > 0;
        return (
          <div key={s.step} className="min-h-24 rounded-xl border border-border bg-surface p-3 shadow-sm flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  isPending ? 'bg-warning text-white' : 'bg-surface-secondary text-text-secondary'
                }`}
              >
                {i + 1}
              </span>
              <p className="text-xs font-semibold leading-tight text-text-primary">{s.label}</p>
            </div>
            <div className="mt-auto flex items-center justify-between gap-1">
              <span className="text-xl font-bold leading-none tracking-tight text-text-primary">
                {s.step === 'PAYMENT' ? '—' : s.count}
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${s.badgeClass}`}>
                {s.statusText}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
