import { describe, it, expect } from 'vitest';
import {
  DAYS_OPTIONS,
  QUICK_FILTERS,
  STATUS_OPTIONS,
  VIEW_OPTIONS,
  attentionReasons,
  boqBar,
  countLabel,
  countNeedingAttention,
  daysOptionsFor,
  isDateWindowFilter,
  matchesDueWindow,
  matchesQuickFilter,
  projectStages,
  statusApiValue,
  formatShortDate,
  paymentBar,
  statusBadge,
  timelineInfo,
  viewOptionsFor,
} from './contract-list-view-helpers';
import type { ProjectProgress } from '../executive/_lib/project-overview-helpers';

const NOW = new Date('2026-12-01T09:00:00Z');
const progress = (over: Partial<ProjectProgress> = {}): ProjectProgress => ({
  confirmed: 0, generated: 0, released: null, inProduction: 0, produced: 0, inStore: 0, delivered: 0, erected: 0, completed: 0, needsReview: 0, hasItems: true, ...over,
});
const contract = (over: Record<string, unknown> = {}) => ({
  status: 'ACTIVE', openClaimsCount: 0, effectiveScheduleStatus: 'ON_TRACK', startDate: '2026-01-10', forecastCompletionDate: '2026-12-26', endDate: undefined, ...over,
}) as unknown as Parameters<typeof attentionReasons>[0];

describe('View filter', () => {
  it('uses the four plain choices, default first', () => {
    expect(VIEW_OPTIONS.map((o) => o.label)).toEqual(['Active / Current', 'Completed / Closed', 'Cancelled', 'All']);
    expect(VIEW_OPTIONS.map((o) => o.value)).toEqual(['', 'CLOSED', 'CANCELLED', 'ALL']);
    expect(viewOptionsFor(undefined)).toBe(VIEW_OPTIONS);
    expect(viewOptionsFor('CLOSED')).toBe(VIEW_OPTIONS);
  });

  it('keeps a value from another screen (dashboard deep link) as an extra choice', () => {
    const options = viewOptionsFor('ACTIVE');
    expect(options).toHaveLength(5);
    expect(options[4]).toEqual({ value: 'ACTIVE', label: 'Active only' });
    expect(viewOptionsFor('SOMETHING')[4]?.label).toBe('SOMETHING');
  });
});

describe('timeline', () => {
  it('shows the due date and days left', () => {
    const t = timelineInfo(contract(), NOW);
    expect(t.due).toBe('26 Dec 2026');
    expect(t.start).toBe('10 Jan 2026');
    expect(t.remaining).toEqual({ text: '25 days left', tone: 'warning' });
  });

  it('is calm when far away, and says Overdue when late', () => {
    expect(timelineInfo(contract({ forecastCompletionDate: '2027-06-01' }), NOW).remaining?.tone).toBe('neutral');
    expect(timelineInfo(contract({ forecastCompletionDate: '2026-11-28' }), NOW).remaining).toEqual({ text: 'Overdue by 3 days', tone: 'error' });
    expect(timelineInfo(contract({ forecastCompletionDate: '2026-12-01' }), NOW).remaining?.text).toBe('Due today');
    expect(timelineInfo(contract({ forecastCompletionDate: '2026-12-02' }), NOW).remaining?.text).toBe('1 day left');
  });

  it('falls back to the end date, and shows nothing for finished or undated contracts', () => {
    expect(timelineInfo(contract({ forecastCompletionDate: undefined, endDate: '2026-12-10' }), NOW).due).toBe('10 Dec 2026');
    expect(timelineInfo(contract({ status: 'CLOSED' }), NOW).remaining).toBeNull();
    const none = timelineInfo(contract({ forecastCompletionDate: undefined, startDate: undefined }), NOW);
    expect(none).toEqual({ start: null, due: null, remaining: null });
    expect(formatShortDate('not a date')).toBeNull();
  });
});

