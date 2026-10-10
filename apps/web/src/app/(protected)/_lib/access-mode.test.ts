import { describe, it, expect } from 'vitest';
import {
  ACCESS_MODE_LABELS,
  MODULE_DISPLAY_NAMES,
  contractRelatedLinks,
  deriveAccessMode,
  getLandingPath,
  getSidebarLayout,
  relatedWorkflowsFor,
  shouldShowReadOnlyBanner,
} from './access-mode';
import { canSeeModule } from './module-visibility';

// Permission shapes mirror the seeded roles (see module-visibility.test.ts).
const CONTRACT_MANAGER = ['contracts.read', 'contracts.update', 'contracts.create'];
const CONTRACT_STAFF = ['contracts.read', 'contracts.workflow_update'];
const PRODUCTION_ONLY = ['production.read', 'production.update'];
const TWO_MODULES = ['contracts.read', 'safety.read'];
const EXECUTIVE = [
  'contracts.read', 'tasks.read', 'incidents.read', 'maintenance.read', 'safety.read', 'production.read',
  'contracts.update', 'tasks.update',
];
const ADMIN = ['users.read', 'roles.read', 'org.departments.read', ...EXECUTIVE];
const SUPER_ADMIN_ONLY_ADMIN = ['users.read', 'roles.read'];

describe('deriveAccessMode', () => {
  it('Contract Manager is Single Module Access with Contract Management as the primary module', () => {
    const info = deriveAccessMode(CONTRACT_MANAGER);
    expect(info.mode).toBe('SINGLE_MODULE');
    expect(info.primaryModule).toBe('CONTRACTS_MANAGEMENT');
    expect(info.fullPlatformSource).toBeNull();
    expect(info.hasAdministration).toBe(false);
  });

  it('Executive Manager shape is Full Platform Access from the role', () => {
    const info = deriveAccessMode(EXECUTIVE);
    expect(info.mode).toBe('FULL_PLATFORM');
    expect(info.fullPlatformSource).toBe('role');
  });

  it('Admin is Full Platform Access from the role and reports Administration', () => {
    const info = deriveAccessMode(ADMIN);
    expect(info.mode).toBe('FULL_PLATFORM');
    expect(info.hasAdministration).toBe(true);
  });

  it('explicit Full Platform Access turns a Contract Manager into Full Platform without adding permissions', () => {
    const info = deriveAccessMode(CONTRACT_MANAGER, true);
    expect(info.mode).toBe('FULL_PLATFORM');
    expect(info.fullPlatformSource).toBe('explicit');
    // Visibility is still permission-driven: still only Contract Management, and no Administration.
    expect(info.modules).toEqual(['CONTRACTS_MANAGEMENT']);
    expect(info.hasAdministration).toBe(false);
  });

  it('Full Platform Access does not make anyone an administrator', () => {
    expect(deriveAccessMode(PRODUCTION_ONLY, true).hasAdministration).toBe(false);
    expect(deriveAccessMode(SUPER_ADMIN_ONLY_ADMIN, false).hasAdministration).toBe(true);
  });

  it('two selected modules is Multi-Module Access and lists only those modules', () => {
    const info = deriveAccessMode(TWO_MODULES);
    expect(info.mode).toBe('MULTI_MODULE');
    expect(info.primaryModule).toBeNull();
    expect(info.modules).toEqual(['SAFETY_COMPLIANCE', 'CONTRACTS_MANAGEMENT']);
  });

  it('the explicit flag is ignored unless true', () => {
    expect(deriveAccessMode(CONTRACT_MANAGER, false).mode).toBe('SINGLE_MODULE');
  });
});

describe('getLandingPath', () => {
  it('Contract Manager and Contract Staff land on the Contract Management Dashboard', () => {
    expect(getLandingPath(CONTRACT_MANAGER)).toBe('/contracts/dashboard');
    expect(getLandingPath(CONTRACT_STAFF)).toBe('/contracts/dashboard');
  });

  it('a Production-only user lands on the Production & Planning Dashboard', () => {
    expect(getLandingPath(PRODUCTION_ONLY)).toBe('/production/dashboard');
  });

  it('every single-module user lands on their own module dashboard', () => {
    expect(getLandingPath(['tasks.read'])).toBe('/factory-tasks/dashboard');
    expect(getLandingPath(['incidents.read'])).toBe('/incidents/dashboard');
    expect(getLandingPath(['maintenance.read'])).toBe('/maintenance/dashboard');
    expect(getLandingPath(['safety.read'])).toBe('/safety-compliance/dashboard');
  });

  it('Executive Manager, Admin, Full Platform and Multi-Module users stay on the Control Center', () => {
    expect(getLandingPath(EXECUTIVE)).toBe('/dashboard');
    expect(getLandingPath(ADMIN)).toBe('/dashboard');
    expect(getLandingPath(CONTRACT_MANAGER, true)).toBe('/dashboard');
    expect(getLandingPath(TWO_MODULES)).toBe('/dashboard');
  });
});

