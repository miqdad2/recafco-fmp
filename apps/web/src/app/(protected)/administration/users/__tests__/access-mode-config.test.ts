import { describe, it, expect } from 'vitest';
import type { UserModuleAccessConfig, ModuleIdentifier, DepartmentAccessScope } from '@/lib/users-api';
import {
  OPERATIONAL_MODULE_IDS,
  TEMPLATE_SUGGESTIONS,
  groupModuleAccess,
  isAccessStepComplete,
  shouldSendFullPlatformFlag,
  wizardVisibleModules,
} from '../_components/access-mode-config';
import { ACCESS_TEMPLATE_VALUES } from '../_components/access-template';
import { MODULE_LABELS } from '../_components/scope-utils';
import { buildCredentialsText } from '../_components/credentials-text';

const CONTRACT_MANAGER = ['contracts.read', 'contracts.update'];
const EXECUTIVE = [
  'contracts.read', 'tasks.read', 'incidents.read', 'maintenance.read', 'safety.read', 'production.read',
];
const ADMIN = ['users.read', 'roles.read', ...EXECUTIVE];

const ALL: ModuleIdentifier[] = [
  'FACTORY_TASKS', 'INCIDENT_REPORT', 'MAINTENANCE_REQUESTS', 'SAFETY_COMPLIANCE',
  'CONTRACTS_MANAGEMENT', 'PRODUCTION_DASHBOARD', 'ADMINISTRATION',
];

function configs(overrides: Partial<Record<ModuleIdentifier, DepartmentAccessScope>> = {}): UserModuleAccessConfig[] {
  return ALL.map((module) => ({
    module,
    scope: overrides[module] ?? 'OWN_DEPARTMENT',
    grantedDepartments: [],
  }));
}

describe('template suggestions', () => {
  it('every Access Template has a suggested mode, module access and role', () => {
    for (const t of ACCESS_TEMPLATE_VALUES) {
      const s = TEMPLATE_SUGGESTIONS[t];
      expect(s.mode).toBeTruthy();
      expect(s.moduleText).toBeTruthy();
      expect(s.roleText).toBeTruthy();
    }
  });

  it('Executive Manager defaults to Full Platform Access', () => {
    expect(TEMPLATE_SUGGESTIONS.EXECUTIVE_MANAGER.mode).toBe('FULL_PLATFORM');
    expect(TEMPLATE_SUGGESTIONS.EXECUTIVE_MANAGER.roleText).toBe('Executive Manager');
  });

  it('Module Manager and Module Staff default to Single Module Access, and can be changed', () => {
    for (const t of ['MODULE_MANAGER', 'MODULE_STAFF'] as const) {
      expect(TEMPLATE_SUGGESTIONS[t].mode).toBe('SINGLE_MODULE');
      expect(TEMPLATE_SUGGESTIONS[t].modeLocked).toBe(false);
    }
  });

  it('Multi-Module User suggests Multi-Module Access', () => {
    expect(TEMPLATE_SUGGESTIONS.MULTI_MODULE.mode).toBe('MULTI_MODULE');
  });

  it('only templates whose role spans everything default to Full Platform Access', () => {
    const full = ACCESS_TEMPLATE_VALUES.filter((t) => TEMPLATE_SUGGESTIONS[t].mode === 'FULL_PLATFORM');
    expect(full.sort()).toEqual(['EXECUTIVE_MANAGER', 'PLATFORM_ADMIN', 'VIEWER']);
  });
});

