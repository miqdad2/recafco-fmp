import { IsString, IsOptional, IsNotEmpty, MaxLength, IsIn, Matches, IsUUID } from 'class-validator';

export const CONTRACT_ISSUE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export const CONTRACT_ISSUE_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_RESPONSE',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
] as const;

/** category is a plain string (not a DB enum) for flexibility, but still validated against a controlled list. */
export const CONTRACT_ISSUE_CATEGORIES = [
  'Commercial',
  'Technical',
  'Production',
  'Delivery',
  'Erection',
  'Client',
  'Document',
  'Payment',
  'Other',
] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class CreateContractIssueDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  issueNo?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn(CONTRACT_ISSUE_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsIn(CONTRACT_ISSUE_PRIORITIES)
  priority?: string;

  @IsOptional()
  @IsIn(CONTRACT_ISSUE_STATUSES)
  status?: string;

  @IsOptional()
  @IsUUID('4')
  responsibleUserId?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'raisedDate must be in YYYY-MM-DD format' })
  raisedDate?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'dueDate must be in YYYY-MM-DD format' })
  dueDate?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'closedDate must be in YYYY-MM-DD format' })
  closedDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  resolution?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  remarks?: string;
}
