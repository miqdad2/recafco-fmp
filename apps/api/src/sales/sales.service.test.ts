import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, SalesEnquiryStatus, SalesFollowUpStatus } from '@recafco/database';
import { SalesService, enquiryConversion } from './sales.service';
import type { DatabaseService } from '../database/database.service';
import type { ContractsService } from '../contracts/contracts.service';
import type { AuthUser } from '../common/types/auth-user';
import { dateKey } from './sales.logic';

// ---------------------------------------------------------------------------
// Mock database: one transaction object that records every write.
// ---------------------------------------------------------------------------

const tx = {
  salesEnquiry: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  salesActivity: { create: vi.fn(), findFirst: vi.fn() },
  salesFollowUp: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  securityAuditEvent: { create: vi.fn() },
  salesCustomStatus: { findUnique: vi.fn(), create: vi.fn() },
  user: { findUnique: vi.fn() },
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
};
const client = {
  salesEnquiry: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn() },
  salesCustomStatus: { findUnique: vi.fn(), findMany: vi.fn() },
  contract: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  salesFollowUp: { count: vi.fn(), findMany: vi.fn() },
  salesActivity: { findMany: vi.fn() },
  $transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
};
const contractsMock: { findOne: ReturnType<typeof vi.fn>; findAll: ReturnType<typeof vi.fn> } = { findOne: vi.fn(), findAll: vi.fn() };
const service = new SalesService({ getClient: () => client } as unknown as DatabaseService, contractsMock as unknown as ContractsService);

const ACTOR: AuthUser = {
  id: 'u1', username: 'm', displayName: 'Manager', roleId: 'r', roleCode: 'SALES_MANAGER', roleName: 'Sales Manager',
  permissions: ['sales.read', 'sales.create', 'sales.update'], isActive: true, mustChangePassword: false, sessionId: 's', departmentId: null,
};

const USER = { id: 'u1', displayName: 'Manager' };
function row(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'e1', enquiryNumber: 'ENQ-2026-0001', companyName: 'Al Ghanim', contactPerson: null, contactNumber: null, email: null,
    enquiryDate: new Date('2026-10-21T00:00:00Z'), source: null, projectName: null, projectLocation: null, scopeOfWork: 'Steel canopy',
    typeOfWork: null, estimatedValue: null, estimatedValueSource: null, currency: 'KWD', status: SalesEnquiryStatus.NEW_ENQUIRY,
    assignedToUserId: 'u1', assignedToUser: USER, nextFollowUpDate: null, remarks: null, additionalNotes: null, expectedStartDate: null,
    expectedAwardDate: null, lostReason: null, awardedValue: null, wonDate: null, lostDate: null, createdByUserId: 'u1', createdByUser: USER,
    createdAt: new Date('2026-10-21T08:00:00Z'), updatedAt: new Date('2026-10-21T08:00:00Z'), ...over,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-21T10:00:00Z')); // 13:00 in Kuwait, same calendar day
  vi.clearAllMocks();
  tx.$queryRaw.mockResolvedValue([{ last_seq: 1 }]);
  tx.salesEnquiry.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => row(data));
  tx.salesEnquiry.findUnique.mockResolvedValue(row());
  tx.salesEnquiry.updateMany.mockResolvedValue({ count: 1 });
  tx.salesFollowUp.findFirst.mockResolvedValue(null);
  tx.salesFollowUp.findMany.mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());

describe('dashboard reporting month (Asia/Kuwait)', () => {
  const REPORTER: AuthUser = { ...ACTOR, permissions: [...ACTOR.permissions, 'sales.reports.read'] };
  beforeEach(() => {
    client.salesEnquiry.count.mockResolvedValue(0);
    client.salesEnquiry.aggregate.mockResolvedValue({ _count: 0, _sum: { estimatedValue: null, awardedValue: null } });
    client.salesEnquiry.groupBy.mockResolvedValue([]);
    client.salesEnquiry.findMany.mockResolvedValue([]);
    client.salesFollowUp.count.mockResolvedValue(0);
    client.salesFollowUp.findMany.mockResolvedValue([]);
    client.salesActivity.findMany.mockResolvedValue([]);
  });
  const monthCountWheres = (): Array<{ gte: Date; lt: Date }> =>
    client.salesEnquiry.count.mock.calls.map((c) => (c[0] as { where?: { enquiryDate?: { gte: Date; lt: Date } } }).where?.enquiryDate).filter((x): x is { gte: Date; lt: Date } => !!x);

  it.each([
    ['2026-10-24T09:00:00Z', '2026-10-24', '2026-10', '2026-10-01', '2026-11-01'],
    ['2026-12-31T20:59:59Z', '2026-12-31', '2026-12', '2026-12-01', '2027-01-01'], // 23:59:59 in Kuwait: still December
    ['2026-12-31T21:00:00Z', '2027-01-01', '2027-01', '2027-01-01', '2027-02-01'], // midnight in Kuwait: January 2027
    ['2027-01-31T21:00:00Z', '2027-02-01', '2027-02', '2027-02-01', '2027-03-01'],
    ['2028-02-29T10:00:00Z', '2028-02-29', '2028-02', '2028-02-01', '2028-03-01'], // leap day
  ])('at %s the dashboard reports Kuwait %s: month %s, figures queried for %s .. %s', async (utc, today, month, from, to) => {
    vi.setSystemTime(new Date(utc));
    const d = await service.dashboard(REPORTER);
    expect(d.today).toBe(today);
    expect(d.month).toBe(month);
    const wheres = monthCountWheres();
    expect(wheres.length).toBeGreaterThan(0);
    for (const w of wheres) {
      expect(dateKey(w.gte)).toBe(from);
      expect(dateKey(w.lt)).toBe(to);
    }
    expect(d.monthlyTrend.at(-1)?.month).toBe(month);
  });

  it('the month figures really change when the month changes (not only the label)', async () => {
    client.salesEnquiry.count.mockImplementation(async (args: { where?: { enquiryDate?: { gte: Date } } }) => (args.where?.enquiryDate && dateKey(args.where.enquiryDate.gte) === '2026-12-01' ? 7 : 2));
    vi.setSystemTime(new Date('2026-12-31T20:59:59Z'));
    const dec = await service.dashboard(REPORTER);
    vi.setSystemTime(new Date('2026-12-31T21:00:00Z'));
    const jan = await service.dashboard(REPORTER);
    expect([dec.month, dec.enquiriesThisMonth]).toEqual(['2026-12', 7]);
    expect([jan.month, jan.enquiriesThisMonth]).toEqual(['2027-01', 2]);
  });
});

