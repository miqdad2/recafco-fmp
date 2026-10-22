import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { WORKSPACE_TABS, allWorkspaceTabs, isWorkspaceTabActive, workspaceTabHref } from './contract-workspace-tabs';

const ID = '11111111-1111-4111-8111-111111111111';
const base = `/contracts/${ID}`;
const src = (): string => fs.readFileSync(path.resolve(__dirname, '../_components/contract-workspace-tabs.tsx'), 'utf8');

describe('Contract workspace tabs (FMP-CONTRACT-DETAIL-01)', () => {
  it('shows exactly the 13 approved tabs in order', () => {
    expect(allWorkspaceTabs().map((t) => t.label)).toEqual([
      'Overview', 'Technical', 'Production & Planning', 'Delivery', 'Erection', 'Variations / Change Orders', 'Claims',
      'Risk Assessment', 'Documents & Obligations', 'Issue Log', 'Attachments', 'Activity / Audit History', 'Closeout',
    ]);
  });

  it('no longer lists the removed tabs', () => {
    const labels = allWorkspaceTabs().map((t) => t.label);
    for (const gone of ['Schedule', 'Payments', 'Production Status', 'BOQ Progress', 'Workflow & Team Tasks']) expect(labels).not.toContain(gone);
  });

  it('routes: new department segments, existing ones unchanged', () => {
    expect(allWorkspaceTabs().map((t) => workspaceTabHref(ID, t))).toEqual([
      base, `${base}/technical`, `${base}/production-planning`, `${base}/delivery`, `${base}/erection`,
      `${base}/variations`, `${base}/claims`, `${base}/risks`, `${base}/documents`, `${base}/issues`,
      `${base}/attachments`, `${base}/activity`, `${base}/closeout`,
    ]);
  });

  it('removed pages still exist as routes (deep links) and keep a related tab highlighted', () => {
    const dir = path.resolve(__dirname, '../[id]/(workspace)');
    for (const seg of ['schedule', 'payments', 'production', 'boq-progress', 'workflow']) expect(fs.existsSync(path.join(dir, seg))).toBe(true);
    const tab = (k: string) => allWorkspaceTabs().find((t) => t.key === k)!;
    const active = (p: string, k: string): boolean => isWorkspaceTabActive(p, workspaceTabHref(ID, tab(k)), tab(k));
    expect(active(`${base}/boq-progress`, 'technical')).toBe(true);
    expect(active(`${base}/production`, 'production-planning')).toBe(true);
    expect(active(`${base}/workflow/erection/checklist`, 'erection')).toBe(true);
    expect(active(`${base}/schedule`, 'technical')).toBe(false);
    expect(active(`${base}/productionx`, 'production-planning')).toBe(false);
  });

  it('is a single flat list — no grouping data', () => {
    expect(WORKSPACE_TABS.every((t) => ['key', 'label', 'segment', 'alsoActiveFor'].includes(Object.keys(t).join(',').split(',')[0]!))).toBe(true);
    for (const text of ['Commercial', 'WORKSPACE_TAB_GROUPS', 'role="group"', 'uppercase']) expect(src()).not.toContain(text);
  });

  it('detects the active tab; Overview matches only its own route', () => {
    const tabs = allWorkspaceTabs();
    const overview = tabs[0]!;
    const claims = tabs.find((t) => t.key === 'claims')!;
    expect(isWorkspaceTabActive(base, workspaceTabHref(ID, overview), overview)).toBe(true);
    expect(isWorkspaceTabActive(`${base}/claims`, workspaceTabHref(ID, overview), overview)).toBe(false);
    expect(isWorkspaceTabActive(`${base}/claims`, workspaceTabHref(ID, claims), claims)).toBe(true);
    expect(isWorkspaceTabActive(`${base}/claims/some-id`, workspaceTabHref(ID, claims), claims)).toBe(true);
    expect(isWorkspaceTabActive(`${base}/claimsx`, workspaceTabHref(ID, claims), claims)).toBe(false);
  });

  it('every tab has a unique key and an icon in the component', () => {
    const keys = allWorkspaceTabs().map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(src()).toContain(key.includes('-') ? `'${key}'` : `${key}:`);
  });

  it('every tab segment has a page', () => {
    const dir = path.resolve(__dirname, '../[id]/(workspace)');
    for (const t of allWorkspaceTabs()) if (t.segment) expect(fs.existsSync(path.join(dir, t.segment, 'page.tsx'))).toBe(true);
  });

  it('component keeps aria semantics, wraps (no horizontal scroll) and highlights the active tab in the accent colour', () => {
    const s = src();
    expect(s).toContain("aria-current={active ? 'page' : undefined}");
    expect(s).toContain('aria-label="Contract workspace sections"');
    expect(s).not.toContain('overflow-x-auto');
    expect(s).toContain('max-w-full');
    expect(s).toContain('flex-wrap');
    expect(s).toContain('bg-accent font-semibold text-white');
    expect(s).toContain('{tab.label}');
  });

  it('the permission behavior is untouched: the layout still renders the tab bar the same way', () => {
    const layout = fs.readFileSync(path.resolve(__dirname, '../[id]/(workspace)/layout.tsx'), 'utf8');
    expect(layout).toContain('<ContractWorkspaceTabs contractId={contract.id} />');
  });
});
