import { describe, it, expect } from 'vitest';
import type { UserModuleAccessConfig, ModuleIdentifier } from '@/lib/users-api';
import {
  groupModuleAccess,
  scopeModuleFor,
  scopeRowLabelOverrides,
  suggestedRoleCode,
  wizardModuleLabel,
  wizardVisibleModules,
} from '../_components/access-mode-config';
import { moduleBySlug } from '../_components/module-catalog';
import { MODULE_LABELS } from '../_components/scope-utils';

const ALL: ModuleIdentifier[] = [
  'FACTORY_TASKS', 'INCIDENT_REPORT', 'MAINTENANCE_REQUESTS', 'SAFETY_COMPLIANCE',
  'CONTRACTS_MANAGEMENT', 'PRODUCTION_DASHBOARD', 'ADMINISTRATION',
];
const configs = (): UserModuleAccessConfig[] =>
  ALL.map((module) => ({ module, scope: 'OWN_DEPARTMENT', grantedDepartments: [] }));

describe('Technical module in user administration (FMP-ACCESS-02)', () => {
  it('the Technical card is its own module, not Contract Management', () => {
    expect(moduleBySlug('technical')?.code).toBe('TECHNICAL');
    expect(moduleBySlug('technical')?.name).toBe('Technical');
  });

  it('Module Staff / Manager for Technical suggest the Technical roles; Contract Management keeps its own', () => {
    expect(suggestedRoleCode('MODULE_STAFF', 'TECHNICAL')).toBe('TECHNICAL_STAFF');
    expect(suggestedRoleCode('MODULE_MANAGER', 'TECHNICAL')).toBe('TECHNICAL_MANAGER');
    expect(suggestedRoleCode('MODULE_STAFF', 'CONTRACTS_MANAGEMENT')).toBe('CONTRACT_STAFF');
    expect(suggestedRoleCode('MODULE_MANAGER', 'CONTRACTS_MANAGEMENT')).toBe('CONTRACT_MANAGER');
    expect(suggestedRoleCode('MODULE_STAFF', 'PRODUCTION_DASHBOARD')).toBeUndefined();
  });

  it('Technical as Primary Module shows one scope row (stored on the Contract Management record) named Technical', () => {
    const input = { mode: 'SINGLE_MODULE' as const, template: 'MODULE_STAFF' as const, targetModule: 'TECHNICAL' as const, multiModules: [] };
    expect(scopeModuleFor('TECHNICAL')).toBe('CONTRACTS_MANAGEMENT');
    expect(wizardVisibleModules(input)).toEqual(['CONTRACTS_MANAGEMENT']);
    expect(scopeRowLabelOverrides(input)).toEqual({ CONTRACTS_MANAGEMENT: 'Technical' });
    expect(wizardModuleLabel('TECHNICAL')).toBe('Technical');
  });

  it('Technical together with Contract Management keeps the Contract Management name', () => {
    const input = {
      mode: 'MULTI_MODULE' as const,
      template: 'MULTI_MODULE' as const,
      targetModule: '' as const,
      multiModules: ['TECHNICAL' as const, 'CONTRACTS_MANAGEMENT' as const],
    };
    expect(wizardVisibleModules(input)).toEqual(['CONTRACTS_MANAGEMENT']);
    expect(scopeRowLabelOverrides(input)).toEqual({});
  });

  it('Edit User: a Technical user has Technical as primary module, not Contract Management, and no Administration', () => {
    const g = groupModuleAccess(configs(), ['technical.read', 'technical.update'], false);
    expect(g.info.mode).toBe('SINGLE_MODULE');
    expect(g.info.primaryModule).toBe('TECHNICAL');
    expect(g.primary?.module).toBe('CONTRACTS_MANAGEMENT');
    expect(g.labelOverrides).toEqual({ CONTRACTS_MANAGEMENT: 'Technical' });
    expect(g.administration).toBeNull();
    expect(g.relatedWorkflows).toEqual([]);
  });

  it('Edit User: a Contract Manager is unchanged, Contract Management primary with no rename', () => {
    const g = groupModuleAccess(configs(), ['contracts.read', 'contracts.update'], false);
    expect(g.primary?.module).toBe('CONTRACTS_MANAGEMENT');
    expect(g.labelOverrides).toEqual({});
    expect(g.relatedWorkflows).toEqual(['Technical', 'Erection', 'Schedule Planning']);
  });

  it('uses the exact label Technical and none of the discouraged ones', () => {
    expect(MODULE_LABELS['TECHNICAL']).toBe('Technical');
    for (const bad of ['Technical Dashboard', 'Engineering module', 'Contract Technical']) {
      expect(Object.values(MODULE_LABELS)).not.toContain(bad);
    }
  });
});