describe('wizardVisibleModules', () => {
  it('Single Module Access shows only the primary module — Contract Management does not pull in unrelated modules', () => {
    expect(
      wizardVisibleModules({ mode: 'SINGLE_MODULE', template: 'MODULE_MANAGER', targetModule: 'CONTRACTS_MANAGEMENT', multiModules: [] }),
    ).toEqual(['CONTRACTS_MANAGEMENT']);
  });

  it('Single Module Access shows nothing until a module is chosen', () => {
    expect(wizardVisibleModules({ mode: 'SINGLE_MODULE', template: 'MODULE_STAFF', targetModule: '', multiModules: [] })).toEqual([]);
  });

  it('Multi-Module Access shows exactly the selected modules, in a stable order', () => {
    expect(
      wizardVisibleModules({
        mode: 'MULTI_MODULE',
        template: 'MULTI_MODULE',
        targetModule: '',
        multiModules: ['SAFETY_COMPLIANCE', 'CONTRACTS_MANAGEMENT'],
      }),
    ).toEqual(['CONTRACTS_MANAGEMENT', 'SAFETY_COMPLIANCE']);
  });

  it('Full Platform Access shows the six operational modules, and Administration only for Platform Admin / Custom', () => {
    const exec = wizardVisibleModules({ mode: 'FULL_PLATFORM', template: 'EXECUTIVE_MANAGER', targetModule: '', multiModules: [] });
    expect(exec).toEqual(OPERATIONAL_MODULE_IDS);
    expect(exec).not.toContain('ADMINISTRATION');
    const admin = wizardVisibleModules({ mode: 'FULL_PLATFORM', template: 'PLATFORM_ADMIN', targetModule: '', multiModules: [] });
    expect(admin).toContain('ADMINISTRATION');
    const manager = wizardVisibleModules({ mode: 'FULL_PLATFORM', template: 'MODULE_MANAGER', targetModule: 'CONTRACTS_MANAGEMENT', multiModules: [] });
    expect(manager).not.toContain('ADMINISTRATION');
  });
});

describe('isAccessStepComplete', () => {
  const base = {
    mode: 'SINGLE_MODULE' as const,
    template: 'MODULE_MANAGER' as const,
    targetModule: '' as const,
    multiModules: [] as ModuleIdentifier[],
    selectedRoleId: 'role-1',
    canGrantFullPlatform: false,
    roleAlreadyFullPlatform: false,
  };

  it('a role is always required', () => {
    expect(isAccessStepComplete({ ...base, selectedRoleId: '', targetModule: 'CONTRACTS_MANAGEMENT' })).toBe(false);
  });

  it('Single Module Access needs exactly one primary module', () => {
    expect(isAccessStepComplete(base)).toBe(false);
    expect(isAccessStepComplete({ ...base, targetModule: 'CONTRACTS_MANAGEMENT' })).toBe(true);
  });

  it('Multi-Module Access needs at least one selected module', () => {
    expect(isAccessStepComplete({ ...base, mode: 'MULTI_MODULE' })).toBe(false);
    expect(isAccessStepComplete({ ...base, mode: 'MULTI_MODULE', multiModules: ['SAFETY_COMPLIANCE'] })).toBe(true);
  });

  it('Full Platform Access on a module role needs the permission to grant it', () => {
    expect(isAccessStepComplete({ ...base, mode: 'FULL_PLATFORM' })).toBe(false);
    expect(isAccessStepComplete({ ...base, mode: 'FULL_PLATFORM', canGrantFullPlatform: true })).toBe(true);
  });

  it('Full Platform Access from a role that already spans every module needs no extra permission', () => {
    expect(isAccessStepComplete({ ...base, mode: 'FULL_PLATFORM', template: 'EXECUTIVE_MANAGER', roleAlreadyFullPlatform: true })).toBe(true);
  });
});

describe('shouldSendFullPlatformFlag', () => {
  it('is explicit: only when Full Platform Access is chosen and the role does not already imply it', () => {
    expect(shouldSendFullPlatformFlag('FULL_PLATFORM', false)).toBe(true);
    expect(shouldSendFullPlatformFlag('FULL_PLATFORM', true)).toBe(false);
    expect(shouldSendFullPlatformFlag('SINGLE_MODULE', false)).toBe(false);
    expect(shouldSendFullPlatformFlag('MULTI_MODULE', false)).toBe(false);
  });
});

