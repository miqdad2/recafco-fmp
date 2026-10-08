import { describe, it, expect } from 'vitest';
import { canSeeModule } from './module-visibility';
import {
  MODULE_DISPLAY_NAMES,
  contractRelatedLinks,
  deriveAccessMode,
  getLandingPath,
  getSidebarLayout,
  shouldShowReadOnlyBanner,
} from './access-mode';

const TECHNICAL_STAFF = ['technical.read', 'technical.update'];
const TECHNICAL_MANAGER = ['technical.read', 'technical.update', 'technical.manage'];
const CONTRACT_MANAGER = ['contracts.read', 'contracts.update', 'contracts.create'];
const EXECUTIVE = ['contracts.read', 'tasks.read', 'incidents.read', 'maintenance.read', 'safety.read', 'production.read'];
// What the API hands the web for a Full Platform Access Contract Manager (role + read overlay).
const CM_WITH_FPA = [...CONTRACT_MANAGER, 'technical.read', 'production.read', 'storage_delivery.read', 'erection.read', 'tasks.read', 'incidents.read', 'maintenance.read', 'safety.read'];

describe('Technical module access (FMP-ACCESS-02)', () => {
  it('a Technical-only user is Single Module Access with Technical as the primary module', () => {
    const info = deriveAccessMode(TECHNICAL_STAFF);
    expect(info.mode).toBe('SINGLE_MODULE');
    expect(info.primaryModule).toBe('TECHNICAL');
    expect(info.modules).toEqual(['TECHNICAL']);
    expect(info.hasAdministration).toBe(false);
  });

  it('lands on the Technical dashboard, not the Contract Management Dashboard', () => {
    expect(getLandingPath(TECHNICAL_STAFF)).toBe('/technical');
    expect(getLandingPath(TECHNICAL_MANAGER)).toBe('/technical');
  });

  it('sidebar is the one-module Technical workspace, not the Contract Management workspace', () => {
    expect(getSidebarLayout(TECHNICAL_STAFF)).toBe('SINGLE_MODULE');
    expect(canSeeModule(TECHNICAL_STAFF, 'CONTRACTS_MANAGEMENT')).toBe(false);
    expect(canSeeModule(TECHNICAL_STAFF, 'TECHNICAL')).toBe(true);
    expect(MODULE_DISPLAY_NAMES.TECHNICAL).toBe('Technical');
  });

  it('Contract Manager still reaches Technical under Related Workflows and stays Contract Management single-module', () => {
    expect(getSidebarLayout(CONTRACT_MANAGER)).toBe('CONTRACT_SINGLE_MODULE');
    expect(getLandingPath(CONTRACT_MANAGER)).toBe('/contracts/dashboard');
    expect(contractRelatedLinks(CONTRACT_MANAGER)[0]).toEqual({ label: 'Technical', href: '/technical' });
    expect(deriveAccessMode(CONTRACT_MANAGER).primaryModule).toBe('CONTRACTS_MANAGEMENT');
  });

  it('Full Platform Access still shows Technical (technical.read comes with the read overlay)', () => {
    expect(canSeeModule(CM_WITH_FPA, 'TECHNICAL')).toBe(true);
    expect(getSidebarLayout(CM_WITH_FPA, true)).toBe('EXECUTIVE');
    expect(getLandingPath(CM_WITH_FPA, true)).toBe('/dashboard');
  });

  it('Executive Manager keeps the executive sidebar with or without the Technical permissions', () => {
    expect(getSidebarLayout(EXECUTIVE)).toBe('EXECUTIVE');
    expect(getSidebarLayout([...EXECUTIVE, ...TECHNICAL_MANAGER])).toBe('EXECUTIVE');
  });

  it('a user holding both Technical and Contract Management is Multi-Module', () => {
    expect(deriveAccessMode([...CONTRACT_MANAGER, ...TECHNICAL_STAFF]).mode).toBe('MULTI_MODULE');
  });

  it('read-only banner on Technical pages: shown for read-only Full Platform users, hidden when they can update', () => {
    expect(shouldShowReadOnlyBanner('/technical', ['technical.read'], true)).toBe(true);
    expect(shouldShowReadOnlyBanner('/technical', TECHNICAL_STAFF, true)).toBe(false);
    expect(shouldShowReadOnlyBanner('/technical', CM_WITH_FPA, true)).toBe(false);
  });
});
