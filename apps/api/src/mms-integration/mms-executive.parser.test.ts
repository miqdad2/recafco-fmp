import { describe, it, expect } from 'vitest';
import { emptyExecutiveSections, parseExecutiveSections, parseLinks, safeMmsUrl, MMS_ROUTES } from './mms-executive.parser';

// What MMS itself is reached on / may put in its links (internal), and what users must be sent to (public).
const BASE = 'http://192.168.1.17:81';
const PUB = 'https://maintenance.recafco.online';
const URLS = { publicBase: PUB, internalBase: BASE };

/** The executive sections as MMS (FMP-MAINT-04) sends them, plus a few malformed rows. */
function executiveBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    links: { dashboard: `${BASE}/dashboard`, inventory: `${BASE}/store/offline-inventory` },
    jobCards: {
      totalJobCards: 40, activeJobs: 14, inProgress: 5, closureRequests: 2, completedThisMonth: 9, paused: 1, workingNow: 3,
      openUrl: `${BASE}/maintenance/work-orders`,
    },
    materialsRequests: {
      totalMaterialsRequests: 16, pendingMaterialsRequests: 4, completedMaterialsRequests: 11, jobCardMaterialsRequests: 11,
      generalInventoryRequests: 5, materialsPending: 4, openUrl: `${BASE}/store/parts-requests`,
    },
    inventory: {
      totalMaterials: 22, currentBalance: -3.5, lowStockCount: 21, outOfStockCount: 4, currentStockValueKwd: 250.5,
      receivedThisMonthKwd: 30, issuedThisMonthKwd: 10, openUrl: `${BASE}/store/offline-inventory`,
    },
    assets: {
      totalAssets: 171, assetsAtSite: 2, activeMaintenance: 8, overdueReturn: 1,
      assetTypeBreakdown: [{ type: 'Car', count: 42 }, { type: 'Generator', count: 25 }, { type: '', count: 1 }, { type: 'Bad', count: -1 }],
      openUrl: `${BASE}/assets`,
    },
    vehicleCompliance: {
      vehicleExpiryAlerts: 25, expiringSoon: 4, expiredCount: 21, windowDays: 15, openUrl: `${BASE}/assets/vehicles`,
      topVehicleExpiryAlerts: [
        { assetRef: 'AST-CAR-0012', title: 'Terios (4-9853)', expiryType: 'Registration', expiryDate: '2025-09-29', daysRemaining: -367, overdueDays: 367, openUrl: `${BASE}/assets/v1` },
        { assetRef: 'AST-X', expiryDate: 'soon' },
      ],
    },
    labor: {
      workingNow: 3, pausedWorkers: 1, laborHoursToday: 12.5, laborCostTodayKwd: 25.125, laborHoursThisWeek: 60, laborCostThisWeekKwd: 120,
      openUrl: `${BASE}/maintenance/assignments`,
    },
    managerAttention: {
      needsManagerAttention: 48,
      counts: { closureRequests: 2, vehicleExpiryAlerts: 25, overdueJobs: 0, waitingMaterials: 0, lowStock: 21, unassignedJobs: 0 },
      attentionItems: [
        { type: 'closure_request', ref: 'JC-2', title: 'not working', reason: 'Closure request pending', status: 'Closure Requested', priority: 'Normal', openUrl: `${BASE}/maintenance/work-orders/wo-2` },
        { type: 'low_stock', ref: 'Inventory', title: 'Brake Pads', reason: 'Negative stock', status: null, priority: null, openUrl: 'javascript:alert(1)' },
        { type: 'vehicle_expiry', title: 'no ref' },
      ],
    },
    ...overrides,
  };
}

