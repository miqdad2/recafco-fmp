import { Injectable, NotFoundException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, SalesContractLinkSource, SalesEnquiryStatus, SalesActivityType, SalesFollowUpStatus } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { ContractsService } from '../contracts/contracts.service';
import { logContractActivity } from '../contracts/contract-activity-log';
import type { AuthUser } from '../common/types/auth-user';
import type {
  CreateEnquiryDto, UpdateEnquiryDto, ChangeStatusDto, AddActivityDto, AddFollowUpDto, CompleteFollowUpDto,
  RescheduleFollowUpDto, EnquiryListQueryDto,
} from './dto/sales.dto';
import {
  kuwaitToday, dateOnly, dateKey, monthOf, monthRange, lastMonths, followUpBucket, cohortConversionRate, formatEnquiryNumber,
  statusChangeError, isValidDateString, CLOSED_STATUSES, type FollowUpBucket,
} from './sales.logic';

/** Shown with the monthly report so the cohort rate is never misread as "confirmed this month / received this month". */
const CONVERSION_BASIS = 'Conversion rate = enquiries RECEIVED in the month that are now Confirmed, divided by all enquiries received in that month. An enquiry received in an earlier month and confirmed this month counts in that later month’s Confirmed Enquiries but not in this rate.';

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

type EnquiryRow = Prisma.SalesEnquiryGetPayload<{ include: { createdByUser: typeof USER_REF; assignedToUser: typeof USER_REF; confirmedByUser: typeof USER_REF } }>;