describe('waiting statuses, confirmation record and contract link (FMP-SALES-09)', () => {
  beforeEach(() => {
    tx.salesFollowUp.findFirst.mockResolvedValue(null);
    contractsMock.findOne.mockReset();
  });

  it('both waiting statuses are accepted, stay active, and a plain change records no confirmation', async () => {
    for (const st of [SalesEnquiryStatus.WAITING_FOR_DRAWINGS, SalesEnquiryStatus.WAITING_FOR_CLIENT]) {
      tx.salesEnquiry.updateMany.mockClear();
      await service.changeStatus('e1', { status: st, expectedStatus: SalesEnquiryStatus.NEW_ENQUIRY }, ACTOR);
      const data = tx.salesEnquiry.updateMany.mock.calls[0]![0].data;
      expect(data.status).toBe(st);
      expect(data.confirmedByUserId).toBeNull();
      expect(data.wonDate).toBeNull();
    }
    // they are not in the closed list, so every Active count/value (status notIn CLOSED) includes them
    const { CLOSED_STATUSES } = await import('./sales.logic');
    expect(CLOSED_STATUSES).not.toContain(SalesEnquiryStatus.WAITING_FOR_DRAWINGS);
    expect(CLOSED_STATUSES).not.toContain(SalesEnquiryStatus.WAITING_FOR_CLIENT);
  });

  it('Confirmed records who confirmed it and when; leaving Confirmed clears that', async () => {
    await service.changeStatus('e1', { status: SalesEnquiryStatus.WON }, ACTOR);
    const won = tx.salesEnquiry.updateMany.mock.calls[0]![0].data;
    expect(won.confirmedByUserId).toBe('u1');
    expect(won.confirmedAt).toBeInstanceOf(Date);
    tx.salesEnquiry.updateMany.mockClear();
    tx.salesEnquiry.findUnique.mockResolvedValue(row({ status: SalesEnquiryStatus.WON, confirmedByUserId: 'u1' }));
    await service.changeStatus('e1', { status: SalesEnquiryStatus.FOLLOW_UP }, ACTOR);
    const back = tx.salesEnquiry.updateMany.mock.calls[0]![0].data;
    expect(back.confirmedByUserId).toBeNull();
    expect(back.confirmedAt).toBeNull();
  });

  it('a Confirmed enquiry linked to a contract cannot be moved back', async () => {
    tx.salesEnquiry.findUnique.mockResolvedValue(row({ status: SalesEnquiryStatus.WON, contractId: 'c1' }));
    await expect(service.changeStatus('e1', { status: SalesEnquiryStatus.FOLLOW_UP }, ACTOR)).rejects.toThrow(/linked to a contract/);
  });

  const CONTRACT = { id: 'c1', referenceNumber: 'CONTRACT-2026-000001', title: 'Hospital' };
  it('links a Confirmed enquiry to a contract the actor may see, once, with history and audit', async () => {
    contractsMock.findOne.mockResolvedValue(CONTRACT);
    tx.salesEnquiry.findUnique.mockResolvedValue(row({ status: SalesEnquiryStatus.WON }));
    tx.salesEnquiry.findFirst.mockResolvedValue(null);
    const r = await service.linkContract('e1', 'c1', ACTOR);
    expect(r.referenceNumber).toBe(CONTRACT.referenceNumber);
    expect(contractsMock.findOne).toHaveBeenCalledWith('c1', ACTOR);
    expect(tx.salesEnquiry.updateMany.mock.calls[0]![0]).toMatchObject({ where: { id: 'e1', contractId: null }, data: { contractId: 'c1', contractLinkedByUserId: 'u1' } });
    expect(tx.salesActivity.create.mock.calls[0]![0].data.metadata).toMatchObject({ changes: [{ label: 'Contract', to: CONTRACT.referenceNumber }] });
    expect(tx.securityAuditEvent.create).toHaveBeenCalled();
  });

  it('refuses: not Confirmed, already linked to another contract, contract already used by another enquiry, contract not visible', async () => {
    contractsMock.findOne.mockResolvedValue(CONTRACT);
    tx.salesEnquiry.findUnique.mockResolvedValue(row({ status: SalesEnquiryStatus.NEW_ENQUIRY }));
    await expect(service.linkContract('e1', 'c1', ACTOR)).rejects.toThrow(/Only a Confirmed enquiry/);
    tx.salesEnquiry.findUnique.mockResolvedValue(row({ status: SalesEnquiryStatus.WON, contractId: 'other' }));
    await expect(service.linkContract('e1', 'c1', ACTOR)).rejects.toThrow(/already linked to a contract/);
    tx.salesEnquiry.findUnique.mockResolvedValue(row({ status: SalesEnquiryStatus.WON }));
    tx.salesEnquiry.findFirst.mockResolvedValue({ enquiryNumber: 'ENQ-2026-0002' });
    await expect(service.linkContract('e1', 'c1', ACTOR)).rejects.toThrow(/already linked to enquiry ENQ-2026-0002/);
    expect(tx.salesEnquiry.updateMany).not.toHaveBeenCalled();
    contractsMock.findOne.mockRejectedValue(new ForbiddenException());
    await expect(service.linkContract('e1', 'c1', ACTOR)).rejects.toThrow(ForbiddenException);
  });

  it('linking the same pair again is harmless', async () => {
    contractsMock.findOne.mockResolvedValue(CONTRACT);
    tx.salesEnquiry.findUnique.mockResolvedValue(row({ status: SalesEnquiryStatus.WON, contractId: 'c1' }));
    await expect(service.linkContract('e1', 'c1', ACTOR)).resolves.toBeDefined();
    expect(tx.salesEnquiry.updateMany).not.toHaveBeenCalled();
  });

  it('the list can show the enquiries confirmed in a month (the dashboard figure)', async () => {
    client.salesEnquiry.findMany.mockResolvedValue([]);
    client.salesEnquiry.count.mockResolvedValue(0);
    client.salesActivity.findMany.mockResolvedValue([]);
    await service.list({ wonMonth: '2026-10' } as never);
    const where = client.salesEnquiry.findMany.mock.calls.at(-1)![0].where;
    expect(where.status).toBe(SalesEnquiryStatus.WON);
    expect(dateKey(where.wonDate.gte)).toBe('2026-10-01');
    expect(dateKey(where.wonDate.lt)).toBe('2026-11-01');
  });
});

describe('add activity', () => {
  const created = (over: Record<string, unknown> = {}) => ({ id: 'a1', enquiryId: 'e1', type: 'NOTE', activityDate: new Date('2026-10-21T00:00:00Z'), notes: 'Client visited', metadata: null, recordedByUser: USER, createdAt: new Date('2026-10-21T10:00:00Z'), ...over });
  beforeEach(() => {
    tx.salesActivity.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => created({ ...data, id: 'a1' }));
    tx.salesActivity.findFirst.mockResolvedValue(null);
    tx.salesFollowUp.create.mockResolvedValue({ id: 'f1' });
  });

  it('saves a plain note for today without a category, and never touches status or follow-ups', async () => {
    const r = await service.addActivity('e1', { activityDate: '2026-10-21', notes: 'Client visited' }, ACTOR);
    expect(tx.salesActivity.create.mock.calls[0]![0].data).toMatchObject({ type: 'NOTE', recordedByUserId: 'u1', notes: 'Client visited' });
    expect(r.recordedBy).toEqual(USER);
    expect(tx.salesEnquiry.updateMany).not.toHaveBeenCalled();
    expect(tx.salesEnquiry.update).not.toHaveBeenCalled();
    expect(tx.salesFollowUp.create).not.toHaveBeenCalled();
    expect(tx.salesFollowUp.updateMany).not.toHaveBeenCalled();
  });

  it('accepts an earlier date but refuses a future one (plans belong in the follow-up)', async () => {
    await expect(service.addActivity('e1', { activityDate: '2026-10-10', notes: 'Earlier call' }, ACTOR)).resolves.toBeDefined();
    await expect(service.addActivity('e1', { activityDate: '2026-10-22', notes: 'Tomorrow' }, ACTOR)).rejects.toThrow(/cannot be in the future/);
    await expect(service.addActivity('e1', { activityDate: '2026-02-30', notes: 'x' }, ACTOR)).rejects.toThrow(UnprocessableEntityException);
  });

  it('schedules the optional next follow-up in the same transaction and links it in the entry', async () => {
    await service.addActivity('e1', { activityDate: '2026-10-21', notes: 'Visit', nextFollowUpDate: '2026-10-28', followUpTask: 'Call the client to request drawings' }, ACTOR);
    expect(tx.salesFollowUp.create).toHaveBeenCalledTimes(1);
    // the task text is what was typed for the task, never the activity note
    expect(tx.salesFollowUp.create.mock.calls[0]![0].data.notes).toBe('Call the client to request drawings');
    expect(dateKey(tx.salesFollowUp.create.mock.calls[0]![0].data.followUpDate)).toBe('2026-10-28');
    expect(tx.salesActivity.create.mock.calls[0]![0].data.metadata).toMatchObject({ followUpId: 'f1', followUpDate: '2026-10-28' });
    expect(client.$transaction).toHaveBeenCalledTimes(1);
    await expect(service.addActivity('e1', { activityDate: '2026-10-21', notes: 'Visit', nextFollowUpDate: '2026-10-20', followUpTask: 'Call' }, ACTOR)).rejects.toThrow(/before today/);
  });

  it('a follow-up date without a task description is refused and nothing is saved; no date needs no task', async () => {
    await expect(service.addActivity('e1', { activityDate: '2026-10-21', notes: 'Visit', nextFollowUpDate: '2026-10-28' }, ACTOR)).rejects.toThrow(/what needs to be done/);
    expect(tx.salesActivity.create).not.toHaveBeenCalled();
    expect(tx.salesFollowUp.create).not.toHaveBeenCalled();
    await expect(service.addActivity('e1', { activityDate: '2026-10-21', notes: 'Visit' }, ACTOR)).resolves.toBeDefined();
    expect(tx.salesFollowUp.create).not.toHaveBeenCalled();
  });

  it('a retry with the same requestId returns the first entry and creates nothing new', async () => {
    tx.salesActivity.findFirst.mockResolvedValue(created({ metadata: { clientRequestId: 'req-12345678' } }));
    const r = await service.addActivity('e1', { activityDate: '2026-10-21', notes: 'Client visited', nextFollowUpDate: '2026-10-28', followUpTask: 'Call', requestId: 'req-12345678' }, ACTOR);
    expect(r.id).toBe('a1');
    expect(tx.salesActivity.create).not.toHaveBeenCalled();
    expect(tx.salesFollowUp.create).not.toHaveBeenCalled();
    expect(tx.$executeRaw).toHaveBeenCalled();
  });
});

