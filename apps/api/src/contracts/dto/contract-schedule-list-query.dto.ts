import { IsOptional, IsInt, Min, Max, IsString, IsUUID, IsIn, IsBoolean, Matches } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export const SCHEDULE_ITEM_TYPES = [
  'CONTRACT_START',
  'CONTRACT_END',
  'FORECAST_COMPLETION',
  'WORKFLOW_TASK',
  'ISSUE_DUE',
  'CLAIM_DUE',
  'PAYMENT_DUE',
  'CLOSEOUT_REQUEST',
  'CLOSEOUT_APPROVAL',
  'CLOSEOUT_CLOSED',
] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class ContractScheduleListQueryDto {
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

  /** Matches contract reference number, contract title, or company/client. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID('4')
  contractId?: string;

  @IsOptional()
  @IsString()
  @IsIn(SCHEDULE_ITEM_TYPES)
  itemType?: string;

  /** Matches the raw underlying status value of the item's source row (contract-derived items use their own synthetic status label instead). */
  @IsOptional()
  @IsString()
  status?: string;

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
  @Matches(DATE_PATTERN, { message: 'dateFrom must be in YYYY-MM-DD format' })
  dateFrom?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'dateTo must be in YYYY-MM-DD format' })
  dateTo?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  @IsBoolean()
  overdueOnly?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  @IsBoolean()
  upcomingOnly?: boolean;
}
