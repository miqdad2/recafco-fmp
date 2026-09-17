import { IsString, IsOptional, MaxLength, IsIn, Matches, IsUUID } from 'class-validator';

export const CONTRACT_ERECTION_WORKFLOW_ASSIGNMENT_STATUSES = ['ASSIGNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// CM-71H — Assign/Change Assignment share one DTO: both write the same
// single per-contract row (see the model's own doc comment). Either
// assignedToUserId (a real user picked from the existing /contracts/people
// dropdown) or assignedToName (free-text fallback) must be present — the
// service enforces "at least one of the two", matching this unit's own
// "allow manual selection/assignment safely" instruction.
export class AssignContractErectionWorkflowDto {
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  assignedToName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  assignedDepartment?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'assignedAt must be in YYYY-MM-DD format' })
  assignedAt?: string;

  @IsOptional()
  @IsIn(CONTRACT_ERECTION_WORKFLOW_ASSIGNMENT_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  remarks?: string;
}