describe('create enquiry', () => {
  it('sets date (Kuwait today), creator, status and number on the server; blank value stays null', async () => {
    const view = await service.create({ companyName: 'Al Ghanim', scopeOfWork: 'Steel canopy' }, ACTOR);
    const data = tx.salesEnquiry.create.mock.calls[0]![0].data;
    expect(dateKey(data.enquiryDate)).toBe('2026-10-21');
    expect(data.status).toBe(SalesEnquiryStatus.NEW_ENQUIRY);
    expect(data.createdByUserId).toBe('u1');
    expect(data.assignedToUserId).toBe('u1');
    expect(data.currency).toBe('KWD');
    expect(data.estimatedValue).toBeNull();
    expect(data.enquiryNumber).toBe('ENQ-2026-0001');
    expect(view.estimatedValue).toBeNull();
    expect(tx.salesFollowUp.create).not.toHaveBeenCalled();
  });

  it('stores a KWD estimate with its decimals exactly', async () => {
    await service.create({ companyName: 'X', scopeOfWork: 'Y', estimatedValue: '125000.125' }, ACTOR);
    expect(tx.salesEnquiry.create.mock.calls[0]![0].data.estimatedValue).toBe('125000.125');
  });

  it('a next follow-up date creates a real pending follow-up, an activity and an audit event', async () => {
    await service.create({ companyName: 'X', scopeOfWork: 'Y', nextFollowUpDate: '2026-10-28', followUpTask: 'Call back', remarks: 'Met at the office' }, ACTOR);
    const f = tx.salesFollowUp.create.mock.calls[0]![0].data;
    expect(dateKey(f.followUpDate)).toBe('2026-10-28');
    expect(f.notes).toBe('Call back'); // the task text, not the remarks
    expect(f.responsibleUserId).toBe('u1');
    expect(tx.salesActivity.create).toHaveBeenCalledTimes(1);
    expect(tx.securityAuditEvent.create.mock.calls[0]![0].data.event).toBe('SALES_ENQUIRY_CREATED');
  });

  it('a follow-up date without a task is refused', async () => {
    await expect(service.create({ companyName: 'X', scopeOfWork: 'Y', nextFollowUpDate: '2026-10-28' }, ACTOR)).rejects.toThrow(/what needs to be done/);
    expect(tx.salesEnquiry.create).not.toHaveBeenCalled();
  });

  it('rejects an impossible date', async () => {
    await expect(service.create({ companyName: 'X', scopeOfWork: 'Y', nextFollowUpDate: '2026-02-31' }, ACTOR)).rejects.toThrow(UnprocessableEntityException);
  });
});

describe('edit enquiry', () => {
  it('records what changed and keeps the old value in history', async () => {
    tx.salesEnquiry.findUnique.mockResolvedValueOnce(row({ contactNumber: '111' })).mockResolvedValue(row({ contactNumber: '222' }));
    await service.update('e1', { contactNumber: '222' }, ACTOR);
    const act = tx.salesActivity.create.mock.calls[0]![0].data;
    expect(act.type).toBe('ENQUIRY_UPDATED');
    expect(act.metadata.changes).toEqual([{ field: 'contactNumber', label: 'Contact Number', from: '111', to: '222' }]);
  });

  it('does nothing (no history noise) when nothing changed', async () => {
    await service.update('e1', { companyName: 'Al Ghanim' }, ACTOR);
    expect(tx.salesEnquiry.update).not.toHaveBeenCalled();
    expect(tx.salesActivity.create).not.toHaveBeenCalled();
  });

  it('editing an enquiry never touches its follow-up tasks (no silent overwrite)', async () => {
    tx.salesEnquiry.findUnique.mockResolvedValueOnce(row({ contactNumber: '111' })).mockResolvedValue(row({ contactNumber: '222' }));
    await service.update('e1', { contactNumber: '222' }, ACTOR);
    expect(tx.salesFollowUp.create).not.toHaveBeenCalled();
    expect(tx.salesFollowUp.update).not.toHaveBeenCalled();
    expect(tx.salesFollowUp.updateMany).not.toHaveBeenCalled();
  });

  it('reassigning needs sales.manage', async () => {
    await expect(service.update('e1', { assignedToUserId: '11111111-1111-4111-8111-111111111111' }, ACTOR)).rejects.toThrow(ForbiddenException);
  });

  it('unknown enquiry is a 404', async () => {
    tx.salesEnquiry.findUnique.mockResolvedValue(null);
    await expect(service.update('missing', { remarks: 'x' }, ACTOR)).rejects.toThrow(NotFoundException);
  });
});

describe('status changes', () => {
  it('Lost needs a reason', async () => {
    await expect(service.changeStatus('e1', { status: SalesEnquiryStatus.LOST }, ACTOR)).rejects.toThrow(UnprocessableEntityException);
    expect(tx.salesEnquiry.updateMany).not.toHaveBeenCalled();
  });

  it('Lost stores the reason and date', async () => {
    await service.changeStatus('e1', { status: SalesEnquiryStatus.LOST, reason: ' Price too high ' }, ACTOR);
    const data = tx.salesEnquiry.updateMany.mock.calls[0]![0].data;
    expect(data.lostReason).toBe('Price too high');
    expect(dateKey(data.lostDate)).toBe('2026-10-21');
  });

  it('Won records award date (default today) and the awarded value without touching the estimate', async () => {
    tx.salesEnquiry.findUnique.mockResolvedValue(row({ estimatedValue: '90000.000' }));
    await service.changeStatus('e1', { status: SalesEnquiryStatus.WON, awardedValue: '85000.500' }, ACTOR);
    const data = tx.salesEnquiry.updateMany.mock.calls[0]![0].data;
    expect(dateKey(data.wonDate)).toBe('2026-10-21');
    expect(data.awardedValue).toBe('85000.500');
    expect('estimatedValue' in data).toBe(false);
  });

  it('can jump straight to Won or Lost from any status (no forced sequence)', async () => {
    tx.salesEnquiry.findUnique.mockResolvedValue(row({ status: SalesEnquiryStatus.NEW_ENQUIRY }));
    await expect(service.changeStatus('e1', { status: SalesEnquiryStatus.WON }, ACTOR)).resolves.toBeDefined();
  });

  it('awarded value is only for Won; same status is refused; a concurrent change is detected', async () => {
    await expect(service.changeStatus('e1', { status: SalesEnquiryStatus.CONTACTED, awardedValue: '5' }, ACTOR)).rejects.toThrow(UnprocessableEntityException);
    await expect(service.changeStatus('e1', { status: SalesEnquiryStatus.NEW_ENQUIRY }, ACTOR)).rejects.toThrow(UnprocessableEntityException);
    tx.salesEnquiry.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.changeStatus('e1', { status: SalesEnquiryStatus.CONTACTED }, ACTOR)).rejects.toThrow(/changed by someone else/);
  });

  it('a stale expectedStatus (someone else changed it) is refused before anything is written', async () => {
    tx.salesEnquiry.findUnique.mockResolvedValue(row({ status: SalesEnquiryStatus.QUOTATION_SENT }));
    await expect(service.changeStatus('e1', { status: SalesEnquiryStatus.FOLLOW_UP, expectedStatus: SalesEnquiryStatus.NEW_ENQUIRY }, ACTOR)).rejects.toThrow(/changed by someone else/);
    expect(tx.salesActivity.create).not.toHaveBeenCalled();
    await expect(service.changeStatus('e1', { status: SalesEnquiryStatus.FOLLOW_UP, expectedStatus: SalesEnquiryStatus.QUOTATION_SENT }, ACTOR)).resolves.toBeDefined();
  });

  it('re-opening a Won enquiry clears the outcome but keeps it in the history entry', async () => {
    tx.salesEnquiry.findUnique.mockResolvedValue(row({ status: SalesEnquiryStatus.WON, wonDate: new Date('2026-10-01T00:00:00Z'), awardedValue: new Prisma.Decimal('5000.000') }));
    await service.changeStatus('e1', { status: SalesEnquiryStatus.FOLLOW_UP }, ACTOR);
    const data = tx.salesEnquiry.updateMany.mock.calls[0]![0].data;
    expect(data.wonDate).toBeNull();
    expect(data.awardedValue).toBeNull();
    const meta = tx.salesActivity.create.mock.calls[0]![0].data.metadata;
    expect(meta.previousWonDate).toBe('2026-10-01');
    expect(meta.previousAwardedValue).toBe('5000');
  });
});