describe('getSidebarLayout', () => {
  it('Executive Manager keeps the executive sidebar', () => {
    expect(getSidebarLayout(EXECUTIVE)).toBe('EXECUTIVE');
  });

  it('Contract Manager with Single Module Access gets the Contract Management group + Related Workflows layout', () => {
    expect(getSidebarLayout(CONTRACT_MANAGER)).toBe('CONTRACT_SINGLE_MODULE');
  });

  it('another single-module user gets a one-module sidebar', () => {
    expect(getSidebarLayout(PRODUCTION_ONLY)).toBe('SINGLE_MODULE');
  });

  it('Full Platform Access, Multi-Module and Admin users get the main sidebar', () => {
    expect(getSidebarLayout(CONTRACT_MANAGER, true)).toBe('MAIN');
    expect(getSidebarLayout(TWO_MODULES)).toBe('MAIN');
    expect(getSidebarLayout(ADMIN)).toBe('MAIN');
  });
});

describe('Contract Management Related Workflows', () => {
  const labels = (perms: string[]) => contractRelatedLinks(perms).map((l) => l.label);
  const FULL_FLOW = [...CONTRACT_MANAGER, 'production.read', 'storage_delivery.read', 'erection.read', 'tasks.read'];

  it('Contract Manager (contracts.* only) sees Technical, Erection and Advanced Planning with the same links as before', () => {
    expect(contractRelatedLinks(CONTRACT_MANAGER)).toEqual([
      { label: 'Technical', href: '/technical' },
      { label: 'Erection', href: '/contracts/erection-dashboard' },
      { label: 'Advanced Planning', href: '/contracts/schedule' },
    ]);
  });

  it('Production & Planning appears only with production.read, and Storage Yard & Delivery only with storage_delivery.read', () => {
    expect(labels(CONTRACT_MANAGER)).not.toContain('Production & Planning');
    expect(labels(CONTRACT_MANAGER)).not.toContain('Storage Yard & Delivery');
    expect(labels([...CONTRACT_MANAGER, 'production.read'])).toContain('Production & Planning');
    expect(labels([...CONTRACT_MANAGER, 'storage_delivery.read'])).toContain('Storage Yard & Delivery');
  });

  it('follows the contract execution flow: Technical, Production & Planning, Storage Yard & Delivery, Erection, Advanced Planning', () => {
    expect(labels(FULL_FLOW)).toEqual([
      'Technical',
      'Production & Planning',
      'Storage Yard & Delivery',
      'Erection',
      'Piece Erection',
      'Task Management',
      'Advanced Planning',
    ]);
  });

  it('uses the existing routes', () => {
    const byLabel = Object.fromEntries(contractRelatedLinks(FULL_FLOW).map((l) => [l.label, l.href]));
    expect(byLabel['Production & Planning']).toBe('/production/dashboard');
    expect(byLabel['Storage Yard & Delivery']).toBe('/storage-delivery/pieces');
    expect(byLabel['Technical']).toBe('/technical');
  });

  it('never uses the old labels', () => {
    const all = labels(FULL_FLOW);
    for (const old of ['Production Dashboard', 'Storage Yard', 'Delivery']) expect(all).not.toContain(old);
  });

  it('Executive Manager, Viewer-shaped and Full Platform layouts are unaffected by the related list', () => {
    expect(getSidebarLayout(EXECUTIVE)).toBe('EXECUTIVE');
    expect(getSidebarLayout(['contracts.read', 'tasks.read', 'incidents.read', 'maintenance.read', 'safety.read', 'production.read'])).toBe('EXECUTIVE');
    expect(getSidebarLayout(CONTRACT_MANAGER, true)).toBe('MAIN');
  });

  it('a Contract Manager who also holds production.read is Multi-Module (main sidebar), not Single Module', () => {
    expect(getSidebarLayout([...CONTRACT_MANAGER, 'production.read'])).toBe('MAIN');
  });

  it('no unrelated module (Safety, Production, Maintenance…) is ever in the related list', () => {
    const labels = contractRelatedLinks([...CONTRACT_MANAGER, 'storage_delivery.read', 'erection.read']).map((l) => l.label);
    for (const unrelated of ['Safety & Compliance', 'Production & Planning', 'Maintenance Management', 'Task Management', 'Incident Management']) {
      expect(labels).not.toContain(unrelated);
    }
  });

  it('relatedWorkflowsFor only returns names for Contract Management', () => {
    expect(relatedWorkflowsFor('CONTRACTS_MANAGEMENT')).toEqual(['Technical', 'Erection', 'Advanced Planning']);
    expect(relatedWorkflowsFor('PRODUCTION_DASHBOARD')).toEqual([]);
    expect(relatedWorkflowsFor(null)).toEqual([]);
  });
});