describe('groupModuleAccess (Edit User → Module Access)', () => {
  it('Contract Manager: Single Module Access, primary module + related workflows, no Administration', () => {
    const g = groupModuleAccess(configs(), CONTRACT_MANAGER, false);
    expect(g.info.mode).toBe('SINGLE_MODULE');
    expect(g.primary?.module).toBe('CONTRACTS_MANAGEMENT');
    expect(g.relatedWorkflows).toEqual(['Technical', 'Erection', 'Advanced Planning']);
    expect(g.administration).toBeNull();
    expect(g.modules).toEqual([]);
    expect(g.other).toEqual([]);
  });

  it('modules the role does not grant are tucked into notGranted, not shown as access', () => {
    const g = groupModuleAccess(configs(), CONTRACT_MANAGER, false);
    const names = g.notGranted.map((c) => c.module);
    expect(names).toContain('SAFETY_COMPLIANCE');
    expect(names).toContain('ADMINISTRATION');
    expect(names).not.toContain('CONTRACTS_MANAGEMENT');
  });

  it('shows existing non-default scope rows honestly under Other Module Access', () => {
    const g = groupModuleAccess(configs({ SAFETY_COMPLIANCE: 'ALL_DEPARTMENTS' }), CONTRACT_MANAGER, false);
    expect(g.other.map((c) => c.module)).toEqual(['SAFETY_COMPLIANCE']);
    expect(g.notGranted.map((c) => c.module)).not.toContain('SAFETY_COMPLIANCE');
  });

  it('keeps an Administration row with a non-default scope visible even without admin permissions', () => {
    const g = groupModuleAccess(configs({ ADMINISTRATION: 'SELECTED_DEPARTMENTS' }), CONTRACT_MANAGER, false);
    expect(g.administration?.module).toBe('ADMINISTRATION');
  });

  it('Administration is shown for a user who really has admin permissions', () => {
    const g = groupModuleAccess(configs(), ADMIN, false);
    expect(g.administration?.module).toBe('ADMINISTRATION');
    expect(g.info.hasAdministration).toBe(true);
  });

  it('Full Platform Access (explicit) on a Contract Manager keeps Administration hidden', () => {
    const g = groupModuleAccess(configs(), CONTRACT_MANAGER, true);
    expect(g.info.mode).toBe('FULL_PLATFORM');
    expect(g.info.fullPlatformSource).toBe('explicit');
    expect(g.administration).toBeNull();
    // Explicit Full Platform Access shows every operational module (the API adds read-only access for them).
    expect(g.modules.map((c) => c.module)).toHaveLength(6);
  });

  it('Executive Manager lists all six operational modules and no Administration', () => {
    const g = groupModuleAccess(configs(), EXECUTIVE, false);
    expect(g.info.fullPlatformSource).toBe('role');
    expect(g.modules).toHaveLength(6);
    expect(g.administration).toBeNull();
  });

  it('never drops a stored row: every input row lands in exactly one group', () => {
    const input = configs({ SAFETY_COMPLIANCE: 'ALL_DEPARTMENTS', ADMINISTRATION: 'SELECTED_DEPARTMENTS' });
    const g = groupModuleAccess(input, CONTRACT_MANAGER, false);
    const placed = [g.primary, ...g.modules, ...g.other, g.administration, ...g.notGranted].filter(Boolean);
    expect(placed.map((c) => c!.module).sort()).toEqual([...ALL].sort());
  });
});

describe('labels and credentials text', () => {
  it('Module Access labels use the modern module names', () => {
    expect(MODULE_LABELS['FACTORY_TASKS']).toBe('Task Management');
    expect(MODULE_LABELS['MAINTENANCE_REQUESTS']).toBe('Maintenance Management');
    expect(MODULE_LABELS['PRODUCTION_DASHBOARD']).toBe('Production & Planning');
    const all = Object.values(MODULE_LABELS);
    for (const old of ['Factory Tasks Management', 'Maintenance Requests', 'Production Dashboard']) {
      expect(all).not.toContain(old);
    }
  });

  it('Copy Credentials includes the Access Mode line only when given, and never a username', () => {
    const base = { email: 'a@b.co', tempPassword: 'x', roleLabel: 'Contract Manager', moduleAccessLines: [] };
    expect(buildCredentialsText(base)).not.toContain('Access Mode');
    const text = buildCredentialsText({ ...base, accessModeLabel: 'Single Module Access — Contract Management' });
    expect(text).toContain('Access Mode: Single Module Access — Contract Management');
    expect(text).toContain('Login Email: a@b.co');
    expect(text).not.toContain('Username');
  });
});
