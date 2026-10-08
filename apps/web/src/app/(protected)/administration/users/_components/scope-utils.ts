import type { DepartmentAccessScope } from '@/lib/users-api';

export function getAvailableScopeOptions(canManageAll: boolean): DepartmentAccessScope[] {
  const opts: DepartmentAccessScope[] = ['OWN_DEPARTMENT', 'SELECTED_DEPARTMENTS'];
  if (canManageAll) opts.push('ALL_DEPARTMENTS');
  return opts;
}

export const SCOPE_LABELS: Record<DepartmentAccessScope, string> = {
  OWN_DEPARTMENT: 'My Department (default)',
  SELECTED_DEPARTMENTS: 'Selected Departments',
  ALL_DEPARTMENTS: 'All Departments',
};

// FMP-UI-02 — relabelled to match the FMP-UI-01 Executive Platform Dashboard
// and sidebar (Task Management / Production Planning / Maintenance
// Management). These are the only 3 that changed; the underlying
// ModuleIdentifier/permission codes are unchanged.
// FMP-UI-23 — INCIDENT_REPORT and PRODUCTION_DASHBOARD relabelled again
// ("Incident Report" → "Incident Management", "Production Planning" →
// "Production & Planning"), matching that unit's own required wording.
export const MODULE_LABELS: Record<string, string> = {
  FACTORY_TASKS: 'Task Management',
  INCIDENT_REPORT: 'Incident Management',
  MAINTENANCE_REQUESTS: 'Maintenance Management',
  SAFETY_COMPLIANCE: 'Safety & Compliance',
  CONTRACTS_MANAGEMENT: 'Contract Management',
  TECHNICAL: 'Technical',
  PRODUCTION_DASHBOARD: 'Production & Planning',
  ADMINISTRATION: 'Administration',
};
