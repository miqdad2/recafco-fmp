import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');
const ACTIONS_FILE = path.join(ROOT, 'actions.ts');
const NEW_PAGE = path.join(ROOT, 'new', 'page.tsx');
const EDIT_PAGE = path.join(ROOT, '[id]', 'edit', 'page.tsx');
const ORG_LIST_DTO = path.join(
  __dirname,
  '../../../../../../../api/src/organizations/dto/org-list-query.dto.ts',
);
const COMPONENTS = path.join(ROOT, '_components');
const PERM_SUMMARY = path.join(COMPONENTS, 'role-permission-summary.tsx');
const MODULE_PANEL = path.join(COMPONENTS, 'module-access-panel.tsx');
const NEW_FORM = path.join(COMPONENTS, 'new-user-form.tsx');
const EDIT_TABS = path.join(COMPONENTS, 'edit-user-tabs.tsx');

// P1: Backend @Max restored to 100; frontend corrected to pageSize ≤ 100
describe('OrgListQueryDto @Max and frontend page-size constraint', () => {
  it('T14 - backend DTO retains @Max(100)', () => {
    const source = fs.readFileSync(ORG_LIST_DTO, 'utf-8');
    expect(source).toContain('@Max(100)');
  });

  it('T14b - new/page.tsx does not request pageSize > 100 from org endpoints', () => {
    const source = fs.readFileSync(NEW_PAGE, 'utf-8');
    // Verify no pageSize value above the allowed limit
    const matches = [...source.matchAll(/pageSize:\s*(\d+)/g)];
    for (const m of matches) {
      expect(parseInt(m[1]!, 10)).toBeLessThanOrEqual(100);
    }
  });

  it('T14c - edit/page.tsx does not request pageSize > 100 from org endpoints', () => {
    const source = fs.readFileSync(EDIT_PAGE, 'utf-8');
    const matches = [...source.matchAll(/pageSize:\s*(\d+)/g)];
    for (const m of matches) {
      expect(parseInt(m[1]!, 10)).toBeLessThanOrEqual(100);
    }
  });
});

// P2: Frontend pages must detect and expose API failures, not silently swallow them
describe('Error state propagation in server pages', () => {
  it('T15 - new/page.tsx detects deptApiError when dept call is rejected', () => {
    const source = fs.readFileSync(NEW_PAGE, 'utf-8');
    expect(source).toContain('deptApiError');
    expect(source).toMatch(/deptData\.status === .rejected./);
  });

  it('T16 - new/page.tsx passes deptApiError to NewUserForm', () => {
    const source = fs.readFileSync(NEW_PAGE, 'utf-8');
    expect(source).toContain('deptApiError={deptApiError}');
    expect(source).toContain('plantApiError={plantApiError}');
    expect(source).toContain('locApiError={locApiError}');
  });

  it('T17 - edit/page.tsx detects and passes all three org API error flags', () => {
    const source = fs.readFileSync(EDIT_PAGE, 'utf-8');
    expect(source).toContain('deptApiError');
    expect(source).toContain('plantApiError');
    expect(source).toContain('locApiError');
    expect(source).toMatch(/deptData\.status === .rejected./);
  });
});

// P3: RolePermissionSummary warns when role has write permissions
describe('RolePermissionSummary write-permission warning', () => {
  it('T21 - exports getWritePermissions logic (READ_ONLY_SUFFIXES defined)', () => {
    const source = fs.readFileSync(PERM_SUMMARY, 'utf-8');
    expect(source).toContain('READ_ONLY_SUFFIXES');
    expect(source).toContain('.read');
    expect(source).toContain('.comment');
  });

  it('T22 - showWriteWarning prop gates the warning banner', () => {
    const source = fs.readFileSync(PERM_SUMMARY, 'utf-8');
    expect(source).toContain('showWriteWarning');
    expect(source).toContain('role="alert"');
    expect(source).toContain('write permissions');
  });

  it('T23 - both new-user-form and edit-user-tabs pass showWriteWarning', () => {
    const newForm = fs.readFileSync(NEW_FORM, 'utf-8');
    const editTabs = fs.readFileSync(EDIT_TABS, 'utf-8');
    expect(newForm).toContain('showWriteWarning');
    expect(editTabs).toContain('showWriteWarning');
  });
});

