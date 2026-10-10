import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { WORKSPACE_TABS, allWorkspaceTabs, isWorkspaceTabActive, workspaceTabHref } from './contract-workspace-tabs';

const ID = '11111111-1111-4111-8111-111111111111';

describe('Contract workspace tabs (FMP-CONTRACT-09B)', () => {
  it('keeps all 14 existing tab labels, none removed or renamed, in order', () => {
    expect(allWorkspaceTabs().map((t) => t.label)).toEqual([
      'Overview',
      'Schedule',
      'Payments',
      'Production Status',
      'BOQ Progress',
      'Variations / Change Orders',
      'Claims',
      'Risk Assessment',
      'Documents & Obligations',
      'Workflow & Team Tasks',
      'Issue Log',
      'Attachments',
      'Activity / Audit History',
      'Closeout',
    ]);
  });

  it('routes are unchanged', () => {
    const hrefs = allWorkspaceTabs().map((t) => workspaceTabHref(ID, t));
    const base = `/contracts/${ID}`;
    expect(hrefs).toEqual([
      base,
      `${base}/schedule`,
      `${base}/payments`,
      `${base}/production`,
      `${base}/boq-progress`,
      `${base}/variations`,
      `${base}/claims`,
      `${base}/risks`,
      `${base}/documents`,
      `${base}/workflow`,
      `${base}/issues`,
      `${base}/attachments`,
      `${base}/activity`,
      `${base}/closeout`,
    ]);
  });

  it('is a single flat list in the original order — no grouping data at all', () => {
    expect(WORKSPACE_TABS.map((t) => t.key)).toEqual([
      'overview', 'schedule', 'payments', 'production', 'boq-progress', 'variations', 'claims',
      'risks', 'documents', 'workflow', 'issues', 'attachments', 'activity', 'closeout',
    ]);
    expect(Object.keys(WORKSPACE_TABS[0]!).sort()).toEqual(['key', 'label', 'segment']);
  });

  it('renders no group labels, group headings or dividers', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../_components/contract-workspace-tabs.tsx'), 'utf8');
    const lib = fs.readFileSync(path.resolve(__dirname, './contract-workspace-tabs.ts'), 'utf8');
    for (const text of ['Commercial', 'Documents & Work', 'History & Closeout', 'WORKSPACE_TAB_GROUPS', 'role="group"', 'border-l', 'uppercase']) {
      expect(src).not.toContain(text);
    }
    expect(lib).not.toContain('Commercial');
    expect(lib).not.toContain('History & Closeout');
    expect(lib).not.toContain("label: 'Main'");
  });

  it('detects the active tab; Overview matches only its own route', () => {
    const tabs = allWorkspaceTabs();
    const overview = tabs[0]!;
    const payments = tabs.find((t) => t.key === 'payments')!;
    const base = `/contracts/${ID}`;
    expect(isWorkspaceTabActive(base, workspaceTabHref(ID, overview), overview)).toBe(true);
    expect(isWorkspaceTabActive(`${base}/payments`, workspaceTabHref(ID, overview), overview)).toBe(false);
    expect(isWorkspaceTabActive(`${base}/payments`, workspaceTabHref(ID, payments), payments)).toBe(true);
    expect(isWorkspaceTabActive(`${base}/payments/some-id`, workspaceTabHref(ID, payments), payments)).toBe(true);
    expect(isWorkspaceTabActive(`${base}/paymentsx`, workspaceTabHref(ID, payments), payments)).toBe(false);
    expect(isWorkspaceTabActive(`${base}/claims`, workspaceTabHref(ID, payments), payments)).toBe(false);
  });

  it('every tab has a unique key and an icon in the component', () => {
    const keys = allWorkspaceTabs().map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    const src = fs.readFileSync(path.resolve(__dirname, '../_components/contract-workspace-tabs.tsx'), 'utf8');
    for (const key of keys) expect(src).toContain(key.includes('-') ? `'${key}'` : `${key}:`);
  });

  it('component keeps keyboard/aria semantics and scrolls inside the tab bar on small screens (no page overflow)', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../_components/contract-workspace-tabs.tsx'), 'utf8');
    expect(src).toContain("aria-current={active ? 'page' : undefined}");
    expect(src).toContain('aria-label="Contract workspace sections"');
    expect(src).toContain('overflow-x-auto');
    expect(src).toContain('max-w-full');
    expect(src).toContain('lg:flex-wrap');
    expect(src).toContain('h-9');
    expect(src).toContain('bg-accent font-semibold text-white');
    // text labels always render next to the icon
    expect(src).toContain('{tab.label}');
  });

  it('the permission behavior is untouched: the tab bar takes no permission props and the layout (whose staff-tier redirect and focused-erection branch are untouched) still renders it the same way', () => {
    const layout = fs.readFileSync(path.resolve(__dirname, '../[id]/(workspace)/layout.tsx'), 'utf8');
    expect(layout).toContain('<ContractWorkspaceTabs contractId={contract.id} />');
  });
});
