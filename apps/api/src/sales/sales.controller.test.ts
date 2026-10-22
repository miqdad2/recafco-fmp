import { describe, it, expect } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PermissionGuard } from '../common/guards/permission.guard';
import type { AuthUser } from '../common/types/auth-user';
import { SalesController } from './sales.controller';
import { CreateEnquiryDto, ChangeStatusDto, AddActivityDto } from './dto/sales.dto';

const BASE: AuthUser = {
  id: 'u1', username: 'u', displayName: 'U', roleId: 'r1', roleCode: 'X', roleName: 'X', permissions: [],
  isActive: true, mustChangePassword: false, sessionId: 's1', departmentId: null,
};
const guard = new PermissionGuard(new Reflector());

function ctx(handler: keyof SalesController, user: AuthUser | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => SalesController.prototype[handler],
    getClass: () => SalesController,
  } as unknown as ExecutionContext;
}
const as = (permissions: string[]): AuthUser => ({ ...BASE, permissions });

const VIEWER = ['sales.read', 'sales.reports.read'];
const MANAGER = ['sales.read', 'sales.create', 'sales.update', 'sales.manage', 'sales.reports.read'];
const OPERATIONAL = ['contracts.read', 'contracts.update', 'production.read', 'production.update', 'users.read', 'tasks.read'];

describe('Sales authorization', () => {
  const reads: (keyof SalesController)[] = ['dashboard', 'followUps', 'list', 'getOne'];
  const writes: (keyof SalesController)[] = ['create', 'update', 'changeStatus', 'addActivity', 'addFollowUp', 'completeFollowUp', 'rescheduleFollowUp'];

  it('a Sales Viewer can read and see reports but cannot create or change anything', () => {
    for (const h of reads) expect(guard.canActivate(ctx(h, as(VIEWER)))).toBe(true);
    expect(guard.canActivate(ctx('monthly', as(VIEWER)))).toBe(true);
    for (const h of writes) expect(() => guard.canActivate(ctx(h, as(VIEWER)))).toThrow(ForbiddenException);
  });

  it('a Sales Manager can do everything', () => {
    for (const h of [...reads, ...writes, 'monthly' as const]) expect(guard.canActivate(ctx(h, as(MANAGER)))).toBe(true);
  });

  it('operational permissions (even many) give no Sales access', () => {
    for (const h of [...reads, ...writes, 'monthly' as const]) expect(() => guard.canActivate(ctx(h, as(OPERATIONAL)))).toThrow(ForbiddenException);
  });

  it('reports need sales.reports.read, which sales.read alone does not give', () => {
    expect(() => guard.canActivate(ctx('monthly', as(['sales.read'])))).toThrow(ForbiddenException);
  });

  it('there is no export route', () => {
    const names = Object.getOwnPropertyNames(SalesController.prototype);
    expect(names.filter((n) => /export|csv|download/i.test(n))).toEqual([]);
  });
});

async function errors(cls: new () => object, body: object): Promise<string[]> {
  const dto = plainToInstance(cls, body);
  const res = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return res.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('Sales input validation', () => {
  const ok = { companyName: 'Al Ghanim Trading', scopeOfWork: 'Steel canopy, 120 tonnes' };

  it('needs only company and scope', async () => {
    expect(await errors(CreateEnquiryDto, ok)).toEqual([]);
    expect(await errors(CreateEnquiryDto, { scopeOfWork: 'x' })).not.toEqual([]);
    expect(await errors(CreateEnquiryDto, { companyName: 'x' })).not.toEqual([]);
    expect(await errors(CreateEnquiryDto, { companyName: '   ', scopeOfWork: 'x' })).not.toEqual([]);
  });

  it('a blank estimated value, email or date is accepted and stays null (not 0)', async () => {
    const dto = plainToInstance(CreateEnquiryDto, { ...ok, estimatedValue: '  ', email: '', nextFollowUpDate: '', contactNumber: '' });
    expect(await validate(dto)).toEqual([]);
    expect(dto.estimatedValue).toBeNull();
    expect(dto.email).toBeNull();
    expect(dto.nextFollowUpDate).toBeNull();
    expect(dto.contactNumber).toBeNull();
  });

  it('accepts KWD with 3 decimals; rejects negative, 4 decimals and text', async () => {
    expect(await errors(CreateEnquiryDto, { ...ok, estimatedValue: '125000.500' })).toEqual([]);
    expect(await errors(CreateEnquiryDto, { ...ok, estimatedValue: 125000 })).toEqual([]);
    expect(await errors(CreateEnquiryDto, { ...ok, estimatedValue: '-1' })).not.toEqual([]);
    expect(await errors(CreateEnquiryDto, { ...ok, estimatedValue: '1.2345' })).not.toEqual([]);
    expect(await errors(CreateEnquiryDto, { ...ok, estimatedValue: 'lots' })).not.toEqual([]);
  });

  it('validates the email only when given', async () => {
    expect(await errors(CreateEnquiryDto, { ...ok, email: 'not-an-email' })).not.toEqual([]);
    expect(await errors(CreateEnquiryDto, { ...ok, email: 'buyer@example.com' })).toEqual([]);
  });

  it('cannot set server-owned fields (status, created by, enquiry date, number)', async () => {
    for (const bad of [{ status: 'WON' }, { createdByUserId: 'x' }, { enquiryDate: '2020-01-01' }, { enquiryNumber: 'ENQ-1' }]) {
      expect(await errors(CreateEnquiryDto, { ...ok, ...bad })).not.toEqual([]);
    }
  });

  it('status change and activity input', async () => {
    expect(await errors(ChangeStatusDto, { status: 'LOST', reason: 'Price' })).toEqual([]);
    expect(await errors(ChangeStatusDto, { status: 'MAYBE' })).not.toEqual([]);
    expect(await errors(AddActivityDto, { type: 'PHONE_CALL', activityDate: '2026-10-21', notes: 'Called, wants a quotation' })).toEqual([]);
    expect(await errors(AddActivityDto, { type: 'STATUS_CHANGE', activityDate: '2026-10-21', notes: 'x' })).not.toEqual([]);
    expect(await errors(AddActivityDto, { type: 'NOTE', activityDate: '21/10/2026', notes: 'x' })).not.toEqual([]);
    expect(await errors(AddActivityDto, { type: 'NOTE', activityDate: '2026-10-21', notes: '  ' })).not.toEqual([]);
  });
});

describe('status filter validation', () => {
  it('accepts open, one status or a comma list; rejects anything else', async () => {
    const { EnquiryListQueryDto } = await import('./dto/sales.dto');
    for (const ok of ['open', 'WON', 'MEETING_DONE,CONTACTED']) expect(await errors(EnquiryListQueryDto, { status: ok })).toEqual([]);
    for (const bad of ['WON,', 'won', 'WON;LOST', "x' OR 1=1"]) expect(await errors(EnquiryListQueryDto, { status: bad })).not.toEqual([]);
  });
});
