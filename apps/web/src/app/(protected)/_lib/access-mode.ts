import {
  canSeeModule,
  getVisibleModules,
  isExecutiveManagerAccess,
  type ModuleCode,
} from './module-visibility';

/**
 * FMP-ACCESS-01 — the one place that decides what *kind* of experience a user gets:
 * which landing page, which sidebar shape, and what the Module Access screens call it.
 *
 * Access Mode is PRESENTATION ONLY. Every permission check (API guards, department scoping,
 * canSeeModule) is unchanged and still enforced — this never grants anything. The only
 * stored input is the explicit `fullPlatformAccess` flag; everything else is derived from the
 * live permission codes (never a role code), exactly like module-visibility.ts.
 */
export type AccessMode = 'SINGLE_MODULE' | 'MULTI_MODULE' | 'FULL_PLATFORM';

export const ACCESS_MODE_LABELS: Record<AccessMode, string> = {
  SINGLE_MODULE: 'Single Module Access',
  MULTI_MODULE: 'Multi-Module Access',
  FULL_PLATFORM: 'Full Platform Access',
};

export const ACCESS_MODE_HELPERS: Record<AccessMode, string> = {
  SINGLE_MODULE: 'For users who work in one module only.',
  MULTI_MODULE: 'For users who need selected modules only.',
  FULL_PLATFORM:
    'For managers who need to see all modules, dashboards and related operations. Actions still follow the role.',
};

/** Why a user is Full Platform: the admin ticked it, or their role/permissions already span everything. */
export type FullPlatformSource = 'explicit' | 'role' | null;

export interface AccessModeInfo {
  mode: AccessMode;
  /** The only operational module, for Single Module Access; null otherwise. */
  primaryModule: Exclude<ModuleCode, 'ADMINISTRATION'> | null;
  /** Every operational module the permissions allow (Administration excluded). */
  modules: Exclude<ModuleCode, 'ADMINISTRATION'>[];
  hasAdministration: boolean;
  fullPlatformSource: FullPlatformSource;
}

export function deriveAccessMode(permissions: string[], fullPlatformAccess = false): AccessModeInfo {
  const visible = getVisibleModules(permissions);
  const hasAdministration = visible.includes('ADMINISTRATION');
  const modules = visible.filter((m): m is Exclude<ModuleCode, 'ADMINISTRATION'> => m !== 'ADMINISTRATION');

  // Admin / Super Admin / Executive Manager shapes are platform-level by their permissions alone.
  const roleIsPlatformLevel = hasAdministration || isExecutiveManagerAccess(permissions);
  const fullPlatformSource: FullPlatformSource = fullPlatformAccess ? 'explicit' : roleIsPlatformLevel ? 'role' : null;

  if (fullPlatformSource) {
    return { mode: 'FULL_PLATFORM', primaryModule: null, modules, hasAdministration, fullPlatformSource };
  }
  if (modules.length === 1) {
    return { mode: 'SINGLE_MODULE', primaryModule: modules[0]!, modules, hasAdministration, fullPlatformSource: null };
  }
  return { mode: 'MULTI_MODULE', primaryModule: null, modules, hasAdministration, fullPlatformSource: null };
}

/** The dashboard route each operational module lands on when it is a user's only module. */
export const MODULE_LANDING_PATH: Record<Exclude<ModuleCode, 'ADMINISTRATION'>, string> = {
  CONTRACTS_MANAGEMENT: '/contracts/dashboard',
  // FMP-ACCESS-02 — Technical has its own module and dashboard.
  TECHNICAL: '/technical',
  SAFETY_COMPLIANCE: '/safety-compliance/dashboard',
  INCIDENT_REPORT: '/incidents/dashboard',
  PRODUCTION_DASHBOARD: '/production/dashboard',
  MAINTENANCE_REQUESTS: '/maintenance/dashboard',
  FACTORY_TASKS: '/factory-tasks/dashboard',
};

/** Where `/dashboard` should send this user: their own module dashboard (Single Module) or stay on the Control Center. */
export function getLandingPath(permissions: string[], fullPlatformAccess = false): string {
  const info = deriveAccessMode(permissions, fullPlatformAccess);
  if (info.mode === 'SINGLE_MODULE' && info.primaryModule) return MODULE_LANDING_PATH[info.primaryModule];
  return '/dashboard';
}

/** Single, shared module names — the same wording in sidebar, Control Center, user creation and Edit User. */
export const MODULE_DISPLAY_NAMES: Record<ModuleCode, string> = {
  FACTORY_TASKS: 'Task Management',
  INCIDENT_REPORT: 'Incident Management',
  MAINTENANCE_REQUESTS: 'Maintenance Management',
  SAFETY_COMPLIANCE: 'Safety & Compliance',
  CONTRACTS_MANAGEMENT: 'Contract Management',
  TECHNICAL: 'Technical',
  PRODUCTION_DASHBOARD: 'Production & Planning',
  ADMINISTRATION: 'Administration',
};

