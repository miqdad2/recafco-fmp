// ---------------------------------------------------------------------------
// FMP-MAINT-04 — validation/sanitization of the executive-summary sections
// MMS adds to its live dashboard payload (job cards, materials requests,
// inventory, assets, vehicle compliance, labor, manager attention, links).
//
// Every section is optional: an MMS build that predates FMP-MAINT-04 simply
// doesn't send them, and MMS returns `null` for a section it could not
// compute. Either way the section is `null` here and the web shows "Not
// available from MMS live API yet" — a section is never invented or
// defaulted to zeros. Each section is validated on its own, so one
// malformed section cannot take the others (or the base dashboard) down.
// MMS is a separate system: nothing about its shape is trusted.
// ---------------------------------------------------------------------------

export interface MmsLinks {
  dashboard: string;
  jobCards: string;
  materialsRequests: string;
  inventory: string;
  assets: string;
  vehicles: string;
  workerActivity: string;
  dailyActivity: string;
}

export interface MmsJobCardsSection {
  totalJobCards: number;
  activeJobs: number;
  inProgress: number;
  closureRequests: number;
  completedThisMonth: number;
  paused: number | null;
  workingNow: number | null;
  openUrl: string;
}

export interface MmsMaterialsRequestsSection {
  totalMaterialsRequests: number;
  pendingMaterialsRequests: number;
  completedMaterialsRequests: number;
  jobCardMaterialsRequests: number | null;
  generalInventoryRequests: number | null;
  materialsPending: number;
  openUrl: string;
}

export interface MmsInventorySection {
  totalMaterials: number;
  /** Sum of unit balances across materials — may be fractional, and negative if MMS holds negative stock. */
  currentBalance: number;
  lowStockCount: number;
  outOfStockCount: number | null;
  /** null = MMS did not send cost figures (withheld or unavailable). */
  currentStockValueKwd: number | null;
  receivedThisMonthKwd: number | null;
  issuedThisMonthKwd: number | null;
  openUrl: string;
}

export interface MmsAssetsSection {
  totalAssets: number;
  assetsAtSite: number;
  activeMaintenance: number;
  overdueReturn: number;
  assetTypeBreakdown: { type: string; count: number }[];
  openUrl: string;
}

export interface MmsVehicleExpiryAlert {
  assetRef: string;
  title: string;
  expiryType: string;
  /** YYYY-MM-DD */
  expiryDate: string;
  /** Negative when already expired. */
  daysRemaining: number | null;
  overdueDays: number;
  openUrl: string;
}

export interface MmsVehicleComplianceSection {
  vehicleExpiryAlerts: number;
  expiringSoon: number;
  expiredCount: number;
  windowDays: number | null;
  topVehicleExpiryAlerts: MmsVehicleExpiryAlert[];
  openUrl: string;
}

export interface MmsLaborSection {
  workingNow: number;
  pausedWorkers: number;
  laborHoursToday: number;
  laborCostTodayKwd: number | null;
  laborHoursThisWeek: number | null;
  laborCostThisWeekKwd: number | null;
  openUrl: string;
}

export interface MmsManagerAttentionItem {
  type: string;
  ref: string;
  title: string;
  reason: string;
  status: string | null;
  priority: string | null;
  openUrl: string;
}

export interface MmsManagerAttentionSection {
  needsManagerAttention: number;
  counts: {
    closureRequests: number | null;
    vehicleExpiryAlerts: number | null;
    overdueJobs: number | null;
    waitingMaterials: number | null;
    lowStock: number | null;
    unassignedJobs: number | null;
  };
  attentionItems: MmsManagerAttentionItem[];
}

export interface MmsExecutiveSections {
  links: MmsLinks;
  jobCards: MmsJobCardsSection | null;
  materialsRequests: MmsMaterialsRequestsSection | null;
  inventory: MmsInventorySection | null;
  assets: MmsAssetsSection | null;
  vehicleCompliance: MmsVehicleComplianceSection | null;
  labor: MmsLaborSection | null;
  managerAttention: MmsManagerAttentionSection | null;
}

