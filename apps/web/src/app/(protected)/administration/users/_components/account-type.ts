/**
 * FMP-MIC-01C — the first choice in the New User wizard. It decides which wizard steps exist,
 * so a management account never walks through (or submits) operational steps. The server action
 * and API re-check everything; this file only drives the UI.
 */
export type AccountType = 'OPERATIONAL' | 'MANAGEMENT';

export const DEFAULT_ACCOUNT_TYPE: AccountType = 'OPERATIONAL';

export const MANAGEMENT_ROLE_CODE = 'MANAGEMENT_INTELLIGENCE_VIEWER';

export type WizardStepKey = 'account' | 'organization' | 'template' | 'modules' | 'review';

const STEPS: Record<AccountType, { key: WizardStepKey; label: string }[]> = {
  OPERATIONAL: [
    { key: 'account', label: 'Account' },
    { key: 'organization', label: 'Organization' },
    { key: 'template', label: 'Access Template' },
    { key: 'modules', label: 'Module Access' },
    { key: 'review', label: 'Review & Create' },
  ],
  MANAGEMENT: [
    { key: 'account', label: 'Account & Access' },
    { key: 'review', label: 'Review & Create' },
  ],
};

export function wizardStepsFor(type: AccountType): { key: WizardStepKey; label: string }[] {
  return STEPS[type];
}

export const ACCOUNT_TYPE_OPTIONS: { value: AccountType; label: string; description: string }[] = [
  {
    value: 'OPERATIONAL',
    label: 'FMP Operational User',
    description: 'For employees who work with contracts, Technical, Production and other FMP modules.',
  },
  {
    value: 'MANAGEMENT',
    label: 'Management Intelligence Viewer',
    description: 'For management users who only view factory performance and reporting dashboards.',
  },
];

/** What the Review step states for a management account — fixed text, because the account can hold nothing else. */
export const MANAGEMENT_REVIEW_ROWS: { label: string; value: string }[] = [
  { label: 'Account Type', value: 'Management Intelligence Viewer' },
  { label: 'Access', value: 'Management dashboards only' },
  { label: 'Operational Modules', value: 'No access' },
  { label: 'Full Platform Access', value: 'Disabled' },
  { label: 'Login', value: 'Existing RECAFCO FMP Login' },
  { label: 'Landing Page', value: 'Management Intelligence Center' },
];
