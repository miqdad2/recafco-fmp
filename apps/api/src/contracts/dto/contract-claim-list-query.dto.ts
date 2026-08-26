import { IsOptional, IsInt, Min, Max, IsString, IsUUID, IsIn, Matches, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { CONTRACT_CLAIM_TYPES, CONTRACT_CLAIM_STATUSES } from './create-contract-claim.dto';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class ContractClaimListQueryDto {
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

  /** Matches claim no., claim title, contract reference number, contract title, or company/client. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID('4')
  contractId?: string;

  @IsOptional()
  @IsString()
  @IsIn(CONTRACT_CLAIM_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @IsIn(CONTRACT_CLAIM_TYPES)
  claimType?: string;

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
  @Matches(DATE_PATTERN, { message: 'claimDateFrom must be in YYYY-MM-DD format' })
  claimDateFrom?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'claimDateTo must be in YYYY-MM-DD format' })
  claimDateTo?: string;

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
