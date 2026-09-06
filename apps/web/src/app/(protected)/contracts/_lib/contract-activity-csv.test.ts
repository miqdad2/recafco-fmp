import { describe, it, expect } from 'vitest';
import { buildActivitiesCsv, ACTIVITY_CSV_HEADERS } from './contract-activity-csv';
import type { ContractActivity } from '@/lib/contracts-api';

function makeActivity(overrides: Partial<ContractActivity> = {}): ContractActivity {
  return {
    id: 'a1',
    contractId: 'contract-1',
    actorUserId: 'user-1',
    actorName: 'Manager',
    event: 'payment_created',
    metadata: { paymentId: 'p1', paymentNo: 'PAY-001' },
    createdAt: '2026-01-05T10:00:00Z',
    ...overrides,
  };
}

describe('buildActivitiesCsv', () => {
  it('produces a header row plus one row per activity', () => {
    const csv = buildActivitiesCsv([makeActivity()]);
    const rows = csv.split('\r\n');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe(ACTIVITY_CSV_HEADERS.join(','));
    expect(rows[1]).toContain('Manager');
    expect(rows[1]).toContain('Payment Added');
    expect(rows[1]).toContain('Payments');
    expect(rows[1]).toContain('Payment PAY-001 added');
  });

  it('produces only the header row for an empty list (no fake rows)', () => {
    const csv = buildActivitiesCsv([]);
    expect(csv.split('\r\n')).toHaveLength(1);
  });

  it('never includes raw metadata JSON', () => {
    const csv = buildActivitiesCsv([makeActivity()]);
    expect(csv).not.toContain('{');
    expect(csv).not.toContain('paymentId');
  });

  it('shows "System" for an activity with no actor name', () => {
    const activity = makeActivity();
    delete activity.actorName;
    const csv = buildActivitiesCsv([activity]);
    expect(csv).toContain('System');
  });

  it('leaves Old Value/New Value blank when not captured (never a fabricated value)', () => {
    const csv = buildActivitiesCsv([makeActivity()]);
    const rows = csv.split('\r\n');
    const cols = rows[1]!.split(',');
    expect(cols[cols.length - 1]).toBe('');
    expect(cols[cols.length - 2]).toBe('');
  });

  it('shows the real previousStatus/newStatus for a lifecycle status change', () => {
    const csv = buildActivitiesCsv([makeActivity({ event: 'activated', previousStatus: 'DRAFT', newStatus: 'ACTIVE', metadata: undefined })]);
    expect(csv).toContain('DRAFT');
    expect(csv).toContain('ACTIVE');
  });
});