describe('progress columns', () => {
  it('BOQ: count with a bar, plain words otherwise', () => {
    expect(boqBar(progress({ confirmed: 30, generated: 30, completed: 0 }))).toEqual({ text: '0 / 30 completed', percent: 0 });
    expect(boqBar(progress({ confirmed: 30, generated: 30, completed: 15 }))).toEqual({ text: '15 / 30 completed', percent: 50 });
    expect(boqBar(progress({ hasItems: false }))).toEqual({ text: 'No BOQ', percent: null });
    expect(boqBar(progress())).toEqual({ text: 'Not confirmed yet', percent: null });
    expect(boqBar(progress({ confirmed: 4 }))).toEqual({ text: 'Pieces not generated', percent: null });
    expect(boqBar(null)).toEqual({ text: '—', percent: null });
  });

  it('Payment: percentage with a bar, Not started at 0, dash when unknown', () => {
    expect(paymentBar(48)).toEqual({ text: '48%', percent: 48 });
    expect(paymentBar(120)).toEqual({ text: '120%', percent: 100 });
    expect(paymentBar(0)).toEqual({ text: 'Not started', percent: null });
    expect(paymentBar(undefined)).toEqual({ text: '—', percent: null });
  });
});

describe('Needs Attention', () => {
  it('flags drafts, open claims, delays and late contracts', () => {
    expect(attentionReasons(contract({ status: 'DRAFT' }), NOW)).toEqual(['Waiting for approval']);
    expect(attentionReasons(contract({ openClaimsCount: 2 }), NOW)).toEqual(['2 open claims']);
    expect(attentionReasons(contract({ openClaimsCount: 1 }), NOW)).toEqual(['1 open claim']);
    expect(attentionReasons(contract({ effectiveScheduleStatus: 'DELAYED' }), NOW)).toEqual(['Delayed']);
    expect(attentionReasons(contract({ forecastCompletionDate: '2026-11-01' }), NOW)).toEqual(['Past due date']);
  });

  it('flags nothing for a healthy or finished contract', () => {
    expect(attentionReasons(contract(), NOW)).toEqual([]);
    expect(attentionReasons(contract({ status: 'CLOSED', openClaimsCount: 5 }), NOW)).toEqual([]);
    expect(attentionReasons(contract({ status: 'CANCELLED' }), NOW)).toEqual([]);
  });

  it('counts flagged contracts', () => {
    expect(countNeedingAttention([contract(), contract({ status: 'DRAFT' }), contract({ openClaimsCount: 1 })], NOW)).toBe(2);
  });
});

describe('labels', () => {
  it('uses plain status badges', () => {
    expect(statusBadge('ACTIVE').label).toBe('Active');
    expect(statusBadge('DRAFT').label).toBe('Draft');
    expect(statusBadge('CLOSED').label).toBe('Closed');
    expect(statusBadge('CANCELLED').label).toBe('Cancelled');
    expect(statusBadge('ODD').label).toBe('Odd');
  });

  it('counts the shown contracts', () => {
    expect(countLabel(25, 2, 25, 60)).toBe('Showing 26 to 50 of 60 contracts');
    expect(countLabel(1, undefined, undefined, undefined)).toBe('Showing 1 contract');
  });
});

describe('Status filter', () => {
  it('has the six requested choices and maps them to stored statuses', () => {
    expect(STATUS_OPTIONS.map((o) => o.label)).toEqual(['All Status', 'Draft', 'Active', 'Pending Approval', 'Closed', 'Cancelled']);
    expect(statusApiValue('ACTIVE')).toBe('ACTIVE');
    expect(statusApiValue('PENDING_APPROVAL')).toBe('DRAFT');
    expect(statusApiValue('')).toBeUndefined();
    expect(statusApiValue('NOPE')).toBeUndefined();
  });
});

describe('Days Remaining filter', () => {
  it('has the five requested choices; window choices are applied in the page', () => {
    expect(DAYS_OPTIONS.map((o) => o.label)).toEqual(['All', 'Due Soon', 'Overdue', 'This Month', 'Next 3 Months']);
    expect(DAYS_OPTIONS.map((o) => o.value)).toEqual(['', 'DUE_30', 'OVERDUE', 'THIS_MONTH', 'NEXT_3_MONTHS']);
    expect(isDateWindowFilter('THIS_MONTH')).toBe(true);
    expect(isDateWindowFilter('DUE_30')).toBe(false);
    expect(daysOptionsFor('DUE_60')).toHaveLength(6);
  });

  it('This Month covers the calendar month; Next 3 Months runs from today', () => {
    const d = (forecastCompletionDate: string, status = 'ACTIVE') => ({ status, forecastCompletionDate, endDate: undefined }) as unknown as Parameters<typeof matchesDueWindow>[0];
    expect(matchesDueWindow(d('2026-12-28'), 'THIS_MONTH', NOW)).toBe(true);
    expect(matchesDueWindow(d('2026-12-01'), 'THIS_MONTH', NOW)).toBe(true);
    expect(matchesDueWindow(d('2027-01-02'), 'THIS_MONTH', NOW)).toBe(false);
    expect(matchesDueWindow(d('2027-02-20'), 'NEXT_3_MONTHS', NOW)).toBe(true);
    expect(matchesDueWindow(d('2027-03-02'), 'NEXT_3_MONTHS', NOW)).toBe(false);
    expect(matchesDueWindow(d('2026-11-20'), 'NEXT_3_MONTHS', NOW)).toBe(false);
    expect(matchesDueWindow(d('2026-12-28', 'CLOSED'), 'THIS_MONTH', NOW)).toBe(false);
    expect(matchesDueWindow({ status: 'ACTIVE' }, 'THIS_MONTH', NOW)).toBe(false);
  });
});

