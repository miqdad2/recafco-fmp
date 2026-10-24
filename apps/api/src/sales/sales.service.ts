import { Injectable, NotFoundException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, SalesEnquiryStatus, SalesActivityType, SalesFollowUpStatus } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import type {
  CreateEnquiryDto, UpdateEnquiryDto, ChangeStatusDto, AddActivityDto, AddFollowUpDto, CompleteFollowUpDto,
  RescheduleFollowUpDto, EnquiryListQueryDto,
} from './dto/sales.dto';
import {
  kuwaitToday, dateOnly, dateKey, monthOf, monthRange, lastMonths, followUpBucket, cohortConversionRate, formatEnquiryNumber,
  statusChangeError, isValidDateString, CLOSED_STATUSES, type FollowUpBucket,
} from './sales.logic';

// ---------------------------------------------------------------------------
// FMP-SALES-01 — Sales & Enquiries. Every method that changes data writes an
// activity row (what the manager sees as history) and a security audit event.
// Dates are Kuwait calendar dates (YYYY-MM-DD); money is a decimal string.
// Nothing here reads or writes Contract Management.
// ---------------------------------------------------------------------------

const USER_REF = { select: { id: true, displayName: true } } as const;
const CLOSED: SalesEnquiryStatus[] = [...CLOSED_STATUSES];

type Db = ReturnType<DatabaseService['getClient']>;
type Tx = Parameters<Parameters<Db['$transaction']>[0]>[0];

type EnquiryRow = Prisma.SalesEnquiryGetPayload<{ include: { createdByUser: typeof USER_REF; assignedToUser: typeof USER_REF } }>;

const ENQUIRY_INCLUDE = { createdByUser: USER_REF, assignedToUser: USER_REF } as const;

export interface EnquiryView {
  id: string;
  enquiryNumber: string;
  companyName: string;
  contactPerson: string | null;
  contactNumber: string | null;
  email: string | null;
  enquiryDate: string;
  source: string | null;
  projectName: string | null;
  projectLocation: string | null;
  scopeOfWork: string;
  typeOfWork: string | null;
  estimatedValue: string | null;
  estimatedValueSource: string | null;
  currency: string;
  status: SalesEnquiryStatus;
  assignedTo: { id: string; displayName: string } | null;
  nextFollowUpDate: string | null;
  remarks: string | null;
  additionalNotes: string | null;
  expectedStartDate: string | null;
  expectedAwardDate: string | null;
  lostReason: string | null;
  awardedValue: string | null;
  wonDate: string | null;
  lostDate: string | null;
  createdBy: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
}

