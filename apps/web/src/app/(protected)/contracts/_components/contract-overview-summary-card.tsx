import type { Contract } from '../../../../lib/contracts-api';
import { formatContractValue, formatDaysRemainingDisplay, scheduleStatusLabel } from '../_lib/contract-ui-helpers';
import { CONTRACT_SUMMARY_LAYOUT, scheduleBadgeClass, type SummaryField } from '../_lib/contract-overview-display-helpers';
import { ContractLifecycleBadge } from './contract-lifecycle-badge';

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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
 * this schema, so it is never shown here. Days Remaining reuses the exact
 * same forecastCompletionDate→endDate fallback the Contract List's own
 * column already uses (contract-ui-helpers.ts), so the two surfaces can
 * never disagree.
 *
 * FMP-CONTRACT-07/08 — shared by every role. Three grouped rows
 * (CONTRACT_SUMMARY_LAYOUT): key facts (Project, Company, Job Order), key
 * status (Contract Status, Days Remaining, Current Contract Value), then the
 * secondary details in a quieter, denser row. Schedule Status is a badge
 * ("—" when empty) and is never confused with Contract Status. Same fields,
 * same data, presentation only.
 */
export function ContractOverviewSummaryCard({ contract, actions }: Props): React.JSX.Element {
  const days = formatDaysRemainingDisplay(contract.forecastCompletionDate, contract.endDate);
  const currentValue = contract.contractValue ? formatContractValue(contract.contractValue, contract.currency) : '—';

  function value(field: SummaryField): React.ReactNode {
    switch (field.key) {
      case 'projectName':
        return contract.title;
      case 'companyName':
        return contract.counterpartyName;
      case 'jobOrder':
        return contract.jobOrder?.trim() || '—';
      case 'contractStatus':
        return <ContractLifecycleBadge status={contract.lifecycleStatus} />;
      case 'daysRemaining':
        return <span className={days.overdue ? 'text-error' : days.dueSoon ? 'text-warning' : ''}>{days.label}</span>;
      case 'currentValue':
        return <span className="tabular-nums">{currentValue}</span>;
      case 'date':
        return formatDate(contract.contractDate);
      case 'quotation':
        return contract.quotationNumber?.trim() || '—';
      case 'projectNumber':
        return contract.projectNumber?.trim() || '—';
      case 'contractManager':
        return contract.ownerUser.displayName;
      case 'scheduleStatus':
        return contract.scheduleStatus ? (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${scheduleBadgeClass(contract.scheduleStatus)}`}>
            {scheduleStatusLabel(contract.scheduleStatus)}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        );
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface shadow-sm p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-border">
        <h2 className="text-sm font-semibold text-text-primary">Contract Summary</h2>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {/* Row 1 — key facts */}
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-3">
        {CONTRACT_SUMMARY_LAYOUT.keyFacts.map((f) => (
          <div key={f.key} className="min-w-0">
            <dt className="text-xs font-medium text-text-muted">{f.label}</dt>
            <dd className="mt-0.5 text-lg font-semibold text-text-primary wrap-break-word">{value(f)}</dd>
          </div>
        ))}
      </dl>

      {/* Row 2 — key status */}
      <dl className="mt-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-3">
        {CONTRACT_SUMMARY_LAYOUT.keyStatus.map((f) => (
          <div key={f.key} className="min-w-0">
            <dt className="text-xs font-medium text-text-muted">{f.label}</dt>
            <dd className="mt-0.5 text-base font-semibold text-text-primary">{value(f)}</dd>
          </div>
        ))}
      </dl>

      {/* Row 3 — secondary details */}
      <dl className="mt-4 pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-3">
        {CONTRACT_SUMMARY_LAYOUT.secondary.map((f) => (
          <div key={f.key} className="min-w-0">
            <dt className="text-xs text-text-muted">{f.label}</dt>
            <dd className="mt-0.5 text-sm font-medium text-text-primary">{value(f)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
