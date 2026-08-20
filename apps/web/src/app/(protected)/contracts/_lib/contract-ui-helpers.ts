// ---------------------------------------------------------------------------
// Pure, presentation-agnostic helpers for Contract Management UI consistency.
// Kept dependency-free (no React import) so they can be unit tested directly,
// matching the pattern used by ../../_lib/root-dashboard-helpers.ts.
// ---------------------------------------------------------------------------

export interface ContractDepartmentBadgeState {
  hasDepartment: boolean;
  label: string;
}

export function getContractDepartmentBadgeState(
  department: { id: string; name: string } | null | undefined,
): ContractDepartmentBadgeState {
  if (!department) {
    return { hasDepartment: false, label: 'No Department' };
  }
  return { hasDepartment: true, label: department.name };
}

// ---------------------------------------------------------------------------
// Lifecycle transition visibility — driven entirely by permission codes.
// Never takes a role name/code; only actor.permissions may gate visibility.
// ---------------------------------------------------------------------------

export interface VisibleContractTransitions {
  activate: boolean;
  terminate: boolean;
  close: boolean;
}

export function getVisibleContractTransitions(
  status: string,
  permissions: string[],
): VisibleContractTransitions {
  const isDraft = status === 'DRAFT';
  const isActive = status === 'ACTIVE';
  const isTerminated = status === 'TERMINATED';

  return {
    activate: isDraft && permissions.includes('contracts.activate'),
    terminate: isActive && permissions.includes('contracts.terminate'),
    close: (isActive || isTerminated) && permissions.includes('contracts.close'),
  };
}

export function hasAnyVisibleTransition(visible: VisibleContractTransitions): boolean {
  return visible.activate || visible.terminate || visible.close;
}

// ---------------------------------------------------------------------------
// KWD currency formatting — always 3 decimal places (KWD has fils
// subdivisions), e.g. "KWD 2,550.000". Returns "—" for missing/invalid values.
// ---------------------------------------------------------------------------

export function formatContractValue(value: string | undefined, currency: string | undefined): string {
  if (!value) return '—';
  const amount = parseFloat(value);
  if (isNaN(amount)) return '—';
  const formatted = amount.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  return currency ? `${currency} ${formatted}` : formatted;
}

// ---------------------------------------------------------------------------
// Scope of Work / Payment Terms option lists — shared by New Contract
// Register, Edit Contract, and the Contract Detail Overview badges so all
// three surfaces always show identical options.
//
// The 'designProduction' key is preserved for backward compatibility with
// data already saved under that key; only its display label changed to
// "Production Drawings".
// ---------------------------------------------------------------------------

export interface OptionDef {
  key: string;
  label: string;
}

export const SCOPE_OF_WORK_OPTIONS: OptionDef[] = [
  { key: 'shopDrawing', label: 'Shop Drawing' },
  { key: 'designProduction', label: 'Production Drawings' },
  { key: 'production', label: 'Production' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'erection', label: 'Erection' },
  { key: 'exFactory', label: 'Ex-Factory' },
  { key: 'other', label: 'Other' },
  { key: 'notApplicable', label: 'Not Applicable' },
];

export const PAYMENT_TERM_OPTIONS: OptionDef[] = [
  { key: 'advance', label: 'Advance' },
  { key: 'retention', label: 'Retention' },
  { key: 'performanceBond', label: 'Performance Bond' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'interimPayment', label: 'Interim Payment' },
  { key: 'taxClearance', label: 'Tax Clearance' },
];

// ---------------------------------------------------------------------------
// Erection / Crane option lists — shown only when Erection is part of scope.
// Values match the backend's controlled list exactly (CRANE_REQUIRED_OPTIONS /
// CRANE_PROVIDED_BY_OPTIONS in create-contract.dto.ts).
// ---------------------------------------------------------------------------

export const CRANE_REQUIRED_OPTIONS: OptionDef[] = [
  { key: 'YES', label: 'Yes' },
  { key: 'NO', label: 'No' },
  { key: 'NOT_DECIDED', label: 'Not Decided' },
];

export const CRANE_PROVIDED_BY_OPTIONS: OptionDef[] = [
  { key: 'RECAFCO', label: 'RECAFCO' },
  { key: 'CLIENT', label: 'Client' },
  { key: 'THIRD_PARTY', label: 'Third Party' },
  { key: 'NOT_DECIDED', label: 'Not Decided' },
];

export function optionLabel(options: OptionDef[], key: string | undefined): string {
  if (!key) return '—';
  return options.find((o) => o.key === key)?.label ?? key;
}
