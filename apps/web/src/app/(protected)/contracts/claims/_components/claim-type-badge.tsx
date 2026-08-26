import type { ContractClaimType } from '@/lib/contracts-api';

const TYPE_LABELS: Record<ContractClaimType, string> = {
  VARIATION: 'Variation',
  EXTENSION_OF_TIME: 'Extension of Time',
  DELAY: 'Delay',
  PAYMENT: 'Payment',
  DAMAGE: 'Damage',
  SCOPE_CHANGE: 'Scope Change',
  OTHER: 'Other',
};

export function ClaimTypeBadge({ claimType }: { claimType: ContractClaimType }): React.JSX.Element {
  return (
    <span className="inline-flex items-center rounded-full bg-surface-secondary px-2.5 py-0.5 text-xs font-medium text-text-secondary whitespace-nowrap">
      {TYPE_LABELS[claimType]}
    </span>
  );
}