describe('parseExecutiveSections', () => {
  it('parses every section MMS sends', () => {
    const r = parseExecutiveSections(executiveBody(), URLS);
    expect(r.jobCards).toMatchObject({ totalJobCards: 40, activeJobs: 14, closureRequests: 2, paused: 1, workingNow: 3 });
    expect(r.materialsRequests).toMatchObject({ totalMaterialsRequests: 16, pendingMaterialsRequests: 4, materialsPending: 4 });
    expect(r.inventory).toMatchObject({ totalMaterials: 22, currentBalance: -3.5, lowStockCount: 21, currentStockValueKwd: 250.5 });
    expect(r.assets?.assetTypeBreakdown).toEqual([{ type: 'Car', count: 42 }, { type: 'Generator', count: 25 }]);
    expect(r.vehicleCompliance?.topVehicleExpiryAlerts).toHaveLength(1);
    expect(r.vehicleCompliance?.topVehicleExpiryAlerts[0]).toMatchObject({ assetRef: 'AST-CAR-0012', overdueDays: 367, daysRemaining: -367 });
    expect(r.labor).toMatchObject({ workingNow: 3, laborHoursToday: 12.5, laborCostTodayKwd: 25.125 });
    expect(r.managerAttention?.needsManagerAttention).toBe(48);
    expect(r.managerAttention?.counts.lowStock).toBe(21);
    // A row without a ref is dropped; a javascript: link is replaced by a real MMS route.
    expect(r.managerAttention?.attentionItems.map((i) => i.type)).toEqual(['closure_request', 'low_stock']);
    expect(r.managerAttention?.attentionItems[1]?.openUrl).toBe(`${PUB}/dashboard`);
  });

  it('returns null for every section an older MMS build does not send, with real fallback links', () => {
    const r = parseExecutiveSections({ source: 'MMS_LIVE' }, URLS);
    expect(r).toEqual(emptyExecutiveSections(URLS));
    expect(r.jobCards).toBeNull();
    expect(r.managerAttention).toBeNull();
    expect(r.links.inventory).toBe(`${PUB}/store/offline-inventory`);
    expect(r.links.workerActivity).toBe(`${PUB}/maintenance/assignments`);
  });

  it('nulls only the malformed section and never invents numbers', () => {
    const r = parseExecutiveSections(
      executiveBody({
        jobCards: null,
        inventory: { totalMaterials: 'many', currentBalance: 1, lowStockCount: 2 },
        labor: { workingNow: 1, pausedWorkers: 0, laborHoursToday: 2, laborCostTodayKwd: null },
        assets: 'nope',
      }),
      URLS,
    );
    expect(r.jobCards).toBeNull();
    expect(r.inventory).toBeNull();
    expect(r.assets).toBeNull();
    expect(r.labor).toMatchObject({ workingNow: 1, laborCostTodayKwd: null, laborHoursThisWeek: null });
    expect(r.materialsRequests).not.toBeNull();
  });
});

describe('safeMmsUrl / parseLinks', () => {
  it('puts internal/public/relative links on the public domain and replaces anything else with a real MMS route', () => {
    // internal address → public domain, path kept
    expect(safeMmsUrl(`${BASE}/assets/abc?x=1#top`, '/assets', URLS)).toBe(`${PUB}/assets/abc?x=1#top`);
    // already public → kept; http on the public host is upgraded to the public scheme
    expect(safeMmsUrl(`${PUB}/assets/abc`, '/assets', URLS)).toBe(`${PUB}/assets/abc`);
    expect(safeMmsUrl('http://maintenance.recafco.online/assets/abc', '/assets', URLS)).toBe(`${PUB}/assets/abc`);
    // relative → prefixed with the public domain
    expect(safeMmsUrl('/assets/vehicles?expiring=1', '/assets', URLS)).toBe(`${PUB}/assets/vehicles?expiring=1`);
    // any other domain (incl. look-alikes and protocol-relative), non-http, garbage, missing → fallback route
    expect(safeMmsUrl('http://localhost:3000/assets/abc?x=1', '/assets', URLS)).toBe(`${PUB}/assets`);
    expect(safeMmsUrl('https://maintenance.recafco.online.evil.example/assets/abc', '/assets', URLS)).toBe(`${PUB}/assets`);
    expect(safeMmsUrl('//evil.example/assets', '/assets', URLS)).toBe(`${PUB}/assets`);
    expect(safeMmsUrl('/\\evil.example/assets', '/assets', URLS)).toBe(`${PUB}/assets`);
    expect(safeMmsUrl('javascript:alert(1)', '/assets', URLS)).toBe(`${PUB}/assets`);
    expect(safeMmsUrl('not a url', '/assets', URLS)).toBe(`${PUB}/assets`);
    expect(safeMmsUrl(undefined, '/assets', URLS)).toBe(`${PUB}/assets`);
  });

  it('always returns every link on the public MMS domain', () => {
    const links = parseLinks({ dashboard: 'http://evil.example/dashboard', assets: 42 }, URLS);
    expect(Object.keys(links).sort()).toEqual(Object.keys(MMS_ROUTES).sort());
    for (const url of Object.values(links)) expect(url.startsWith(`${PUB}/`)).toBe(true);
  });
});