// P4: Organization empty-state messages
describe('Organization field empty-state messaging', () => {
  it('T24 - new-user-form shows "No active plants found" for empty plant list', () => {
    const source = fs.readFileSync(NEW_FORM, 'utf-8');
    expect(source).toContain('No active plants found');
  });

  it('T25 - new-user-form shows "Select a plant before assigning a location" when no plant chosen', () => {
    const source = fs.readFileSync(NEW_FORM, 'utf-8');
    expect(source).toContain('Select a plant before assigning a location');
  });

  it('T26 - new-user-form shows "No active locations found for this plant" when plant chosen but no locs', () => {
    const source = fs.readFileSync(NEW_FORM, 'utf-8');
    expect(source).toContain('No active locations found for this plant');
  });

  it('T27 - edit-user-tabs shows all three location/plant empty states', () => {
    const source = fs.readFileSync(EDIT_TABS, 'utf-8');
    expect(source).toContain('No active plants found');
    expect(source).toContain('Select a plant before assigning a location');
    expect(source).toContain('No active locations found for this plant');
  });

  it('T28 - no-dept warning in new-user-form mentions "fails closed"', () => {
    const source = fs.readFileSync(NEW_FORM, 'utf-8');
    expect(source).toContain('fails closed');
  });

  it('T29 - no-dept warning in edit-user-tabs mentions "fails closed"', () => {
    const source = fs.readFileSync(EDIT_TABS, 'utf-8');
    expect(source).toContain('fails closed');
  });
});

// P5: Module access panel Save-disable when SELECTED_DEPARTMENTS and 0 depts chosen
describe('ModuleAccessPanel SELECTED_DEPARTMENTS validation', () => {
  it('T30 - Save button is disabled when noDeptSelected', () => {
    const source = fs.readFileSync(MODULE_PANEL, 'utf-8');
    expect(source).toContain('noDeptSelected');
    expect(source).toContain('disabled={pending || noDeptSelected}');
  });

  it('T31 - inline error message shown when no dept selected', () => {
    const source = fs.readFileSync(MODULE_PANEL, 'utf-8');
    expect(source).toContain('Select at least one department');
  });

  it('T32 - Cancel restores persisted config via cancelEditing()', () => {
    const source = fs.readFileSync(MODULE_PANEL, 'utf-8');
    expect(source).toContain('cancelEditing');
    expect(source).toContain('config.grantedDepartments');
  });

  it('T33 - checkboxes are controlled (checked= not defaultChecked=)', () => {
    const source = fs.readFileSync(MODULE_PANEL, 'utf-8');
    // After the fix, the dept checkboxes use checked={checkedDeptIds.has(dept.id)}
    expect(source).toContain('checked={checkedDeptIds.has(dept.id)}');
    // The old defaultChecked pattern should no longer be used for dept checkboxes in ModuleRow
    expect(source).not.toContain('defaultChecked={config.grantedDepartments');
  });
});

// P2/P7: updateOrgAction must allow clearing (empty string → null), not silently skip
describe('updateOrgAction department clearing', () => {
  it('T18 - sends null for empty departmentId (allows clearing with "— None —")', () => {
    const source = fs.readFileSync(ACTIONS_FILE, 'utf-8');
    expect(source).toContain('departmentId: departmentIdRaw || null');
  });

  it('T19 - updateOrgAction always includes departmentId in payload (never omits it)', () => {
    const source = fs.readFileSync(ACTIONS_FILE, 'utf-8');
    // Extract just the updateOrgAction function body by bounding to the next exported function.
    const start = source.indexOf('async function updateOrgAction');
    const rest = source.slice(start);
    const end = rest.search(/\nexport async function/);
    const fn = end > 0 ? rest.slice(0, end) : rest;
    // The fixed pattern uses `departmentId: departmentIdRaw || null` (no conditional omission).
    expect(fn).toContain('departmentId: departmentIdRaw || null');
  });

  it('T20 - clears plant and location the same way as department', () => {
    const source = fs.readFileSync(ACTIONS_FILE, 'utf-8');
    expect(source).toContain('plantId: plantIdRaw || null');
    expect(source).toContain('locationId: locationIdRaw || null');
  });
});