describe('quick filters', () => {
  it('lists the six chips that do not depend on the old internal workflow', () => {
    expect(QUICK_FILTERS.map((q) => q.label)).toEqual(['All', 'Active', 'Needs Attention', 'Due Soon', 'Overdue', 'Completed']);
  });

  it('matches each chip from existing data', () => {
    const c = contract();
    expect(matchesQuickFilter(c, null, 'ALL', NOW)).toBe(true);
    expect(matchesQuickFilter(c, null, 'ACTIVE', NOW)).toBe(true);
    expect(matchesQuickFilter(contract({ status: 'DRAFT' }), null, 'ACTIVE', NOW)).toBe(false);
    expect(matchesQuickFilter(contract({ openClaimsCount: 1 }), null, 'ATTENTION', NOW)).toBe(true);
    expect(matchesQuickFilter(c, null, 'DUE_SOON', NOW)).toBe(true);
    expect(matchesQuickFilter(contract({ forecastCompletionDate: '2027-06-01' }), null, 'DUE_SOON', NOW)).toBe(false);
    expect(matchesQuickFilter(contract({ forecastCompletionDate: '2026-11-01' }), null, 'OVERDUE', NOW)).toBe(true);
    expect(matchesQuickFilter(c, null, 'OVERDUE', NOW)).toBe(false);
    // Completed is a commercial status only: old local piece progress no longer counts as completion.
    expect(matchesQuickFilter(c, progress({ confirmed: 2, generated: 2, completed: 2 }), 'COMPLETED', NOW)).toBe(false);
    expect(matchesQuickFilter(contract({ status: 'CLOSED' }), null, 'COMPLETED', NOW)).toBe(true);
  });
});

describe('project progress stages', () => {
  const texts = (p: ProjectProgress | null, status = 'ACTIVE') => projectStages(p, status).map((s) => s.text);

  it('lists Technical, Production, Delivery, Erection in order', () => {
    expect(projectStages(null, 'ACTIVE').map((s) => s.label)).toEqual(['Technical', 'Production', 'Delivery', 'Erection']);
  });

  it('shows a dash when there is nothing to judge', () => {
    expect(texts(null)).toEqual(['—', '—', '—', '—']);
    expect(texts(progress({ hasItems: false }))).toEqual(['—', '—', '—', '—']);
    expect(texts(progress({ confirmed: 3, generated: 3 }), 'CANCELLED')).toEqual(['—', '—', '—', '—']);
  });

  it('walks through the stages as pieces move', () => {
    expect(texts(progress())).toEqual(['Not started', '—', '—', '—']);
    expect(texts(progress({ confirmed: 4, generated: 2 }))).toEqual(['In progress', 'Not started', 'Not started', 'Not started']);
    expect(texts(progress({ confirmed: 4, generated: 4, inProduction: 2 }))).toEqual(['Done', 'In progress', 'Not started', 'Not started']);
    expect(texts(progress({ confirmed: 4, generated: 4, produced: 4 }))).toEqual(['Done', 'Done', 'Not started', 'Not started']);
    expect(texts(progress({ confirmed: 4, generated: 4, delivered: 2, produced: 2 }))).toEqual(['Done', 'Done', 'In progress', 'Not started']);
    expect(texts(progress({ confirmed: 4, generated: 4, completed: 4 }))).toEqual(['Done', 'Done', 'Done', 'Done']);
  });
});

describe('BOQ column completed state', () => {
  it('says Completed when every piece is complete', () => {
    expect(boqBar(progress({ confirmed: 5, generated: 5, completed: 5 }))).toEqual({ text: 'Completed', percent: 100 });
  });
});