/** Real MMS routes (MMS components/layout/app-layout.tsx). Used when MMS sends no link, or one that fails validation. */
export const MMS_ROUTES: Record<keyof MmsLinks, string> = {
  dashboard: '/dashboard',
  jobCards: '/maintenance/work-orders',
  materialsRequests: '/store/parts-requests',
  inventory: '/store/offline-inventory',
  assets: '/assets',
  vehicles: '/assets/vehicles',
  workerActivity: '/maintenance/assignments',
  dailyActivity: '/maintenance/daily-activity',
};

const MAX_VEHICLE_ALERTS = 5;
const MAX_ATTENTION_ITEMS = 10;
const MAX_ASSET_TYPES = 12;
const MAX_TEXT = 200;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim().slice(0, MAX_TEXT) : null);
const count = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const amount = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

/**
 * FMP-MAINT-06 — the two MMS addresses.
 * - `internalBase` (MMS_BASE_URL): where the FMP API calls MMS. Never shown to users.
 * - `publicBase` (MMS_PUBLIC_BASE_URL): where users open MMS. Every link FMP returns is on this origin.
 */
export interface MmsUrlBases {
  publicBase: string;
  internalBase: string;
}

/**
 * Turns a link from MMS into one a user may click — always on the PUBLIC
 * MMS origin:
 * - a relative path ("/assets/vehicles") is prefixed with the public base;
 * - an absolute link already on the public host is kept (scheme forced to the public one);
 * - an absolute link on the INTERNAL host (LAN IP/port) keeps its path on the public base;
 * - anything else — another domain, `javascript:`, garbage, missing — is
 *   ignored and replaced by `fallbackPath` on the public base.
 * The internal address therefore never reaches the browser, and an MMS
 * payload can never point a user at a third-party site.
 */
export function safeMmsUrl(raw: unknown, fallbackPath: string, urls: MmsUrlBases): string {
  const pub = new URL(urls.publicBase);
  const internal = new URL(urls.internalBase);
  const onPublic = (pathAndMore: string): string => new URL(pathAndMore, pub.origin).toString();

  if (typeof raw === 'string') {
    const value = raw.trim();
    // Relative path (but not protocol-relative "//host" or a backslash trick).
    if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) {
      return onPublic(value);
    }
    try {
      const u = new URL(value);
      const isHttp = u.protocol === 'http:' || u.protocol === 'https:';
      if (isHttp && (u.host === pub.host || u.host === internal.host)) {
        return onPublic(`${u.pathname}${u.search}${u.hash}`);
      }
    } catch {
      // fall through
    }
  }
  return onPublic(fallbackPath);
}

export function parseLinks(v: unknown, urls: MmsUrlBases): MmsLinks {
  const src = isObj(v) ? v : {};
  const out = {} as MmsLinks;
  for (const key of Object.keys(MMS_ROUTES) as (keyof MmsLinks)[]) {
    out[key] = safeMmsUrl(src[key], MMS_ROUTES[key], urls);
  }
  return out;
}

function parseJobCards(v: unknown, urls: MmsUrlBases): MmsJobCardsSection | null {
  if (!isObj(v)) return null;
  const totalJobCards = count(v['totalJobCards']);
  const activeJobs = count(v['activeJobs']);
  const inProgress = count(v['inProgress']);
  const closureRequests = count(v['closureRequests']);
  const completedThisMonth = count(v['completedThisMonth']);
  if (totalJobCards === null || activeJobs === null || inProgress === null || closureRequests === null || completedThisMonth === null) return null;
  return {
    totalJobCards,
    activeJobs,
    inProgress,
    closureRequests,
    completedThisMonth,
    paused: count(v['paused']),
    workingNow: count(v['workingNow']),
    openUrl: safeMmsUrl(v['openUrl'], MMS_ROUTES.jobCards, urls),
  };
}