describe('confirmation, Monthly Results and contract provenance (FMP-SALES-11)', () => {
  const CONTRACT = { id: 'c1', referenceNumber: 'CONTRACT-2026-000001', title: 'Hospital', createdByUserId: 'u1', createdAt: new Date('2026-10-21T09:50:00Z') };

  it('confirming saves date, notes, who and when; the notes are in the history entry; follow-up tasks are untouched', async () => {
    tx.salesEnquiry.findUnique.mockResolvedValue(row({ status: SalesEnquiryStatus.QUOTATION_SENT }));
    await service.changeStatus('e1', { status: SalesEnquiryStatus.WON, wonDate: '2026-10-21', confirmationNotes: 'Agreed by phone' }, ACTOR);
    const data = tx.salesEnquiry.updateMany.mock.calls[0]![0].data;
    expect(dateKey(data.wonDate)).toBe('2026-10-21');
    expect(data.confirmedByUserId).toBe('u1');
    expect(data.confirmedAt).toBeInstanceOf(Date);
    const act = tx.salesActivity.create.mock.calls[0]![0].data;
    expect(act.notes).toBe('Agreed by phone');
    expect(act.metadata).toMatchObject({ to: 'WON', wonDate: '2026-10-21', confirmationNotes: 'Agreed by phone' });
    expect(tx.securityAuditEvent.create.mock.calls[0]![0].data.event).toBe('SALES_ENQUIRY_STATUS_CHANGED');
    expect(tx.salesFollowUp.create).not.toHaveBeenCalled();
    expect(tx.salesFollowUp.update).not.toHaveBeenCalled();
    expect(tx.salesFollowUp.updateMany).not.toHaveBeenCalled();
  });

  it('the confirmation date defaults to today in Kuwait', async () => {
    tx.salesEnquiry.findUnique.mockResolvedValue(row({ status: SalesEnquiryStatus.FOLLOW_UP }));
    vi.setSystemTime(new Date('2026-10-31T21:30:00Z')); // already 1 November in Kuwait
    await service.changeStatus('e1', { status: SalesEnquiryStatus.WON }, ACTOR);
    expect(dateKey(tx.salesEnquiry.updateMany.mock.calls[0]![0].data.wonDate)).toBe('2026-11-01');
  });

  it('refuses a future confirmation date, one before the enquiry was received, and notes on another status', async () => {
    tx.salesEnquiry.findUnique.mockResolvedValue(row({ status: SalesEnquiryStatus.FOLLOW_UP }));
    await expect(service.changeStatus('e1', { status: SalesEnquiryStatus.WON, wonDate: '2026-10-22' }, ACTOR)).rejects.toThrow(/cannot be in the future/);
    await expect(service.changeStatus('e1', { status: SalesEnquiryStatus.WON, wonDate: '2026-10-20' }, ACTOR)).rejects.toThrow(/before the enquiry was received/);
    await expect(service.changeStatus('e1', { status: SalesEnquiryStatus.QUOTATION_SENT, confirmationNotes: 'x' }, ACTOR)).rejects.toThrow(/only be recorded when the enquiry is Confirmed/);
    expect(tx.salesEnquiry.updateMany).not.toHaveBeenCalled();
  });

  it('re-opening clears the confirmation and keeps it in history; re-confirming sets one new date, so an enquiry is counted once', async () => {
    tx.salesEnquiry.findUnique.mockResolvedValue(row({ status: SalesEnquiryStatus.WON, wonDate: new Date('2026-10-21T00:00:00Z') }));
    await service.changeStatus('e1', { status: SalesEnquiryStatus.FOLLOW_UP }, ACTOR);
    expect(tx.salesEnquiry.updateMany.mock.calls[0]![0].data).toMatchObject({ wonDate: null, confirmedAt: null, confirmedByUserId: null });
    expect(tx.salesActivity.create.mock.calls[0]![0].data.metadata).toMatchObject({ previousWonDate: '2026-10-21' });
    vi.clearAllMocks();
    tx.salesEnquiry.findUnique.mockResolvedValue(row({ status: SalesEnquiryStatus.FOLLOW_UP }));
    tx.salesEnquiry.updateMany.mockResolvedValue({ count: 1 });
    await service.changeStatus('e1', { status: SalesEnquiryStatus.WON, wonDate: '2026-10-21' }, ACTOR);
    expect(dateKey(tx.salesEnquiry.updateMany.mock.calls[0]![0].data.wonDate)).toBe('2026-10-21');
  });

  it('linking an existing contract is ALWAYS recorded as LINKED, however new it is or whoever created it (no timing heuristic)', async () => {
    tx.salesEnquiry.findUnique.mockResolvedValue(row({ status: SalesEnquiryStatus.WON }));
    tx.salesEnquiry.findFirst.mockResolvedValue(null);
    const source = (): string => tx.salesEnquiry.updateMany.mock.calls.at(-1)![0].data.contractLinkSource;
    contractsMock.findOne.mockResolvedValue(CONTRACT); // created by this same user 10 minutes ago
    await service.linkContract('e1', 'c1', ACTOR);
    expect(source()).toBe('LINKED');
    contractsMock.findOne.mockResolvedValue({ ...CONTRACT, createdAt: new Date() }); // created just now
    await service.linkContract('e1', 'c1', ACTOR);
    expect(source()).toBe('LINKED');
    contractsMock.findOne.mockResolvedValue({ ...CONTRACT, createdByUserId: 'someone-else', createdAt: new Date('2026-10-20T08:00:00Z') });
    await service.linkContract('e1', 'c1', ACTOR);
    expect(source()).toBe('LINKED');
  });

  describe('dashboard monthly figures', () => {
    const REPORTER: AuthUser = { ...ACTOR, permissions: [...ACTOR.permissions, 'sales.reports.read'] };
    const CONTRACT_READER: AuthUser = { ...REPORTER, permissions: [...REPORTER.permissions, 'contracts.read'] };
    beforeEach(() => {
      client.salesEnquiry.count.mockImplementation(async (a: { where?: { status?: string; estimatedValue?: null } }) => (a.where?.status === 'WON' && a.where.estimatedValue === null ? 3 : 0));
      client.salesEnquiry.aggregate.mockImplementation(async (a: { where?: { status?: string; estimatedValue?: unknown } }) =>
        a.where?.status === 'WON' && a.where.estimatedValue !== undefined
          ? { _count: 2, _sum: { estimatedValue: new Prisma.Decimal('1500.5') } }
          : { _count: 4, _sum: { estimatedValue: null, awardedValue: null } });
      client.salesEnquiry.groupBy.mockResolvedValue([]);
      client.salesEnquiry.findMany.mockResolvedValue([]);
      client.salesFollowUp.count.mockResolvedValue(0);
      client.salesFollowUp.findMany.mockResolvedValue([]);
      client.salesActivity.findMany.mockResolvedValue([]);
    });

    it('Confirmed Enquiries use the confirmation date; the estimate sums only recorded estimates and counts the missing ones', async () => {
      const d = await service.dashboard(REPORTER);
      expect(d.confirmedMonth).toEqual({ count: 4, estimatedValue: '1500.5', withEstimate: 2, withoutEstimate: 3 });
      const wonWhere = client.salesEnquiry.aggregate.mock.calls.map((c) => c[0].where).find((w: { status?: string; wonDate?: unknown }) => w.status === 'WON' && w.wonDate)!;
      expect(dateKey(wonWhere.wonDate.gte)).toBe('2026-10-01'); // wonDate, not enquiryDate: an October enquiry confirmed in November counts in November
    });

    it('an explicit zero estimate stays a recorded 0; no estimate at all stays null (never shown as 0)', async () => {
      client.salesEnquiry.aggregate.mockImplementation(async (a: { where?: { status?: string; estimatedValue?: unknown } }) =>
        a.where?.status === 'WON' && a.where.estimatedValue !== undefined ? { _count: 1, _sum: { estimatedValue: new Prisma.Decimal('0') } } : { _count: 1, _sum: { estimatedValue: null } });
      expect((await service.dashboard(REPORTER)).confirmedMonth).toMatchObject({ estimatedValue: '0', withEstimate: 1 });
      client.salesEnquiry.aggregate.mockImplementation(async () => ({ _count: 0, _sum: { estimatedValue: null } }));
      expect((await service.dashboard(REPORTER)).confirmedMonth).toMatchObject({ estimatedValue: null, withEstimate: 0 });
    });

    it('Contracts Created asks the Contracts service for the Kuwait month with the viewer scope; null without contracts.read or on failure', async () => {
      contractsMock.findAll = vi.fn().mockResolvedValue({ total: 5 });
      vi.setSystemTime(new Date('2026-10-31T21:00:00Z')); // November in Kuwait
      expect((await service.dashboard(CONTRACT_READER)).contractsCreated).toBe(5);
      expect(contractsMock.findAll).toHaveBeenCalledWith({ fromEnquiryMonth: '2026-11', page: 1, pageSize: 1 }, CONTRACT_READER);
      expect((await service.dashboard(REPORTER)).contractsCreated).toBeNull();
      contractsMock.findAll = vi.fn().mockRejectedValue(new ForbiddenException());
      expect((await service.dashboard(CONTRACT_READER)).contractsCreated).toBeNull();
    });

    it('the conversion rate stays in the report with its denominator explained', async () => {
      const r = await service.monthlyReport('2026-10');
      expect(r.conversionBasis).toMatch(/RECEIVED in the month/);
      expect(r).toHaveProperty('cohortConversionRate');
    });
  });
});

