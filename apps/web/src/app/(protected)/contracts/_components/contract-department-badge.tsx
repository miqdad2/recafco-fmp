import { Building2, AlertTriangle } from 'lucide-react';
import { getContractDepartmentBadgeState } from '../_lib/contract-ui-helpers';

interface Props {
  department: { id: string; name: string } | null | undefined;
  className?: string | undefined;
}

export function ContractDepartmentBadge({ department, className = '' }: Props): React.JSX.Element {
  const state = getContractDepartmentBadgeState(department);

  if (!state.hasDepartment) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-warning/10 text-warning border border-warning/30 ${className}`}
      >
        <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
        {state.label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-info-light text-info border border-info/20 ${className}`}
    >
      <Building2 className="size-3.5 shrink-0" aria-hidden="true" />
      {state.label}
    </span>
  );
}