const ENQUIRY_INCLUDE = { createdByUser: USER_REF, assignedToUser: USER_REF, confirmedByUser: USER_REF } as const;

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
  /** Who confirmed the enquiry and when (null while not Confirmed, and for enquiries confirmed before this was recorded). */
  confirmedBy: { id: string; displayName: string } | null;
  confirmedAt: string | null;
  /** True when linked to a contract (the details come from getOne, gated by contracts.read). */
  hasContract: boolean;
  createdAt: string;
  updatedAt: string;
  /** Newest hand-written activity (list/dashboard only). */
  latestActivity?: { id: string; activityDate: string; notes: string | null; recordedBy: string } | null;
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
    confirmedBy: r.confirmedByUser ?? null,
    confirmedAt: r.confirmedAt ? r.confirmedAt.toISOString() : null,
    hasContract: Boolean(r.contractId),
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
  constructor(
    private readonly db: DatabaseService,
    private readonly contracts?: ContractsService,
  ) {}

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

  private taskRequired(): UnprocessableEntityException {
    return this.invalid('SALES_FOLLOW_UP_TASK_REQUIRED', 'Please say what needs to be done for this follow-up.');
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
    if (dto.nextFollowUpDate && !dto.followUpTask) throw this.taskRequired();
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
            notes: dto.followUpTask ?? null,
            responsibleUserId: actor.id,
            createdByUserId: actor.id,
          },
        });
      }
      await this.audit(tx, 'SALES_ENQUIRY_CREATED', actor, { enquiryId: created.id, enquiryNumber });
      return toEnquiryView(created);
    });
  }

  /** Adds the newest hand-written activity (not status changes or field edits) to each enquiry, in one query. */
  private async withLatestActivity(client: Pick<Tx, 'salesActivity'>, views: EnquiryView[]): Promise<EnquiryView[]> {
    if (views.length === 0) return views;
    const rows = await client.salesActivity.findMany({
      where: { enquiryId: { in: views.map((v) => v.id) }, type: { notIn: [SalesActivityType.STATUS_CHANGE, SalesActivityType.ENQUIRY_UPDATED] } },
      orderBy: [{ activityDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      distinct: ['enquiryId'],
      include: { recordedByUser: USER_REF },
    });
    const byEnquiry = new Map(rows.map((r) => [r.enquiryId, r]));
    return views.map((v) => {
      const r = byEnquiry.get(v.id);
      return { ...v, latestActivity: r ? { id: r.id, activityDate: dateKey(r.activityDate)!, notes: r.notes, recordedBy: r.recordedByUser.displayName } : null };
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
    if (query.wonMonth) {
      // Same rule as the dashboard's Confirmed Projects figure: Confirmed, with a Confirmed date in that month.
      const { start, endExclusive } = monthRange(query.wonMonth);
      where.status = SalesEnquiryStatus.WON;
      where.wonDate = { gte: start, lt: endExclusive };
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
      items: await this.withLatestActivity(client, rows.map(toEnquiryView)),
      today: kuwaitToday(),
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async getOne(id: string, actor: AuthUser): Promise<{
    contract: { id: string | null; referenceNumber: string; title: string | null; linkedAt: string | null; linkedBy: string | null } | null;
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
        orderBy: [{ activityDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      }),
      client.salesFollowUp.findMany({
        where: { enquiryId: id },
        include: { responsibleUser: USER_REF, completedByUser: USER_REF },
        orderBy: [{ followUpDate: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);
    const today = kuwaitToday();
    const linked = row.contractId
      ? await client.contract.findUnique({ where: { id: row.contractId }, select: { id: true, referenceNumber: true, title: true } })
      : null;
    const linkedBy = row.contractLinkedByUserId
      ? await client.user.findUnique({ where: { id: row.contractLinkedByUserId }, select: { displayName: true } })
      : null;
    const mayOpen = actor.permissions.includes('contracts.read');
    return {
      contract: linked
        ? {
            id: mayOpen ? linked.id : null,
            referenceNumber: linked.referenceNumber,
            title: mayOpen ? linked.title : null,
            linkedAt: row.contractLinkedAt ? row.contractLinkedAt.toISOString() : null,
            linkedBy: linkedBy?.displayName ?? null,
          }
        : null,
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
    for (const [label, v] of [['Expected Project Start Date', dto.expectedStartDate], ['Expected Contract Award Date', dto.expectedAwardDate]] as const) {
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

      if (changes.length === 0) return beforeView;

      if (Object.keys(data).length > 0) await tx.salesEnquiry.update({ where: { id }, data });

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
    if (dto.status !== SalesEnquiryStatus.WON && (dto.awardedValue || dto.wonDate || dto.confirmationNotes)) {
      throw this.invalid('SALES_WON_ONLY', 'Confirmed value, confirmation date and confirmation notes can only be recorded when the enquiry is Confirmed');
    }
    const today = kuwaitToday();
    if (dto.wonDate && dto.wonDate > today) throw this.invalid('SALES_WON_DATE_IN_FUTURE', 'The confirmation date cannot be in the future.');

    return this.db.getClient().$transaction(async (tx) => {
      const before = await this.findOrThrow(tx, id);
      if (dto.expectedStatus && before.status !== dto.expectedStatus) throw this.invalid('SALES_STATUS_CONFLICT', 'The enquiry was just changed by someone else. Please refresh and try again.');
      if (before.status === dto.status) throw this.invalid('SALES_STATUS_UNCHANGED', 'The enquiry already has this status');
      if (before.status === SalesEnquiryStatus.WON && before.contractId) {
        throw this.invalid('SALES_ENQUIRY_HAS_CONTRACT', 'This confirmed enquiry is linked to a contract, so its status cannot be changed.');
      }

      const data: Prisma.SalesEnquiryUncheckedUpdateInput = { status: dto.status };
      const meta: Record<string, unknown> = { from: before.status, to: dto.status };
      if (dto.status === SalesEnquiryStatus.WON && dto.wonDate && dto.wonDate < dateKey(before.enquiryDate)!) {
        throw this.invalid('SALES_WON_DATE_BEFORE_ENQUIRY', 'The confirmation date cannot be before the enquiry was received.');
      }
      if (dto.status === SalesEnquiryStatus.WON) {
        data.wonDate = dateOnly(dto.wonDate ?? today);
        data.awardedValue = dto.awardedValue ?? null;
        data.confirmedByUserId = actor.id;
        data.confirmedAt = new Date();
        data.lostReason = null;
        data.lostDate = null;
        meta['wonDate'] = dto.wonDate ?? today;
        meta['awardedValue'] = dto.awardedValue ?? null;
        if (dto.confirmationNotes) meta['confirmationNotes'] = dto.confirmationNotes;
      } else if (dto.status === SalesEnquiryStatus.LOST) {
        data.lostReason = dto.reason!.trim();
        data.lostDate = dateOnly(today);
        data.wonDate = null;
        data.awardedValue = null;
        data.confirmedByUserId = null;
        data.confirmedAt = null;
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
        data.confirmedByUserId = null;
        data.confirmedAt = null;
      }
      // Guarded write: only applies if nobody changed the status in the meantime.
      const res = await tx.salesEnquiry.updateMany({ where: { id, status: before.status }, data });
      if (res.count === 0) throw this.invalid('SALES_STATUS_CONFLICT', 'The enquiry was just changed by someone else. Please refresh and try again.');

      await tx.salesActivity.create({
        data: {
          enquiryId: id,
          type: SalesActivityType.STATUS_CHANGE,
          activityDate: dateOnly(today),
          notes: (dto.status === SalesEnquiryStatus.WON ? dto.confirmationNotes : dto.reason) ?? null,
          metadata: meta as Prisma.InputJsonValue,
          recordedByUserId: actor.id,
        },
      });
      await this.audit(tx, 'SALES_ENQUIRY_STATUS_CHANGED', actor, { enquiryId: id, from: before.status, to: dto.status });
      return toEnquiryView(await this.findOrThrow(tx, id));
    });
  }

  /**
   * Links a Confirmed enquiry to an existing contract. The actor must be able to see that contract (ContractsService.findOne
   * applies contracts.read and department scope). One enquiry <-> one contract: either side already linked is refused,
   * linking the same pair again is harmless. Nothing is created or changed on the contract itself except an entry in its
   * activity log naming the enquiry.
   */
  async linkContract(id: string, contractId: string, actor: AuthUser): Promise<{ contractId: string; referenceNumber: string }> {
    if (!this.contracts) throw this.invalid('SALES_CONTRACTS_UNAVAILABLE', 'Contracts are not available right now.');
    const contract = await this.contracts.findOne(contractId, actor); // throws 403/404 when the actor may not see it
    // FMP-SALES-12: this path only ever links an EXISTING contract, so the origin is always LINKED, whatever its age or creator.
    // "Created from an enquiry" is recorded only by ContractsService.create, atomically with the creation.
    const linkSource = SalesContractLinkSource.LINKED;
    const result = await this.db.getClient().$transaction(async (tx) => {
      const enquiry = await this.findOrThrow(tx, id);
      if (enquiry.status !== SalesEnquiryStatus.WON) throw this.invalid('SALES_ENQUIRY_NOT_CONFIRMED', 'Only a Confirmed enquiry can be linked to a contract.');
      if (enquiry.contractId === contractId) return { enquiryNumber: enquiry.enquiryNumber, already: true };
      if (enquiry.contractId) throw this.invalid('SALES_ENQUIRY_ALREADY_LINKED', 'This enquiry is already linked to a contract.');
      const other = await tx.salesEnquiry.findFirst({ where: { contractId }, select: { enquiryNumber: true } });
      if (other) throw this.invalid('SALES_CONTRACT_ALREADY_LINKED', `That contract is already linked to enquiry ${other.enquiryNumber}.`);
      const res = await tx.salesEnquiry.updateMany({
        where: { id, contractId: null },
        data: { contractId, contractLinkedByUserId: actor.id, contractLinkedAt: new Date(), contractLinkSource: linkSource },
      });
      if (res.count === 0) throw this.invalid('SALES_ENQUIRY_ALREADY_LINKED', 'This enquiry is already linked to a contract.');
      await tx.salesActivity.create({
        data: {
          enquiryId: id,
          type: SalesActivityType.ENQUIRY_UPDATED,
          activityDate: dateOnly(kuwaitToday()),
          notes: null,
          metadata: { changes: [{ label: 'Contract', from: null, to: contract.referenceNumber }], contractId, linkSource } as Prisma.InputJsonValue,
          recordedByUserId: actor.id,
        },
      });
      await this.audit(tx, 'SALES_ENQUIRY_CONTRACT_LINKED', actor, { enquiryId: id, contractId, linkSource });
      return { enquiryNumber: enquiry.enquiryNumber, already: false };
    });
    if (!result.already) {
      await logContractActivity(this.db, contractId, actor, 'SALES_ENQUIRY_LINKED', { enquiryId: id, enquiryNumber: result.enquiryNumber });
    }
    return { contractId, referenceNumber: contract.referenceNumber };
  }

  /**
   * One simple entry: a date (not in the future), the text, and optionally the next follow-up - all saved in one
   * transaction so a failure never leaves half of it. A retry carrying the same requestId returns the first result.
   * It never changes the enquiry's status and never completes an existing follow-up.
   */
  async addActivity(id: string, dto: AddActivityDto, actor: AuthUser): Promise<ActivityView> {
    if (!isValidDateString(dto.activityDate)) throw this.invalid('SALES_INVALID_DATE', 'Activity Date is not a real date');
    const today = kuwaitToday();
    if (dto.activityDate > today) {
      throw this.invalid('SALES_ACTIVITY_IN_FUTURE', 'Activity Date cannot be in the future. To plan something for later, set a Next Follow-up.');
    }
    if (dto.nextFollowUpDate) {
      if (!isValidDateString(dto.nextFollowUpDate)) throw this.invalid('SALES_INVALID_DATE', 'Next Follow-up is not a real date');
      if (dto.nextFollowUpDate < today) throw this.invalid('SALES_FOLLOW_UP_IN_PAST', 'Next Follow-up cannot be before today.');
      // The task is only required when a new follow-up is being scheduled; the activity text is never reused for it.
      if (!dto.followUpTask) throw this.taskRequired();
    }
    return this.db.getClient().$transaction(async (tx) => {
      await this.findOrThrow(tx, id);
      if (dto.requestId) {
        // Serialise identical requests so two quick clicks cannot both pass the check below.
        const lockKey = `${id}:${dto.requestId}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
        const prior = await tx.salesActivity.findFirst({
          where: { enquiryId: id, recordedByUserId: actor.id, metadata: { path: ['clientRequestId'], equals: dto.requestId } },
          include: { recordedByUser: USER_REF },
        });
        if (prior) return toActivityView(prior);
      }
      let followUp: { id: string; date: string } | null = null;
      if (dto.nextFollowUpDate) {
        const f = await tx.salesFollowUp.create({
          data: { enquiryId: id, followUpDate: dateOnly(dto.nextFollowUpDate), notes: dto.followUpTask ?? null, responsibleUserId: actor.id, createdByUserId: actor.id },
        });
        await this.syncNextFollowUp(tx, id);
        followUp = { id: f.id, date: dto.nextFollowUpDate };
      }
      const meta: Record<string, unknown> = {};
      if (dto.requestId) meta['clientRequestId'] = dto.requestId;
      if (followUp) {
        meta['followUpId'] = followUp.id;
        meta['followUpDate'] = followUp.date;
      }
      const a = await tx.salesActivity.create({
        data: {
          enquiryId: id, type: dto.type ?? SalesActivityType.NOTE, activityDate: dateOnly(dto.activityDate), notes: dto.notes,
          ...(Object.keys(meta).length ? { metadata: meta as Prisma.InputJsonValue } : {}), recordedByUserId: actor.id,
        },
        include: { recordedByUser: USER_REF },
      });
      await this.audit(tx, 'SALES_ACTIVITY_RECORDED', actor, { enquiryId: id, activityId: a.id, type: a.type });
      if (followUp) await this.audit(tx, 'SALES_FOLLOW_UP_SCHEDULED', actor, { enquiryId: id, followUpId: followUp.id, date: followUp.date });
      return toActivityView(a);
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
    if (dto.followUpDate < today) throw this.invalid('SALES_FOLLOW_UP_IN_PAST', 'The new date cannot be before today.');
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

  /**
   * FMP-SALES-10 — the Follow-ups task list. One row per task (never per activity), whatever the enquiry's status.
   * PENDING (the default) is overdue + today + upcoming, earliest due date first, so overdue work leads. Counts are
   * for every filter so the chips can show them; cancelled (replaced) tasks are kept in the database but never listed.
   */
  async listFollowUps(q: { bucket?: FollowUpFilter; page?: number; pageSize?: number } = {}): Promise<{
    today: string;
    bucket: FollowUpFilter;
    counts: Record<FollowUpFilter, number>;
    items: FollowUpListItem[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const client = this.db.getClient();
    const today = kuwaitToday();
    const day = dateOnly(today);
    const bucket = q.bucket ?? 'PENDING';
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, q.pageSize ?? 15));
    const pending = { status: SalesFollowUpStatus.PENDING };
    const where: Record<FollowUpFilter, Prisma.SalesFollowUpWhereInput> = {
      PENDING: pending,
      OVERDUE: { ...pending, followUpDate: { lt: day } },
      TODAY: { ...pending, followUpDate: day },
      UPCOMING: { ...pending, followUpDate: { gt: day } },
      COMPLETED: { status: SalesFollowUpStatus.COMPLETED },
    };
    const include = {
      responsibleUser: USER_REF,
      completedByUser: USER_REF,
      enquiry: { select: { id: true, enquiryNumber: true, companyName: true, contactPerson: true, contactNumber: true, status: true } },
    } as const;
    const [rows, ...countList] = await Promise.all([
      client.salesFollowUp.findMany({
        where: where[bucket], include,
        orderBy: bucket === 'COMPLETED' ? [{ completedAt: 'desc' }, { id: 'asc' }] : [{ followUpDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize, take: pageSize,
      }),
      ...FOLLOW_UP_FILTERS.map((k) => client.salesFollowUp.count({ where: where[k] })),
    ]);
    const counts = Object.fromEntries(FOLLOW_UP_FILTERS.map((k, i) => [k, countList[i]!])) as Record<FollowUpFilter, number>;
    const total = counts[bucket];
    return {
      today, bucket, counts,
      items: rows.map((f) => ({ ...toFollowUpView(f, today), enquiry: { ...f.enquiry } })),
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
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
      conversionBasis: CONVERSION_BASIS,
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

  /**
   * Contracts created through an enquiry's Create Contract flow in this Kuwait month - the SAME query the Contract List runs
   * for `fromEnquiryMonth`, so the figure, the department scope and the list always agree. null when the viewer cannot read
   * contracts (the card then says so instead of showing a number that would be wrong or leak scope).
   */
  private async contractsCreatedInMonth(month: string, actor: AuthUser): Promise<number | null> {
    if (!this.contracts || !actor.permissions.includes('contracts.read')) return null;
    try {
      return (await this.contracts.findAll({ fromEnquiryMonth: month, page: 1, pageSize: 1 }, actor)).total;
    } catch {
      return null;
    }
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
    const monthWon = { status: SalesEnquiryStatus.WON, wonDate: { gte: start, lt: endExclusive } };
    const [thisMonth, overdue, dueToday, openCount, potential, openMissing, wonRes, statusGroups, attention, recent, trendRows, report, upcoming, upcomingCount, noFollowUp, wonEstimated, wonMissing, contractsCreated] = await Promise.all([
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
        take: 8,
      }),
      client.salesEnquiry.findMany({ include: ENQUIRY_INCLUDE, orderBy: [{ enquiryDate: 'desc' }, { createdAt: 'desc' }], take: 8 }),
      client.salesEnquiry.findMany({ where: { enquiryDate: { gte: trendStart, lt: endExclusive } }, select: { enquiryDate: true } }),
      canReport ? this.monthlyReport(month) : Promise.resolve(null),
      client.salesFollowUp.findMany({
        where: { status: SalesFollowUpStatus.PENDING, followUpDate: { gt: dateOnly(today) } },
        include: { responsibleUser: USER_REF, completedByUser: USER_REF, enquiry: followUpEnquiry },
        orderBy: { followUpDate: 'asc' },
        take: 5,
      }),
      // Same set as the Follow-ups page's Upcoming filter (every pending task after today), so the numbers always agree.
      client.salesFollowUp.count({ where: { status: SalesFollowUpStatus.PENDING, followUpDate: { gt: dateOnly(today) } } }),
      client.salesEnquiry.count({ where: { ...open, followUps: { none: { status: SalesFollowUpStatus.PENDING } } } }),
      // Estimated value of the enquiries confirmed this month (by confirmation date): the recorded estimates only; a blank is never a zero.
      client.salesEnquiry.aggregate({ where: { ...monthWon, estimatedValue: { not: null } }, _count: true, _sum: { estimatedValue: true } }),
      client.salesEnquiry.count({ where: { ...monthWon, estimatedValue: null } }),
      this.contractsCreatedInMonth(month, actor),
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
      confirmedMonth: {
        count: wonRes._count,
        estimatedValue: wonEstimated._sum.estimatedValue === null || wonEstimated._sum.estimatedValue === undefined ? null : wonEstimated._sum.estimatedValue.toString(),
        withEstimate: wonEstimated._count,
        withoutEstimate: wonMissing,
      },
      contractsCreated,
      awardedValueWon: wonRes._sum.awardedValue === null || wonRes._sum.awardedValue === undefined ? null : wonRes._sum.awardedValue.toString(),
      // Cohort conversion (see monthlyReport). null when the viewer lacks sales.reports.read; rate null = N/A.
      conversion: report ? { rate: report.cohortConversionRate, created: report.enquiriesCreated, won: report.cohortWon } : null,
      statusCounts,
      followUpsNeedingAttention: attention.map((f) => ({ ...toFollowUpView(f, today), enquiry: { ...f.enquiry } })),
      upcomingFollowUps: upcoming.map((f) => ({ ...toFollowUpView(f, today), enquiry: { ...f.enquiry } })),
      upcomingFollowUpCount: upcomingCount,
      activeWithoutFollowUp: noFollowUp,
      recentEnquiries: await this.withLatestActivity(client, recent.map(toEnquiryView)),
      monthlyTrend: months.map((m) => ({ month: m, count: trendCounts.get(m) ?? 0 })),
    };
  }
}

// ---------------------------------------------------------------------------
// views
// ---------------------------------------------------------------------------

type ActivityRow = Prisma.SalesActivityGetPayload<{ include: { recordedByUser: typeof USER_REF } }>;

function toActivityView(a: ActivityRow): ActivityView {
  return {
    id: a.id, type: a.type, activityDate: dateKey(a.activityDate)!, notes: a.notes,
    metadata: (a.metadata ?? null) as Record<string, unknown> | null, recordedBy: a.recordedByUser, createdAt: a.createdAt.toISOString(),
  };
}

export interface ActivityView {
  id: string;
  type: SalesActivityType;
  activityDate: string;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  recordedBy: { id: string; displayName: string };
  createdAt: string;
}

export const FOLLOW_UP_FILTERS = ['PENDING', 'OVERDUE', 'TODAY', 'UPCOMING', 'COMPLETED'] as const;
export type FollowUpFilter = (typeof FOLLOW_UP_FILTERS)[number];

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
  /** Plain-language definition of cohortConversionRate: its denominator is the enquiries RECEIVED in the month, not the ones confirmed in it. */
  conversionBasis: string;
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
  /** Enquiries Confirmed this month by their confirmation date, with the sum of their recorded estimates. */
  confirmedMonth: { count: number; estimatedValue: string | null; withEstimate: number; withoutEstimate: number };
  /** Contracts created through an enquiry in this month; null when the viewer cannot read contracts. */
  contractsCreated: number | null;
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