describe('follow-ups', () => {
  const pending = { id: 'f1', enquiryId: 'e1', status: SalesFollowUpStatus.PENDING, followUpDate: new Date('2026-10-20T00:00:00Z'), notes: 'Call', responsibleUserId: 'u1' };

  it('completing keeps the record (status change, not delete) and refreshes the enquiry next follow-up', async () => {
    tx.salesFollowUp.findUnique.mockResolvedValue(pending);
    tx.salesFollowUp.updateMany.mockResolvedValue({ count: 1 });
    await service.completeFollowUp('f1', { completionNotes: 'Spoke to client' }, ACTOR);
    const upd = tx.salesFollowUp.updateMany.mock.calls[0]![0];
    expect(upd.data.status).toBe(SalesFollowUpStatus.COMPLETED);
    expect(upd.data.completedByUserId).toBe('u1');
    expect(tx.salesEnquiry.update.mock.calls[0]![0].data).toEqual({ nextFollowUpDate: null });
  });

  it('a completed follow-up cannot be completed or rescheduled again', async () => {
    tx.salesFollowUp.findUnique.mockResolvedValue({ ...pending, status: SalesFollowUpStatus.COMPLETED });
    await expect(service.completeFollowUp('f1', {}, ACTOR)).rejects.toThrow(UnprocessableEntityException);
    await expect(service.rescheduleFollowUp('f1', { followUpDate: '2026-11-01' }, ACTOR)).rejects.toThrow(UnprocessableEntityException);
  });

  it('a double click cannot complete twice', async () => {
    tx.salesFollowUp.findUnique.mockResolvedValue(pending);
    tx.salesFollowUp.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.completeFollowUp('f1', {}, ACTOR)).rejects.toThrow(UnprocessableEntityException);
  });

  it('rescheduling cancels the old one and creates a linked new one (history preserved)', async () => {
    tx.salesFollowUp.findUnique.mockResolvedValue(pending);
    tx.salesFollowUp.updateMany.mockResolvedValue({ count: 1 });
    tx.salesFollowUp.create.mockResolvedValue({ id: 'f2' });
    const res = await service.rescheduleFollowUp('f1', { followUpDate: '2026-11-03' }, ACTOR);
    expect(res.id).toBe('f2');
    expect(tx.salesFollowUp.updateMany.mock.calls[0]![0].data.status).toBe(SalesFollowUpStatus.CANCELLED);
    const created = tx.salesFollowUp.create.mock.calls[0]![0].data;
    expect(created.rescheduledFromId).toBe('f1');
    expect(created.notes).toBe('Call');
    expect(dateKey(created.followUpDate)).toBe('2026-11-03');
  });

  it('rescheduling to a past date is refused and changes nothing', async () => {
    await expect(service.rescheduleFollowUp('f1', { followUpDate: '2026-10-20' }, ACTOR)).rejects.toThrow(/before today/);
    expect(tx.salesFollowUp.updateMany).not.toHaveBeenCalled();
  });

  it('completing one task of an enquiry touches only that task and never the enquiry status', async () => {
    tx.salesFollowUp.findUnique.mockResolvedValue(pending);
    tx.salesFollowUp.updateMany.mockResolvedValue({ count: 1 });
    tx.salesFollowUp.findFirst.mockResolvedValue({ followUpDate: new Date('2026-10-30T00:00:00Z') });
    await service.completeFollowUp('f1', {}, ACTOR);
    expect(tx.salesFollowUp.updateMany.mock.calls[0]![0].where).toEqual({ id: 'f1', status: SalesFollowUpStatus.PENDING });
    expect(tx.salesEnquiry.update.mock.calls[0]![0].data).toEqual({ nextFollowUpDate: new Date('2026-10-30T00:00:00Z') }); // earliest remaining pending task
    expect(tx.salesEnquiry.updateMany).not.toHaveBeenCalled();
  });

  it('the task list defaults to Pending, earliest due first, paginated, with a count for every filter', async () => {
    client.salesFollowUp.findMany.mockResolvedValue([]);
    client.salesFollowUp.count.mockResolvedValueOnce(7).mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(4).mockResolvedValueOnce(9);
    const r = await service.listFollowUps({});
    const call = client.salesFollowUp.findMany.mock.calls[0]![0];
    expect(call.where).toEqual({ status: SalesFollowUpStatus.PENDING });
    expect(call.orderBy[0]).toEqual({ followUpDate: 'asc' });
    expect(call.take).toBe(15);
    expect(r.counts).toEqual({ PENDING: 7, OVERDUE: 2, TODAY: 1, UPCOMING: 4, COMPLETED: 9 });
    expect(r.pagination).toMatchObject({ page: 1, total: 7, totalPages: 1 });
  });

  it('Overdue / Today / Upcoming split on the Kuwait calendar day; Completed lists completed tasks only', async () => {
    client.salesFollowUp.findMany.mockResolvedValue([]);
    client.salesFollowUp.count.mockResolvedValue(0);
    await service.listFollowUps({ bucket: 'OVERDUE' });
    await service.listFollowUps({ bucket: 'TODAY' });
    await service.listFollowUps({ bucket: 'UPCOMING', page: 2, pageSize: 10 });
    await service.listFollowUps({ bucket: 'COMPLETED' });
    const wheres = client.salesFollowUp.findMany.mock.calls.map((c: unknown[]) => (c[0] as { where: { followUpDate?: unknown; status: unknown } }).where);
    expect(dateKey((wheres.at(-4)!.followUpDate as { lt: Date }).lt)).toBe('2026-10-21');
    expect(dateKey(wheres.at(-3)!.followUpDate as Date)).toBe('2026-10-21');
    expect(dateKey((wheres.at(-2)!.followUpDate as { gt: Date }).gt)).toBe('2026-10-21');
    expect(client.salesFollowUp.findMany.mock.calls.at(-2)![0]).toMatchObject({ skip: 10, take: 10 });
    expect(wheres.at(-1)).toEqual({ status: SalesFollowUpStatus.COMPLETED });
  });

  it('scheduling another follow-up never overwrites existing ones', async () => {
    tx.salesFollowUp.create.mockResolvedValue({ id: 'f3' });
    await service.addFollowUp('e1', { followUpDate: '2026-11-10' }, ACTOR);
    expect(tx.salesFollowUp.create).toHaveBeenCalledTimes(1);
    expect(tx.salesFollowUp.update).not.toHaveBeenCalled();
    expect(tx.salesFollowUp.updateMany).not.toHaveBeenCalled();
  });
});

