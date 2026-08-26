import { IsString, IsOptional, MaxLength, IsIn, Matches, IsUUID, IsObject } from 'class-validator';

export const CONTRACT_WORKFLOW_TASK_STATUSES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'COMPLETED',
  'ON_HOLD',
] as const;

export const CONTRACT_WORKFLOW_TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class UpdateContractWorkflowTaskDto {
  @IsOptional()
  @IsIn(CONTRACT_WORKFLOW_TASK_STATUSES)
  status?: string;

  @IsOptional()
  @IsUUID('4')
  responsibleUserId?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'startDate must be in YYYY-MM-DD format' })
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'dueDate must be in YYYY-MM-DD format' })
  dueDate?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'completedDate must be in YYYY-MM-DD format' })
  completedDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  remarks?: string;

  @IsOptional()
  @IsIn(CONTRACT_WORKFLOW_TASK_PRIORITIES)
  priority?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  delayReason?: string;

  // CM-46B — optional Contract Staff task-intake fields (Receipt Details /
  // Drawing-Task Information / Follow-up notes). Sent as a plain object;
  // the service's sanitizeWorkflowTaskFormData() is the actual source of
  // truth for which keys are ever persisted — this DTO only checks it's an
  // object at all, same convention as CreateContractDto's scopeOfWork.
  @IsOptional()
  @IsObject()
  formData?: Record<string, string | boolean>;
}
