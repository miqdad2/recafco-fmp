import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ACCOUNT_TYPE_OPTIONS,
  DEFAULT_ACCOUNT_TYPE,
  MANAGEMENT_REVIEW_ROWS,
  MANAGEMENT_ROLE_CODE,
  wizardStepsFor,
} from '../_components/account-type';

const read = (rel: string): string => readFileSync(join(__dirname, '..', rel), 'utf8');

describe('New User account type', () => {
  it('defaults to the operational account type', () => {
    expect(DEFAULT_ACCOUNT_TYPE).toBe('OPERATIONAL');
    expect(ACCOUNT_TYPE_OPTIONS.map((o) => o.label)).toEqual(['FMP Operational User', 'Management Intelligence Viewer']);
  });

  it('keeps the five operational steps unchanged', () => {
    expect(wizardStepsFor('OPERATIONAL').map((s) => s.label)).toEqual([
      'Account',
      'Organization',
      'Access Template',
      'Module Access',
      'Review & Create',
    ]);
  });

  it('gives a management account only two steps, with no organization, template or module access', () => {
    const keys = wizardStepsFor('MANAGEMENT').map((s) => s.key);
    expect(keys).toEqual(['account', 'review']);
  });

  it('states the fixed management review facts', () => {
    const rows = Object.fromEntries(MANAGEMENT_REVIEW_ROWS.map((r) => [r.label, r.value]));
    expect(rows).toMatchObject({
      'Account Type': 'Management Intelligence Viewer',
      Access: 'Management dashboards only',
      'Operational Modules': 'No access',
      'Full Platform Access': 'Disabled',
      Login: 'Existing RECAFCO FMP Login',
      'Landing Page': 'Management Intelligence Center',
    });
  });
});

describe('wizard and server action wiring', () => {
  const wizard = read('_components/new-user-wizard.tsx');
  const action = read('actions.ts');

  it('does not render operational steps (and so cannot submit their fields) for a management account', () => {
    expect(wizard).toContain('{!isManagement && (');
    // roleId and fullPlatformAccess inputs live inside the operational-only block
    const operationalStart = wizard.indexOf('{!isManagement && (\n        <>');
    const reviewStart = wizard.indexOf('{/* Review & Create */}');
    const block = wizard.slice(operationalStart, reviewStart).replace(/\r\n/g, '\n');
    expect(block).toContain('name="roleId"');
    expect(block).toContain('name="fullPlatformAccess"');
    expect(wizard.slice(0, operationalStart)).not.toContain('name="roleId"');
  });

  it('clears operational selections when the account type changes', () => {
    expect(wizard).toContain('resetOperationalSelections();');
  });

  it('resolves the management role by code on the server and ignores submitted role/scope fields', () => {
    expect(action).toContain(`formData.get('accountType')?.toString() === 'MANAGEMENT'`);
    expect(action).toContain('MANAGEMENT_ROLE_CODE');
    const mgmtBranch = action.slice(action.indexOf(`=== 'MANAGEMENT'`), action.indexOf('const payload = {'));
    expect(mgmtBranch).not.toContain('setModuleAccess');
    expect(mgmtBranch).not.toContain('setPlatformAccess');
    expect(mgmtBranch).not.toContain('roleIdRaw');
    expect(MANAGEMENT_ROLE_CODE).toBe('MANAGEMENT_INTELLIGENCE_VIEWER');
  });

  it('step indicator wraps instead of scrolling', () => {
    expect(wizard).not.toContain('overflow-x-auto');
    expect(wizard).toContain('flex-wrap');
  });
});
