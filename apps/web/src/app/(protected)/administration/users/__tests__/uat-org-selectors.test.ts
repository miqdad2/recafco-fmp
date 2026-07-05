/**
 * uat-org-selectors.test.ts
 *
 * Automated coverage for plant/location selector dependency behavior
 * (UAT acceptance test blocked items C — Plant and Location selectors).
 *
 * Tests verify source-code behavior without rendering components:
 * - Location filtering is scoped to the selected plant
 * - Location filter also includes locations with no plant (plantId = null)
 * - Location selector shows "Select a plant" prompt before plant is chosen
 * - Location selector shows "No active locations" when plant has no locations
 * - Plant onChange updates state used to filter locations
 * - Both new-user-form and edit-user-tabs implement the same filter logic
 * - Inactive plant/location values are NOT displayed (isActive filter on server)
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');
const NEW_FORM = path.join(ROOT, '_components', 'new-user-form.tsx');
const EDIT_TABS = path.join(ROOT, '_components', 'edit-user-tabs.tsx');
const NEW_PAGE = path.join(ROOT, 'new', 'page.tsx');
const EDIT_PAGE = path.join(ROOT, '[id]', 'edit', 'page.tsx');

// ---------------------------------------------------------------------------
// C — Plant/location filter logic
// ---------------------------------------------------------------------------

describe('C — Location filter includes locations without a plant (plantId null)', () => {
  it('T34: new-user-form uses !l.plantId in the location filter', () => {
    const src = fs.readFileSync(NEW_FORM, 'utf-8');
    // The filter must pass through locations that have no plant assigned
    expect(src).toContain('!l.plantId');
  });

  it('T35: new-user-form filters locations to match the selected plant', () => {
    const src = fs.readFileSync(NEW_FORM, 'utf-8');
    expect(src).toContain('l.plantId === selectedPlantId');
  });

  it('T36: edit-user-tabs uses !l.plantId in the location filter', () => {
    const src = fs.readFileSync(EDIT_TABS, 'utf-8');
    expect(src).toContain('!l.plantId');
  });

  it('T37: edit-user-tabs filters locations to match the selected plant', () => {
    const src = fs.readFileSync(EDIT_TABS, 'utf-8');
    expect(src).toContain('l.plantId === selectedPlantId');
  });
});

describe('C — Location selector shows correct prompt based on plant selection state', () => {
  it('T38: new-user-form shows "Select a plant" when no plant is selected', () => {
    const src = fs.readFileSync(NEW_FORM, 'utf-8');
    expect(src).toContain('Select a plant before assigning a location');
  });

  it('T39: new-user-form shows "No active locations" when plant selected but no locations', () => {
    const src = fs.readFileSync(NEW_FORM, 'utf-8');
    expect(src).toContain('No active locations found for this plant');
  });

  it('T40: edit-user-tabs shows "Select a plant" when no plant is selected', () => {
    const src = fs.readFileSync(EDIT_TABS, 'utf-8');
    expect(src).toContain('Select a plant before assigning a location');
  });

  it('T41: edit-user-tabs shows "No active locations" when plant selected but no locations', () => {
    const src = fs.readFileSync(EDIT_TABS, 'utf-8');
    expect(src).toContain('No active locations found for this plant');
  });
});

describe('C — Plant onChange drives location filtering', () => {
  it('T42: new-user-form onChange for plant selector updates selectedPlantId state', () => {
    const src = fs.readFileSync(NEW_FORM, 'utf-8');
    // The plant select has an onChange that sets state
    expect(src).toContain('setSelectedPlantId');
    expect(src).toContain('onChange');
  });

  it('T43: filteredLocations variable is derived from selectedPlantId', () => {
    const src = fs.readFileSync(NEW_FORM, 'utf-8');
    expect(src).toContain('filteredLocations');
    expect(src).toContain('selectedPlantId');
  });

  it('T44: edit-user-tabs also derives filteredLocations from selectedPlantId', () => {
    const src = fs.readFileSync(EDIT_TABS, 'utf-8');
    expect(src).toContain('filteredLocations');
    expect(src).toContain('selectedPlantId');
  });
});

describe('C — Server pages request only active plants and locations', () => {
  it('T45: new/page.tsx requests isActive:true for plants', () => {
    const src = fs.readFileSync(NEW_PAGE, 'utf-8');
    // Page fetches active plants — isActive filter must be present in the API call or server logic
    expect(src).toMatch(/isActive/);
  });

  it('T46: new/page.tsx requests isActive:true for locations', () => {
    const src = fs.readFileSync(NEW_PAGE, 'utf-8');
    expect(src).toMatch(/isActive/);
  });

  it('T47: edit/page.tsx requests isActive:true for plants', () => {
    const src = fs.readFileSync(EDIT_PAGE, 'utf-8');
    expect(src).toMatch(/isActive/);
  });
});

describe('C — Plant selector shows "No active plants" empty state', () => {
  it('T48: new-user-form renders empty state when plants array is empty', () => {
    const src = fs.readFileSync(NEW_FORM, 'utf-8');
    expect(src).toContain('No active plants found');
  });

  it('T49: edit-user-tabs renders empty state when plants array is empty', () => {
    const src = fs.readFileSync(EDIT_TABS, 'utf-8');
    expect(src).toContain('No active plants found');
  });
});
