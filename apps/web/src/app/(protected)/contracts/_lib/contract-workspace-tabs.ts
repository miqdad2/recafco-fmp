/**
 * Contract Detail tab definitions (data only; icons are attached by the
 * component). FMP-CONTRACT-09B: one flat, single-level list in the original
 * order — every tab keeps its key, label and route segment, all 14 visible.
 */

export interface WorkspaceTabDef {
  key: string;
  label: string;
  /** Route segment under /contracts/:id — `null` is the Overview (the base route itself). */
  segment: string | null;
}

/** The original single-level order (FMP-CONTRACT-09B restores it; no grouping). */
export const WORKSPACE_TABS: WorkspaceTabDef[] = [
  { key: 'overview', label: 'Overview', segment: null },
  { key: 'schedule', label: 'Schedule', segment: 'schedule' },
  { key: 'payments', label: 'Payments', segment: 'payments' },
  { key: 'production', label: 'Production Status', segment: 'production' },
  // FMP-BOQ-10 — read-only piece progress across Technical, Production, Storage & Delivery and Erection.
  { key: 'boq-progress', label: 'BOQ Progress', segment: 'boq-progress' },
  { key: 'variations', label: 'Variations / Change Orders', segment: 'variations' },
  { key: 'claims', label: 'Claims', segment: 'claims' },
  { key: 'risks', label: 'Risk Assessment', segment: 'risks' },
  { key: 'documents', label: 'Documents & Obligations', segment: 'documents' },
  { key: 'workflow', label: 'Workflow & Team Tasks', segment: 'workflow' },
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

/** Overview matches its own route only; other tabs also stay active on their nested pages. */
export function isWorkspaceTabActive(pathname: string, href: string, tab: WorkspaceTabDef): boolean {
  if (pathname === href) return true;
  return tab.segment !== null && pathname.startsWith(`${href}/`);
}