function parseMaterialsRequests(v: unknown, urls: MmsUrlBases): MmsMaterialsRequestsSection | null {
  if (!isObj(v)) return null;
  const total = count(v['totalMaterialsRequests']);
  const pending = count(v['pendingMaterialsRequests']);
  const completed = count(v['completedMaterialsRequests']);
  const materialsPending = count(v['materialsPending']);
  if (total === null || pending === null || completed === null || materialsPending === null) return null;
  return {
    totalMaterialsRequests: total,
    pendingMaterialsRequests: pending,
    completedMaterialsRequests: completed,
    jobCardMaterialsRequests: count(v['jobCardMaterialsRequests']),
    generalInventoryRequests: count(v['generalInventoryRequests']),
    materialsPending,
    openUrl: safeMmsUrl(v['openUrl'], MMS_ROUTES.materialsRequests, urls),
  };
}

function parseInventory(v: unknown, urls: MmsUrlBases): MmsInventorySection | null {
  if (!isObj(v)) return null;
  const totalMaterials = count(v['totalMaterials']);
  const currentBalance = num(v['currentBalance']);
  const lowStockCount = count(v['lowStockCount']);
  if (totalMaterials === null || currentBalance === null || lowStockCount === null) return null;
  return {
    totalMaterials,
    currentBalance,
    lowStockCount,
    outOfStockCount: count(v['outOfStockCount']),
    currentStockValueKwd: amount(v['currentStockValueKwd']),
    receivedThisMonthKwd: amount(v['receivedThisMonthKwd']),
    issuedThisMonthKwd: amount(v['issuedThisMonthKwd']),
    openUrl: safeMmsUrl(v['openUrl'], MMS_ROUTES.inventory, urls),
  };
}

function parseAssets(v: unknown, urls: MmsUrlBases): MmsAssetsSection | null {
  if (!isObj(v)) return null;
  const totalAssets = count(v['totalAssets']);
  const assetsAtSite = count(v['assetsAtSite']);
  const activeMaintenance = count(v['activeMaintenance']);
  const overdueReturn = count(v['overdueReturn']);
  if (totalAssets === null || assetsAtSite === null || activeMaintenance === null || overdueReturn === null) return null;
  const breakdown = (Array.isArray(v['assetTypeBreakdown']) ? v['assetTypeBreakdown'] : [])
    .flatMap((row): { type: string; count: number }[] => {
      if (!isObj(row)) return [];
      const type = text(row['type']);
      const n = count(row['count']);
      return type && n !== null ? [{ type, count: n }] : [];
    })
    .slice(0, MAX_ASSET_TYPES);
  return { totalAssets, assetsAtSite, activeMaintenance, overdueReturn, assetTypeBreakdown: breakdown, openUrl: safeMmsUrl(v['openUrl'], MMS_ROUTES.assets, urls) };
}

function parseVehicleCompliance(v: unknown, urls: MmsUrlBases): MmsVehicleComplianceSection | null {
  if (!isObj(v)) return null;
  const vehicleExpiryAlerts = count(v['vehicleExpiryAlerts']);
  const expiringSoon = count(v['expiringSoon']);
  const expiredCount = count(v['expiredCount']);
  if (vehicleExpiryAlerts === null || expiringSoon === null || expiredCount === null) return null;
  const top = (Array.isArray(v['topVehicleExpiryAlerts']) ? v['topVehicleExpiryAlerts'] : [])
    .flatMap((row): MmsVehicleExpiryAlert[] => {
      if (!isObj(row)) return [];
      const assetRef = text(row['assetRef']);
      const expiryDate = text(row['expiryDate']);
      if (!assetRef || !expiryDate || !/^\d{4}-\d{2}-\d{2}/.test(expiryDate)) return [];
      const days = num(row['daysRemaining']);
      return [
        {
          assetRef,
          title: text(row['title']) ?? assetRef,
          expiryType: text(row['expiryType']) ?? 'Document',
          expiryDate: expiryDate.slice(0, 10),
          daysRemaining: days === null ? null : Math.trunc(days),
          overdueDays: count(row['overdueDays']) ?? 0,
          openUrl: safeMmsUrl(row['openUrl'], MMS_ROUTES.vehicles, urls),
        },
      ];
    })
    .slice(0, MAX_VEHICLE_ALERTS);
  return {
    vehicleExpiryAlerts,
    expiringSoon,
    expiredCount,
    windowDays: count(v['windowDays']),
    topVehicleExpiryAlerts: top,
    openUrl: safeMmsUrl(v['openUrl'], MMS_ROUTES.vehicles, urls),
  };
}

