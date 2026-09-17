'use client';

import { useActionState, useState, useMemo } from 'react';
import { Check, AlertTriangle } from 'lucide-react';
import type { OrgEntity, LocationEntity } from '@/lib/organizations-api';
import type { RoleSummary, PermissionSummary } from '@/lib/roles-api';
import type { ModuleIdentifier, DepartmentAccessScope } from '@/lib/users-api';
import { RolePermissionSummary } from './role-permission-summary';
import { ModuleAccessEditor, ALL_MODULES } from './module-access-editor';
import { MODULE_LABELS, SCOPE_LABELS } from './scope-utils';
import type { CreateWithAccessState } from '../actions';

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
  preselectedModule?: ModuleIdentifier;
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

type AccessTemplate = 'MODULE_STAFF' | 'MODULE_MANAGER' | 'ERECTION_MANAGER' | 'MULTI_MODULE' | 'PLATFORM_ADMIN' | 'CUSTOM';

const TEMPLATE_OPTIONS: { value: AccessTemplate; label: string; helper: string }[] = [
  { value: 'MODULE_STAFF', label: 'Module Staff', helper: 'For normal users working in one module.' },
  { value: 'MODULE_MANAGER', label: 'Module Manager', helper: 'For managers responsible for a module or department.' },
  // CM-71H.1 — no dedicated "Erection Manager" role exists (see TEMPLATE_ROLE_CODE below); this is a
  // clearly-labelled access template, not a new role/permission, per that unit's own "if the existing
  // role model does not support a separate role, create a safe access template" instruction.
  { value: 'ERECTION_MANAGER', label: 'Erection Manager / Workflow Owner', helper: 'Contract Management — assigned to own and update a specific contract’s Erection Workflow.' },
  { value: 'MULTI_MODULE', label: 'Multi-Module User', helper: 'For managers or staff who need more than one module.' },
  { value: 'PLATFORM_ADMIN', label: 'Platform Admin', helper: 'For IT/admin users who manage users, roles or configuration.' },
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
 */
const TEMPLATE_ROLE_CODE: Partial<Record<AccessTemplate, string>> = {
  MODULE_STAFF: 'CONTRACT_STAFF',
  MODULE_MANAGER: 'CONTRACT_MANAGER',
  ERECTION_MANAGER: 'CONTRACT_STAFF',
};

/**
 * CM-42 — mirrors what handleTargetModuleChange() below would do, for the
 * initial render only: the default template is MODULE_STAFF, so a
 * preselected Contract Management module also auto-selects Contract Staff
 * (the user can still switch to Module Manager, which re-triggers the same
 * mapping for Contract Manager). Every other module has no auto-mapped
 * role — this correctly resolves to '' for them, same as picking it by hand.
 */
function preselectedRoleId(mod: ModuleIdentifier | undefined, roles: RoleWithPerms[]): string {
  if (!mod || mod !== 'CONTRACTS_MANAGEMENT') return '';
  const roleCode = TEMPLATE_ROLE_CODE['MODULE_STAFF'];
  if (!roleCode) return '';
  return roles.find((r) => r.isActive && r.code === roleCode)?.id ?? '';
}

/** Short capability hint shown next to a role's name in the Role dropdown — purely descriptive, not authoritative (the permission preview below is). */
const ROLE_HINTS: Record<string, string> = {
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

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,49}$/;

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
): ModuleAccessSummaryEntry[] {
  return ALL_MODULES.filter((m) => scopes[m] !== undefined).map((m) => ({
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
}: Props): React.JSX.Element {
  const [state, formAction, isPending] = useActionState(action, null);
  const [step, setStep] = useState(0);

  // Step 1 — Account
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [employeeNumber, setEmployeeNumber] = useState('');

  // Step 2 — Organization
  const [departmentId, setDepartmentId] = useState('');
  const [selectedPlantId, setSelectedPlantId] = useState('');
  const [locationId, setLocationId] = useState('');

  // Step 3 — Access Template
  const [template, setTemplate] = useState<AccessTemplate>('MODULE_STAFF');
  const [targetModule, setTargetModule] = useState<ModuleIdentifier | ''>(preselectedModule ?? '');
  const [selectedRoleId, setSelectedRoleId] = useState(() => preselectedRoleId(preselectedModule, roles));

  // Step 4 — Module Access (lifted out of ModuleAccessEditor so Review can summarize it)
  const [moduleScopes, setModuleScopes] = useState<Partial<Record<ModuleIdentifier, DepartmentAccessScope>>>(
    () => (preselectedModule ? { [preselectedModule]: 'OWN_DEPARTMENT' } : {}),
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

  function handleTemplateChange(next: AccessTemplate): void {
    setTemplate(next);
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
    } else {
      setTargetModule('');
    }
    // MULTI_MODULE / CUSTOM: leave the current role selection untouched.
  }

  function handleTargetModuleChange(mod: ModuleIdentifier | ''): void {
    setTargetModule(mod);
    const roleCode = mod ? TEMPLATE_ROLE_CODE[template] : undefined;
    const match = mod === 'CONTRACTS_MANAGEMENT' && roleCode ? activeRoles.find((r) => r.code === roleCode) : undefined;
    setSelectedRoleId(match?.id ?? '');
    if (mod) {
      // Pre-seed the working module's scope so it shows up in the Review summary
      // and so the "role selected but module access never configured" warning
      // doesn't fire for the module the template itself just picked.
      setModuleScopes((prev) => (prev[mod] !== undefined ? prev : { ...prev, [mod]: 'OWN_DEPARTMENT' }));
    }
  }

  const emphasizedModule =
    template === 'ERECTION_MANAGER'
      ? 'CONTRACTS_MANAGEMENT'
      : (template === 'MODULE_STAFF' || template === 'MODULE_MANAGER') && targetModule ? targetModule : undefined;

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const selectedDepartment = departments.find((d) => d.id === departmentId);
  const selectedPlant = plants.find((p) => p.id === selectedPlantId);
  const filteredLocations = selectedPlantId ? locations.filter((l) => !l.plantId || l.plantId === selectedPlantId) : locations;
  const selectedLocation = locations.find((l) => l.id === locationId);

  const moduleAccessSummary = useMemo(
    () => buildModuleAccessSummary(moduleScopes, moduleDeptIds),
    [moduleScopes, moduleDeptIds],
  );
  const warnings = useMemo(
    () => computeAccessWarnings({ template, selectedRole, moduleScopes }),
    [template, selectedRole, moduleScopes],
  );

  const usernameValid = USERNAME_PATTERN.test(username);
  const canProceedFromAccount = usernameValid && displayName.trim().length > 0;
  const canProceedFromTemplate = selectedRoleId !== '';
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
          <p className="font-medium">User &ldquo;{state.created.username}&rdquo; created successfully.</p>
          <p className="mt-1 text-xs text-text-secondary">
            Share the temporary password with <strong>{state.created.displayName}</strong>. It will not
            be shown again. The user must change their password after first login.
          </p>
        </div>

        <div className="rounded-md bg-surface border border-border px-4 py-3 space-y-3">
          <div>
            <p className="text-xs text-text-secondary mb-1">Username</p>
            <p className="font-mono text-sm text-text-primary">{state.created.username}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary mb-1">Temporary password</p>
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
            <p className="text-xs text-text-secondary mb-1">Module access</p>
            {moduleAccessSummary.length === 0 ? (
              <p className="text-sm text-text-muted">All modules default to My Department.</p>
            ) : (
              <ul className="text-sm text-text-primary space-y-0.5">
                {moduleAccessSummary.map((entry) => (
                  <li key={entry.module}>
                    {MODULE_LABELS[entry.module]}: {SCOPE_LABELS[entry.scope]}
                    {entry.scope === 'SELECTED_DEPARTMENTS' ? ` (${entry.deptCount})` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <CopyButton
            text={`Username: ${state.created.username}\nTemporary password: ${state.created.tempPassword}`}
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
          Creating a user for {MODULE_LABELS[preselectedModule]}. The module is already selected in Access
          Template below — change it there if needed.
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
            <label htmlFor="username" className="block text-sm font-medium text-text-primary mb-1">
              Username <span aria-hidden="true" className="text-error">*</span>
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="off"
              placeholder="e.g. john.doe"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              className={inputCls(!!state?.fieldErrors?.['username'] || (username.length > 0 && !usernameValid))}
            />
            <FieldError errors={state?.fieldErrors?.['username']} />
            {username.length > 0 && !usernameValid ? (
              <p role="alert" className="mt-1 text-xs text-error">
                Must be 3–50 characters, start with a letter or digit, and use only lowercase letters,
                digits, dots, hyphens or underscores. Uppercase letters are converted automatically.
              </p>
            ) : (
              <p className="mt-1 text-xs text-text-muted">
                3–50 characters; lowercase letters, digits, dots, hyphens, underscores. Automatically
                lowercased as you type.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-text-primary mb-1">
              Display name <span aria-hidden="true" className="text-error">*</span>
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              required
              placeholder="Full name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputCls(!!state?.fieldErrors?.['displayName'])}
            />
            <FieldError errors={state?.fieldErrors?.['displayName']} />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="optional@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls(!!state?.fieldErrors?.['email'])}
            />
            <FieldError errors={state?.fieldErrors?.['email']} />
          </div>
          <div>
            <label htmlFor="employeeNumber" className="block text-sm font-medium text-text-primary mb-1">
              Employee number
            </label>
            <input
              id="employeeNumber"
              name="employeeNumber"
              type="text"
              placeholder="e.g. EMP-001"
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

            {(template === 'MODULE_STAFF' || template === 'MODULE_MANAGER') && (
              <div className="mt-4">
                <label htmlFor="targetModule" className="block text-sm font-medium text-text-primary mb-1">
                  Module <span aria-hidden="true" className="text-error">*</span>
                </label>
                <select
                  id="targetModule"
                  className={selectCls}
                  value={targetModule}
                  onChange={(e) => handleTargetModuleChange(e.target.value as ModuleIdentifier | '')}
                >
                  <option value="">— Select a module —</option>
                  {ALL_MODULES.map((m) => (
                    <option key={m} value={m}>{MODULE_LABELS[m]}</option>
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

                {targetModule && targetModule !== 'CONTRACTS_MANAGEMENT' && (
                  <p className="mt-3 text-xs text-warning bg-warning-light border border-warning/30 rounded-md px-3 py-2">
                    No dedicated staff/manager role exists yet for {MODULE_LABELS[targetModule]}. Select a role
                    manually below.
                  </p>
                )}
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
          {emphasizedModule && (
            <p className="text-xs text-text-muted">
              {MODULE_LABELS[emphasizedModule]} is highlighted below and defaults to My Department. The other
              modules are dimmed for reference only — since the selected role only grants{' '}
              {MODULE_LABELS[emphasizedModule]} permissions, this user will not see those modules regardless of
              the scope set here.
            </p>
          )}
          <ModuleAccessEditor
            allDepartments={departments.map((d) => ({ id: d.id, code: d.code, name: d.name }))}
            deptApiError={deptApiError}
            canManageAll={canManageAll}
            scopes={moduleScopes}
            deptIdsByModule={moduleDeptIds}
            onScopeChange={handleModuleScopeChange}
            onDeptIdsChange={handleModuleDeptIdsChange}
            emphasizeModule={emphasizedModule}
          />
        </div>

        {/* Step 5 — Review & Create */}
        <div className={step === 4 ? 'space-y-4' : 'hidden'}>
          <div className="rounded-md border border-border bg-surface-secondary/40 divide-y divide-border">
            <dl className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-text-muted">Username</dt>
                <dd className="font-mono text-text-primary mt-0.5">{username || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Display name</dt>
                <dd className="text-text-primary mt-0.5">{displayName || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Email</dt>
                <dd className="text-text-primary mt-0.5">{email || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Employee number</dt>
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
                  {targetModule ? ` — ${MODULE_LABELS[targetModule]}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Role</dt>
                <dd className="text-text-primary mt-0.5">
                  {selectedRole ? roleOptionLabel(selectedRole) : '— Default (Viewer) —'}
                </dd>
              </div>
            </dl>
            <div className="p-4">
              <dt className="text-xs text-text-muted mb-1.5">Module Access</dt>
              {moduleAccessSummary.length === 0 ? (
                <p className="text-sm text-text-muted">All modules default to My Department.</p>
              ) : (
                <ul className="text-sm text-text-primary space-y-0.5">
                  {moduleAccessSummary.map((entry) => (
                    <li key={entry.module}>
                      {MODULE_LABELS[entry.module]}: {SCOPE_LABELS[entry.scope]}
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
