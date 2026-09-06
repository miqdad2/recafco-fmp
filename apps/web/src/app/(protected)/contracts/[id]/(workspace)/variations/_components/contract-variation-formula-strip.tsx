import { formatContractValue } from '../../../../_lib/contract-ui-helpers';

interface Props {
  originalContractValue: string | null;
  approvedValue: string;
  computedCurrentValue: string | null;
}

/**
 * CM-60 — "Original Contract Value + Approved Variations Value = Current
 * Contract Value" strip. Same three real values as the KPI strip's own
 * Current Contract Value card (computed once server-side, not re-derived
 * here) — kept consistent between the two, unlike the approved design
 * screenshot's own mockup numbers, which don't actually reconcile with each
 * other (a KPI card showing 695,750 against a formula strip resolving to
 * 665,750 for the same inputs). Only APPROVED variations affect this value —
 * pending/rejected/cancelled never do, regardless of how large their totals
 * are.
 * CM-60B — values enlarged (text-base → text-xl/2xl) and each given its own
 * color identity (Original: info blue, Approved: success green, Current:
 * accent, in a highlighted box for emphasis as the strip's own "result") so
 * the strip reads as a real formula at a glance rather than small fine
 * print; +/= operators enlarged to match. Formula meaning and inputs are
 * unchanged — this is presentation only.
 */
export function ContractVariationFormulaStrip({ originalContractValue, approvedValue, computedCurrentValue }: Props): React.JSX.Element {
  return (
    <section className="rounded-lg border border-border bg-surface-secondary/50 px-5 py-4">
      <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-center">
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Original Contract Value</p>
          <p className="text-xl sm:text-2xl font-bold text-info tabular-nums mt-1">
            {originalContractValue ? formatContractValue(originalContractValue, 'KWD') : '—'}
          </p>
        </div>
        <span className="text-2xl font-bold text-text-muted shrink-0">+</span>
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Approved Variations Value</p>
          <p className="text-xl sm:text-2xl font-bold text-success tabular-nums mt-1">{formatContractValue(approvedValue, 'KWD')}</p>
        </div>
        <span className="text-2xl font-bold text-text-muted shrink-0">=</span>
        <div className="rounded-lg bg-accent/5 border border-accent/15 px-4 py-2">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Current Contract Value</p>
          <p className="text-xl sm:text-2xl font-bold text-accent tabular-nums mt-1">
            {computedCurrentValue ? formatContractValue(computedCurrentValue, 'KWD') : '—'}
          </p>
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-text-muted">
        Only approved variations affect the Current Contract Value.
      </p>
    </section>
  );
}
