import { Injectable, NotFoundException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { ModuleIdentifier } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { AuthUser } from '../common/types/auth-user';
import type { AssignContractErectionWorkflowDto } from './dto/assign-contract-erection-workflow.dto';
import { logContractActivity } from './contract-activity-log';

// ---------------------------------------------------------------------------
// CM-71H — Assigns ownership of the Erection Workflow (CM-71A-G) to a
// specific Erection Manager, distinct from Contract.ownerUserId (the
// contract's own general business owner — an unrelated, pre-existing
// concept) and from ContractWorkflowTask.responsibleUserId (per-task
// assignment on the generic team-task register). Contract Manager remains
// the contract owner/monitor; this only ever assigns the erection EXECUTION
// workflow to someone else. See the model's own doc comment in
// schema.prisma for the "one row per contract, update in place" shape.
//
// Only a manager-tier actor (contracts.update — Contract Manager/Admin/
// Super Admin) may assign or reassign; the assigned Erection Manager
// themselves never needs to call this endpoint to do their own work (their
// access to the Step 1/3/5 screens already comes from those screens' own
// existing contracts.update/contracts.workflow_update gates, unchanged by
// this unit — see progress-tracker.md for why those gates were deliberately
// left alone).
// ---------------------------------------------------------------------------

const ASSIGNMENT_SELECT = {
  id: true,
  contractId: true,
  assignedToUserId: true,
  assignedToName: true,
  assignedDepartment: true,
  assignedByUserId: true,
  assignedAt: true,
  status: true,
  remarks: true,
  createdAt: true,
  updatedAt: true,
  assignedToUser: { select: { id: true, displayName: true } },
  assignedByUser: { select: { id: true, displayName: true } },
} as const;

/** At least one of assignedToUserId (a real picked user) or assignedToName (manual free text) must be present. */
export function assertAssigneeProvided(dto: { assignedToUserId?: string; assignedToName?: string }): void {
  if (!dto.assignedToUserId && !dto.assignedToName?.trim()) {
    throw new UnprocessableEntityException({
      code: 'CONTRACT_ERECTION_WORKFLOW_ASSIGNMENT_ASSIGNEE_REQUIRED',
      message: 'Select an Erection Manager or enter a name to assign the Erection Workflow.',
    });
  }
}

/** create -> assigned; update of an existing row -> reassigned, matching this unit's own "assigned/reassigned" activity-logging language. */
export function computeAssignmentActivityEvent(isReassignment: boolean): string {
  return isReassignment ? 'erection_workflow_reassigned' : 'erection_workflow_assigned';
}

function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function toResponseShape(row: { assignedAt: Date; [key: string]: unknown }): Record<string, unknown> {
  return { ...row, assignedAt: isoDate(row.assignedAt) as string };
}

@Injectable()
export class ContractErectionWorkflowAssignmentService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
  ) {}

  private async loadContract(contractId: string, actor: AuthUser): Promise<{ id: string; departmentId: string | null }> {
    const contract = await this.db.getClient().contract.findUnique({
      where: { id: contractId },
      select: { id: true, departmentId: true },
    });
    if (!contract) {
      throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
    }
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, contract.departmentId);
    return contract;
  }

  // Not created yet is a normal, valid state — returns null, not 404.
  async getForContract(contractId: string, actor: AuthUser): Promise<unknown | null> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
    await this.loadContract(contractId, actor);

    const assignment = await this.db.getClient().contractErectionWorkflowAssignment.findUnique({
      where: { contractId },
      select: ASSIGNMENT_SELECT,
    });
    return assignment ? toResponseShape(assignment) : null;
  }

  /** Assign (no row yet) or Change Assignment (row exists) — both write the same single row, per the model's own doc comment. */
  async assign(contractId: string, dto: AssignContractErectionWorkflowDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }
    await this.loadContract(contractId, actor);
    assertAssigneeProvided(dto);

    if (dto.assignedToUserId) {
      const user = await this.db.getClient().user.findUnique({ where: { id: dto.assignedToUserId }, select: { id: true } });
      if (!user) {
        throw new UnprocessableEntityException({
          code: 'CONTRACT_ERECTION_WORKFLOW_ASSIGNMENT_INVALID_USER',
          message: 'assignedToUserId does not refer to a valid user.',
        });
      }
    }

    const existing = await this.db.getClient().contractErectionWorkflowAssignment.findUnique({
      where: { contractId },
      select: { id: true },
    });

    const assignedAt = dto.assignedAt ? new Date(dto.assignedAt) : new Date();
    const assignedDepartment = dto.assignedDepartment?.trim() || 'Erection Department';

    const savedId = existing
      ? (
          await this.db.getClient().contractErectionWorkflowAssignment.update({
            where: { id: existing.id },
            data: {
              assignedToUserId: dto.assignedToUserId ?? null,
              assignedToName: dto.assignedToName || null,
              assignedDepartment,
              assignedByUserId: actor.id,
              assignedAt,
              status: (dto.status ?? 'ASSIGNED') as never,
              remarks: dto.remarks || null,
            },
            select: { id: true },
          })
        ).id
      : (
          await this.db.getClient().contractErectionWorkflowAssignment.create({
            data: {
              contractId,
              assignedToUserId: dto.assignedToUserId ?? null,
              assignedToName: dto.assignedToName || null,
              assignedDepartment,
              assignedByUserId: actor.id,
              assignedAt,
              status: (dto.status ?? 'ASSIGNED') as never,
              remarks: dto.remarks || null,
            },
            select: { id: true },
          })
        ).id;

    const saved = await this.db.getClient().contractErectionWorkflowAssignment.findUniqueOrThrow({
      where: { id: savedId },
      select: ASSIGNMENT_SELECT,
    });

    await logContractActivity(this.db, contractId, actor, computeAssignmentActivityEvent(existing !== null), {
      assignmentId: saved.id,
      assignedToUserId: saved.assignedToUserId,
      assignedToName: saved.assignedToName,
      assignedDepartment: saved.assignedDepartment,
    });

    return toResponseShape(saved);
  }
}
