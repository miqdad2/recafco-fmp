import { describe, it, expect } from 'vitest';
import {
  MMS_LIVE_STATUS_DISPLAY,
  MMS_SYNC_STATUS_WORD,
  mmsJobCardsUrl,
  summarizeReasons,
  formatRelative,
  priorityClasses,
  reasonClasses,
  reasonLabel,
  statusClasses,
  SECTION_NOT_AVAILABLE,
  attentionTypeClasses,
  attentionTypeLabel,
  fallbackMmsLinks,
  formatDateOnly,
  formatHours,
  formatKwd,
  formatQuantity,
  vehicleExpiryText,
} from './mms-format';

describe('mms-format — FMP-MAINT-04 executive summary', () => {
  it('formats KWD, hours, and quantities, and shows a missing value as a dash (never 0)', () => {
    expect(formatKwd(1250.5)).toBe('1,250.500 KWD');
    expect(formatKwd(0)).toBe('0.000 KWD');
    expect(formatKwd(null)).toBe('—');
    expect(formatHours(12.5)).toBe('12.5 h');
    expect(formatHours(null)).toBe('—');
    expect(formatQuantity(-3.5)).toBe('-3.5');
    expect(formatQuantity(undefined)).toBe('—');
  });

  it('labels MMS attention types, including unknown ones', () => {
    expect(attentionTypeLabel('closure_request')).toBe('Closure request');
    expect(attentionTypeLabel('overdue_job')).toBe('Past start time');
    expect(attentionTypeLabel('some_new_type')).toBe('Some new type');
    expect(attentionTypeClasses('vehicle_expiry')).toContain('text-error');
    expect(attentionTypeClasses('some_new_type')).toContain('text-text-secondary');
  });

  it('describes vehicle expiry timing', () => {
    expect(vehicleExpiryText({ daysRemaining: -367, overdueDays: 367 })).toBe('Expired 367 days ago');
    expect(vehicleExpiryText({ daysRemaining: -1, overdueDays: 1 })).toBe('Expired 1 day ago');
    expect(vehicleExpiryText({ daysRemaining: 0, overdueDays: 0 })).toBe('Expires today');
    expect(vehicleExpiryText({ daysRemaining: 5, overdueDays: 0 })).toBe('Expires in 5 days');
    expect(vehicleExpiryText({ daysRemaining: null, overdueDays: 0 })).toBe('Expiring');
    expect(formatDateOnly('2025-09-29')).toBe('29 Sep 2025');
    expect(formatDateOnly('garbage')).toBe('garbage');
  });

  it('builds only real MMS routes for the fallback links', () => {
    expect(fallbackMmsLinks('https://maintenance.recafco.online/')).toEqual({
      dashboard: 'https://maintenance.recafco.online/dashboard',
      jobCards: 'https://maintenance.recafco.online/maintenance/work-orders',
      materialsRequests: 'https://maintenance.recafco.online/store/parts-requests',
      inventory: 'https://maintenance.recafco.online/store/offline-inventory',
      assets: 'https://maintenance.recafco.online/assets',
      vehicles: 'https://maintenance.recafco.online/assets/vehicles',
      workerActivity: 'https://maintenance.recafco.online/maintenance/assignments',
      dailyActivity: 'https://maintenance.recafco.online/maintenance/daily-activity',
    });
    expect(SECTION_NOT_AVAILABLE).toBe('Not available from MMS live API yet');
  });
});

const NOW = new Date('2026-10-01T12:00:00Z').getTime();
const ago = (ms: number): string => new Date(NOW - ms).toISOString();

describe('mms-format', () => {
  it('formats relative times, including missing/invalid dates', () => {
    expect(formatRelative(ago(20_000), NOW)).toBe('just now');
    expect(formatRelative(ago(5 * 60_000), NOW)).toBe('5 min ago');
    expect(formatRelative(ago(3 * 3_600_000), NOW)).toBe('3 h ago');
    expect(formatRelative(ago(4 * 86_400_000), NOW)).toBe('4 d ago');
    expect(formatRelative(ago(60 * 86_400_000), NOW)).toMatch(/2026/);
    expect(formatRelative(null, NOW)).toBe('—');
    expect(formatRelative('not a date', NOW)).toBe('—');
  });

  it('labels the MMS "Overdue" reason as past start time, other reasons verbatim', () => {
    expect(reasonLabel('Overdue')).toBe('Past start time');
    expect(reasonLabel('Waiting for parts')).toBe('Waiting for parts');
    expect(reasonClasses('Urgent priority')).toContain('error');
    expect(reasonClasses('Unassigned')).toContain('surface-secondary');
  });

  it('colors raw MMS statuses and priorities', () => {
    expect(statusClasses('In Progress')).toContain('teal');
    expect(statusClasses('Waiting Materials')).toContain('secondary-accent');
    expect(statusClasses('Closed')).toContain('success');
    expect(statusClasses('Something Legacy')).toContain('surface-secondary');
    expect(priorityClasses('Urgent')).toContain('error');
    expect(priorityClasses('High')).toContain('warning');
    expect(priorityClasses(null)).toContain('surface-secondary');
  });

  it('has a display entry for every live status', () => {
    expect(Object.keys(MMS_LIVE_STATUS_DISPLAY).sort()).toEqual([
      'AUTH_ERROR',
      'NOT_CONFIGURED',
      'NOT_ENABLED',
      'OFFLINE',
      'ONLINE',
      'SCOPE_RESTRICTED',
    ]);
  });

  it('shows "MMS not configured" for both not-configured and not-deployed states', () => {
    expect(MMS_LIVE_STATUS_DISPLAY.NOT_CONFIGURED.label).toBe('MMS not configured');
    expect(MMS_LIVE_STATUS_DISPLAY.NOT_ENABLED.label).toBe('MMS not configured');
    expect(MMS_LIVE_STATUS_DISPLAY.ONLINE.label).toBe('Live from MMS');
    expect(MMS_SYNC_STATUS_WORD.OFFLINE).toBe('Offline');
  });

  it('builds real MMS job-card list links', () => {
    expect(mmsJobCardsUrl('https://maintenance.recafco.online/', 'Active')).toBe('https://maintenance.recafco.online/maintenance/work-orders?status=Active');
    expect(mmsJobCardsUrl('https://maintenance.recafco.online', 'ClosureRequested')).toBe('https://maintenance.recafco.online/maintenance/work-orders?status=ClosureRequested');
  });

  it('summarizes attention reasons in MMS weight order, counting each item once per reason', () => {
    expect(
      summarizeReasons([
        { reasons: ['Unassigned', 'Overdue'] },
        { reasons: ['Waiting for parts', 'Overdue', 'Overdue'] },
        { reasons: ['Something new'] },
      ]),
    ).toEqual([
      { reason: 'Overdue', count: 2 },
      { reason: 'Waiting for parts', count: 1 },
      { reason: 'Unassigned', count: 1 },
      { reason: 'Something new', count: 1 },
    ]);
  });
});
