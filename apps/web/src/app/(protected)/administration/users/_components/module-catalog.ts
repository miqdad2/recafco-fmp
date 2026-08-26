import type { ModuleCode } from '../../../_lib/module-visibility';

// ---------------------------------------------------------------------------
// CM-42 — the operational modules Super Admin creates/manages users for, in
// one shared place so the Users page's module cards, its optional module
// filter, and the New User wizard's ?module= preselection all agree on the
// same slug↔ModuleCode mapping. Slugs are the short, URL-friendly values
// used in ?module=<slug> (e.g. /administration/users/new?module=contracts).
// ---------------------------------------------------------------------------

export interface ModuleCatalogEntry {
  code: Exclude<ModuleCode, 'ADMINISTRATION'>;
  slug: string;
  name: string;
  shortDescription: string;
}

export const MODULE_CATALOG: ModuleCatalogEntry[] = [
  {
    code: 'CONTRACTS_MANAGEMENT',
    slug: 'contracts',
    name: 'Contract Management',
    shortDescription: 'Create contract managers and staff who work on contract tasks.',
  },
  {
    code: 'FACTORY_TASKS',
    slug: 'factory-tasks',
    name: 'Factory Tasks Management',
    shortDescription: 'Create users who create, assign and complete factory tasks.',
  },
  {
    code: 'INCIDENT_REPORT',
    slug: 'incident-report',
    name: 'Incident Report',
    shortDescription: 'Create users who report and investigate safety incidents.',
  },
  {
    code: 'MAINTENANCE_REQUESTS',
    slug: 'maintenance',
    name: 'Maintenance Requests',
    shortDescription: 'Create users who raise and action maintenance requests.',
  },
  {
    code: 'SAFETY_COMPLIANCE',
    slug: 'safety',
    name: 'Safety & Compliance',
    shortDescription: 'Create users who run inspections and track compliance findings.',
  },
  {
    code: 'PRODUCTION_DASHBOARD',
    slug: 'production',
    name: 'Production Dashboard',
    shortDescription: 'Create users who monitor and record production line output.',
  },
];

export function moduleBySlug(slug: string | undefined): ModuleCatalogEntry | undefined {
  if (!slug) return undefined;
  return MODULE_CATALOG.find((m) => m.slug === slug);
}

export function moduleByCode(code: ModuleCode | undefined): ModuleCatalogEntry | undefined {
  if (!code) return undefined;
  return MODULE_CATALOG.find((m) => m.code === code);
}
