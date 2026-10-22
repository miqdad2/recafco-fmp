/**
 * Contract Detail tab definitions (data only; icons are attached by the
 * component). FMP-CONTRACT-DETAIL-01: the manager-approved 13-tab, department
 * oriented order. One flat list — no group headings.
 *
 * Schedule, Payments, Production Status, BOQ Progress and Workflow & Team Tasks
 * are no longer tabs, but their routes and pages are untouched (deep links keep
 * working); see `alsoActiveFor` for which tab stays highlighted on them.
 */

export interface WorkspaceTabDef {
  key: string;
  label: string;
  /** Route segment under /contracts/:id — `null` is the Overview (the base route itself). */
  segment: string | null;
  /** Other route segments (still-existing pages that are no longer tabs) that keep this tab highlighted. */
  alsoActiveFor?: string[];
}

export const WORKSPACE_TABS: WorkspaceTabDef[] = [
  { key: 'overview', label: 'Overview', segment: null },
  { key: 'technical', label: 'Technical', segment: 'technical', alsoActiveFor: ['boq-progress'] },
  { key: 'production-planning', label: 'Production & Planning', segment: 'production-planning', alsoActiveFor: ['production'] },
  { key: 'delivery', label: 'Delivery', segment: 'delivery' },
  { key: 'erection', label: 'Erection', segment: 'erection', alsoActiveFor: ['workflow/erection'] },
  { key: 'variations', label: 'Variations / Change Orders', segment: 'variations' },
  { key: 'claims', label: 'Claims', segment: 'claims' },
  { key: 'risks', label: 'Risk Assessment', segment: 'risks' },
  { key: 'documents', label: 'Documents & Obligations', segment: 'documents' },
  { key: 'issues', label: 'Issue Log', segment: 'issues' },
  { key: 'attachments', label: 'Attachments', segment: 'attachments' },
  { key: 'activity', label: 'Activity / Audit History', segment: 'activity' },
  { key: 'closeout', label: 'Closeout', segment: 'closeout' },
];

export function allWorkspaceTabs(): WorkspaceTabDef[] {
  return WORKSPACE_TABS;
}

export function workspaceTabHref(contractId: string, tab: WorkspaceTabDef): string {
  const base = `/contracts/${contractId}`;
  return tab.segment ? `${base}/${tab.segment}` : base;
}

/** Overview matches its own route only; other tabs also stay active on their nested pages and on their `alsoActiveFor` routes. */
export function isWorkspaceTabActive(pathname: string, href: string, tab: WorkspaceTabDef): boolean {
  if (pathname === href) return true;
  if (tab.segment === null) return false;
  if (pathname.startsWith(`${href}/`)) return true;
  const base = href.slice(0, href.length - tab.segment.length - 1);
  return (tab.alsoActiveFor ?? []).some((seg) => pathname === `${base}/${seg}` || pathname.startsWith(`${base}/${seg}/`));
}
