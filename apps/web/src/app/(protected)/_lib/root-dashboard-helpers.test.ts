import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  getAccessibleModulePermissions,
  moduleDashStatus,
  MODULE_READ_PERMISSIONS,
} from './root-dashboard-helpers';

const ROOT_PAGE = path.join(__dirname, '..', 'page.tsx');

// -------------------------------------------------------------------------
// T01-T03: Department scope — metrics pass through from scoped dashboard data
// -------------------------------------------------------------------------

describe('moduleDashStatus: dept-scoped dashboard data', () => {
  it('T01 - extracts ok status and correct value from OWN_DEPARTMENT response', () => {
    const result: PromiseSettledResult<{
      metrics: { totalOpen: number };
      scope: { type: string; departmentNames: string[] };
    } | null> = {
      status: 'fulfilled',
      value: {
        metrics: { totalOpen: 3 },
        scope: { type: 'OWN_DEPARTMENT', departmentNames: ['Engineering'] },
      },
    };
    expect(moduleDashStatus(result)).toBe('ok');
    const value =
      result.status === 'fulfilled' && result.value
        ? result.value.metrics.totalOpen
        : undefined;
    expect(value).toBe(3);
  });

  it('T02 - extracts ok status and correct value from SELECTED_DEPARTMENTS response', () => {
    const result: PromiseSettledResult<{
      metrics: { openTasks: number };
      scope: { type: string; departmentNames: string[] };
    } | null> = {
      status: 'fulfilled',
      value: {
        metrics: { openTasks: 7 },
        scope: {
          type: 'SELECTED_DEPARTMENTS',
          departmentNames: ['Maintenance', 'Safety'],
        },
      },
    };
    expect(moduleDashStatus(result)).toBe('ok');
    const value =
      result.status === 'fulfilled' && result.value
        ? result.value.metrics.openTasks
        : undefined;
    expect(value).toBe(7);
  });

  it('T03 - extracts ok status and correct value from ALL_DEPARTMENTS response', () => {
    const result: PromiseSettledResult<{
      metrics: { totalActive: number };
      scope: { type: string; departmentNames: string[] };
    } | null> = {
      status: 'fulfilled',
      value: {
        metrics: { totalActive: 42 },
        scope: { type: 'ALL_DEPARTMENTS', departmentNames: [] },
      },
    };
    expect(moduleDashStatus(result)).toBe('ok');
    const value =
      result.status === 'fulfilled' && result.value
        ? result.value.metrics.totalActive
        : undefined;
    expect(value).toBe(42);
  });
});

// -------------------------------------------------------------------------
// T04-T08: Module filtering based on read permissions
// -------------------------------------------------------------------------

describe('getAccessibleModulePermissions: module filtering', () => {
  it('T04 - returns empty when no matching permissions (unauthorized module excluded)', () => {
    const result = getAccessibleModulePermissions(['users.read', 'roles.read']);
    expect(result).toHaveLength(0);
  });

  it('T05 - returns only the single accessible module', () => {
    const result = getAccessibleModulePermissions(['tasks.read', 'users.read']);
    expect(result).toEqual(['tasks.read']);
  });

  it('T06 - single-module user sees exactly one permission', () => {
    expect(getAccessibleModulePermissions(['incidents.read'])).toHaveLength(1);
  });

  it('T07 - multi-module user sees all their authorized modules', () => {
    const result = getAccessibleModulePermissions([
      'tasks.read',
      'incidents.read',
      'maintenance.read',
    ]);
    expect(result).toHaveLength(3);
    expect(result).toContain('tasks.read');
    expect(result).toContain('incidents.read');
    expect(result).toContain('maintenance.read');
  });

  it('T08 - user with no module permissions gets empty list (empty state)', () => {
    expect(getAccessibleModulePermissions([])).toHaveLength(0);
    expect(getAccessibleModulePermissions(['users.read', 'roles.read'])).toHaveLength(0);
  });
});

// -------------------------------------------------------------------------
// T09: Resilience — one failed module does not affect others
// -------------------------------------------------------------------------

describe('moduleDashStatus: fetch resilience', () => {
  it('T09 - rejected module returns unavailable while fulfilled module returns ok independently', () => {
    const failed: PromiseSettledResult<{ metrics: { totalOpen: number } } | null> = {
      status: 'rejected',
      reason: new Error('network error'),
    };
    const succeeded: PromiseSettledResult<{ metrics: { openTasks: number } } | null> = {
      status: 'fulfilled',
      value: { metrics: { openTasks: 5 }, scope: { type: 'ALL_DEPARTMENTS', departmentNames: [] } } as never,
    };

    expect(moduleDashStatus(failed)).toBe('unavailable');
    expect(moduleDashStatus(succeeded)).toBe('ok');

    const succeededValue =
      succeeded.status === 'fulfilled' && succeeded.value
        ? succeeded.value.metrics.openTasks
        : undefined;
    expect(succeededValue).toBe(5);
  });
});

// -------------------------------------------------------------------------
// T10: No legacy unscoped summary() endpoints in root page
// -------------------------------------------------------------------------

describe('Root page static analysis', () => {
  it('T10 - root page does not call any legacy unscoped summary() endpoint', () => {
    const source = fs.readFileSync(ROOT_PAGE, 'utf-8');
    expect(source).not.toMatch(/\bincidentsApi\.summary\b/);
    expect(source).not.toMatch(/\btasksApi\.summary\b/);
    expect(source).not.toMatch(/\bmaintenanceApi\.summary\b/);
    expect(source).not.toMatch(/\bsafetyApi\.summary\b/);
    expect(source).not.toMatch(/\bcontractsApi\.summary\b/);
  });

  // -----------------------------------------------------------------------
  // T11: No role-name authorization
  // -----------------------------------------------------------------------

  it('T11 - root page does not use role names for authorization decisions', () => {
    const source = fs.readFileSync(ROOT_PAGE, 'utf-8');
    expect(source).not.toMatch(/roleCode\s*===/);
    expect(source).not.toMatch(/\.role\s*===/);
    expect(source).not.toContain("'SUPER_ADMIN'");
    expect(source).not.toContain("'ADMIN'");
    expect(source).not.toContain('"SUPER_ADMIN"');
    expect(source).not.toContain('"ADMIN"');
  });
});

// -------------------------------------------------------------------------
// Sanity: all 6 module permissions are covered
// -------------------------------------------------------------------------

describe('MODULE_READ_PERMISSIONS coverage', () => {
  it('defines all 6 operational module read permissions', () => {
    expect(MODULE_READ_PERMISSIONS).toHaveLength(6);
    expect(MODULE_READ_PERMISSIONS).toContain('tasks.read');
    expect(MODULE_READ_PERMISSIONS).toContain('incidents.read');
    expect(MODULE_READ_PERMISSIONS).toContain('maintenance.read');
    expect(MODULE_READ_PERMISSIONS).toContain('safety.read');
    expect(MODULE_READ_PERMISSIONS).toContain('contracts.read');
    expect(MODULE_READ_PERMISSIONS).toContain('production.read');
  });
});
