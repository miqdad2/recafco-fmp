import { IsOptional, IsString, IsUUID, IsIn, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

// ---------------------------------------------------------------------------
// CM-40 — Manager Assignment Queue query. Contract-level filters mirror
// ContractWorkflowListQueryDto (search/status/departmentId/ownerUserId feed
// the same buildWorkflowContractWhere()); team/priority/dueDateMissing are
// new, task-level filters specific to the unassigned-task list.
// ---------------------------------------------------------------------------

const CONTRACT_STATUSES = ['DRAFT', 'ACTIVE', 'TERMINATED', 'CLOSED'];
const WORKFLOW_TEAMS = ['TECHNICAL', 'PRODUCTION', 'ERECTION', 'QS_COMMERCIAL'];
const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export class ContractWorkflowAssignmentQueueQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  @IsIn(CONTRACT_STATUSES)
  status?: string;

  @IsOptional()
  @IsUUID('4')
  departmentId?: string;

  @IsOptional()
  @IsUUID('4')
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  @IsIn(WORKFLOW_TEAMS)
  team?: string;

  @IsOptional()
  @IsString()
  @IsIn(TASK_PRIORITIES)
  priority?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  @IsBoolean()
  dueDateMissing?: boolean;
}