/**
 * Technical, Erection and Schedule Planning are not separate permission modules — they ride on
 * Contract Management's contracts.read. Production & Planning, Storage Yard & Delivery and Piece Erection have their own
 * permission codes, in contract execution order (Technical → Production → Storage → Erection → Schedule). For a Single Module Contract Management user they are shown together as
 * "Related Workflows"; each link keeps its own gate, nothing is added or removed.
 */
export const CONTRACT_RELATED_LINKS: { label: string; href: string; permission?: string }[] = [
  { label: 'Technical', href: '/technical' },
  // FMP-ACCESS-01B — same route and gate (production.read) as the main sidebar's Production & Planning link.
  { label: 'Production & Planning', href: '/production/dashboard', permission: 'production.read' },
  { label: 'Storage Yard & Delivery', href: '/storage-delivery/pieces', permission: 'storage_delivery.read' },
  { label: 'Erection', href: '/contracts/erection-dashboard' },
  { label: 'Piece Erection', href: '/erection/pieces', permission: 'erection.read' },
  // FMP-ACCESS-01C — operational follow-up; same route and gate (tasks.read) as the main sidebar's Task Management link.
  { label: 'Task Management', href: '/factory-tasks/dashboard', permission: 'tasks.read' },
  { label: 'Schedule Planning', href: '/contracts/schedule' },
];

/** The Related Workflows links this user may open (the always-on trio plus any permission-gated ones they hold). */
export function contractRelatedLinks(permissions: string[]): { label: string; href: string }[] {
  return CONTRACT_RELATED_LINKS.filter((l) => !l.permission || permissions.includes(l.permission)).map(({ label, href }) => ({
    label,
    href,
  }));
}

/** Names shown on the user-creation and Edit User screens (the always-on Contract Management workflow trio). */
export function relatedWorkflowsFor(module: ModuleCode | null): string[] {
  return module === 'CONTRACTS_MANAGEMENT'
    ? CONTRACT_RELATED_LINKS.filter((l) => !l.permission).map((l) => l.label)
    : [];
}

export type SidebarLayout = 'EXECUTIVE' | 'CONTRACT_SINGLE_MODULE' | 'SINGLE_MODULE' | 'MAIN';

/**
 * Which sidebar shape a user gets.
 *  EXECUTIVE              — flat executive list (Executive Manager / Viewer-shaped permissions)
 *  CONTRACT_SINGLE_MODULE — Contract Management group + Related Workflows, nothing else
 *  SINGLE_MODULE          — that one module only, no Control Center link
 *  MAIN                   — main platform sidebar with the Factory Operations Control Center link
 */
export function getSidebarLayout(permissions: string[], fullPlatformAccess = false): SidebarLayout {
  if (isExecutiveManagerAccess(permissions)) return 'EXECUTIVE';
  const info = deriveAccessMode(permissions, fullPlatformAccess);
  if (info.mode !== 'SINGLE_MODULE') return 'MAIN';
  return info.primaryModule === 'CONTRACTS_MANAGEMENT' ? 'CONTRACT_SINGLE_MODULE' : 'SINGLE_MODULE';
}

/** Route prefix → permission namespace, for the read-only banner. Executive landing pages are view-only already, so they are skipped. */
const MODULE_ROUTE_NAMESPACES: { prefix: string; namespaces: string[] }[] = [
  { prefix: '/production', namespaces: ['production'] },
  { prefix: '/storage-delivery', namespaces: ['storage_delivery'] },
  { prefix: '/erection', namespaces: ['erection'] },
  { prefix: '/factory-tasks', namespaces: ['tasks'] },
  { prefix: '/incidents', namespaces: ['incidents'] },
  { prefix: '/maintenance', namespaces: ['maintenance'] },
  { prefix: '/safety-compliance', namespaces: ['safety'] },
  { prefix: '/contracts', namespaces: ['contracts'] },
  // Technical write access is technical.update/manage, or the older contract workflow codes.
  { prefix: '/technical', namespaces: ['technical', 'contracts'] },
];

export const FULL_PLATFORM_READ_ONLY_MESSAGE =
  'You have full platform view access. Some actions are hidden because your role does not include update permission for this module.';

/**
 * FMP-ACCESS-01C — true only for a Full Platform Access user who is on a module page whose role
 * holds no write-type permission (anything except .read / .comment) in that module. Never shown
 * to users without the explicit flag, so ordinary module users see no new banner.
 */
export function shouldShowReadOnlyBanner(pathname: string, permissions: string[], fullPlatformAccess: boolean): boolean {
  if (!fullPlatformAccess || pathname.includes('/executive')) return false;
  const match = MODULE_ROUTE_NAMESPACES.find((m) => pathname === m.prefix || pathname.startsWith(`${m.prefix}/`));
  if (!match) return false;
  const hasWrite = permissions.some(
    (p) => match.namespaces.some((ns) => p.startsWith(`${ns}.`)) && !p.endsWith('.read') && !p.endsWith('.comment'),
  );
  return !hasWrite;
}

export { canSeeModule };
