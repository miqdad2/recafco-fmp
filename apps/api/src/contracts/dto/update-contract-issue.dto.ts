import { IsString, IsOptional, MaxLength, IsIn, Matches, IsUUID } from 'class-validator';
import {
  CONTRACT_ISSUE_PRIORITIES,
  CONTRACT_ISSUE_STATUSES,
  CONTRACT_ISSUE_CATEGORIES,
} from './create-contract-issue.dto';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class UpdateContractIssueDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  issueNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

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