describe('register search', () => {
  it('searches company, contact, number, project and enquiry number; filters by month and open status', async () => {
    client.salesEnquiry.findMany.mockResolvedValue([]);
    client.salesEnquiry.count.mockResolvedValue(0);
    await service.list({ search: '5551', status: 'open', month: '2026-10', page: 2, pageSize: 10 });
    const args = client.salesEnquiry.findMany.mock.calls[0]![0];
    expect(args.where.OR).toHaveLength(5);
    expect(args.where.status).toEqual({ notIn: ['WON', 'LOST'] });
    expect(dateKey(args.where.enquiryDate.gte)).toBe('2026-10-01');
    expect(dateKey(args.where.enquiryDate.lt)).toBe('2026-11-01');
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
  });
});

describe('register status filter accepts several statuses (Under Discussion = Meeting Done + Contacted)', () => {
  it('a comma list becomes an IN filter; one status stays a plain match', async () => {
    client.salesEnquiry.findMany.mockResolvedValue([]);
    client.salesEnquiry.count.mockResolvedValue(0);
    await service.list({ status: 'MEETING_DONE,CONTACTED' });
    expect(client.salesEnquiry.findMany.mock.calls.at(-1)![0].where.status).toEqual({ in: ['MEETING_DONE', 'CONTACTED'] });
    await service.list({ status: 'WON' });
    expect(client.salesEnquiry.findMany.mock.calls.at(-1)![0].where.status).toBe('WON');
  });
});

describe('Enquiry Conversion (FMP-SALES-15)', () => {
  const g = (date: string, status: SalesEnquiryStatus, n: number): { enquiryDate: Date; status: SalesEnquiryStatus; _count: { _all: number } } => ({ enquiryDate: new Date(date + 'T00:00:00Z'), status, _count: { _all: n } });

  it('3 confirmed of 10 received is 30%; Not Proceeding and active enquiries stay in the denominator', () => {
    const r = enquiryConversion([g('2026-11-02', SalesEnquiryStatus.WON, 3), g('2026-11-03', SalesEnquiryStatus.LOST, 2), g('2026-11-04', SalesEnquiryStatus.NEW_ENQUIRY, 5)], '2026-11');
    expect(r.allTime).toEqual({ period: 'all', received: 10, confirmed: 3, rate: 30 });
    expect(r.months).toEqual([{ period: '2026-11', received: 10, confirmed: 3, rate: 30 }]);
  });

  it('no enquiries: no rate (shown as —), never a division by zero; enquiries without confirmations: 0%', () => {
    expect(enquiryConversion([], '2026-11')).toEqual({ allTime: { period: 'all', received: 0, confirmed: 0, rate: null }, months: [{ period: '2026-11', received: 0, confirmed: 0, rate: null }] });
    expect(enquiryConversion([g('2026-11-01', SalesEnquiryStatus.FOLLOW_UP, 4)], '2026-11').allTime.rate).toBe(0);
  });

  it('an enquiry received in October and confirmed in November counts in the October group and All Time, not in November', () => {
    const r = enquiryConversion([g('2026-10-20', SalesEnquiryStatus.WON, 1), g('2026-10-21', SalesEnquiryStatus.QUOTATION_SENT, 2), g('2026-11-02', SalesEnquiryStatus.NEW_ENQUIRY, 1)], '2026-11');
    expect(r.months.map((m) => [m.period, m.received, m.confirmed])).toEqual([['2026-11', 1, 0], ['2026-10', 3, 1]]); // newest first
    expect(r.allTime).toMatchObject({ received: 4, confirmed: 1, rate: 25 });
  });

  it('rounds to one decimal; the current Kuwait month is always offered even before its first enquiry', () => {
    const r = enquiryConversion([g('2026-09-10', SalesEnquiryStatus.WON, 1), g('2026-09-11', SalesEnquiryStatus.NEW_ENQUIRY, 2)], '2026-11');
    expect(r.allTime.rate).toBe(33.3);
    expect(r.months.map((m) => m.period)).toEqual(['2026-11', '2026-09']);
  });

  it('the dashboard counts every enquiry the viewer may read, by received date and current status (not a page or preview)', async () => {
    client.salesEnquiry.count.mockResolvedValue(0);
    client.salesEnquiry.aggregate.mockResolvedValue({ _count: 0, _sum: { estimatedValue: null, awardedValue: null } });
    client.salesEnquiry.findMany.mockResolvedValue([]);
    client.salesFollowUp.count.mockResolvedValue(0);
    client.salesFollowUp.findMany.mockResolvedValue([]);
    client.salesActivity.findMany.mockResolvedValue([]);
    client.salesEnquiry.groupBy.mockImplementation(async (a: { by: string[] }) => (a.by.includes('enquiryDate') ? [g('2026-10-05', SalesEnquiryStatus.WON, 3), g('2026-10-06', SalesEnquiryStatus.LOST, 7)] : []));
    const d = await service.dashboard(ACTOR);
    const call = client.salesEnquiry.groupBy.mock.calls.map((x) => x[0] as { by: string[]; where?: unknown }).find((a) => a.by.includes('enquiryDate'))!;
    expect(call.by).toEqual(['enquiryDate', 'status']);
    expect(call.where).toBeUndefined(); // no paging, no preview limit
    expect(d.enquiryConversion.allTime).toEqual({ period: 'all', received: 10, confirmed: 3, rate: 30 });
  });

  it('FMP-SALES-16: the current-month group follows the Kuwait calendar, so at Kuwait midnight on 1 December the card switches to December', async () => {
    client.salesEnquiry.groupBy.mockImplementation(async (a: { by: string[] }) => (a.by.includes('enquiryDate') ? [g('2026-11-20', SalesEnquiryStatus.WON, 1), g('2026-11-21', SalesEnquiryStatus.NEW_ENQUIRY, 1)] : []));
    vi.setSystemTime(new Date('2026-11-30T20:59:59Z')); // 23:59:59 on 30 November in Kuwait
    const nov = await service.dashboard(ACTOR);
    expect(nov.month).toBe('2026-11');
    expect(nov.enquiryConversion.months.find((m) => m.period === nov.month)).toEqual({ period: '2026-11', received: 2, confirmed: 1, rate: 50 });
    vi.setSystemTime(new Date('2026-11-30T21:00:00Z')); // 00:00 on 1 December in Kuwait
    const dec = await service.dashboard(ACTOR);
    expect(dec.month).toBe('2026-12');
    expect(dec.enquiryConversion.months.find((m) => m.period === dec.month)).toEqual({ period: '2026-12', received: 0, confirmed: 0, rate: null });
  });
});

