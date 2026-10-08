// FMP-ACCESS-01 — pure helpers behind the New User wizard's Access Mode step and the Edit User
// Module Access tab. No 'use client' on purpose (same reason as access-template.ts): both the
// client components and server pages/tests can import real values from here.
import type { ModuleIdentifier, UserModuleAccessConfig } from '@/lib/users-api';
import {
  MODULE_DISPLAY_NAMES,
  deriveAccessMode,
  relatedWorkflowsFor,
  type AccessMode,
  type AccessModeInfo,
} from '../../../_lib/access-mode';
import type { AccessTemplate } from './access-template';

/** The six real operational modules (Administration is granted through the Platform Admin template, never by default). */
export const OPERATIONAL_MODULE_IDS: ModuleIdentifier[] = [
  'CONTRACTS_MANAGEMENT',
  'PRODUCTION_DASHBOARD',
  'SAFETY_COMPLIANCE',
  'INCIDENT_REPORT',
  'MAINTENANCE_REQUESTS',
  'FACTORY_TASKS',
];

const ALL_MODULE_IDS: ModuleIdentifier[] = [...OPERATIONAL_MODULE_IDS, 'ADMINISTRATION'];

/**
 * FMP-ACCESS-02 — Technical is a module an admin can pick, but it is NOT a ModuleIdentifier: its
 * department scope is stored on the Contract Management scope row (technical jobs are contract
 * records, and department scoping is unchanged). `scopeModuleFor` maps a pick to that row.
 */
export type WizardModule = ModuleIdentifier | 'TECHNICAL';

/** Modules offered in the Primary Module / Modules pickers, in display order (Administration is added for Custom only). */
export const WIZARD_MODULE_CHOICES: WizardModule[] = [
  'CONTRACTS_MANAGEMENT',
  'TECHNICAL',
  'PRODUCTION_DASHBOARD',
  'SAFETY_COMPLIANCE',
  'INCIDENT_REPORT',
  'MAINTENANCE_REQUESTS',
  'FACTORY_TASKS',
];

export function scopeModuleFor(choice: WizardModule): ModuleIdentifier {
  return choice === 'TECHNICAL' ? 'CONTRACTS_MANAGEMENT' : choice;
}

export function wizardModuleLabel(choice: WizardModule): string {
  return MODULE_DISPLAY_NAMES[choice];
}

/** Role suggested for a module + template. Contract Management and Technical have dedicated staff/manager roles; other modules pick manually. */
export function suggestedRoleCode(template: AccessTemplate, module: WizardModule): string | undefined {
  if (module === 'TECHNICAL') {
    if (template === 'MODULE_STAFF') return 'TECHNICAL_STAFF';
    if (template === 'MODULE_MANAGER') return 'TECHNICAL_MANAGER';
    return undefined;
  }
  if (module === 'CONTRACTS_MANAGEMENT') {
    if (template === 'MODULE_STAFF' || template === 'ERECTION_MANAGER') return 'CONTRACT_STAFF';
    if (template === 'MODULE_MANAGER') return 'CONTRACT_MANAGER';
  }
  return undefined;
}

export interface TemplateSuggestion {
  mode: AccessMode;
  /** True when the role itself decides the experience (Executive/Viewer/Admin span every module; Erection is always Contract Management). */
  modeLocked: boolean;
  moduleText: string;
  roleText: string;
}

/** What each Access Template suggests — shown on the template card and used to default the Access Mode. */
export const TEMPLATE_SUGGESTIONS: Record<AccessTemplate, TemplateSuggestion> = {
  EXECUTIVE_MANAGER: { mode: 'FULL_PLATFORM', modeLocked: true, moduleText: 'All platform modules (primary module optional)', roleText: 'Executive Manager' },
  MODULE_MANAGER: { mode: 'SINGLE_MODULE', modeLocked: false, moduleText: 'One selected module', roleText: 'Contract Manager (Contract Management) or Technical Manager (Technical); pick the role for other modules' },
  MODULE_STAFF: { mode: 'SINGLE_MODULE', modeLocked: false, moduleText: 'One selected module', roleText: 'Contract Staff (Contract Management) or Technical Staff (Technical); pick the role for other modules' },
  ERECTION_MANAGER: { mode: 'SINGLE_MODULE', modeLocked: true, moduleText: 'Contract Management (with Erection workflow)', roleText: 'Contract Staff' },
  MULTI_MODULE: { mode: 'MULTI_MODULE', modeLocked: false, moduleText: 'Modules you select', roleText: 'Choose the role manually' },
  VIEWER: { mode: 'FULL_PLATFORM', modeLocked: true, moduleText: 'All modules, read-only', roleText: 'Viewer' },
  PLATFORM_ADMIN: { mode: 'FULL_PLATFORM', modeLocked: true, moduleText: 'All modules plus Administration', roleText: 'Admin' },
  CUSTOM: { mode: 'SINGLE_MODULE', modeLocked: false, moduleText: 'Configure manually', roleText: 'Choose the role manually' },
};

export interface WizardAccessInput {
  mode: AccessMode;
  template: AccessTemplate;
  targetModule: WizardModule | '';
  multiModules: WizardModule[];
}

