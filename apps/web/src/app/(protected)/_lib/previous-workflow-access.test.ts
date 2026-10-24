import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { canAccessPreviousWorkflow, contractMonitoringRelatedLinks, contractRelatedLinks, PREVIOUS_WORKFLOW_LINK_LABELS } from './access-mode';

// Permission sets copied from the real roles (dev database, 2026-10-22), reduced to what matters here.
const CONTRACT_MANAGER = ['contracts.read', 'contracts.update', 'contracts.create', 'contracts.operations_link'];
const CONTRACT_MANAGEMENT_USER = ['contracts.read', 'contracts.update', 'contracts.create'];
const VIEWER = ['contracts.read', 'technical.read', 'production.read', 'storage_delivery.read', 'erection.read', 'users.read', 'roles.read'];
const EXECUTIVE_MANAGER = ['contracts.read', 'contracts.update', 'contracts.manage', 'technical.read', 'technical.update', 'production.read', 'production.update', 'storage_delivery.read', 'storage_delivery.update', 'erection.read', 'erection.update'];
const ADMIN = [...EXECUTIVE_MANAGER, 'users.assign_role', 'users.read', 'roles.read'];
const TECHNICAL_MANAGER = ['technical.read', 'technical.update', 'technical.manage'];
const CONTRACT_STAFF = ['contracts.read'];

describe('Previous Internal Workflow access', () => {
  it('administrators and people who work in the old workflow can open it', () => {
    expect(canAccessPreviousWorkflow(ADMIN)).toBe(true);
    expect(canAccessPreviousWorkflow(EXECUTIVE_MANAGER)).toBe(true);
    expect(canAccessPreviousWorkflow(TECHNICAL_MANAGER)).toBe(true);
  });
  it('the Contract Manager and read-only monitoring roles never need it and do not see it', () => {
    expect(canAccessPreviousWorkflow(CONTRACT_MANAGER)).toBe(false);
    expect(canAccessPreviousWorkflow(CONTRACT_MANAGEMENT_USER)).toBe(false);
    expect(canAccessPreviousWorkflow(VIEWER)).toBe(false);
    expect(canAccessPreviousWorkflow(CONTRACT_STAFF)).toBe(false);
    expect(canAccessPreviousWorkflow([])).toBe(false);
  });
  it('a read permission alone is not enough', () => {
    for (const p of ['technical.read', 'production.read', 'storage_delivery.read', 'erection.read']) expect(canAccessPreviousWorkflow([p])).toBe(false);
  });
});

describe('monitoring sidebar no longer lists the old operational workflow', () => {
  it('Related Workflows (monitoring) drops Technical / Production / Storage / Erection / Piece Erection', () => {
    const labels = contractMonitoringRelatedLinks([...CONTRACT_MANAGER, 'production.read', 'storage_delivery.read', 'erection.read', 'tasks.read']).map((l) => l.label);
    for (const old of PREVIOUS_WORKFLOW_LINK_LABELS) expect(labels).not.toContain(old);
    expect(labels).toContain('Advanced Planning');
    expect(labels).toContain('Task Management');
  });
  it('the underlying link definitions are preserved (nothing deleted)', () => {
    const labels = contractRelatedLinks([...CONTRACT_MANAGER, 'production.read', 'storage_delivery.read', 'erection.read']).map((l) => l.label);
    for (const old of PREVIOUS_WORKFLOW_LINK_LABELS) expect(labels).toContain(old);
  });
});

describe('main contract monitoring screens carry no old workflow entry buttons', () => {
  const contracts = path.resolve(__dirname, '../contracts');
  const read = (rel: string): string => fs.readFileSync(path.join(contracts, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const files = [
    '[id]/(workspace)/page.tsx',
    '[id]/(workspace)/technical/page.tsx',
    '[id]/(workspace)/production-planning/page.tsx',
    '[id]/(workspace)/delivery/page.tsx',
    '[id]/(workspace)/erection/page.tsx',
    '_components/operations-stage-tab.tsx',
    '_components/operations-stage-panel.tsx',
    '_components/operations-progress-summary-card.tsx',
    '_components/operations-list-cell.tsx',
    '_components/contract-list-table.tsx',
    '_components/contract-row-actions.tsx',
    'page.tsx',
  ];
  for (const f of files) {
    it(`${f} has none of the old entry buttons`, () => {
      const text = read(f);
      for (const label of ['Open Technical Workflow', 'Open Technical workflow', 'Open Production Work', 'Open Storage Yard & Delivery', 'Open Erection']) {
        expect(text).not.toContain(label);
      }
      expect(text).not.toMatch(/\/production\/pieces|\/storage-delivery\/pieces|\/erection\/pieces|\/technical\/jobs/);
    });
  }
  it('the four tabs do not read the old local workflow data', () => {
    for (const f of ['technical', 'production-planning', 'delivery', 'erection']) {
      const text = read(`[id]/(workspace)/${f}/page.tsx`);
      expect(text).not.toMatch(/technical-api|fetchBoqConfirmations|fetchElementCoverage|contract-department-panel|contract-department-helpers/);
    }
  });
  it('the Contract List no longer fetches per-contract old workflow progress', () => {
    const text = read('page.tsx');
    expect(text).not.toMatch(/fetchBoqConfirmations|summarizeProgress|boqProgress/);
    expect(text).toContain('operationsApi.monitoring');
  });
  it('the old workflow screens still exist in their own area (routes preserved)', () => {
    const app = path.resolve(__dirname, '..');
    for (const route of ['technical', 'production', 'storage-delivery', 'erection', 'previous-workflow']) expect(fs.existsSync(path.join(app, route))).toBe(true);
    expect(fs.existsSync(path.join(contracts, 'erection-dashboard'))).toBe(true);
    expect(fs.existsSync(path.join(contracts, '[id]/(workspace)/boq-progress'))).toBe(true);
  });
});

describe('demonstration controls are development only', () => {
  const dir = path.resolve(__dirname, '../dev/operations-demo');
  it('the page and actions refuse production and need the explicit flag', () => {
    const page = fs.readFileSync(path.join(dir, 'page.tsx'), 'utf8');
    const actions = fs.readFileSync(path.join(dir, 'actions.ts'), 'utf8');
    expect(page).toMatch(/NODE_ENV'\] === 'production'/);
    expect(page).toMatch(/OPERATIONS_DEMO_ENABLED/);
    expect(actions).toMatch(/NODE_ENV'\] !== 'production'/);
    expect(actions).toMatch(/OPERATIONS_DEMO_ENABLED/);
  });
  it('no normal manager screen links to the demonstration controls', () => {
    const contracts = path.resolve(__dirname, '../contracts');
    const walk = (d: string): string[] =>
      fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    for (const f of walk(contracts).filter((x) => /\.(tsx?|ts)$/.test(x) && !x.endsWith('.test.ts'))) {
      expect(fs.readFileSync(f, 'utf8'), f).not.toContain('/dev/operations-demo');
    }
    expect(fs.readFileSync(path.resolve(__dirname, '../_components/sidebar.tsx'), 'utf8')).not.toContain('/dev/operations-demo');
  });
});