function parseLabor(v: unknown, urls: MmsUrlBases): MmsLaborSection | null {
  if (!isObj(v)) return null;
  const workingNow = count(v['workingNow']);
  const pausedWorkers = count(v['pausedWorkers']);
  const laborHoursToday = amount(v['laborHoursToday']);
  if (workingNow === null || pausedWorkers === null || laborHoursToday === null) return null;
  return {
    workingNow,
    pausedWorkers,
    laborHoursToday,
    laborCostTodayKwd: amount(v['laborCostTodayKwd']),
    laborHoursThisWeek: amount(v['laborHoursThisWeek']),
    laborCostThisWeekKwd: amount(v['laborCostThisWeekKwd']),
    openUrl: safeMmsUrl(v['openUrl'], MMS_ROUTES.workerActivity, urls),
  };
}

function parseManagerAttention(v: unknown, urls: MmsUrlBases): MmsManagerAttentionSection | null {
  if (!isObj(v)) return null;
  const needsManagerAttention = count(v['needsManagerAttention']);
  if (needsManagerAttention === null) return null;
  const c = isObj(v['counts']) ? v['counts'] : {};
  const items = (Array.isArray(v['attentionItems']) ? v['attentionItems'] : [])
    .flatMap((row): MmsManagerAttentionItem[] => {
      if (!isObj(row)) return [];
      const type = text(row['type']);
      const ref = text(row['ref']);
      const title = text(row['title']);
      if (!type || !ref || !title) return [];
      return [
        {
          type,
          ref,
          title,
          reason: text(row['reason']) ?? '',
          status: text(row['status']),
          priority: text(row['priority']),
          openUrl: safeMmsUrl(row['openUrl'], MMS_ROUTES.dashboard, urls),
        },
      ];
    })
    .slice(0, MAX_ATTENTION_ITEMS);
  return {
    needsManagerAttention,
    counts: {
      closureRequests: count(c['closureRequests']),
      vehicleExpiryAlerts: count(c['vehicleExpiryAlerts']),
      overdueJobs: count(c['overdueJobs']),
      waitingMaterials: count(c['waitingMaterials']),
      lowStock: count(c['lowStock']),
      unassignedJobs: count(c['unassignedJobs']),
    },
    attentionItems: items,
  };
}

export function parseExecutiveSections(body: Record<string, unknown>, urls: MmsUrlBases): MmsExecutiveSections {
  const links = parseLinks(body['links'], urls);
  return {
    links,
    jobCards: parseJobCards(body['jobCards'], urls),
    materialsRequests: parseMaterialsRequests(body['materialsRequests'], urls),
    inventory: parseInventory(body['inventory'], urls),
    assets: parseAssets(body['assets'], urls),
    vehicleCompliance: parseVehicleCompliance(body['vehicleCompliance'], urls),
    labor: parseLabor(body['labor'], urls),
    managerAttention: parseManagerAttention(body['managerAttention'], urls),
  };
}

/** No live data at all (offline / not configured / restricted): real links, every section unavailable. */
export function emptyExecutiveSections(urls: MmsUrlBases): MmsExecutiveSections {
  return {
    links: parseLinks(null, urls),
    jobCards: null,
    materialsRequests: null,
    inventory: null,
    assets: null,
    vehicleCompliance: null,
    labor: null,
    managerAttention: null,
  };
}
