import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Building2,
  CalendarCheck,
  Database,
  Factory,
  HardHat,
  Target,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export const MANAGEMENT_BASE_PATH = '/management/intelligence';

export interface ManagementModule {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

/**
 * The ten Management Intelligence modules, in sidebar order. Every figure these pages will
 * eventually show comes from RECAFCO Factory Management (192.168.0.12:8080) — never from FMP's
 * own contract, technical, production, storage or MMS data (see docs/management-intelligence.md).
 */
export const MANAGEMENT_MODULES: readonly ManagementModule[] = [
  {
    slug: 'executive-overview',
    title: 'Executive Overview',
    description: 'The whole factory at a glance: projects, output, deliveries and erection.',
    icon: BarChart3,
  },
  {
    slug: 'projects-engineering',
    title: 'Projects & Engineering',
    description: 'Project activity, drawings and engineering progress for every job.',
    icon: Building2,
  },
  {
    slug: 'production-casting',
    title: 'Production & Casting',
    description: 'What the plant has produced and cast against what was planned.',
    icon: Factory,
  },
  {
    slug: 'stock-delivery',
    title: 'Stock & Delivery',
    description: 'Finished stock in the yard and what has been delivered to site.',
    icon: Boxes,
  },
  {
    slug: 'erection',
    title: 'Erection',
    description: 'Site erection progress against project targets.',
    icon: HardHat,
  },
  {
    slug: 'daily-performance',
    title: 'Daily Performance',
    description: 'Day-by-day output and how each day compares with the target.',
    icon: CalendarCheck,
  },
  {
    slug: 'resources-costs',
    title: 'Resources & Costs',
    description: 'Manpower, equipment and cost information behind the work.',
    icon: Wallet,
  },
  {
    slug: 'targets-achievement',
    title: 'Targets & Achievement',
    description: 'Targets set for the period and how much has been achieved.',
    icon: Target,
  },
  {
    slug: 'delays-follow-up',
    title: 'Delays & Follow-up',
    description: 'Late items, their reasons and the actions still open.',
    icon: AlertTriangle,
  },
  {
    slug: 'data-quality',
    title: 'Data Quality',
    description: 'Missing or inconsistent entries to correct at the source.',
    icon: Database,
  },
];

export function moduleHref(m: ManagementModule): string {
  return `${MANAGEMENT_BASE_PATH}/${m.slug}`;
}

export function findModule(slug: string): ManagementModule | undefined {
  return MANAGEMENT_MODULES.find((m) => m.slug === slug);
}

export const CONNECTION_STATUS_TITLE = 'Factory Management Connection Not Configured';
export const CONNECTION_STATUS_TEXT =
  'Live reporting will be available after the Factory Management integration is connected.';
