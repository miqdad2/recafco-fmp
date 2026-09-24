import type { ModuleCode } from '../../../_lib/module-visibility';

// ---------------------------------------------------------------------------
// CM-42 — the operational modules Super Admin creates/manages users for, in
// one shared place so the Users page's module cards, its optional module
// filter, and the New User wizard's ?module= preselection all agree on the
// same slug↔ModuleCode mapping. Slugs are the short, URL-friendly values
// used in ?module=<slug> (e.g. /administration/users/new?module=contracts).
//
// FMP-UI-02 — relabelled to match the FMP-UI-01 Executive Platform Dashboard
// and sidebar (Task Management / Production Planning / Maintenance
// Management), reordered to match that dashboard's module order, and
// extended with "Technical" and "Erection" cards. Technical/Erection are NOT
// separate ModuleIdentifier/permission modules (confirmed by audit — see
// context/progress-tracker.md) — both share CONTRACTS_MANAGEMENT's own
// `code`/`contracts.read` permission, exactly like the FMP-UI-01 dashboard
// treats them as sub-views of Contract Management. They exist here purely as
// clearly-labelled entry points into the same Contract Management user-
// creation flow, each with its own name/description/preset so an admin
// creating an "Erection" user lands on the right template without guessing.
// The Executive / Management card is a role template, not a module, so it is
// NOT part of this array (its `code` would have nowhere honest to point in
// ModuleCode/MODULE_READ_PERMISSION) — see EXECUTIVE_CATALOG_ENTRY below.
// ---------------------------------------------------------------------------

export interface ModuleCatalogEntry {
  code: Exclude<ModuleCode, 'ADMINISTRATION'>;
  slug: string;
  name: string;
  shortDescription: string;
  /** Only true for the main "Contract Management" entry — Technical/Erection share the same `code` (and therefore the same real user counts), but showing the Manager/Staff split identically on all three cards would be redundant, not informative. */
  showManagerStaffSplit?: boolean;
  /** Pre-selects an Access Template value in the New User wizard (see new-user-wizard.tsx's AccessTemplate union) — e.g. Erection preselects 'ERECTION_MANAGER'. Left undefined to leave the wizard's own default (Module Staff) in place. */
  presetTemplate?: string;
}

export const MODULE_CATALOG: ModuleCatalogEntry[] = [
  {
    code: 'CONTRACTS_MANAGEMENT',
    slug: 'contracts',
    name: 'Contract Management',
    shortDescription: 'Create users who manage contracts, approvals, payments, claims, risks, and closeout.',
    showManagerStaffSplit: true,
  },
  {
    code: 'CONTRACTS_MANAGEMENT',
    slug: 'technical',
    name: 'Technical',
    shortDescription: 'Create users who handle drawings, submissions, calculations, and technical approvals.',
  },
  {
    code: 'CONTRACTS_MANAGEMENT',
    slug: 'erection',
    name: 'Erection',
    shortDescription: 'Create users who manage erection workflow, schedules, delivery coordination, erection start, and checklist status.',
    presetTemplate: 'ERECTION_MANAGER',
  },
  {
    code: 'SAFETY_COMPLIANCE',
    slug: 'safety',
    name: 'Safety & Compliance',
    shortDescription: 'Create users who run inspections, compliance checks, and safety follow-up.',
  },
  {
    code: 'INCIDENT_REPORT',
    slug: 'incident-report',
    name: 'Incident Report',
    shortDescription: 'Create users who report, investigate, and close incidents.',
  },
  {
    code: 'PRODUCTION_DASHBOARD',
    slug: 'production',
    name: 'Production Planning',
    shortDescription: 'Create users who monitor production schedules, delayed jobs, and delivery readiness.',
  },
  {
    code: 'MAINTENANCE_REQUESTS',
    slug: 'maintenance',
    name: 'Maintenance Management',
    shortDescription: 'Create users who raise, manage, and complete maintenance work orders.',
  },
  {
    code: 'FACTORY_TASKS',
    slug: 'factory-tasks',
    name: 'Task Management',
    shortDescription: 'Create users who create, assign, and complete operational tasks.',
  },
];

/**
 * FMP-UI-02 — Executive / Management is a role template (EXECUTIVE_MANAGER),
 * not a ModuleIdentifier — it has no single permission to filter/count by,
 * so it is deliberately kept out of MODULE_CATALOG/ModuleCatalogEntry (whose
 * `code` type is real ModuleCode values only). Rendered as the first card in
 * ModuleUserCards; its "Create User" link presets the Access Template
 * directly via `?template=EXECUTIVE_MANAGER` (no `?module=`), and its count
 * comes from computeExecutiveManagerCount() (role-code based), not
 * computeModuleUserCounts() (permission based).
 */
export const EXECUTIVE_CATALOG_ENTRY = {
  slug: 'executive',
  name: 'Executive / Management',
  shortDescription: 'Create executive managers with full operational access across all platform modules.',
  presetTemplate: 'EXECUTIVE_MANAGER',
} as const;

export function moduleBySlug(slug: string | undefined): ModuleCatalogEntry | undefined {
  if (!slug) return undefined;
  return MODULE_CATALOG.find((m) => m.slug === slug);
}

export function moduleByCode(code: ModuleCode | undefined): ModuleCatalogEntry | undefined {
  if (!code) return undefined;
  return MODULE_CATALOG.find((m) => m.code === code);
}