describe('Monthly Results by received month (FMP-SALES-17)', () => {
  type Fx = { enquiryDate: string; status: SalesEnquiryStatus; estimatedValue: string | null; wonDate?: string | null };
  let rows: Fx[] = [];
  const CONTRACT_READER: AuthUser = { ...ACTOR, permissions: [...ACTOR.permissions, 'contracts.read'] };
  type W = { enquiryDate?: { gte: Date; lt: Date }; status?: unknown; estimatedValue?: unknown; wonDate?: { gte: Date; lt: Date } };
  const inRange = (d: string | null | undefined, r?: { gte: Date; lt: Date }): boolean => !r || (!!d && d >= dateKey(r.gte)! && d < dateKey(r.lt)!);
  const match = (w: W = {}) => rows.filter((r) =>
    inRange(r.enquiryDate, w.enquiryDate) && (!w.wonDate || inRange(r.wonDate, w.wonDate)) &&
    (typeof w.status !== 'string' || r.status === w.status) &&
    (w.estimatedValue === undefined || (w.estimatedValue === null ? r.estimatedValue === null : r.estimatedValue !== null)));
  beforeEach(() => {
    rows = [];
    client.salesEnquiry.count.mockImplementation(async (a: { where?: W }) => match(a.where).length);
    client.salesEnquiry.aggregate.mockImplementation(async (a: { where?: W }) => {
      const m = match(a.where);
      const sum = m.filter((r) => r.estimatedValue !== null).reduce<Prisma.Decimal | null>((s, r) => (s ?? new Prisma.Decimal(0)).plus(r.estimatedValue!), null);
      return { _count: m.length, _sum: { estimatedValue: sum, awardedValue: null } };
    });
    client.salesEnquiry.groupBy.mockImplementation(async (a: { by: string[] }) => {
      if (!a.by.includes('enquiryDate')) return [];
      return rows.map((r) => ({ enquiryDate: new Date(`${r.enquiryDate}T00:00:00Z`), status: r.status, _count: { _all: 1 } }));
    });
    client.salesEnquiry.findMany.mockResolvedValue([]);
    client.salesFollowUp.count.mockResolvedValue(0);
    client.salesFollowUp.findMany.mockResolvedValue([]);
    client.salesActivity.findMany.mockResolvedValue([]);
    contractsMock.findAll = vi.fn().mockResolvedValue({ total: 0 });
    vi.setSystemTime(new Date('2026-11-08T09:00:00Z'));
  });
  const W = SalesEnquiryStatus.WON;

  it('defaults to the current Kuwait month and follows it', async () => {
    const d = await service.dashboard(ACTOR);
    expect([d.reportMonth, d.reportFollowsCurrentMonth, d.reportMonths]).toEqual(['2026-11', true, ['2026-11']]);
    expect(d.monthlyResults).toMatchObject({ month: '2026-11', received: 0, confirmed: 0, conversionRate: null });
  });

  it('an October enquiry confirmed in November counts in October, not November; November 1 of 1 = 100%', async () => {
    rows = [
      { enquiryDate: '2026-10-20', status: W, estimatedValue: '1000', wonDate: '2026-11-03' },
      { enquiryDate: '2026-10-21', status: SalesEnquiryStatus.QUOTATION_SENT, estimatedValue: null },
      { enquiryDate: '2026-11-02', status: W, estimatedValue: '250.5', wonDate: '2026-11-04' },
    ];
    const nov = await service.dashboard(ACTOR);
    expect(nov.monthlyResults).toMatchObject({ received: 1, confirmed: 1, conversionRate: 100, confirmedValue: { estimatedValue: '250.5', withEstimate: 1, withoutEstimate: 0 } });
    expect(nov.confirmedMonth.count).toBe(2); // the confirmation-date figure is unchanged for its other consumers
    const oct = await service.dashboard(ACTOR, '2026-10');
    expect([oct.reportMonth, oct.reportFollowsCurrentMonth, oct.month]).toEqual(['2026-10', false, '2026-11']);
    expect(oct.monthlyResults).toMatchObject({ month: '2026-10', received: 2, confirmed: 1, conversionRate: 50, confirmedValue: { estimatedValue: '1000' } });
    expect(oct.reportMonths).toEqual(['2026-11', '2026-10']);
    expect(oct.enquiriesThisMonth).toBe(1); // operational figures stay on the current month
  });

  it('Not Proceeding stays in the denominator; no confirmed gives 0%; an empty month gives null', async () => {
    rows = [
      { enquiryDate: '2026-09-01', status: SalesEnquiryStatus.LOST, estimatedValue: null },
      { enquiryDate: '2026-09-02', status: SalesEnquiryStatus.NEW_ENQUIRY, estimatedValue: null },
      { enquiryDate: '2026-09-03', status: W, estimatedValue: null },
    ];
    expect((await service.dashboard(ACTOR, '2026-09')).monthlyResults).toMatchObject({ received: 3, confirmed: 1, conversionRate: 33.3, confirmedValue: { estimatedValue: null, withEstimate: 0, withoutEstimate: 1 } });
    rows[2]!.status = SalesEnquiryStatus.FOLLOW_UP; // reopened
    expect((await service.dashboard(ACTOR, '2026-09')).monthlyResults).toMatchObject({ received: 3, confirmed: 0, conversionRate: 0 });
    rows[2]!.status = W; // reconfirmed: counted once
    expect((await service.dashboard(ACTOR, '2026-09')).monthlyResults).toMatchObject({ received: 3, confirmed: 1 });
    expect((await service.dashboard(ACTOR, '2026-08')).monthlyResults).toMatchObject({ received: 0, confirmed: 0, conversionRate: null });
  });

  it('a recorded zero estimate is 0, not missing', async () => {
    rows = [{ enquiryDate: '2026-11-01', status: W, estimatedValue: '0' }];
    expect((await service.dashboard(ACTOR)).monthlyResults.confirmedValue).toEqual({ estimatedValue: '0', withEstimate: 1, withoutEstimate: 0 });
  });

  it('a future month falls back to the current month; a selected empty month is still offered', async () => {
    const f = await service.dashboard(ACTOR, '2027-01');
    expect([f.reportMonth, f.reportFollowsCurrentMonth]).toEqual(['2026-11', true]);
    const e = await service.dashboard(ACTOR, '2025-03');
    expect(e.reportMonths).toEqual(['2026-11', '2025-03']);
  });

  it('Contracts Created follows the selected month with the viewer scope; months with enquiry-created contracts are offered', async () => {
    client.salesEnquiry.findMany.mockImplementation(async (a: { where?: { contractLinkSource?: string } }) =>
      a.where?.contractLinkSource === 'CREATED' ? [{ contract: { createdAt: new Date('2026-06-30T21:30:00Z') } }] : []); // 1 July in Kuwait
    contractsMock.findAll = vi.fn().mockImplementation(async (q: { fromEnquiryMonth: string }) => ({ total: q.fromEnquiryMonth === '2026-07' ? 1 : 0 }));
    const d = await service.dashboard(CONTRACT_READER, '2026-07');
    expect(contractsMock.findAll).toHaveBeenCalledWith({ fromEnquiryMonth: '2026-07', page: 1, pageSize: 1 }, CONTRACT_READER);
    expect(d.reportMonths).toEqual(['2026-11', '2026-07']);
    expect(d.monthlyResults.contractsCreated).toBe(1);
    // A viewer whose department scope hides that contract is not offered the month.
    contractsMock.findAll = vi.fn().mockResolvedValue({ total: 0 });
    expect((await service.dashboard(CONTRACT_READER)).reportMonths).toEqual(['2026-11']);
    const noContracts = await service.dashboard(ACTOR, '2026-07');
    expect(noContracts.monthlyResults.contractsCreated).toBeNull();
  });

  it('the list month filter and the cards share one received-date rule', async () => {
    client.salesEnquiry.findMany.mockResolvedValue([]);
    client.salesEnquiry.count.mockResolvedValue(0);
    await service.list({ month: '2026-10', status: 'WON' });
    const where = client.salesEnquiry.count.mock.calls.at(-1)![0].where;
    expect(where.status).toBe('WON');
    expect([dateKey(where.enquiryDate.gte), dateKey(where.enquiryDate.lt)]).toEqual(['2026-10-01', '2026-11-01']);
    expect(where.wonDate).toBeUndefined();
  });
});

