import { IsOptional, IsInt, Min, Max, IsString, IsUUID, IsIn, Matches, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  CONTRACT_ISSUE_PRIORITIES,
  CONTRACT_ISSUE_STATUSES,
  CONTRACT_ISSUE_CATEGORIES,
} from './create-contract-issue.dto';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class ContractIssueListQueryDto {
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

  /** Matches issue no., title, contract reference number, or contract title. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID('4')
  contractId?: string;

  @IsOptional()
  @IsString()
  @IsIn(CONTRACT_ISSUE_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @IsIn(CONTRACT_ISSUE_PRIORITIES)
  priority?: string;

  @IsOptional()
  @IsString()
  @IsIn(CONTRACT_ISSUE_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsUUID('4')
  departmentId?: string;

  @IsOptional()
  @IsUUID('4')
  responsibleUserId?: string;

  @IsOptional()
  @IsUUID('4')
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'raisedDateFrom must be in YYYY-MM-DD format' })
  raisedDateFrom?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'raisedDateTo must be in YYYY-MM-DD format' })
  raisedDateTo?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'dueDateFrom must be in YYYY-MM-DD format' })
  dueDateFrom?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'dueDateTo must be in YYYY-MM-DD format' })
  dueDateTo?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  @IsBoolean()
  overdueOnly?: boolean;
}
