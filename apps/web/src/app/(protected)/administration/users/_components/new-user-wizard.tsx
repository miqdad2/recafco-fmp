'use client';

import { useActionState, useState, useMemo, useEffect } from 'react';
import { Check, AlertTriangle } from 'lucide-react';
import type { OrgEntity, LocationEntity } from '@/lib/organizations-api';
import type { RoleSummary, PermissionSummary } from '@/lib/roles-api';
import type { ModuleIdentifier, DepartmentAccessScope } from '@/lib/users-api';
import { RolePermissionSummary } from './role-permission-summary';
import { ModuleAccessEditor, ALL_MODULES } from './module-access-editor';
import { MODULE_LABELS, SCOPE_LABELS } from './scope-utils';
import type { AccessTemplate } from './access-template';
import { buildCredentialsText } from './credentials-text';
import {
  ACCESS_MODE_HELPERS,
  ACCESS_MODE_LABELS,
  deriveAccessMode,
  relatedWorkflowsFor,
  type AccessMode,
} from '../../../_lib/access-mode';
import {
  WIZARD_MODULE_CHOICES,
  scopeModuleFor,
  scopeRowLabelOverrides,
  suggestedRoleCode,
  wizardModuleLabel,
  type WizardModule,
  TEMPLATE_SUGGESTIONS,
  isAccessStepComplete,
  shouldSendFullPlatformFlag,
  wizardVisibleModules,
} from './access-mode-config';
import type { CreateWithAccessState } from '../actions';

export type { AccessTemplate } from './access-template';

export interface RoleWithPerms extends RoleSummary {
  permissions: PermissionSummary[];
}

interface Props {
  action: (prev: CreateWithAccessState, formData: FormData) => Promise<CreateWithAccessState>;
  roles: RoleWithPerms[];
  departments: OrgEntity[];
  plants: OrgEntity[];
  locations: LocationEntity[];
  canManageAll: boolean;
  deptApiError?: boolean;
  plantApiError?: boolean;
  locApiError?: boolean;
  /** CM-42 — carried in from /administration/users/new?module=<slug> (Users page module cards). Only affects initial state — the Module dropdown and Access Template stay fully editable, exactly as if picked by hand. */
  preselectedModule?: WizardModule;
  /** FMP-UI-02 — display name for the banner shown alongside preselectedModule, so a card whose slug differs from the underlying module's own name (e.g. "Technical"/"Erection", both really Contract Management) shows the label the admin actually clicked, not the generic module name. Falls back to MODULE_LABELS[preselectedModule] when omitted. */
  preselectedModuleLabel?: string;
  /** FMP-UI-02 — carried in from ?template=<value> (module-catalog.ts's presetTemplate, or the standalone Executive / Management card link). Applied once on mount via the same handleTemplateChange() path a manual radio click would use. */
  preselectedTemplate?: AccessTemplate;
}

function FieldError({ errors }: { errors: string[] | undefined }): React.JSX.Element | null {
  if (!errors?.length) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-error">
      {errors.join('. ')}
    </p>
  );
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 h-8 px-3 rounded-md border border-border bg-surface text-xs text-text-secondary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
    >
      {copied ? 'Copied!' : label}
    </button>
  );
}

const inputCls = (hasError?: boolean): string =>
  [
    'w-full h-10 px-3 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-focus bg-surface text-text-primary',
    hasError ? 'border-error' : 'border-border',
  ].join(' ');

const selectCls =
  'w-full h-10 px-3 rounded-md border border-border bg-surface text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-focus';

const TEMPLATE_OPTIONS: { value: AccessTemplate; label: string; helper: string }[] = [
  // FMP-UI-02 — no dedicated "Executive Manager" role existed before this unit (audited all 6
  // existing roles first); EXECUTIVE_MANAGER is a new additive role (all 6 operational modules'
  // own read/write permissions, withholding users.*/roles.*/org.*/audit.*/access_scope.* — see
  // that role's own migration) so it is deliberately NOT the same as Platform Admin below.
  { value: 'EXECUTIVE_MANAGER', label: 'Executive Manager', helper: 'Full platform access. View and manage operations across modules based on the assigned role (not system administration).' },
  { value: 'MODULE_MANAGER', label: 'Module Manager', helper: 'Manage one selected module.' },
  { value: 'MODULE_STAFF', label: 'Module Staff', helper: 'Work inside one selected module.' },
  // CM-71H.1 — no dedicated "Erection Manager" role exists (see TEMPLATE_ROLE_CODE below); this is a
  // clearly-labelled access template, not a new role/permission, per that unit's own "if the existing
  // role model does not support a separate role, create a safe access template" instruction.
  { value: 'ERECTION_MANAGER', label: 'Erection Manager / Workflow Owner', helper: 'Contract Management — assigned to own and update a specific contract’s Erection Workflow.' },
  { value: 'MULTI_MODULE', label: 'Multi-Module User', helper: 'Work across selected modules.' },
  { value: 'VIEWER', label: 'Viewer / Read-only', helper: 'View dashboards and records without create, update or delete.' },
  { value: 'PLATFORM_ADMIN', label: 'Platform Admin', helper: 'Manage users, roles and configuration.' },
  { value: 'CUSTOM', label: 'Custom', helper: 'Manually configure role, modules and scopes.' },
];

/**
 * Only Contract Management has dedicated Staff/Manager roles as of CM-35 —
 * other modules fall back to manual role selection.
 *
 * CM-71H.1 — Erection Manager / Workflow Owner deliberately maps to the
 * SAME CONTRACT_STAFF role as Module Staff (contracts.workflow_update, no
 * contracts.update): that permission tier is exactly what CM-71H.1's own
 * erection-department-write-access.ts relaxation was built for (it lets a
 * contracts.workflow_update-only actor save Steps 1/3/5, the Erection-
 * Department-owned steps), and it deliberately stays short of Contract
 * Manager's full contract-wide authority (payments/claims/closeout/etc.) —
 * an Erection Manager should only ever be able to act on the SPECIFIC
 * contracts a Contract Manager assigns them via the Erection Workflow
 * Assignment flow (CM-71H), never on every contract in the department.
 *
 * FMP-UI-02 — EXECUTIVE_MANAGER and VIEWER map to their own real roles of
 * the same name (see the migration for EXECUTIVE_MANAGER's exact grant).
 */
