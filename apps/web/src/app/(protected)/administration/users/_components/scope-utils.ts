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

export const MODULE_LABELS: Record<string, string> = {
  FACTORY_TASKS: 'Factory Tasks Management',
  INCIDENT_REPORT: 'Incident Report',
  MAINTENANCE_REQUESTS: 'Maintenance Requests',
  SAFETY_COMPLIANCE: 'Safety & Compliance',
  CONTRACTS_MANAGEMENT: 'Contracts Management',
  PRODUCTION_DASHBOARD: 'Production Dashboard',
  ADMINISTRATION: 'Administration',
};