export function toEnquiryView(r: EnquiryRow): EnquiryView {
  return {
    id: r.id,
    enquiryNumber: r.enquiryNumber,
    companyName: r.companyName,
    contactPerson: r.contactPerson,
    contactNumber: r.contactNumber,
    email: r.email,
    enquiryDate: dateKey(r.enquiryDate)!,
    source: r.source,
    projectName: r.projectName,
    projectLocation: r.projectLocation,
    scopeOfWork: r.scopeOfWork,
    typeOfWork: r.typeOfWork,
    estimatedValue: r.estimatedValue === null ? null : r.estimatedValue.toString(),
    estimatedValueSource: r.estimatedValueSource,
    currency: r.currency,
    status: r.status,
    assignedTo: r.assignedToUser,
    nextFollowUpDate: dateKey(r.nextFollowUpDate),
    remarks: r.remarks,
    additionalNotes: r.additionalNotes,
    expectedStartDate: dateKey(r.expectedStartDate),
    expectedAwardDate: dateKey(r.expectedAwardDate),
    lostReason: r.lostReason,
    awardedValue: r.awardedValue === null ? null : r.awardedValue.toString(),
    wonDate: dateKey(r.wonDate),
    lostDate: dateKey(r.lostDate),
    createdBy: r.createdByUser,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

const FIELD_LABELS: Record<string, string> = {
  companyName: 'Company / Client Name',
  contactPerson: 'Contact Person',
  contactNumber: 'Contact Number',
  email: 'Email',
  projectName: 'Project Name',
  projectLocation: 'Project Location',
  scopeOfWork: 'Scope of Work',
  typeOfWork: 'Type of Work',
  estimatedValue: 'Estimated Project Value',
  estimatedValueSource: 'Estimated Value Source',
  source: 'Enquiry Source',
  remarks: 'Remarks',
  additionalNotes: 'Additional Notes',
  expectedStartDate: 'Expected Project Start Date',
  expectedAwardDate: 'Expected Contract Award Date',
  nextFollowUpDate: 'Next Follow-up Date',
  assignedToUserId: 'Assigned To',
};

@Injectable()
export class SalesService {
  constructor(private readonly db: DatabaseService) {}

  // -------------------------------------------------------------------------
  // helpers
  // -------------------------------------------------------------------------

  private async findOrThrow(client: Db | Tx, id: string): Promise<EnquiryRow> {
    const row = await client.salesEnquiry.findUnique({ where: { id }, include: ENQUIRY_INCLUDE });
    if (!row) throw new NotFoundException({ code: 'SALES_ENQUIRY_NOT_FOUND', message: 'Enquiry not found' });
    return row;
  }

  private audit(tx: Tx, event: string, actor: AuthUser, metadata: Record<string, unknown>): Promise<unknown> {
    return tx.securityAuditEvent.create({ data: { event, userId: actor.id, actorId: actor.id, metadata: metadata as Prisma.InputJsonValue } });
  }

  private invalid(code: string, message: string): UnprocessableEntityException {
    return new UnprocessableEntityException({ code, message });
  }

  /** The enquiry's "next follow-up" is always the earliest PENDING follow-up (or none). */
  private async syncNextFollowUp(tx: Tx, enquiryId: string): Promise<Date | null> {
    const next = await tx.salesFollowUp.findFirst({
      where: { enquiryId, status: SalesFollowUpStatus.PENDING },
      orderBy: { followUpDate: 'asc' },
      select: { followUpDate: true },
    });
    await tx.salesEnquiry.update({ where: { id: enquiryId }, data: { nextFollowUpDate: next?.followUpDate ?? null } });
    return next?.followUpDate ?? null;
  }

  private async nextEnquiryNumber(tx: Tx, year: number): Promise<string> {
    const rows = await tx.$queryRaw<[{ last_seq: number }]>`
      INSERT INTO sales_sequences (year, last_seq) VALUES (${year}, 1)
      ON CONFLICT (year) DO UPDATE SET last_seq = sales_sequences.last_seq + 1
      RETURNING last_seq
    `;
    return formatEnquiryNumber(year, Number(rows[0].last_seq));
  }

  // -------------------------------------------------------------------------
  // enquiries
  // -------------------------------------------------------------------------

  async create(dto: CreateEnquiryDto, actor: AuthUser): Promise<EnquiryView> {
    const today = kuwaitToday();
    for (const [label, v] of [['Next Follow-up Date', dto.nextFollowUpDate], ['Expected Project Start Date', dto.expectedStartDate], ['Expected Contract Award Date', dto.expectedAwardDate]] as const) {
      if (v && !isValidDateString(v)) throw this.invalid('SALES_INVALID_DATE', `${label} is not a real date`);
    }
    const year = Number(today.slice(0, 4));

    return this.db.getClient().$transaction(async (tx) => {
      const enquiryNumber = await this.nextEnquiryNumber(tx, year);
      const created = await tx.salesEnquiry.create({
        data: {
          enquiryNumber,
          companyName: dto.companyName,
          scopeOfWork: dto.scopeOfWork,
          enquiryDate: dateOnly(today),
          status: SalesEnquiryStatus.NEW_ENQUIRY,
          currency: 'KWD',
          createdByUserId: actor.id,
          assignedToUserId: actor.id,
          contactPerson: dto.contactPerson ?? null,
          contactNumber: dto.contactNumber ?? null,
          email: dto.email ?? null,
          projectName: dto.projectName ?? null,
          projectLocation: dto.projectLocation ?? null,
          typeOfWork: dto.typeOfWork ?? null,
          estimatedValue: dto.estimatedValue ?? null,
          estimatedValueSource: dto.estimatedValueSource ?? null,
          source: dto.source ?? null,
          remarks: dto.remarks ?? null,
          additionalNotes: dto.additionalNotes ?? null,
          expectedStartDate: dto.expectedStartDate ? dateOnly(dto.expectedStartDate) : null,
          expectedAwardDate: dto.expectedAwardDate ? dateOnly(dto.expectedAwardDate) : null,
          nextFollowUpDate: dto.nextFollowUpDate ? dateOnly(dto.nextFollowUpDate) : null,
        },
        include: ENQUIRY_INCLUDE,
      });

      await tx.salesActivity.create({
        data: {
          enquiryId: created.id,
          type: SalesActivityType.STATUS_CHANGE,
          activityDate: dateOnly(today),
          notes: 'Enquiry registered.',
          metadata: { from: null, to: SalesEnquiryStatus.NEW_ENQUIRY },
          recordedByUserId: actor.id,
        },
      });
      if (dto.nextFollowUpDate) {
        await tx.salesFollowUp.create({
          data: {
            enquiryId: created.id,
            followUpDate: dateOnly(dto.nextFollowUpDate),
            notes: dto.remarks ?? null,
            responsibleUserId: actor.id,
            createdByUserId: actor.id,
          },
        });
      }
      await this.audit(tx, 'SALES_ENQUIRY_CREATED', actor, { enquiryId: created.id, enquiryNumber });
      return toEnquiryView(created);
    });
  }

  async list(query: EnquiryListQueryDto): Promise<{
    items: EnquiryView[];
    today: string;
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.SalesEnquiryWhereInput = {};

    if (query.search) {
      const s = query.search;
      where.OR = [
        { companyName: { contains: s, mode: 'insensitive' } },
        { contactPerson: { contains: s, mode: 'insensitive' } },
        { contactNumber: { contains: s, mode: 'insensitive' } },
        { projectName: { contains: s, mode: 'insensitive' } },
        { enquiryNumber: { contains: s, mode: 'insensitive' } },
      ];
    }
    if (query.status === 'open') where.status = { notIn: CLOSED };
    else if (query.status) {
      const list = query.status.split(',') as SalesEnquiryStatus[];
      where.status = list.length === 1 ? list[0]! : { in: list };
    }
    if (query.month) {
      const { start, endExclusive } = monthRange(query.month);
      where.enquiryDate = { gte: start, lt: endExclusive };
    }

    const client = this.db.getClient();
    const [rows, total] = await Promise.all([
      client.salesEnquiry.findMany({
        where,
        include: ENQUIRY_INCLUDE,
        orderBy: [{ enquiryDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      client.salesEnquiry.count({ where }),
    ]);
    return {
      items: rows.map(toEnquiryView),
      today: kuwaitToday(),
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async getOne(id: string): Promise<{
    enquiry: EnquiryView;
    activities: ActivityView[];
    followUps: FollowUpView[];
    today: string;
  }> {
    const client = this.db.getClient();
    const row = await this.findOrThrow(client, id);
    const [activities, followUps] = await Promise.all([
      client.salesActivity.findMany({
        where: { enquiryId: id },
        include: { recordedByUser: USER_REF },
        orderBy: [{ activityDate: 'desc' }, { createdAt: 'desc' }],
      }),
      client.salesFollowUp.findMany({
        where: { enquiryId: id },
        include: { responsibleUser: USER_REF, completedByUser: USER_REF },
        orderBy: [{ followUpDate: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);
    const today = kuwaitToday();
    return {
      enquiry: toEnquiryView(row),
      activities: activities.map((a) => ({
        id: a.id,
        type: a.type,
        activityDate: dateKey(a.activityDate)!,
        notes: a.notes,
        metadata: (a.metadata ?? null) as Record<string, unknown> | null,
        recordedBy: a.recordedByUser,
        createdAt: a.createdAt.toISOString(),
      })),
      followUps: followUps.map((f) => toFollowUpView(f, today)),
      today,
    };
  }

  async update(id: string, dto: UpdateEnquiryDto, actor: AuthUser): Promise<EnquiryView> {
    for (const [label, v] of [['Next Follow-up Date', dto.nextFollowUpDate], ['Expected Project Start Date', dto.expectedStartDate], ['Expected Contract Award Date', dto.expectedAwardDate]] as const) {
      if (v && !isValidDateString(v)) throw this.invalid('SALES_INVALID_DATE', `${label} is not a real date`);
    }
    if (dto.assignedToUserId !== undefined && !actor.permissions.includes('sales.manage')) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
    }
    const today = kuwaitToday();

    return this.db.getClient().$transaction(async (tx) => {
      const before = await this.findOrThrow(tx, id);
      const beforeView = toEnquiryView(before);

      const data: Prisma.SalesEnquiryUncheckedUpdateInput = {};
      const changes: { field: string; label: string; from: string | null; to: string | null }[] = [];
      const track = (field: string, from: string | null, to: string | null | undefined): boolean => {
        if (to === undefined || (to ?? null) === (from ?? null)) return false;
        changes.push({ field, label: FIELD_LABELS[field] ?? field, from, to: to ?? null });
        return true;
      };

      const text = ['companyName', 'scopeOfWork', 'contactPerson', 'contactNumber', 'email', 'projectName', 'projectLocation', 'typeOfWork', 'estimatedValueSource', 'source', 'remarks', 'additionalNotes'] as const;
      for (const f of text) {
        const to = dto[f];
        if (track(f, beforeView[f] as string | null, to)) (data as Record<string, unknown>)[f] = to ?? null;
      }
      if (track('estimatedValue', beforeView.estimatedValue, dto.estimatedValue)) data.estimatedValue = dto.estimatedValue ?? null;
      if (track('expectedStartDate', beforeView.expectedStartDate, dto.expectedStartDate)) data.expectedStartDate = dto.expectedStartDate ? dateOnly(dto.expectedStartDate) : null;
      if (track('expectedAwardDate', beforeView.expectedAwardDate, dto.expectedAwardDate)) data.expectedAwardDate = dto.expectedAwardDate ? dateOnly(dto.expectedAwardDate) : null;
      if (dto.assignedToUserId !== undefined && dto.assignedToUserId !== before.assignedToUserId) {
        const target = await tx.user.findUnique({ where: { id: dto.assignedToUserId }, select: { id: true, isActive: true } });
        if (!target || !target.isActive) throw this.invalid('SALES_ASSIGNEE_INVALID', 'That user cannot be assigned');
        changes.push({ field: 'assignedToUserId', label: FIELD_LABELS['assignedToUserId']!, from: before.assignedToUserId, to: dto.assignedToUserId });
        data.assignedToUserId = dto.assignedToUserId;
      }

      const followUpChanged = dto.nextFollowUpDate !== undefined && (dto.nextFollowUpDate ?? null) !== beforeView.nextFollowUpDate;
      if (followUpChanged) changes.push({ field: 'nextFollowUpDate', label: FIELD_LABELS['nextFollowUpDate']!, from: beforeView.nextFollowUpDate, to: dto.nextFollowUpDate ?? null });
      if (changes.length === 0) return beforeView;

      if (Object.keys(data).length > 0) await tx.salesEnquiry.update({ where: { id }, data });

      if (followUpChanged) {
        // History is kept: an old pending follow-up is cancelled (never deleted) and a new one created.
        const pending = await tx.salesFollowUp.findMany({ where: { enquiryId: id, status: SalesFollowUpStatus.PENDING }, orderBy: { followUpDate: 'asc' } });
        const earliest = pending[0];
        if (dto.nextFollowUpDate) {
          if (earliest) {
            await tx.salesFollowUp.update({
              where: { id: earliest.id },
              data: { status: SalesFollowUpStatus.CANCELLED, completionNotes: `Rescheduled to ${dto.nextFollowUpDate}.` },
            });
          }
          await tx.salesFollowUp.create({
            data: {
              enquiryId: id,
              followUpDate: dateOnly(dto.nextFollowUpDate),
              notes: earliest?.notes ?? null,
              responsibleUserId: earliest?.responsibleUserId ?? actor.id,
              rescheduledFromId: earliest?.id ?? null,
              createdByUserId: actor.id,
            },
          });
        } else if (pending.length > 0) {
          await tx.salesFollowUp.updateMany({
            where: { enquiryId: id, status: SalesFollowUpStatus.PENDING },
            data: { status: SalesFollowUpStatus.CANCELLED, completionNotes: 'Follow-up date cleared.' },
          });
        }
        await this.syncNextFollowUp(tx, id);
      }

      await tx.salesActivity.create({
        data: {
          enquiryId: id,
          type: SalesActivityType.ENQUIRY_UPDATED,
          activityDate: dateOnly(today),
          notes: `Updated: ${changes.map((c) => c.label).join(', ')}.`,
          metadata: { changes } as unknown as Prisma.InputJsonValue,
          recordedByUserId: actor.id,
        },
      });
      await this.audit(tx, 'SALES_ENQUIRY_UPDATED', actor, { enquiryId: id, fields: changes.map((c) => c.field) });
      return toEnquiryView(await this.findOrThrow(tx, id));
    });
  }

  async changeStatus(id: string, dto: ChangeStatusDto, actor: AuthUser): Promise<EnquiryView> {
    const problem = statusChangeError(dto.status, dto.reason);
    if (problem) throw this.invalid('SALES_LOST_REASON_REQUIRED', problem);
    if (dto.wonDate && !isValidDateString(dto.wonDate)) throw this.invalid('SALES_INVALID_DATE', 'Confirmation date is not a real date');
    if (dto.status !== SalesEnquiryStatus.WON && (dto.awardedValue || dto.wonDate)) {
      throw this.invalid('SALES_WON_ONLY', 'Confirmed value and confirmation date can only be recorded when the enquiry is Confirmed');
    }
    const today = kuwaitToday();

    return this.db.getClient().$transaction(async (tx) => {
      const before = await this.findOrThrow(tx, id);
      if (dto.expectedStatus && before.status !== dto.expectedStatus) throw this.invalid('SALES_STATUS_CONFLICT', 'The enquiry was just changed by someone else. Please refresh and try again.');
      if (before.status === dto.status) throw this.invalid('SALES_STATUS_UNCHANGED', 'The enquiry already has this status');

      const data: Prisma.SalesEnquiryUncheckedUpdateInput = { status: dto.status };
      const meta: Record<string, unknown> = { from: before.status, to: dto.status };
      if (dto.status === SalesEnquiryStatus.WON) {
        data.wonDate = dateOnly(dto.wonDate ?? today);
        data.awardedValue = dto.awardedValue ?? null;
        data.lostReason = null;
        data.lostDate = null;
        meta['wonDate'] = dto.wonDate ?? today;
        meta['awardedValue'] = dto.awardedValue ?? null;
      } else if (dto.status === SalesEnquiryStatus.LOST) {
        data.lostReason = dto.reason!.trim();
        data.lostDate = dateOnly(today);
        data.wonDate = null;
        data.awardedValue = null;
        meta['reason'] = dto.reason!.trim();
      } else {
        // Re-opened: the outcome fields are cleared, but what they were stays in this activity's metadata.
        if (before.status === SalesEnquiryStatus.WON) {
          meta['previousWonDate'] = dateKey(before.wonDate);
          meta['previousAwardedValue'] = before.awardedValue === null ? null : before.awardedValue.toString();
        }
        if (before.status === SalesEnquiryStatus.LOST) meta['previousLostReason'] = before.lostReason;
        data.wonDate = null;
        data.awardedValue = null;
        data.lostReason = null;
        data.lostDate = null;
      }
      // Guarded write: only applies if nobody changed the status in the meantime.
      const res = await tx.salesEnquiry.updateMany({ where: { id, status: before.status }, data });
      if (res.count === 0) throw this.invalid('SALES_STATUS_CONFLICT', 'The enquiry was just changed by someone else. Please refresh and try again.');

      await tx.salesActivity.create({
        data: {
          enquiryId: id,
          type: SalesActivityType.STATUS_CHANGE,
          activityDate: dateOnly(today),
          notes: dto.reason ?? null,
          metadata: meta as Prisma.InputJsonValue,
          recordedByUserId: actor.id,
        },
      });
      await this.audit(tx, 'SALES_ENQUIRY_STATUS_CHANGED', actor, { enquiryId: id, from: before.status, to: dto.status });
      return toEnquiryView(await this.findOrThrow(tx, id));
    });
  }

  async addActivity(id: string, dto: AddActivityDto, actor: AuthUser): Promise<ActivityView> {
    if (!isValidDateString(dto.activityDate)) throw this.invalid('SALES_INVALID_DATE', 'Date is not a real date');
    return this.db.getClient().$transaction(async (tx) => {
      await this.findOrThrow(tx, id);
      const a = await tx.salesActivity.create({
        data: { enquiryId: id, type: dto.type, activityDate: dateOnly(dto.activityDate), notes: dto.notes, recordedByUserId: actor.id },
        include: { recordedByUser: USER_REF },
      });
      await this.audit(tx, 'SALES_ACTIVITY_RECORDED', actor, { enquiryId: id, activityId: a.id, type: dto.type });
      return {
        id: a.id, type: a.type, activityDate: dateKey(a.activityDate)!, notes: a.notes,
        metadata: null, recordedBy: a.recordedByUser, createdAt: a.createdAt.toISOString(),
      };
    });
  }

  // -------------------------------------------------------------------------
  // follow-ups
  // -------------------------------------------------------------------------

  async addFollowUp(id: string, dto: AddFollowUpDto, actor: AuthUser): Promise<{ id: string }> {
    if (!isValidDateString(dto.followUpDate)) throw this.invalid('SALES_INVALID_DATE', 'Follow-up date is not a real date');
    return this.db.getClient().$transaction(async (tx) => {
      await this.findOrThrow(tx, id);
      const f = await tx.salesFollowUp.create({
        data: { enquiryId: id, followUpDate: dateOnly(dto.followUpDate), notes: dto.notes ?? null, responsibleUserId: actor.id, createdByUserId: actor.id },
      });
      await this.syncNextFollowUp(tx, id);
      await this.audit(tx, 'SALES_FOLLOW_UP_SCHEDULED', actor, { enquiryId: id, followUpId: f.id, date: dto.followUpDate });
      return { id: f.id };
    });
  }

  private async pendingFollowUpOrThrow(tx: Tx, followUpId: string): Promise<{ id: string; enquiryId: string; notes: string | null; responsibleUserId: string | null; followUpDate: Date }> {
    const f = await tx.salesFollowUp.findUnique({ where: { id: followUpId } });
    if (!f) throw new NotFoundException({ code: 'SALES_FOLLOW_UP_NOT_FOUND', message: 'Follow-up not found' });
    if (f.status !== SalesFollowUpStatus.PENDING) throw this.invalid('SALES_FOLLOW_UP_NOT_PENDING', 'This follow-up is already completed or cancelled');
    return f;
  }

  async completeFollowUp(followUpId: string, dto: CompleteFollowUpDto, actor: AuthUser): Promise<{ id: string }> {
    const today = kuwaitToday();
    return this.db.getClient().$transaction(async (tx) => {
      const f = await this.pendingFollowUpOrThrow(tx, followUpId);
      // Guarded: a second click on the same follow-up cannot complete it twice.
      const res = await tx.salesFollowUp.updateMany({
        where: { id: followUpId, status: SalesFollowUpStatus.PENDING },
        data: { status: SalesFollowUpStatus.COMPLETED, completedAt: new Date(), completedByUserId: actor.id, completionNotes: dto.completionNotes ?? null },
      });
      if (res.count === 0) throw this.invalid('SALES_FOLLOW_UP_NOT_PENDING', 'This follow-up is already completed or cancelled');
      await this.syncNextFollowUp(tx, f.enquiryId);
      await tx.salesActivity.create({
        data: {
          enquiryId: f.enquiryId, type: SalesActivityType.FOLLOW_UP, activityDate: dateOnly(today),
          notes: dto.completionNotes ? `Follow-up completed: ${dto.completionNotes}` : 'Follow-up completed.',
          metadata: { followUpId, dueDate: dateKey(f.followUpDate) } as Prisma.InputJsonValue, recordedByUserId: actor.id,
        },
      });
      await this.audit(tx, 'SALES_FOLLOW_UP_COMPLETED', actor, { enquiryId: f.enquiryId, followUpId });
      return { id: followUpId };
    });
  }

  async rescheduleFollowUp(followUpId: string, dto: RescheduleFollowUpDto, actor: AuthUser): Promise<{ id: string }> {
    if (!isValidDateString(dto.followUpDate)) throw this.invalid('SALES_INVALID_DATE', 'New follow-up date is not a real date');
    const today = kuwaitToday();
    return this.db.getClient().$transaction(async (tx) => {
      const f = await this.pendingFollowUpOrThrow(tx, followUpId);
      const res = await tx.salesFollowUp.updateMany({
        where: { id: followUpId, status: SalesFollowUpStatus.PENDING },
        data: { status: SalesFollowUpStatus.CANCELLED, completionNotes: `Rescheduled to ${dto.followUpDate}.` },
      });
      if (res.count === 0) throw this.invalid('SALES_FOLLOW_UP_NOT_PENDING', 'This follow-up is already completed or cancelled');
      const created = await tx.salesFollowUp.create({
        data: {
          enquiryId: f.enquiryId, followUpDate: dateOnly(dto.followUpDate), notes: dto.notes ?? f.notes,
          responsibleUserId: f.responsibleUserId, rescheduledFromId: f.id, createdByUserId: actor.id,
        },
      });
      await this.syncNextFollowUp(tx, f.enquiryId);
      await tx.salesActivity.create({
        data: {
          enquiryId: f.enquiryId, type: SalesActivityType.FOLLOW_UP, activityDate: dateOnly(today),
          notes: `Follow-up moved from ${dateKey(f.followUpDate)} to ${dto.followUpDate}.`,
          metadata: { followUpId: created.id, rescheduledFromId: f.id } as Prisma.InputJsonValue, recordedByUserId: actor.id,
        },
      });
      await this.audit(tx, 'SALES_FOLLOW_UP_RESCHEDULED', actor, { enquiryId: f.enquiryId, from: f.id, to: created.id });
      return { id: created.id };
    });
  }

  async listFollowUps(bucket?: FollowUpBucket): Promise<{
    today: string;
    counts: Record<'OVERDUE' | 'TODAY' | 'UPCOMING' | 'COMPLETED', number>;
    items: FollowUpListItem[];
  }> {
    const client = this.db.getClient();
    const today = kuwaitToday();
    const include = {
      responsibleUser: USER_REF,
      completedByUser: USER_REF,
      enquiry: { select: { id: true, enquiryNumber: true, companyName: true, contactPerson: true, contactNumber: true, status: true } },
    } as const;
    const [pending, completed] = await Promise.all([
      client.salesFollowUp.findMany({ where: { status: SalesFollowUpStatus.PENDING }, include, orderBy: { followUpDate: 'asc' } }),
      client.salesFollowUp.findMany({ where: { status: SalesFollowUpStatus.COMPLETED }, include, orderBy: { completedAt: 'desc' }, take: 50 }),
    ]);
    const all: FollowUpListItem[] = [...pending, ...completed].map((f) => ({
      ...toFollowUpView(f, today),
      enquiry: { ...f.enquiry },
    }));
    const counts = { OVERDUE: 0, TODAY: 0, UPCOMING: 0, COMPLETED: 0 };
    for (const f of all) if (f.bucket !== 'CANCELLED') counts[f.bucket]++;
    return { today, counts, items: bucket ? all.filter((f) => f.bucket === bucket) : all };
  }

  // -------------------------------------------------------------------------
  // dashboard and reports
  // -------------------------------------------------------------------------

  /** Monthly figures. `rate` is the cohort rate: enquiries created in the month that are now Won / enquiries created in the month. */
  async monthlyReport(month: string): Promise<MonthlyReport> {
    const client = this.db.getClient();
    const { start, endExclusive } = monthRange(month);
    const created = { gte: start, lt: endExclusive };
    const [createdCount, cohortWon, wonInMonth, lostInMonth, createdEstimate, createdMissing] = await Promise.all([
      client.salesEnquiry.count({ where: { enquiryDate: created } }),
      client.salesEnquiry.count({ where: { enquiryDate: created, status: SalesEnquiryStatus.WON } }),
      client.salesEnquiry.aggregate({ where: { status: SalesEnquiryStatus.WON, wonDate: created }, _count: true, _sum: { awardedValue: true } }),
      client.salesEnquiry.count({ where: { status: SalesEnquiryStatus.LOST, lostDate: created } }),
      client.salesEnquiry.aggregate({ where: { enquiryDate: created, estimatedValue: { not: null } }, _sum: { estimatedValue: true } }),
      client.salesEnquiry.count({ where: { enquiryDate: created, estimatedValue: null } }),
    ]);
    return {
      month,
      enquiriesCreated: createdCount,
      cohortWon,
      cohortConversionRate: cohortConversionRate(createdCount, cohortWon),
      projectsWonInMonth: wonInMonth._count,
      awardedValueWonInMonth: wonInMonth._sum.awardedValue === null || wonInMonth._sum.awardedValue === undefined ? null : wonInMonth._sum.awardedValue.toString(),
      projectsLostInMonth: lostInMonth,
      estimatedValueCreated: createdEstimate._sum.estimatedValue === null || createdEstimate._sum.estimatedValue === undefined ? null : createdEstimate._sum.estimatedValue.toString(),
      createdWithoutEstimate: createdMissing,
    };
  }

  async dashboard(actor: AuthUser): Promise<SalesDashboard> {
    const client = this.db.getClient();
    const today = kuwaitToday();
    const month = monthOf(today);
    const { start, endExclusive } = monthRange(month);
    const months = lastMonths(month, 6);
    const trendStart = monthRange(months[0]!).start;
    const canReport = actor.permissions.includes('sales.reports.read');
    const open: Prisma.SalesEnquiryWhereInput = { status: { notIn: CLOSED } };

    const followUpEnquiry = { select: { id: true, enquiryNumber: true, companyName: true, contactPerson: true, contactNumber: true, status: true, scopeOfWork: true } } as const;
    const [thisMonth, overdue, dueToday, openCount, potential, openMissing, wonRes, statusGroups, attention, recent, trendRows, report, upcoming, upcomingCount, noFollowUp] = await Promise.all([
      client.salesEnquiry.count({ where: { enquiryDate: { gte: start, lt: endExclusive } } }),
      client.salesFollowUp.count({ where: { status: SalesFollowUpStatus.PENDING, followUpDate: { lt: dateOnly(today) } } }),
      client.salesFollowUp.count({ where: { status: SalesFollowUpStatus.PENDING, followUpDate: dateOnly(today) } }),
      client.salesEnquiry.count({ where: open }),
      client.salesEnquiry.aggregate({ where: { ...open, estimatedValue: { not: null } }, _sum: { estimatedValue: true } }),
      client.salesEnquiry.count({ where: { ...open, estimatedValue: null } }),
      client.salesEnquiry.aggregate({ where: { status: SalesEnquiryStatus.WON, wonDate: { gte: start, lt: endExclusive } }, _count: true, _sum: { awardedValue: true } }),
      client.salesEnquiry.groupBy({ by: ['status'], _count: { _all: true } }),
      client.salesFollowUp.findMany({
        where: { status: SalesFollowUpStatus.PENDING, followUpDate: { lte: dateOnly(today) } },
        include: {
          responsibleUser: USER_REF, completedByUser: USER_REF,
          enquiry: followUpEnquiry,
        },
        orderBy: { followUpDate: 'asc' },
        take: 6,
      }),
      client.salesEnquiry.findMany({ include: ENQUIRY_INCLUDE, orderBy: [{ enquiryDate: 'desc' }, { createdAt: 'desc' }], take: 6 }),
      client.salesEnquiry.findMany({ where: { enquiryDate: { gte: trendStart, lt: endExclusive } }, select: { enquiryDate: true } }),
      canReport ? this.monthlyReport(month) : Promise.resolve(null),
      client.salesFollowUp.findMany({
        where: { status: SalesFollowUpStatus.PENDING, followUpDate: { gt: dateOnly(today) }, enquiry: open },
        include: { responsibleUser: USER_REF, completedByUser: USER_REF, enquiry: followUpEnquiry },
        orderBy: { followUpDate: 'asc' },
        take: 5,
      }),
      client.salesFollowUp.count({ where: { status: SalesFollowUpStatus.PENDING, followUpDate: { gt: dateOnly(today) }, enquiry: open } }),
      client.salesEnquiry.count({ where: { ...open, followUps: { none: { status: SalesFollowUpStatus.PENDING } } } }),
    ]);

    const trendCounts = new Map<string, number>(months.map((m) => [m, 0]));
    for (const r of trendRows) {
      const key = monthOf(dateKey(r.enquiryDate)!);
      trendCounts.set(key, (trendCounts.get(key) ?? 0) + 1);
    }
    const statusCounts: Record<string, number> = {};
    for (const g of statusGroups) statusCounts[g.status] = g._count._all;

    return {
      today,
      month,
      enquiriesThisMonth: thisMonth,
      followUpsOverdue: overdue,
      followUpsDueToday: dueToday,
      followUpsDue: overdue + dueToday,
      openEnquiries: openCount,
      potentialValue: potential._sum.estimatedValue === null || potential._sum.estimatedValue === undefined ? null : potential._sum.estimatedValue.toString(),
      openWithoutEstimate: openMissing,
      projectsWon: wonRes._count,
      awardedValueWon: wonRes._sum.awardedValue === null || wonRes._sum.awardedValue === undefined ? null : wonRes._sum.awardedValue.toString(),
      // Cohort conversion (see monthlyReport). null when the viewer lacks sales.reports.read; rate null = N/A.
      conversion: report ? { rate: report.cohortConversionRate, created: report.enquiriesCreated, won: report.cohortWon } : null,
      statusCounts,
      followUpsNeedingAttention: attention.map((f) => ({ ...toFollowUpView(f, today), enquiry: { ...f.enquiry } })),
      upcomingFollowUps: upcoming.map((f) => ({ ...toFollowUpView(f, today), enquiry: { ...f.enquiry } })),
      upcomingFollowUpCount: upcomingCount,
      activeWithoutFollowUp: noFollowUp,
      recentEnquiries: recent.map(toEnquiryView),
      monthlyTrend: months.map((m) => ({ month: m, count: trendCounts.get(m) ?? 0 })),
    };
  }
}

// ---------------------------------------------------------------------------
// views
// ---------------------------------------------------------------------------

export interface ActivityView {
  id: string;
  type: SalesActivityType;
  activityDate: string;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  recordedBy: { id: string; displayName: string };
  createdAt: string;
}

export interface FollowUpView {
  id: string;
  enquiryId: string;
  followUpDate: string;
  notes: string | null;
  status: SalesFollowUpStatus;
  /** Where it sits against today in Kuwait: overdue / due today / upcoming / completed / cancelled. */
  bucket: FollowUpBucket;
  responsibleUser: { id: string; displayName: string } | null;
  completedAt: string | null;
  completedBy: { id: string; displayName: string } | null;
  completionNotes: string | null;
  rescheduledFromId: string | null;
}

export interface FollowUpListItem extends FollowUpView {
  enquiry: { id: string; enquiryNumber: string; companyName: string; contactPerson: string | null; contactNumber: string | null; status: SalesEnquiryStatus; /** Dashboard only. */ scopeOfWork?: string };
}

type FollowUpRow = Prisma.SalesFollowUpGetPayload<{ include: { responsibleUser: typeof USER_REF; completedByUser: typeof USER_REF } }>;

function toFollowUpView(f: FollowUpRow, today: string): FollowUpView {
  const date = dateKey(f.followUpDate)!;
  return {
    id: f.id,
    enquiryId: f.enquiryId,
    followUpDate: date,
    notes: f.notes,
    status: f.status,
    bucket: followUpBucket(f.status, date, today),
    responsibleUser: f.responsibleUser,
    completedAt: f.completedAt ? f.completedAt.toISOString() : null,
    completedBy: f.completedByUser,
    completionNotes: f.completionNotes,
    rescheduledFromId: f.rescheduledFromId,
  };
}

export interface MonthlyReport {
  month: string;
  enquiriesCreated: number;
  cohortWon: number;
  cohortConversionRate: number | null;
  projectsWonInMonth: number;
  awardedValueWonInMonth: string | null;
  projectsLostInMonth: number;
  estimatedValueCreated: string | null;
  createdWithoutEstimate: number;
}

export interface SalesDashboard {
  today: string;
  month: string;
  enquiriesThisMonth: number;
  followUpsOverdue: number;
  followUpsDueToday: number;
  followUpsDue: number;
  openEnquiries: number;
  potentialValue: string | null;
  openWithoutEstimate: number;
  projectsWon: number;
  awardedValueWon: string | null;
  conversion: { rate: number | null; created: number; won: number } | null;
  statusCounts: Record<string, number>;
  followUpsNeedingAttention: FollowUpListItem[];
  /** Next pending follow-ups after today (dashboard shows them when nothing is overdue or due today). */
  upcomingFollowUps: FollowUpListItem[];
  upcomingFollowUpCount: number;
  /** Active enquiries with no pending follow-up date at all (distinct from "nothing due"). */
  activeWithoutFollowUp: number;
  recentEnquiries: EnquiryView[];
  monthlyTrend: { month: string; count: number }[];
}