/** Modules whose scope rows the wizard shows and submits — only what the chosen Access Mode actually covers. */
export function wizardVisibleModules({ mode, template, targetModule, multiModules }: WizardAccessInput): ModuleIdentifier[] {
  if (mode === 'FULL_PLATFORM') {
    return template === 'PLATFORM_ADMIN' || template === 'CUSTOM' ? ALL_MODULE_IDS : OPERATIONAL_MODULE_IDS;
  }
  if (mode === 'MULTI_MODULE') {
    const rows = new Set(multiModules.map(scopeModuleFor));
    return ALL_MODULE_IDS.filter((m) => rows.has(m));
  }
  return targetModule ? [scopeModuleFor(targetModule)] : [];
}

/** When Technical is picked without Contract Management, the shared scope row is shown under the name "Technical". */
export function scopeRowLabelOverrides(input: WizardAccessInput): Partial<Record<ModuleIdentifier, string>> {
  const picked: WizardModule[] = input.mode === 'MULTI_MODULE' ? input.multiModules : input.targetModule ? [input.targetModule] : [];
  return picked.includes('TECHNICAL') && !picked.includes('CONTRACTS_MANAGEMENT') ? { CONTRACTS_MANAGEMENT: 'Technical' } : {};
}

export interface AccessStepInput extends WizardAccessInput {
  selectedRoleId: string;
  /** Actor may set the explicit Full Platform flag (same permission as granting All Departments). */
  canGrantFullPlatform: boolean;
  /** The chosen role already spans every module on its own, so no explicit flag is needed. */
  roleAlreadyFullPlatform: boolean;
}

/** Whether the Access Template step is complete for the chosen Access Mode. */
export function isAccessStepComplete(input: AccessStepInput): boolean {
  if (input.selectedRoleId === '') return false;
  if (input.mode === 'SINGLE_MODULE') return input.targetModule !== '';
  if (input.mode === 'MULTI_MODULE') return input.multiModules.length > 0;
  return input.roleAlreadyFullPlatform || input.canGrantFullPlatform;
}

/** The explicit flag is only sent when the admin chose Full Platform and the role does not already imply it. */
export function shouldSendFullPlatformFlag(mode: AccessMode, roleAlreadyFullPlatform: boolean): boolean {
  return mode === 'FULL_PLATFORM' && !roleAlreadyFullPlatform;
}

export interface ModuleAccessGroups {
  info: AccessModeInfo;
  /** Single Module Access only: the one module this user works in. */
  primary: UserModuleAccessConfig | null;
  /** Names of the workflow links that ride on the primary module (Contract Management → Technical, Erection, Schedule Planning). */
  relatedWorkflows: string[];
  /** Multi-Module / Full Platform: every module the role grants. */
  modules: UserModuleAccessConfig[];
  /** Modules the role does not grant but that carry a non-default scope row — shown honestly, never hidden. */
  other: UserModuleAccessConfig[];
  administration: UserModuleAccessConfig | null;
  /** Default-scope rows for modules the role does not grant — tucked away so they do not look like access. */
  notGranted: UserModuleAccessConfig[];
  /** Technical keeps its department scope on the Contract Management row; a Technical-only user sees that row named "Technical". */
  labelOverrides: Partial<Record<ModuleIdentifier, string>>;
}

/** Groups a user's stored scope rows by how they relate to what the role actually grants. Read-only: nothing is added or removed. */
export function groupModuleAccess(
  configs: UserModuleAccessConfig[],
  permissions: string[],
  fullPlatformAccess: boolean,
): ModuleAccessGroups {
  const info = deriveAccessMode(permissions, fullPlatformAccess);
  const byModule = new Map(configs.map((c) => [c.module, c]));
  // Explicit Full Platform Access shows every operational module (read overlay applied by the API); otherwise only what the role grants.
  const grantedCodes = info.fullPlatformSource === 'explicit' ? [...OPERATIONAL_MODULE_IDS, 'TECHNICAL' as const] : info.modules;
  const technicalOnly = grantedCodes.includes('TECHNICAL') && !grantedCodes.includes('CONTRACTS_MANAGEMENT');
  const granted = new Set<ModuleIdentifier>(grantedCodes.map((m) => scopeModuleFor(m)));
  const isSingle = info.mode === 'SINGLE_MODULE';

  const primary = isSingle && info.primaryModule ? byModule.get(scopeModuleFor(info.primaryModule)) ?? null : null;
  const modules = isSingle
    ? []
    : OPERATIONAL_MODULE_IDS.flatMap((m) => (granted.has(m) && byModule.has(m) ? [byModule.get(m)!] : []));

  const administration = byModule.get('ADMINISTRATION');
  const showAdministration = !!administration && (info.hasAdministration || administration.scope !== 'OWN_DEPARTMENT');

  const rest = OPERATIONAL_MODULE_IDS.flatMap((m) => (!granted.has(m) && byModule.has(m) ? [byModule.get(m)!] : []));
  return {
    info,
    primary,
    relatedWorkflows: isSingle ? relatedWorkflowsFor(info.primaryModule) : [],
    labelOverrides: technicalOnly ? { CONTRACTS_MANAGEMENT: 'Technical' } : {},
    modules,
    other: rest.filter((c) => c.scope !== 'OWN_DEPARTMENT'),
    administration: showAdministration ? administration! : null,
    notGranted: [
      ...rest.filter((c) => c.scope === 'OWN_DEPARTMENT'),
      ...(administration && !showAdministration ? [administration] : []),
    ],
  };
}