const TEMPLATE_ROLE_CODE: Partial<Record<AccessTemplate, string>> = {
  EXECUTIVE_MANAGER: 'EXECUTIVE_MANAGER',
  MODULE_STAFF: 'CONTRACT_STAFF',
  MODULE_MANAGER: 'CONTRACT_MANAGER',
  ERECTION_MANAGER: 'CONTRACT_STAFF',
  VIEWER: 'VIEWER',
};

/** Every operational module EXECUTIVE_MANAGER's Module Access step auto-selects — deliberately excludes ADMINISTRATION (Executive Manager has no users/roles/org permission codes, so an Administration scope row would be meaningless). */
const EXECUTIVE_MANAGER_MODULES: ModuleIdentifier[] = [
  'CONTRACTS_MANAGEMENT', 'FACTORY_TASKS', 'INCIDENT_REPORT', 'MAINTENANCE_REQUESTS', 'SAFETY_COMPLIANCE', 'PRODUCTION_DASHBOARD',
];

/**
 * CM-42 — mirrors what handleTargetModuleChange() below would do, for the
 * initial render only: the default template is MODULE_STAFF, so a
 * preselected Contract Management module also auto-selects Contract Staff
 * (the user can still switch to Module Manager, which re-triggers the same
 * mapping for Contract Manager). Every other module has no auto-mapped
 * role — this correctly resolves to '' for them, same as picking it by hand.
 */
function preselectedRoleId(mod: WizardModule | undefined, roles: RoleWithPerms[]): string {
  if (!mod) return '';
  // FMP-ACCESS-02 — Contract Management and Technical each have their own Staff role.
  const roleCode = suggestedRoleCode('MODULE_STAFF', mod);
  if (!roleCode) return '';
  return roles.find((r) => r.isActive && r.code === roleCode)?.id ?? '';
}

/** Short capability hint shown next to a role's name in the Role dropdown — purely descriptive, not authoritative (the permission preview below is). */
const ROLE_HINTS: Record<string, string> = {
  EXECUTIVE_MANAGER: 'Full operational access — all modules, not admin',
  CONTRACT_STAFF: 'Contract Management — Staff',
  CONTRACT_MANAGER: 'Contract Management — Manager',
  CONTRACT_MANAGEMENT_USER: 'Contract Management — Legacy / full access',
  VIEWER: 'Read-only across modules',
  ADMIN: 'Platform Admin',
  SUPER_ADMIN: 'Full unrestricted access',
};

