import { describe, it, expect } from 'vitest';
import type { MmsLinks, MmsLiveDashboard, MmsManagerAttentionSection, MmsNeedsAttentionItem } from '@/lib/mms-api';
import { ATTENTION_LIMIT, attentionRows, tagDotColor } from '../_components/mms/mms-manager-attention';
import { buildModuleRows } from '../_components/mms/mms-modules-summary';
import { fallbackMmsLinks } from './mms-format';

// FMP-MAINT-05 — the one-screen layout's own mapping rules.

const links: MmsLinks = fallbackMmsLinks('https://maintenance.recafco.online');

const jobCardItem = (n: number, reasons: string[]): MmsNeedsAttentionItem => ({
  id: `id-${n}`,
  ref: `JC-${n}`,
  title: `Job ${n}`,
  status: 'In Progress',
  statusLabel: 'Active',
  priority: null,
  reasons,
  updatedAt: null,
  openUrl: `https://maintenance.recafco.online/maintenance/work-orders/id-${n}`,
});

const managerAttention = (count: number): MmsManagerAttentionSection => ({
  needsManagerAttention: count,
  counts: { closureRequests: 1, vehicleExpiryAlerts: null, overdueJobs: 0, waitingMaterials: 0, lowStock: 0, unassignedJobs: 0 },
  attentionItems: Array.from({ length: count }, (_, i) => ({
    type: i === 0 ? 'closure_request' : 'low_stock',
    ref: `R-${i}`,
    title: `Item ${i}`,
    reason: `Reason ${i}`,
    status: null,
    priority: null,
    openUrl: `https://maintenance.recafco.online/x/${i}`,
  })),
});

describe('attentionRows', () => {
  it('shows at most 5 of MMS manager-attention items, in MMS order', () => {
    const rows = attentionRows(managerAttention(8), [jobCardItem(1, ['Overdue'])]);
    expect(rows).toHaveLength(ATTENTION_LIMIT);
    expect(rows.map((r) => r.ref)).toEqual(['R-0', 'R-1', 'R-2', 'R-3', 'R-4']);
    expect(rows[0]).toMatchObject({ tag: 'Closure request', detail: 'Reason 0' });
  });

  it('falls back to the job-card attention list (max 5) only when MMS sends no manager attention', () => {
    const items = [1, 2, 3, 4, 5, 6, 7].map((n) => jobCardItem(n, ['Overdue', 'Waiting for parts']));
    const rows = attentionRows(null, items);
    expect(rows).toHaveLength(ATTENTION_LIMIT);
    // First MMS reason becomes the tag ("Overdue" is shown as past start time); the rest the detail.
    expect(rows[0]).toMatchObject({ ref: 'JC-1', tag: 'Past start time', detail: 'Waiting for parts' });
  });

  it('uses the status label as the tag when a job card has no reasons, and is empty for no items', () => {
    expect(attentionRows(null, [jobCardItem(1, [])])[0]).toMatchObject({ tag: 'Active', detail: '' });
    expect(attentionRows(managerAttention(0), [jobCardItem(1, ['Overdue'])])).toEqual([]);
  });
});

describe('buildModuleRows', () => {
  const online = (over: Partial<MmsLiveDashboard>): MmsLiveDashboard =>
    ({
      status: 'ONLINE',
      summary: { openRequests: 3, inProgress: 2, waitingForParts: 1, overdue: 0, assignedToMe: null, completedThisMonth: 4 },
      jobCards: null,
      materialsRequests: null,
      inventory: null,
      assets: null,
      vehicleCompliance: null,
      labor: null,
      ...over,
    }) as MmsLiveDashboard;

  it('always returns the five modules with their MMS links', () => {
    const rows = buildModuleRows(null, links);
    expect(rows.map((r) => r.title)).toEqual(['Job Cards', 'Materials & Inventory', 'Assets & Equipment', 'Vehicle Expiry', 'Labor Snapshot']);
    expect(rows.map((r) => r.href)).toEqual([links.jobCards, links.inventory, links.assets, links.vehicles, links.workerActivity]);
    expect(rows.every((r) => r.stats === null)).toBe(true);
  });

  it('marks a section MMS did not send as null, never zeros', () => {
    const rows = buildModuleRows(online({}), links);
    // Job Cards still has the original summary values; "Active" is unknown without the jobCards section.
    expect(rows[0]?.stats).toEqual([
      { label: 'Active', value: null },
      { label: 'In progress', value: 2 },
      { label: 'Waiting parts', value: 1, alert: true },
    ]);
    expect(rows.slice(1).every((r) => r.stats === null)).toBe(true);
  });

  it('shows three values per module from the sections MMS sent; a withheld cost stays null', () => {
    const rows = buildModuleRows(
      online({
        labor: { workingNow: 14, pausedWorkers: 2, laborHoursToday: 86.5, laborCostTodayKwd: null, laborHoursThisWeek: null, laborCostThisWeekKwd: null, openUrl: '' },
        vehicleCompliance: { vehicleExpiryAlerts: 8, expiringSoon: 5, expiredCount: 3, windowDays: 30, topVehicleExpiryAlerts: [], openUrl: '' },
      }),
      links,
    );
    expect(rows[4]?.stats).toEqual([
      { label: 'Working', value: 14 },
      { label: 'Today', value: '86.5 h' },
      { label: 'KWD', value: null },
    ]);
    expect(rows[3]?.stats?.map((s) => s.value)).toEqual([3, 5, 8]);
  });
});

describe('tagDotColor', () => {
  it('uses the tag badge text color for its dot, with a muted default', () => {
    expect(tagDotColor('bg-error-light text-error')).toBe('text-error');
    expect(tagDotColor('bg-surface-secondary text-text-secondary')).toBe('text-text-secondary');
    expect(tagDotColor('')).toBe('text-text-muted');
  });
});
