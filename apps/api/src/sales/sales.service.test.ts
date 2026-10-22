import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, SalesEnquiryStatus, SalesFollowUpStatus } from '@recafco/database';
import { SalesService } from './sales.service';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import { dateKey } from './sales.logic';

// ---------------------------------------------------------------------------
// Mock database: one transaction object that records every write.
// ---------------------------------------------------------------------------

const tx = {
  salesEnquiry: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  salesActivity: { create: vi.fn() },
  salesFollowUp: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  securityAuditEvent: { create: vi.fn() },
  user: { findUnique: vi.fn() },
  $queryRaw: vi.fn(),
};
const client = {
  salesEnquiry: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
  $transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
};
const service = new SalesService({ getClient: () => client } as unknown as DatabaseService);

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
    await service.create({ companyName: 'X', scopeOfWork: 'Y', nextFollowUpDate: '2026-10-28', remarks: 'Call back' }, ACTOR);
    const f = tx.salesFollowUp.create.mock.calls[0]![0].data;
    expect(dateKey(f.followUpDate)).toBe('2026-10-28');
    expect(f.notes).toBe('Call back');
    expect(f.responsibleUserId).toBe('u1');
    expect(tx.salesActivity.create).toHaveBeenCalledTimes(1);
    expect(tx.securityAuditEvent.create.mock.calls[0]![0].data.event).toBe('SALES_ENQUIRY_CREATED');
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

  it('moving the follow-up date cancels the old pending one (kept) and creates a new one', async () => {
    tx.salesEnquiry.findUnique.mockResolvedValue(row({ nextFollowUpDate: new Date('2026-10-25T00:00:00Z') }));
    tx.salesFollowUp.findMany.mockResolvedValue([{ id: 'f1', notes: 'n', responsibleUserId: 'u1', followUpDate: new Date('2026-10-25T00:00:00Z') }]);
    await service.update('e1', { nextFollowUpDate: '2026-11-02' }, ACTOR);
    expect(tx.salesFollowUp.update.mock.calls[0]![0].data.status).toBe(SalesFollowUpStatus.CANCELLED);
    const created = tx.salesFollowUp.create.mock.calls[0]![0].data;
    expect(dateKey(created.followUpDate)).toBe('2026-11-02');
    expect(created.rescheduledFromId).toBe('f1');
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
