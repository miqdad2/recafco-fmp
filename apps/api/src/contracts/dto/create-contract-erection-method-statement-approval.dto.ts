import { IsString, IsOptional, MaxLength, IsBoolean, IsIn, Matches } from 'class-validator';

export const CONTRACT_ERECTION_METHOD_STATEMENT_APPROVAL_STATUSES = [
  'PENDING_APPROVAL',
  'DRAFT_REVIEW',
  'APPROVED',
  'REVISION_REQUESTED',
  'REJECTED',
] as const;

export const CONTRACT_ERECTION_METHOD_STATEMENT_APPROVAL_DECISIONS = ['APPROVE', 'REQUEST_REVISION', 'REJECT'] as const;

export const CONTRACT_ERECTION_METHOD_STATEMENT_APPROVAL_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class CreateContractErectionMethodStatementApprovalDto {
  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'reviewRequiredBy must be in YYYY-MM-DD format' })
  reviewRequiredBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  reviewingEngineer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  reviewType?: string;

  @IsOptional()
  @IsIn(CONTRACT_ERECTION_METHOD_STATEMENT_APPROVAL_PRIORITIES)
  priority?: string;

  @IsOptional()
  @IsIn(CONTRACT_ERECTION_METHOD_STATEMENT_APPROVAL_STATUSES)
  reviewStatus?: string;

  @IsOptional()
  @IsIn(CONTRACT_ERECTION_METHOD_STATEMENT_APPROVAL_DECISIONS)
  decision?: string;

  @IsOptional()
  @IsBoolean()
  requiresClientApproval?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  comments?: string;
}