function roleOptionLabel(role: RoleWithPerms): string {
  const hint = ROLE_HINTS[role.code];
  return hint ? `${role.name} (${hint})` : role.name;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const WIZARD_STEPS = ['Account', 'Organization', 'Access Template', 'Module Access', 'Review & Create'] as const;

function StepIndicator({ current }: { current: number }): React.JSX.Element {
  return (
    <ol className="flex items-center gap-1 sm:gap-2 mb-6 overflow-x-auto pb-1">
      {WIZARD_STEPS.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'upcoming';
        return (
          <li key={label} className="flex items-center gap-1 sm:gap-2 shrink-0">
            <span
              className={[
                'flex items-center justify-center size-6 rounded-full text-[11px] font-semibold shrink-0',
                state === 'done' ? 'bg-accent text-accent-foreground' : '',
                state === 'active' ? 'bg-accent text-accent-foreground' : '',
                state === 'upcoming' ? 'bg-surface-secondary text-text-muted border border-border' : '',
              ].join(' ')}
              aria-hidden="true"
            >
              {state === 'done' ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span
              className={[
                'text-xs whitespace-nowrap',
                state === 'upcoming' ? 'text-text-muted' : 'text-text-primary font-medium',
              ].join(' ')}
            >
              {label}
            </span>
            {i < WIZARD_STEPS.length - 1 && (
              <span className="w-4 sm:w-8 h-px bg-border shrink-0" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

interface ModuleAccessSummaryEntry {
  module: ModuleIdentifier;
  scope: DepartmentAccessScope;
  deptCount: number;
}

function buildModuleAccessSummary(
  scopes: Partial<Record<ModuleIdentifier, DepartmentAccessScope>>,
  deptIdsByModule: Partial<Record<ModuleIdentifier, string[]>>,
  visibleModules: ModuleIdentifier[],
): ModuleAccessSummaryEntry[] {
  return ALL_MODULES.filter((m) => visibleModules.includes(m) && scopes[m] !== undefined).map((m) => ({
    module: m,
    scope: scopes[m]!,
    deptCount: deptIdsByModule[m]?.length ?? 0,
  }));
}

interface WarningInput {
  template: AccessTemplate;
  selectedRole: RoleWithPerms | undefined;
  moduleScopes: Partial<Record<ModuleIdentifier, DepartmentAccessScope>>;
}

/** Pure, deliberately literal — each rule maps 1:1 to a scenario named in the CM-36 spec rather than a general-purpose mismatch engine. */
function computeAccessWarnings({ template, selectedRole, moduleScopes }: WarningInput): string[] {
  const warnings: string[] = [];

  if (template === 'PLATFORM_ADMIN') {
    warnings.push('Platform Admin grants broad access, including managing users, roles and configuration. Confirm this is intended.');
  }
  if (selectedRole?.code === 'CONTRACT_STAFF' && moduleScopes['CONTRACTS_MANAGEMENT'] === 'ALL_DEPARTMENTS') {
    warnings.push('Contract Staff with All Departments access is unusual — staff normally only need visibility into their own department.');
  }
  if (selectedRole?.code === 'CONTRACT_MANAGER' && moduleScopes['CONTRACTS_MANAGEMENT'] === undefined) {
    warnings.push('Contract Manager role selected, but Contract Management module access was never configured in this wizard — it will default to My Department.');
  }
  if (template === 'MODULE_MANAGER' && selectedRole?.code === 'VIEWER') {
    warnings.push('Viewer is a read-only role — it does not match what the Module Manager template usually expects.');
  }
  if (template === 'ERECTION_MANAGER' && selectedRole && selectedRole.code !== 'CONTRACT_STAFF') {
    warnings.push('Erection Manager / Workflow Owner is designed around the Contract Staff role (contracts.workflow_update). A different role may grant broader or narrower access than intended.');
  }
  if (template === 'EXECUTIVE_MANAGER' && selectedRole && selectedRole.code !== 'EXECUTIVE_MANAGER') {
    warnings.push('Executive Manager template is designed around the Executive Manager role. A different role may grant broader or narrower access than intended.');
  }

  return warnings;
}

export function NewUserWizard({
  action,
  roles,
  departments,
  plants,
  locations,
  canManageAll,
  deptApiError = false,
  plantApiError = false,
  locApiError = false,
  preselectedModule,
  preselectedModuleLabel,
  preselectedTemplate,
}: Props): React.JSX.Element {
  const [state, formAction, isPending] = useActionState(action, null);
  const [step, setStep] = useState(0);

  // Step 1 — Account
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [employeeNumber, setEmployeeNumber] = useState('');

  // Step 2 — Organization
  const [departmentId, setDepartmentId] = useState('');
  const [selectedPlantId, setSelectedPlantId] = useState('');
  const [locationId, setLocationId] = useState('');

  // Step 3 — Access Template
  const [template, setTemplate] = useState<AccessTemplate>('MODULE_STAFF');
  const [targetModule, setTargetModule] = useState<WizardModule | ''>(preselectedModule ?? '');
  // FMP-ACCESS-01 — Access Mode is chosen explicitly. The default template (Module Staff) suggests
  // Single Module Access; Full Platform Access is never selected unless a template/admin picks it.
  const [accessMode, setAccessMode] = useState<AccessMode>(TEMPLATE_SUGGESTIONS['MODULE_STAFF'].mode);
  const [multiModules, setMultiModules] = useState<WizardModule[]>(() => (preselectedModule ? [preselectedModule] : []));
  const [selectedRoleId, setSelectedRoleId] = useState(() => preselectedRoleId(preselectedModule, roles));

  // Step 4 — Module Access (lifted out of ModuleAccessEditor so Review can summarize it)
  const [moduleScopes, setModuleScopes] = useState<Partial<Record<ModuleIdentifier, DepartmentAccessScope>>>(
    () => (preselectedModule ? { [scopeModuleFor(preselectedModule)]: 'OWN_DEPARTMENT' } : {}),
  );
  const [moduleDeptIds, setModuleDeptIds] = useState<Partial<Record<ModuleIdentifier, string[]>>>({});

  function handleModuleScopeChange(mod: ModuleIdentifier, scope: DepartmentAccessScope): void {
    setModuleScopes((prev) => ({ ...prev, [mod]: scope }));
    if (scope !== 'SELECTED_DEPARTMENTS') {
      setModuleDeptIds((prev) => ({ ...prev, [mod]: [] }));
    }
  }
  function handleModuleDeptIdsChange(mod: ModuleIdentifier, deptIds: string[]): void {
    setModuleDeptIds((prev) => ({ ...prev, [mod]: deptIds }));
  }

  const activeRoles = roles.filter((r) => r.isActive);
  const contractStaffRole = activeRoles.find((r) => r.code === 'CONTRACT_STAFF');
  const contractManagerRole = activeRoles.find((r) => r.code === 'CONTRACT_MANAGER');
  const contractLegacyRole = activeRoles.find((r) => r.code === 'CONTRACT_MANAGEMENT_USER');
  const viewerRole = activeRoles.find((r) => r.code === 'VIEWER');

  function handleMultiModuleToggle(mod: WizardModule, checked: boolean): void {
    setMultiModules((prev) => (checked ? (prev.includes(mod) ? prev : [...prev, mod]) : prev.filter((m) => m !== mod)));
    const row = scopeModuleFor(mod);
    if (checked) setModuleScopes((prev) => (prev[row] !== undefined ? prev : { ...prev, [row]: 'OWN_DEPARTMENT' }));
  }

  function handleAccessModeChange(next: AccessMode): void {
    setAccessMode(next);
    // Switching to Multi-Module starts from the module already picked (if any) — nothing else is pre-selected.
    if (next === 'MULTI_MODULE' && multiModules.length === 0 && targetModule) handleMultiModuleToggle(targetModule, true);
  }

  function handleTemplateChange(next: AccessTemplate): void {
    setTemplate(next);
    setAccessMode(TEMPLATE_SUGGESTIONS[next].mode);
    if (next === 'PLATFORM_ADMIN') {
      setTargetModule('');
      const admin = activeRoles.find((r) => r.code === 'ADMIN');
      setSelectedRoleId(admin?.id ?? '');
    } else if (next === 'MODULE_STAFF' || next === 'MODULE_MANAGER') {
      setTargetModule('');
      setSelectedRoleId(''); // wait for the module to be chosen below
    } else if (next === 'ERECTION_MANAGER') {
      // CM-71H.1 — this template is Contract Management only, so there is no
      // module picker to wait on (unlike Module Staff/Manager, which work
      // across any module) — go straight to the role and module scope it implies.
      setTargetModule('CONTRACTS_MANAGEMENT');
      const contractStaff = activeRoles.find((r) => r.code === TEMPLATE_ROLE_CODE['ERECTION_MANAGER']);
      setSelectedRoleId(contractStaff?.id ?? '');
      setModuleScopes((prev) => (prev['CONTRACTS_MANAGEMENT'] !== undefined ? prev : { ...prev, CONTRACTS_MANAGEMENT: 'OWN_DEPARTMENT' }));
    } else if (next === 'EXECUTIVE_MANAGER') {
      // FMP-UI-02 — not tied to one module (unlike Module Staff/Manager), so
      // no module picker is shown, same reasoning as Erection Manager above.
      // Auto-selects the Executive Manager role and seeds every operational
      // module's Module Access scope: All Departments when this actor can
      // grant it (access_scope.manage_all_departments — see canManageAll),
      // otherwise Selected Departments with every currently-active
      // department pre-checked, since granting All Departments without that
      // permission would be rejected server-side. Either way this is a
      // starting point, not a lock — every row stays editable in Step 4.
      setTargetModule('');
      const executiveManager = activeRoles.find((r) => r.code === TEMPLATE_ROLE_CODE['EXECUTIVE_MANAGER']);
      setSelectedRoleId(executiveManager?.id ?? '');
      const allDeptIds = departments.map((d) => d.id);
      setModuleScopes((prev) => {
        const seeded = { ...prev };
        for (const mod of EXECUTIVE_MANAGER_MODULES) seeded[mod] = canManageAll ? 'ALL_DEPARTMENTS' : 'SELECTED_DEPARTMENTS';
        return seeded;
      });
      if (!canManageAll) {
        setModuleDeptIds((prev) => {
          const seeded = { ...prev };
          for (const mod of EXECUTIVE_MANAGER_MODULES) seeded[mod] = allDeptIds;
          return seeded;
        });
      }
    } else if (next === 'VIEWER') {
      // FMP-UI-02 — Viewer's own role already carries read-only access to
      // every module (see the RBAC foundation migration), so there is no
      // module picker to wait on either; Module Access in Step 4 stays at
      // its normal My Department default per module unless the admin widens
      // it manually — read-only visibility, not automatically company-wide.
      setTargetModule('');
      const viewer = activeRoles.find((r) => r.code === TEMPLATE_ROLE_CODE['VIEWER']);
      setSelectedRoleId(viewer?.id ?? '');
    } else {
      setTargetModule('');
    }
    // MULTI_MODULE / CUSTOM: leave the current role selection untouched.
  }

  // FMP-UI-02 — applies a ?template=<value> card preset (Executive /
  // Management, or Erection's presetTemplate) once on mount, through the
  // exact same handleTemplateChange() a manual radio click would use — one
  // source of truth for what each template means, never duplicated logic.
  useEffect(() => {
    if (preselectedTemplate) handleTemplateChange(preselectedTemplate);
  }, []);

  function handleTargetModuleChange(mod: WizardModule | ''): void {
    setTargetModule(mod);
    const roleCode = mod ? suggestedRoleCode(template, mod) : undefined;
    const match = roleCode ? activeRoles.find((r) => r.code === roleCode) : undefined;
    setSelectedRoleId(match?.id ?? '');
    if (mod) {
      const row = scopeModuleFor(mod);
      // Pre-seed the working module's scope so it shows up in the Review summary
      // and so the "role selected but module access never configured" warning
      // doesn't fire for the module the template itself just picked.
      setModuleScopes((prev) => (prev[row] !== undefined ? prev : { ...prev, [row]: 'OWN_DEPARTMENT' }));
    }
  }

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const suggestion = TEMPLATE_SUGGESTIONS[template];
  const roleAlreadyFullPlatform =
    deriveAccessMode((selectedRole?.permissions ?? []).map((p) => p.code), false).fullPlatformSource === 'role';
  const visibleModules = wizardVisibleModules({ mode: accessMode, template, targetModule, multiModules });
  const sendFullPlatformFlag = shouldSendFullPlatformFlag(accessMode, roleAlreadyFullPlatform);
  const primaryModuleForRelated = template === 'ERECTION_MANAGER' ? 'CONTRACTS_MANAGEMENT' : targetModule || null;
  const relatedWorkflows = accessMode === 'MULTI_MODULE' ? [] : relatedWorkflowsFor(primaryModuleForRelated);
  const accessModeSummaryText =
    accessMode === 'SINGLE_MODULE' && targetModule
      ? `${ACCESS_MODE_LABELS[accessMode]} — ${wizardModuleLabel(targetModule)}`
      : accessMode === 'MULTI_MODULE'
        ? `${ACCESS_MODE_LABELS[accessMode]} — ${multiModules.map((m) => wizardModuleLabel(m)).join(', ') || 'no modules selected'}`
        : ACCESS_MODE_LABELS[accessMode];
  const selectedDepartment = departments.find((d) => d.id === departmentId);
  const selectedPlant = plants.find((p) => p.id === selectedPlantId);
  const filteredLocations = selectedPlantId ? locations.filter((l) => !l.plantId || l.plantId === selectedPlantId) : locations;
  const selectedLocation = locations.find((l) => l.id === locationId);

  const moduleAccessSummary = buildModuleAccessSummary(moduleScopes, moduleDeptIds, visibleModules);
  const rowLabelOverrides = scopeRowLabelOverrides({ mode: accessMode, template, targetModule, multiModules });
  const rowLabel = (m: ModuleIdentifier): string => rowLabelOverrides[m] ?? MODULE_LABELS[m] ?? m;
  const warnings = useMemo(
    () => computeAccessWarnings({ template, selectedRole, moduleScopes }),
    [template, selectedRole, moduleScopes],
  );

  const emailValid = EMAIL_PATTERN.test(email.trim());
  const canProceedFromAccount = emailValid && displayName.trim().length > 0;
  const canProceedFromTemplate = isAccessStepComplete({
    mode: accessMode,
    template,
    targetModule,
    multiModules,
    selectedRoleId,
    canGrantFullPlatform: canManageAll,
    roleAlreadyFullPlatform,
  });
  const stepCanProceed = [canProceedFromAccount, true, canProceedFromTemplate, true, true];

  function goNext(): void {
    setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
  }
  function goBack(): void {
    setStep((s) => Math.max(s - 1, 0));
  }

  if (state?.created) {
    const failures = state.created.accessFailures;
    return (
      <div className="space-y-5 max-w-2xl mx-auto">
        {failures && failures.length > 0 && (
          <div
            role="alert"
            className="rounded-md bg-warning-light border border-warning/30 px-4 py-3 text-sm text-warning"
          >
            <p className="font-medium">User created — some module access scopes could not be applied.</p>
            <p className="mt-1 text-xs">
              The following modules will default to My Department. Go to the user to retry:
            </p>
            <ul className="mt-1.5 list-disc list-inside text-xs space-y-0.5">
              {failures.map((f) => (
                <li key={f.module}>
                  <strong>{f.module}</strong>: {f.error}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div
          className={`rounded-md px-4 py-3 text-sm ${
            failures?.length
              ? 'bg-surface border border-border'
              : 'bg-success-light border border-success text-success-foreground'
          }`}
        >
          <p className="font-medium">User &ldquo;{state.created.displayName}&rdquo; created successfully.</p>
          <p className="mt-1 text-xs text-text-secondary">
            Share the login email and temporary password with the user. The user must change their
            password after first login.
          </p>
        </div>

        <div className="rounded-md bg-surface border border-border px-4 py-3 space-y-3">
          <div>
            <p className="text-xs text-text-secondary mb-1">Login Email</p>
            <p className="font-mono text-sm text-text-primary break-all">{state.created.email}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary mb-1">Temporary Password</p>
            <div className="flex items-center gap-3">
              <p className="font-mono text-sm text-text-primary break-all flex-1">
                {state.created.tempPassword}
              </p>
              <CopyButton text={state.created.tempPassword} />
            </div>
          </div>
          <div>
            <p className="text-xs text-text-secondary mb-1">Role</p>
            <p className="text-sm text-text-primary">{selectedRole ? roleOptionLabel(selectedRole) : 'Viewer (default)'}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary mb-1">Access Mode</p>
            <p className="text-sm text-text-primary">{accessModeSummaryText}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary mb-1">Module access</p>
            {moduleAccessSummary.length === 0 ? (
              <p className="text-sm text-text-muted">All modules default to My Department.</p>
            ) : (
              <ul className="text-sm text-text-primary space-y-0.5">
                {moduleAccessSummary.map((entry) => (
                  <li key={entry.module}>
                    {rowLabel(entry.module)}: {SCOPE_LABELS[entry.scope]}
                    {entry.scope === 'SELECTED_DEPARTMENTS' ? ` (${entry.deptCount})` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <CopyButton
            text={buildCredentialsText({
              email: state.created.email,
              tempPassword: state.created.tempPassword,
              roleLabel: selectedRole ? roleOptionLabel(selectedRole) : 'Viewer (default)',
              accessModeLabel: accessModeSummaryText,
              moduleAccessLines: moduleAccessSummary.map(
                (e) =>
                  `${rowLabel(e.module)}: ${SCOPE_LABELS[e.scope]}${e.scope === 'SELECTED_DEPARTMENTS' ? ` (${e.deptCount})` : ''}`,
              ),
            })}
            label="Copy Credentials"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href={`/administration/users/${state.created.id}/edit`}
            className="inline-flex items-center h-10 px-4 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Go to User
          </a>
          <a
            href="/administration/users/new"
            className="inline-flex items-center h-10 px-4 rounded-md border border-border bg-surface text-text-primary text-sm font-medium hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Create Another User
          </a>
          <a
            href="/administration/users"
            className="inline-flex items-center h-10 px-4 rounded-md border border-border bg-surface text-text-primary text-sm font-medium hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Back to Users
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto rounded-lg border border-border bg-surface p-6 sm:p-8">
      <StepIndicator current={step} />

      {preselectedModule && (
        <p className="mb-5 rounded-md bg-accent/10 px-3 py-2 text-xs font-medium text-accent">
          Creating a user for {preselectedModuleLabel ?? wizardModuleLabel(preselectedModule)}. The module is already
          selected in Access Template below — change it there if needed.
        </p>
      )}
      {!preselectedModule && preselectedTemplate === 'EXECUTIVE_MANAGER' && (
        <p className="mb-5 rounded-md bg-accent/10 px-3 py-2 text-xs font-medium text-accent">
          Creating an Executive Manager user. The access template is already selected below — change it there if
          needed.
        </p>
      )}

      {/* Single form spanning every step — steps are shown/hidden via CSS, never
          unmounted, so every field stays in the DOM (and in FormData) all the
          way to submission on the final step. This is what keeps the payload
          identical to the pre-wizard single-page form. */}
      <form action={formAction} className="space-y-6">
        {state?.error && (
          <div role="alert" className="rounded-md bg-error-light border border-error px-4 py-3 text-sm text-error">
            {state.error}
          </div>
        )}

        {/* Step 1 — Account */}
        <div className={step === 0 ? 'space-y-4' : 'hidden'}>
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-text-primary mb-1">
              Full Name <span aria-hidden="true" className="text-error">*</span>
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputCls(!!state?.fieldErrors?.['displayName'])}
            />
            <FieldError errors={state?.fieldErrors?.['displayName']} />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1">
              Email <span aria-hidden="true" className="text-error">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="off"
              placeholder="name@recafco.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls(!!state?.fieldErrors?.['email'])}
            />
            <FieldError errors={state?.fieldErrors?.['email']} />
          </div>
          <div>
            <label htmlFor="employeeNumber" className="block text-sm font-medium text-text-primary mb-1">
              Employee Number
            </label>
            <input
              id="employeeNumber"
              name="employeeNumber"
              type="text"
              placeholder="EMP-001"
              value={employeeNumber}
              onChange={(e) => setEmployeeNumber(e.target.value)}
              className={inputCls(!!state?.fieldErrors?.['employeeNumber'])}
            />
            <FieldError errors={state?.fieldErrors?.['employeeNumber']} />
          </div>
        </div>

        {/* Step 2 — Organization */}
        <div className={step === 1 ? 'space-y-4' : 'hidden'}>
          <p className="text-xs text-text-muted bg-info-light border border-info/20 rounded-md px-3 py-2">
            Primary department is the user&rsquo;s default department. Module access controls which department
            records they can see.
          </p>
          {(deptApiError || plantApiError || locApiError) && (
            <div role="alert" className="rounded-md bg-error-light border border-error px-4 py-3 text-xs text-error">
              Unable to load organization data — contact your administrator.
              {deptApiError && ' Departments unavailable.'}
              {plantApiError && ' Plants unavailable.'}
              {locApiError && ' Locations unavailable.'}
            </div>
          )}
          {!departmentId && !deptApiError && (
            <div className="rounded-md bg-warning-light border border-warning/30 px-4 py-3 text-xs text-warning">
              This user has no primary department. Department-scoped operational access currently
              fails closed — they will see zero records in modules that filter by department.
            </div>
          )}
          <div>
            <label htmlFor="departmentId" className="block text-sm font-medium text-text-primary mb-1">
              Primary Department
            </label>
            {deptApiError ? (
              <p className="text-xs text-error">Unable to load departments.</p>
            ) : (
              <select
                id="departmentId"
                name="departmentId"
                className={selectCls}
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">— None —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label htmlFor="plantId" className="block text-sm font-medium text-text-primary mb-1">
              Plant
            </label>
            {plantApiError ? (
              <p className="text-xs text-error">Unable to load plants.</p>
            ) : plants.length === 0 ? (
              <p className="text-xs text-text-muted">No active plants found.</p>
            ) : (
              <select
                id="plantId"
                name="plantId"
                className={selectCls}
                value={selectedPlantId}
                onChange={(e) => {
                  setSelectedPlantId(e.target.value);
                  setLocationId('');
                }}
              >
                <option value="">— None —</option>
                {plants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label htmlFor="locationId" className="block text-sm font-medium text-text-primary mb-1">
              Location
            </label>
            {locApiError ? (
              <p className="text-xs text-error">Unable to load locations.</p>
            ) : !selectedPlantId ? (
              <p className="text-xs text-text-muted">Select a plant before assigning a location.</p>
            ) : filteredLocations.length === 0 ? (
              <p className="text-xs text-text-muted">No active locations found for this plant.</p>
            ) : (
              <select
                id="locationId"
                name="locationId"
                className={selectCls}
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              >
                <option value="">— None —</option>
                {filteredLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} — {l.name}
                    {l.plant ? ` (${l.plant.code})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Step 3 — Access Template + Role */}
        <div className={step === 2 ? 'space-y-5' : 'hidden'}>
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Access Template</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TEMPLATE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={[
                    'flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm cursor-pointer transition-colors',
                    template === opt.value
                      ? 'border-accent bg-accent/5 text-text-primary font-medium'
                      : 'border-border text-text-secondary hover:border-border-strong',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="accessTemplate"
                    value={opt.value}
                    checked={template === opt.value}
                    onChange={() => handleTemplateChange(opt.value)}
                    className="mt-0.5 text-accent focus:ring-accent"
                  />
                  <span>
                    <span className="block">{opt.label}</span>
                    <span className="block text-xs text-text-muted font-normal mt-0.5">{opt.helper}</span>
                  </span>
                </label>
              ))}
            </div>

            {/* FMP-ACCESS-01 — what the chosen template suggests, in plain words. */}
            <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 rounded-md border border-border bg-surface-secondary/40 px-3 py-2.5 text-xs">
              <div>
                <dt className="text-text-muted">Suggested Access Mode</dt>
                <dd className="mt-0.5 font-medium text-text-primary">{ACCESS_MODE_LABELS[suggestion.mode]}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Suggested Module Access</dt>
                <dd className="mt-0.5 font-medium text-text-primary">{suggestion.moduleText}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Suggested Role</dt>
                <dd className="mt-0.5 font-medium text-text-primary">{suggestion.roleText}</dd>
              </div>
            </dl>

            {/* FMP-ACCESS-01 — Access Mode. Templates whose role already decides it show it as fixed. */}
            <fieldset className="mt-5">
              <legend className="text-sm font-semibold text-text-primary mb-2">Access Mode</legend>
              {suggestion.modeLocked ? (
                <p className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text-primary">
                  <span className="font-medium">{ACCESS_MODE_LABELS[accessMode]}</span>
                  <span className="block text-xs text-text-muted mt-0.5">
                    Set by the {TEMPLATE_OPTIONS.find((o) => o.value === template)?.label} template. {ACCESS_MODE_HELPERS[accessMode]}
                  </span>
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(['SINGLE_MODULE', 'MULTI_MODULE', 'FULL_PLATFORM'] as AccessMode[]).map((m) => {
                    const disabled = m === 'FULL_PLATFORM' && !canManageAll && !roleAlreadyFullPlatform;
                    return (
                      <label
                        key={m}
                        className={[
                          'flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm transition-colors',
                          disabled ? 'cursor-not-allowed opacity-50 border-border' : 'cursor-pointer',
                          !disabled && accessMode === m
                            ? 'border-accent bg-accent/5 text-text-primary font-medium'
                            : !disabled
                              ? 'border-border text-text-secondary hover:border-border-strong'
                              : '',
                        ].join(' ')}
                      >
                        <input
                          type="radio"
                          name="accessMode"
                          value={m}
                          checked={accessMode === m}
                          disabled={disabled}
                          onChange={() => handleAccessModeChange(m)}
                          className="mt-0.5 text-accent focus:ring-accent"
                        />
                        <span>
                          <span className="block">{ACCESS_MODE_LABELS[m]}</span>
                          <span className="block text-xs text-text-muted font-normal mt-0.5">{ACCESS_MODE_HELPERS[m]}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              {!suggestion.modeLocked && !canManageAll && !roleAlreadyFullPlatform && (
                <p className="mt-2 text-xs text-text-muted">
                  Full Platform Access can only be granted by an administrator who may also grant All Departments access.
                </p>
              )}
              {accessMode === 'FULL_PLATFORM' && (
                <p className="mt-2 text-xs text-info bg-info-light border border-info/20 rounded-md px-3 py-2">
                  {roleAlreadyFullPlatform
                    ? 'This role already covers every module, so no extra setting is needed.'
                    : 'This user will land on the Factory Operations Control Center with the main platform sidebar. Actions still follow the role — this does not make them an administrator, and modules the role does not grant stay hidden.'}
                </p>
              )}
            </fieldset>

            {(template === 'MODULE_STAFF' || template === 'MODULE_MANAGER' || (template === 'CUSTOM' && accessMode === 'SINGLE_MODULE')) &&
              accessMode !== 'MULTI_MODULE' && (
              <div className="mt-4">
                <label htmlFor="targetModule" className="block text-sm font-medium text-text-primary mb-1">
                  Primary Module{' '}
                  {accessMode === 'SINGLE_MODULE' && <span aria-hidden="true" className="text-error">*</span>}
                </label>
                <select
                  id="targetModule"
                  className={selectCls}
                  value={targetModule}
                  onChange={(e) => handleTargetModuleChange(e.target.value as WizardModule | '')}
                >
                  <option value="">— Select a module —</option>
                  {(template === 'CUSTOM' ? [...WIZARD_MODULE_CHOICES, 'ADMINISTRATION' as const] : WIZARD_MODULE_CHOICES).map((m) => (
                    <option key={m} value={m}>{wizardModuleLabel(m)}</option>
                  ))}
                </select>

                {targetModule === 'CONTRACTS_MANAGEMENT' && (
                  <div className="mt-3 text-xs text-info bg-info-light border border-info/20 rounded-md px-3 py-2">
                    <p className="font-medium mb-1">Recommended roles for Contract Management</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {contractStaffRole && <li>Contract Staff — daily work, assigned workflow tasks only</li>}
                      {contractManagerRole && <li>Contract Manager — full operational access</li>}
                      {contractLegacyRole && <li>Contract Management User — Legacy / full contract access</li>}
                      {viewerRole && <li>Viewer — read-only</li>}
                    </ul>
                  </div>
                )}

                {targetModule === 'TECHNICAL' && (
                  <div className="mt-3 text-xs text-info bg-info-light border border-info/20 rounded-md px-3 py-2">
                    <p className="font-medium mb-1">Recommended roles for Technical</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>Technical Staff — view and update Technical workflow steps</li>
                      <li>Technical Manager — Technical Staff plus manager-level Technical actions</li>
                    </ul>
                    <p className="mt-1.5">
                      This user lands on the Technical dashboard and does not get the Contract Management workspace.
                      Department scope is set in Module Access (stored with the contract records Technical works on).
                    </p>
                  </div>
                )}

                {targetModule && targetModule !== 'CONTRACTS_MANAGEMENT' && targetModule !== 'TECHNICAL' && (
                  <p className="mt-3 text-xs text-warning bg-warning-light border border-warning/30 rounded-md px-3 py-2">
                    No dedicated staff/manager role exists yet for {wizardModuleLabel(targetModule)}. Select a role
                    manually below.
                  </p>
                )}
              </div>
            )}

            {accessMode === 'MULTI_MODULE' && !suggestion.modeLocked && (
              <fieldset className="mt-4">
                <legend className="text-sm font-medium text-text-primary mb-1">
                  Modules <span aria-hidden="true" className="text-error">*</span>
                </legend>
                <p className="text-xs text-text-muted mb-2">
                  Only the modules ticked here appear in Module Access. Nothing else is selected for you.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(template === 'CUSTOM' ? [...WIZARD_MODULE_CHOICES, 'ADMINISTRATION' as const] : WIZARD_MODULE_CHOICES).map((m) => (
                    <label key={m} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer hover:border-border-strong">
                      <input
                        type="checkbox"
                        checked={multiModules.includes(m)}
                        onChange={(e) => handleMultiModuleToggle(m, e.target.checked)}
                        className="rounded border-border text-accent focus:ring-accent"
                      />
                      <span className="text-text-primary">{wizardModuleLabel(m)}</span>
                    </label>
                  ))}
                </div>
                {multiModules.includes('CONTRACTS_MANAGEMENT') && (
                  <p className="mt-2 text-xs text-text-muted">
                    Contract Management includes its related workflows: {relatedWorkflowsFor('CONTRACTS_MANAGEMENT').join(', ')}.
                  </p>
                )}
              </fieldset>
            )}

            {relatedWorkflows.length > 0 && (
              <div className="mt-4 rounded-md border border-border bg-surface-secondary/40 px-3 py-2.5 text-xs">
                <p className="font-medium text-text-primary mb-1">Related Workflow Access</p>
                <ul className="list-disc list-inside text-text-secondary space-y-0.5">
                  {relatedWorkflows.map((w) => <li key={w}>{w}</li>)}
                </ul>
                <p className="mt-1.5 text-text-muted">
                  These are part of the Contract Management workflow, not separate modules.
                </p>
              </div>
            )}

            {template === 'ERECTION_MANAGER' && (
              <div className="mt-4 text-xs text-info bg-info-light border border-info/20 rounded-md px-3 py-2">
                <p className="font-medium mb-1">Erection Manager / Workflow Owner</p>
                <p>
                  Grants Contract Staff-level access (contracts.workflow_update — assigned work only, not the full
                  Contract Manager permission set). Owned by Erection Department for erection execution.
                </p>
                <p className="mt-1.5">
                  This alone does not put any contract in this user's Erection Dashboard. After creating this
                  user, a Contract Manager must assign them the Erection Workflow for each specific contract from
                  Contract Detail → Workflow &amp; Team Tasks → Erection Workflow Assignment.
                </p>
              </div>
            )}

            {template === 'EXECUTIVE_MANAGER' && (
              <div className="mt-4 text-xs text-info bg-info-light border border-info/20 rounded-md px-3 py-2">
                <p className="font-medium mb-1">Executive Manager gets access to all operational modules.</p>
                <p>
                  Grants full view/create/update/approve/assign/manage access to Contract Management (incl.
                  Technical and Erection), Safety &amp; Compliance, Incident Management, Production &amp; Planning,
                  Maintenance Management, and Task Management — not user, role, or organization administration
                  (that is Platform Admin, below).
                </p>
                <p className="mt-1.5">
                  {canManageAll
                    ? 'Module Access (Step 4) has been set to All Departments for every module above — company-wide visibility.'
                    : 'Your account cannot grant company-wide (All Departments) access. Module Access (Step 4) has been set to Selected Departments with every currently active department pre-checked instead — ask a Super Admin to upgrade this to All Departments later if new departments are added.'}
                </p>
              </div>
            )}

            {template === 'VIEWER' && (
              <p className="mt-4 text-xs text-text-muted">
                Read-only across every module — no create, update, or delete access. Good for users who should
                monitor dashboards and records but not edit them.
              </p>
            )}

            {template === 'MULTI_MODULE' && (
              <p className="mt-4 text-xs text-text-muted">
                Select a role manually below, then configure department scope for each module this user needs in
                Module Access. This does not automatically grant full platform access.
              </p>
            )}

            {template === 'PLATFORM_ADMIN' && (
              <p className="mt-4 text-xs text-text-muted">
                The Admin role is selected by default below. Change it if a different platform role is needed.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="roleId" className="block text-sm font-medium text-text-primary mb-1">
              Role <span aria-hidden="true" className="text-error">*</span>
            </label>
            <select
              id="roleId"
              name="roleId"
              className={selectCls}
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
            >
              <option value="">— Default (Viewer) —</option>
              {activeRoles.map((r) => (
                <option key={r.id} value={r.id}>{roleOptionLabel(r)}</option>
              ))}
            </select>
            <FieldError errors={state?.fieldErrors?.['roleId']} />
          </div>

          {selectedRole ? (
            <div>
              <p className="text-xs text-text-muted mb-2">Permissions for this role:</p>
              <RolePermissionSummary permissions={selectedRole.permissions} showWriteWarning />
            </div>
          ) : (
            <p className="text-xs text-text-muted">Select a role above to preview its permissions.</p>
          )}

          <p className="text-xs text-info bg-info-light border border-info/20 rounded-md px-3 py-2">
            Role controls actions. Module Access controls which department records are visible.
          </p>
        </div>

        {/* Step 4 — Module Access */}
        <div className={step === 3 ? 'space-y-3' : 'hidden'}>
          <p className="text-xs text-text-muted bg-info-light border border-info/20 rounded-md px-3 py-2">
            Module Access controls data visibility, not action permissions.
          </p>
          <p className="text-xs font-medium text-accent bg-accent/10 rounded-md px-3 py-2">
            {accessModeSummaryText}
            {accessMode === 'FULL_PLATFORM' ? ' — all modules visible according to the role and scope.' : ''}
          </p>
          {visibleModules.length === 0 ? (
            <p className="text-xs text-text-muted">Go back and choose a module in the Access Template step.</p>
          ) : (
            <ModuleAccessEditor
              allDepartments={departments.map((d) => ({ id: d.id, code: d.code, name: d.name }))}
              deptApiError={deptApiError}
              canManageAll={canManageAll}
              scopes={moduleScopes}
              deptIdsByModule={moduleDeptIds}
              onScopeChange={handleModuleScopeChange}
              onDeptIdsChange={handleModuleDeptIdsChange}
              visibleModules={visibleModules}
              labelOverrides={rowLabelOverrides}
            />
          )}
          {sendFullPlatformFlag && <input type="hidden" name="fullPlatformAccess" value="true" />}
        </div>

        {/* Step 5 — Review & Create */}
        <div className={step === 4 ? 'space-y-4' : 'hidden'}>
          <div className="rounded-md border border-border bg-surface-secondary/40 divide-y divide-border">
            <dl className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-text-muted">Full Name</dt>
                <dd className="text-text-primary mt-0.5">{displayName || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Login Email</dt>
                <dd className="text-text-primary mt-0.5">{email || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Employee Number</dt>
                <dd className="text-text-primary mt-0.5">{employeeNumber || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Department</dt>
                <dd className="text-text-primary mt-0.5">
                  {selectedDepartment ? `${selectedDepartment.code} — ${selectedDepartment.name}` : '— None —'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Plant / Location</dt>
                <dd className="text-text-primary mt-0.5">
                  {selectedPlant ? selectedPlant.name : '—'}
                  {selectedLocation ? ` / ${selectedLocation.name}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Access Template</dt>
                <dd className="text-text-primary mt-0.5">
                  {TEMPLATE_OPTIONS.find((o) => o.value === template)?.label}
                  {targetModule ? ` — ${wizardModuleLabel(targetModule)}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Access Mode</dt>
                <dd className="text-text-primary mt-0.5">{accessModeSummaryText}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Role</dt>
                <dd className="text-text-primary mt-0.5">
                  {selectedRole ? roleOptionLabel(selectedRole) : '— Default (Viewer) —'}
                </dd>
              </div>
              {relatedWorkflows.length > 0 && (
                <div>
                  <dt className="text-xs text-text-muted">Related Workflow Access</dt>
                  <dd className="text-text-primary mt-0.5">{relatedWorkflows.join(', ')}</dd>
                </div>
              )}
            </dl>
            <div className="p-4">
              <dt className="text-xs text-text-muted mb-1.5">Module Access</dt>
              {moduleAccessSummary.length === 0 ? (
                <p className="text-sm text-text-muted">All modules default to My Department.</p>
              ) : (
                <ul className="text-sm text-text-primary space-y-0.5">
                  {moduleAccessSummary.map((entry) => (
                    <li key={entry.module}>
                      {rowLabel(entry.module)}: {SCOPE_LABELS[entry.scope]}
                      {entry.scope === 'SELECTED_DEPARTMENTS' ? ` (${entry.deptCount} department${entry.deptCount !== 1 ? 's' : ''})` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="space-y-2">
              {warnings.map((w) => (
                <div
                  key={w}
                  role="alert"
                  className="flex items-start gap-2 rounded-md bg-warning-light border border-warning/30 px-3 py-2.5 text-xs text-warning"
                >
                  <AlertTriangle className="size-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-border">
          <div>
            {step > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="h-10 px-4 rounded-md border border-border bg-surface text-text-primary text-sm font-medium hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <a
              href="/administration/users"
              className="inline-flex items-center h-10 px-4 rounded-md border border-border bg-surface text-text-primary text-sm hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Cancel
            </a>
            {step < WIZARD_STEPS.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={!stepCanProceed[step]}
                className="h-10 px-5 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-focus"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={isPending}
                className="h-10 px-5 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-focus"
              >
                {isPending ? 'Creating…' : 'Create User'}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
