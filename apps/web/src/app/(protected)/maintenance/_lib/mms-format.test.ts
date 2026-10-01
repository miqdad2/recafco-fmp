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
} from './mms-format';

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
    expect(mmsJobCardsUrl('http://192.168.1.17:81/', 'Active')).toBe('http://192.168.1.17:81/maintenance/work-orders?status=Active');
    expect(mmsJobCardsUrl('http://192.168.1.17:81', 'ClosureRequested')).toBe('http://192.168.1.17:81/maintenance/work-orders?status=ClosureRequested');
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