describe('module labels', () => {
  it('uses the modern names and none of the old ones', () => {
    const all = Object.values(MODULE_DISPLAY_NAMES);
    expect(all).toContain('Task Management');
    expect(all).toContain('Maintenance Management');
    expect(all).toContain('Production & Planning');
    for (const old of ['Factory Tasks Management', 'Maintenance Requests', 'Production Dashboard']) {
      expect(all).not.toContain(old);
    }
  });

  it('names the three access modes clearly', () => {
    expect(Object.values(ACCESS_MODE_LABELS)).toEqual(['Single Module Access', 'Multi-Module Access', 'Full Platform Access']);
  });
});

// FMP-ACCESS-01C — what the API hands the web for a Full Platform Access user: the role's own
// permissions plus the read-only module codes (see apps/api/src/common/full-platform-access.ts).
const FPA_READS = [
  'contracts.read', 'production.read', 'storage_delivery.read', 'erection.read',
  'tasks.read', 'incidents.read', 'maintenance.read', 'safety.read',
];
const CM_WITH_FPA = [...new Set([...CONTRACT_MANAGER, ...FPA_READS])];

describe('Full Platform Access (FMP-ACCESS-01C)', () => {
  it('a Contract Manager with Full Platform Access sees every module and lands on the Control Center', () => {
    for (const m of ['CONTRACTS_MANAGEMENT', 'PRODUCTION_DASHBOARD', 'FACTORY_TASKS', 'SAFETY_COMPLIANCE', 'INCIDENT_REPORT', 'MAINTENANCE_REQUESTS'] as const) {
      expect(canSeeModule(CM_WITH_FPA, m)).toBe(true);
    }
    expect(CM_WITH_FPA).toContain('storage_delivery.read');
    expect(getLandingPath(CM_WITH_FPA, true)).toBe('/dashboard');
    expect(deriveAccessMode(CM_WITH_FPA, true).mode).toBe('FULL_PLATFORM');
  });

  it('gets the full platform sidebar, as the Executive Manager does', () => {
    expect(getSidebarLayout(CM_WITH_FPA, true)).toBe('EXECUTIVE');
    expect(getSidebarLayout(EXECUTIVE)).toBe('EXECUTIVE');
  });

  it('does not show Administration, and does not gain any write or admin permission', () => {
    expect(canSeeModule(CM_WITH_FPA, 'ADMINISTRATION')).toBe(false);
    expect(deriveAccessMode(CM_WITH_FPA, true).hasAdministration).toBe(false);
    for (const p of ['production.update', 'storage_delivery.update', 'erection.update', 'tasks.create', 'tasks.manage', 'contracts.manage', 'users.read']) {
      expect(CM_WITH_FPA).not.toContain(p);
    }
  });

  it('a Full Platform Access user who also has admin permissions keeps the main sidebar with Administration', () => {
    const perms = [...CM_WITH_FPA, 'users.read'];
    expect(getSidebarLayout(perms, true)).toBe('MAIN');
    expect(deriveAccessMode(perms, true).hasAdministration).toBe(true);
  });

  it('a Contract Manager without the flag stays focused on Contract Management', () => {
    expect(getSidebarLayout(CONTRACT_MANAGER, false)).toBe('CONTRACT_SINGLE_MODULE');
    expect(getLandingPath(CONTRACT_MANAGER, false)).toBe('/contracts/dashboard');
    expect(canSeeModule(CONTRACT_MANAGER, 'PRODUCTION_DASHBOARD')).toBe(false);
  });
});

describe('read-only banner', () => {
  it('shows for a Full Platform user on a module page where the role has no write permission', () => {
    expect(shouldShowReadOnlyBanner('/production/dashboard', CM_WITH_FPA, true)).toBe(true);
    expect(shouldShowReadOnlyBanner('/storage-delivery/pieces', CM_WITH_FPA, true)).toBe(true);
    expect(shouldShowReadOnlyBanner('/factory-tasks/dashboard', CM_WITH_FPA, true)).toBe(true);
  });

  it('does not show where the role can write (Contract Manager on contracts), or without the flag, or off module pages', () => {
    expect(shouldShowReadOnlyBanner('/contracts/dashboard', CM_WITH_FPA, true)).toBe(false);
    expect(shouldShowReadOnlyBanner('/production/dashboard', CM_WITH_FPA, false)).toBe(false);
    expect(shouldShowReadOnlyBanner('/dashboard', CM_WITH_FPA, true)).toBe(false);
    expect(shouldShowReadOnlyBanner('/production/executive', CM_WITH_FPA, true)).toBe(false);
  });

  it('does not show on a module where the role holds a write permission', () => {
    expect(shouldShowReadOnlyBanner('/production/dashboard', [...CM_WITH_FPA, 'production.update'], true)).toBe(false);
  });
});
