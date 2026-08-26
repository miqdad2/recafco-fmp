import { IsOptional, IsInt, Min, Max, IsString, IsUUID, IsIn, IsBoolean, Matches } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export const CONTRACT_CLOSEOUT_REQUEST_STATUSES = [
  'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CLOSED', 'CANCELLED',
] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class ContractCloseoutListQueryDto {
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

  /** Matches request no., contract reference number, contract title, or company/client. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID('4')
  contractId?: string;

  @IsOptional()
  @IsString()
  @IsIn(CONTRACT_CLOSEOUT_REQUEST_STATUSES)
  status?: string;

  @IsOptional()
  @IsUUID('4')
  requestedByUserId?: string;

  @IsOptional()
  @IsUUID('4')
  reviewedByUserId?: string;

  @IsOptional()
  @IsUUID('4')
  departmentId?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'requestedDateFrom must be in YYYY-MM-DD format' })
  requestedDateFrom?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'requestedDateTo must be in YYYY-MM-DD format' })
  requestedDateTo?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'reviewedDateFrom must be in YYYY-MM-DD format' })
  reviewedDateFrom?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'reviewedDateTo must be in YYYY-MM-DD format' })
  reviewedDateTo?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'approvedDateFrom must be in YYYY-MM-DD format' })
  approvedDateFrom?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'approvedDateTo must be in YYYY-MM-DD format' })
  approvedDateTo?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  @IsBoolean()
  pendingOnly?: boolean;
}