describe('custom in-progress statuses (FMP-SALES-18)', () => {
  const CS = { id: '5f0c6c1e-7d1a-4e7b-9c1d-2a3b4c5d6e7f', name: 'Waiting for Site Visit' };
  beforeEach(() => {
    tx.salesCustomStatus.findUnique.mockResolvedValue(null);
    tx.salesCustomStatus.create.mockImplementation(async ({ data }: { data: { name: string } }) => ({ id: CS.id, name: data.name }));
    tx.salesEnquiry.findUnique.mockResolvedValue(row({ status: SalesEnquiryStatus.FOLLOW_UP, customStatusId: null, customStatus: null }));
  });
  const reason = async (p: Promise<unknown>): Promise<string> => {
    try { await p; return 'resolved'; } catch (e) { return ((e as { getResponse?: () => { code: string } }).getResponse?.() ?? { code: String(e) }).code; }
  };

  it('normalises the name, creates it and applies it in the same transaction, with history and audit', async () => {
    await service.createAndApplyCustomStatus('e1', { name: '  Waiting   for\tSite Visit ', expectedStatus: SalesEnquiryStatus.FOLLOW_UP }, ACTOR);
    expect(client.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.salesCustomStatus.create).toHaveBeenCalledWith(expect.objectContaining({ data: { name: 'Waiting for Site Visit', nameKey: 'waiting for site visit', createdByUserId: 'u1' } }));
    const upd = tx.salesEnquiry.updateMany.mock.calls[0]![0];
    expect(upd.where).toEqual({ id: 'e1', status: SalesEnquiryStatus.FOLLOW_UP, customStatusId: null });
    expect(upd.data).toMatchObject({ status: SalesEnquiryStatus.CUSTOM, customStatusId: CS.id, wonDate: null, lostDate: null });
    const meta = tx.salesActivity.create.mock.calls[0]![0].data.metadata;
    expect(meta).toMatchObject({ from: 'FOLLOW_UP', to: 'CUSTOM', fromLabel: 'Follow-up Needed', toLabel: 'Waiting for Site Visit', toCustomStatusId: CS.id, customStatusCreated: true });
    expect(tx.securityAuditEvent.create.mock.calls.map((c) => c[0].data.event)).toEqual(['SALES_CUSTOM_STATUS_CREATED', 'SALES_ENQUIRY_STATUS_CHANGED']);
    expect(tx.salesFollowUp.updateMany).not.toHaveBeenCalled(); // follow-ups are never completed or changed
  });

  it.each([
    ['', 'SALES_CUSTOM_STATUS_NAME_INVALID'], ['   ', 'SALES_CUSTOM_STATUS_NAME_INVALID'], ['x'.repeat(61), 'SALES_CUSTOM_STATUS_NAME_INVALID'], ['---', 'SALES_CUSTOM_STATUS_NAME_INVALID'],
    ['won', 'SALES_CUSTOM_STATUS_NAME_INVALID'], [' CONFIRMED ', 'SALES_CUSTOM_STATUS_NAME_INVALID'], ['Not-Proceeding', 'SALES_CUSTOM_STATUS_NAME_INVALID'], ['lost', 'SALES_CUSTOM_STATUS_NAME_INVALID'],
    ['new', 'SALES_CUSTOM_STATUS_NAME_INVALID'], ['follow up needed', 'SALES_CUSTOM_STATUS_NAME_INVALID'], ['waiting_for_drawings', 'SALES_CUSTOM_STATUS_NAME_INVALID'], ['Under  Discussion', 'SALES_CUSTOM_STATUS_NAME_INVALID'],
  ])('refuses %j before creating anything', async (name, code) => {
    expect(await reason(service.createAndApplyCustomStatus('e1', { name }, ACTOR))).toBe(code);
    expect(tx.salesCustomStatus.create).not.toHaveBeenCalled();
  });

  it('a case or spacing variant of an existing custom status is refused; a concurrent insert (P2002) gives the same message', async () => {
    tx.salesCustomStatus.findUnique.mockResolvedValue({ name: 'Waiting for Site Visit' });
    expect(await reason(service.createAndApplyCustomStatus('e1', { name: 'WAITING for site-visit' }, ACTOR))).toBe('SALES_CUSTOM_STATUS_EXISTS');
    expect(tx.salesCustomStatus.create).not.toHaveBeenCalled();
    tx.salesCustomStatus.findUnique.mockResolvedValue(null);
    tx.salesCustomStatus.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }));
    client.salesCustomStatus.findUnique.mockResolvedValue({ name: 'Waiting for Site Visit' });
    expect(await reason(service.createAndApplyCustomStatus('e1', { name: 'Waiting for site visit' }, ACTOR))).toBe('SALES_CUSTOM_STATUS_EXISTS');
  });

  it('applying fails inside the creating transaction (so the new status is rolled back): linked contract, conflict, same status', async () => {
    tx.salesEnquiry.findUnique.mockResolvedValue(row({ status: SalesEnquiryStatus.WON, contractId: 'c1', customStatusId: null, customStatus: null }));
    expect(await reason(service.createAndApplyCustomStatus('e1', { name: 'Site Visit Booked' }, ACTOR))).toBe('SALES_ENQUIRY_HAS_CONTRACT');
    expect(tx.salesCustomStatus.create).toHaveBeenCalledTimes(1); // created, then the transaction threw: Postgres discards both
    expect(tx.salesEnquiry.updateMany).not.toHaveBeenCalled();
    tx.salesEnquiry.findUnique.mockResolvedValue(row({ status: SalesEnquiryStatus.FOLLOW_UP, customStatusId: null, customStatus: null }));
    expect(await reason(service.createAndApplyCustomStatus('e1', { name: 'Site Visit Booked', expectedStatus: SalesEnquiryStatus.QUOTATION_SENT }, ACTOR))).toBe('SALES_STATUS_CONFLICT');
    tx.salesEnquiry.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await reason(service.createAndApplyCustomStatus('e1', { name: 'Site Visit Booked' }, ACTOR))).toBe('SALES_STATUS_CONFLICT');
  });

  it('Change Status to an existing custom status; the same one again is refused; another custom status is a change', async () => {
    tx.salesCustomStatus.findUnique.mockResolvedValue(CS);
    await service.changeStatus('e1', { status: SalesEnquiryStatus.CUSTOM, customStatusId: CS.id, expectedStatus: SalesEnquiryStatus.FOLLOW_UP }, ACTOR);
    expect(tx.salesEnquiry.updateMany.mock.calls[0]![0].data).toMatchObject({ status: 'CUSTOM', customStatusId: CS.id });
    tx.salesEnquiry.findUnique.mockResolvedValue(row({ status: SalesEnquiryStatus.CUSTOM, customStatusId: CS.id, customStatus: CS }));
    expect(await reason(service.changeStatus('e1', { status: SalesEnquiryStatus.CUSTOM, customStatusId: CS.id }, ACTOR))).toBe('SALES_STATUS_UNCHANGED');
    expect(await reason(service.changeStatus('e1', { status: SalesEnquiryStatus.CUSTOM, customStatusId: CS.id, expectedStatus: SalesEnquiryStatus.CUSTOM, expectedCustomStatusId: '6f0c6c1e-7d1a-4e7b-9c1d-2a3b4c5d6e7f' }, ACTOR))).toBe('SALES_STATUS_CONFLICT');
    const other = { id: '7a0c6c1e-7d1a-4e7b-9c1d-2a3b4c5d6e7f', name: 'Awaiting Samples' };
    tx.salesCustomStatus.findUnique.mockResolvedValue(other);
    await service.changeStatus('e1', { status: SalesEnquiryStatus.CUSTOM, customStatusId: other.id, expectedStatus: SalesEnquiryStatus.CUSTOM, expectedCustomStatusId: CS.id }, ACTOR);
    const last = tx.salesEnquiry.updateMany.mock.calls.at(-1)![0];
    expect(last.where).toEqual({ id: 'e1', status: 'CUSTOM', customStatusId: CS.id });
    expect(tx.salesActivity.create.mock.calls.at(-1)![0].data.metadata).toMatchObject({ fromLabel: 'Waiting for Site Visit', toLabel: 'Awaiting Samples' });
  });

  it('leaving a custom status clears the id; Confirmed keeps its usual fields; bad combinations are refused', async () => {
    tx.salesEnquiry.findUnique.mockResolvedValue(row({ status: SalesEnquiryStatus.CUSTOM, customStatusId: CS.id, customStatus: CS }));
    await service.changeStatus('e1', { status: SalesEnquiryStatus.WON }, ACTOR);
    expect(tx.salesEnquiry.updateMany.mock.calls[0]![0].data).toMatchObject({ status: 'WON', customStatusId: null, confirmedByUserId: 'u1' });
    expect(await reason(service.changeStatus('e1', { status: SalesEnquiryStatus.CUSTOM }, ACTOR))).toBe('SALES_CUSTOM_STATUS_REQUIRED');
    expect(await reason(service.changeStatus('e1', { status: SalesEnquiryStatus.FOLLOW_UP, customStatusId: CS.id }, ACTOR))).toBe('SALES_CUSTOM_STATUS_MISMATCH');
    tx.salesCustomStatus.findUnique.mockResolvedValue(null);
    expect(await reason(service.changeStatus('e1', { status: SalesEnquiryStatus.CUSTOM, customStatusId: CS.id }, ACTOR))).toBe('SALES_CUSTOM_STATUS_NOT_FOUND');
  });

  it('enquiries carry their custom status name; the list filters by one custom status', async () => {
    client.salesEnquiry.findMany.mockResolvedValue([row({ status: SalesEnquiryStatus.CUSTOM, customStatusId: CS.id, customStatus: CS })]);
    client.salesEnquiry.count.mockResolvedValue(1);
    client.salesActivity.findMany.mockResolvedValue([]);
    const res = await service.list({ status: `custom:${CS.id}` });
    expect(client.salesEnquiry.count.mock.calls.at(-1)![0].where).toEqual({ customStatusId: CS.id });
    expect(res.items[0]).toMatchObject({ status: 'CUSTOM', customStatus: CS, statusLabel: 'Waiting for Site Visit' });
    await service.list({ status: 'open' });
    expect(client.salesEnquiry.count.mock.calls.at(-1)![0].where).toEqual({ status: { notIn: ['WON', 'LOST'] } }); // custom = active
  });
});
