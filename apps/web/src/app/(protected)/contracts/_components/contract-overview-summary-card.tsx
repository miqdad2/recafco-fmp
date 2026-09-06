import type { Contract } from '../../../../lib/contracts-api';
import { formatDaysRemainingDisplay, scheduleStatusLabel } from '../_lib/contract-ui-helpers';
import { LIFECYCLE_STATUS_LABEL } from './contract-lifecycle-badge';

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface FieldProps {
  label: string;
  value: string;
  valueClassName?: string;
}

function Field({ label, value, valueClassName }: FieldProps): React.JSX.Element {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className={`mt-0.5 text-sm font-medium text-text-primary ${valueClassName ?? ''}`}>{value}</dd>
    </div>
  );
}

interface Props {
  contract: Contract;
  /**
   * CM-57B — real lifecycle/closeout action buttons (ContractTransitions /
   * ContractClosureAction), rendered inline in this card's own header row
   * instead of a separate full-width "Available Actions" section. Exactly
   * the same components/conditions as before — only where they render
   * changed, never what they do or when they're visible.
   */
  actions?: React.ReactNode;
}

/**
 * CM-57 — Contract Detail Overview, Section 1 "Contract Summary". Every
 * field is a real Contract column; there is no Risk Rating field/module in
 * this schema, so it is never shown here (per the approved-design note that
 * explicitly says to prefer omitting it over faking one). Days Remaining
 * reuses the exact same forecastCompletionDate→endDate fallback the
 * Contract List's own column already uses (contract-ui-helpers.ts), so the
 * two surfaces can never disagree.
 */
export function ContractOverviewSummaryCard({ contract, actions }: Props): React.JSX.Element {
  const days = formatDaysRemainingDisplay(contract.forecastCompletionDate, contract.endDate);

  return (
    <section className="rounded-lg border border-border bg-surface shadow-sm p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-border">
        <h2 className="text-sm font-semibold text-text-primary">Contract Summary</h2>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
        <Field label="Job Order" value={contract.jobOrder?.trim() || '—'} />
        <Field label="Date" value={formatDate(contract.contractDate)} />
        <Field label="Quotation #" value={contract.quotationNumber?.trim() || '—'} />
        <Field label="Company Name" value={contract.counterpartyName} />
        <Field label="Project Name" value={contract.title} />
        <Field label="Project Number" value={contract.projectNumber?.trim() || '—'} />
        <Field label="Contract Manager" value={contract.ownerUser.displayName} />
        <Field label="Contract Status" value={LIFECYCLE_STATUS_LABEL[contract.lifecycleStatus]} />
        <Field
          label="Schedule Status"
          value={contract.scheduleStatus ? scheduleStatusLabel(contract.scheduleStatus) : '—'}
        />
        <Field
          label="Days Remaining"
          value={days.label}
          valueClassName={days.overdue ? 'text-error' : days.dueSoon ? 'text-warning' : ''}
        />
      </dl>
    </section>
  );
}
