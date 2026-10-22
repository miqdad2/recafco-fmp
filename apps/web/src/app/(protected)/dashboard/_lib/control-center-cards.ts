import type { PlatformModuleCard, PlatformModuleCode } from '@/lib/platform-api';

/**
 * FMP-UI-36 — the Factory Operations Control Center shows exactly these seven cards, in this order.
 * Presentation only: titles/descriptions are overridden here, while routes, metrics and permission
 * gating still come from `platformApi.dashboard()` (PlatformDashboardService), which is unchanged.
 * Cards the API returns for other modules (Estimation, Safety, Incident, Maintenance, Tasks, Quality
 * Control) are simply not shown here; their pages, routes and permissions are untouched.
 */
export const CONTROL_CENTER_API_CARDS: { code: PlatformModuleCode; title: string; description: string }[] = [
  { code: 'CONTRACTS_MANAGEMENT', title: 'Contract Management', description: 'Contracts, payments and project progress.' },
  { code: 'TECHNICAL', title: 'Technical', description: 'Drawings, confirmed elements and production releases.' },
  { code: 'PRODUCTION_DASHBOARD', title: 'Production & Planning', description: 'Production readiness, active work and completed elements.' },
  // The card is named "Delivery"; it still opens the existing Storage Yard & Delivery page (the API's own route).
  { code: 'STORAGE_DELIVERY', title: 'Delivery', description: 'Storage, dispatch and delivery progress.' },
  { code: 'ERECTION', title: 'Erection', description: 'Site erection activities and completed elements.' },
];

export const FACTORY_PERFORMANCE_CARD = {
  title: 'Factory Performance',
  description: 'Factory output, production capacity and delivery trends.',
} as const;

export const SALES_ENQUIRIES_CARD = {
  title: 'Sales & Enquiries',
  description: 'Client visits, enquiries, quotations and follow-ups.',
} as const;

export interface ControlCenterApiCard extends PlatformModuleCard {
  /** Control Center wording (overrides the API title/description). */
  displayTitle: string;
  displayDescription: string;
}

/** The permitted API cards, restricted to the five retained modules and put in the approved order. */
export function selectControlCenterCards(cards: PlatformModuleCard[]): ControlCenterApiCard[] {
  const out: ControlCenterApiCard[] = [];
  for (const def of CONTROL_CENTER_API_CARDS) {
    const card = cards.find((c) => c.code === def.code);
    if (card) {
      out.push({
        ...card,
        metrics: card.metrics.map((m) => ({ ...m, label: displayMetricLabel(card.code, m.label) })),
        displayTitle: def.title,
        displayDescription: def.description,
      });
    }
  }
  return out;
}

/**
 * FMP-UI-38 — display-only wording for the API's short metric labels. The metric values, their order and
 * their business meaning come from the API untouched; only the words shown on the card are made plainer.
 * Labels not listed here are shown exactly as the API sends them.
 */
export const METRIC_DISPLAY_LABELS: Partial<Record<PlatformModuleCode, Record<string, string>>> = {
  CONTRACTS_MANAGEMENT: { Total: 'Total Contracts', Active: 'Active Contracts', Pending: 'Pending Contracts', Outstanding: 'Outstanding Payments' },
  TECHNICAL: { Drawings: 'Pending Drawings', 'SD / Calc.': 'Pending Calculations', Approvals: 'Pending Approvals', Completed: 'Completed Tasks' },
  PRODUCTION_DASHBOARD: { Schedules: 'Scheduled Orders' },
  ERECTION: { Contracts: 'Erection Contracts', Method: 'Method Statements Pending', Progress: 'In Progress', Checklist: 'Checklists Pending' },
};

export function displayMetricLabel(code: PlatformModuleCode, label: string): string {
  return METRIC_DISPLAY_LABELS[code]?.[label] ?? label;
}

/** The module-specific button wording (FMP-UI-38). Sales & Enquiries has none until a working module exists. */
export const CARD_CTA: Record<string, string> = {
  CONTRACTS_MANAGEMENT: 'Open Contract Management',
  TECHNICAL: 'Open Technical',
  PRODUCTION_DASHBOARD: 'Open Production',
  STORAGE_DELIVERY: 'Open Delivery',
  ERECTION: 'Open Erection',
  FACTORY_PERFORMANCE: 'Open Factory Performance',
  SALES_ENQUIRIES: 'Open Sales & Enquiries',
};
