import { IsOptional, IsInt, Min, Max, IsString, IsUUID, IsIn, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

const CONTRACT_STATUSES = ['DRAFT', 'ACTIVE', 'TERMINATED', 'CLOSED', 'CANCELLED'];
const WORKFLOW_TEAMS = ['TECHNICAL', 'PRODUCTION', 'ERECTION', 'QS_COMMERCIAL'];
/** Derived, contract-level summary status — distinct from the per-task ContractWorkflowTaskStatus enum. */
const WORKFLOW_STATUSES = ['NOT_GENERATED', 'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'];
/** Per-task status (CM-32 "Task Status" filter) — distinct from the contract-level WORKFLOW_STATUSES above. Matches a contract if ANY of its tasks has this status. */
const TASK_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED', 'ON_HOLD'];

export class ContractWorkflowListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  pageSize?: number;

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
  @IsIn(WORKFLOW_STATUSES)
  workflowStatus?: string;

  @IsOptional()
  @IsString()
  @IsIn(WORKFLOW_TEAMS)
  team?: string;

  @IsOptional()
  @IsString()
  @IsIn(TASK_STATUSES)
  taskStatus?: string;

  @IsOptional()
  @IsUUID('4')
  responsibleUserId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  @IsBoolean()
  overdueOnly?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  @IsBoolean()
  myTasksOnly?: boolean;
}
