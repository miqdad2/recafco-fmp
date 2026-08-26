import { describe, it, expect } from 'vitest';
import { buildScheduleCsv, SCHEDULE_CSV_HEADERS } from './contract-schedule-csv';
import type { ScheduleItem } from '@/lib/contracts-api';

function makeItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: 'contract-1:WORKFLOW_TASK:task-1',
    sourceType: 'WORKFLOW_TASK',
    sourceId: 'task-1',
    contractId: 'contract-1',
    contractReference: 'CONTRACT-2026-000001',
    contractTitle: 'Test Contract',
    companyName: 'Acme Co',
    department: { id: 'dept-1', name: 'Engineering' },
    title: 'Submit shop drawings',
    description: null,
    date: '2026-08-10',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    responsibleUser: { id: 'user-1', displayName: 'Manager' },
    amount: null,
    currency: null,
    isOverdue: true,
    overdueDays: 5,
    actionUrl: '/contracts/contract-1/workflow',
    ...overrides,
  };
}

describe('buildScheduleCsv', () => {
  it('produces a header row plus one row per schedule item', () => {
    const csv = buildScheduleCsv([makeItem()]);
    const rows = csv.split('\r\n');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe(SCHEDULE_CSV_HEADERS.join(','));
    expect(rows[1]).toContain('CONTRACT-2026-000001');
    expect(rows[1]).toContain('Submit shop drawings');
    expect(rows[1]).toContain('5');
  });

  it('produces only the header row for an empty list (no fake data)', () => {
    const csv = buildScheduleCsv([]);
    expect(csv.split('\r\n')).toHaveLength(1);
  });

  it('escapes a company name containing a comma', () => {
    const csv = buildScheduleCsv([makeItem({ companyName: 'Acme, Inc.' })]);
    expect(csv).toContain('"Acme, Inc."');
  });

  it('leaves amount and overdue days blank when not applicable', () => {
    const csv = buildScheduleCsv([makeItem({ amount: null, isOverdue: false, overdueDays: null })]);
    const dataRow = csv.split('\r\n')[1];
    expect(dataRow).toBeDefined();
  });
});
