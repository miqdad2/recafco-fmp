import { IsOptional, IsInt, Min, Max, IsString, IsUUID, IsIn, Matches, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { CONTRACT_PAYMENT_STATUSES } from './create-contract-payment.dto';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class ContractPaymentListQueryDto {
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

  /** Matches payment no., invoice number, contract reference number, or contract title. */
  @IsOptional()
  @IsString()
  search?: string;

  /** Matches contract counterparty (company / client) name. */
  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsUUID('4')
  contractId?: string;

  @IsOptional()
  @IsString()
  @IsIn(CONTRACT_PAYMENT_STATUSES)
  status?: string;

  @IsOptional()
  @IsUUID('4')
  departmentId?: string;

  @IsOptional()
  @IsUUID('4')
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'invoiceDateFrom must be in YYYY-MM-DD format' })
  invoiceDateFrom?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'invoiceDateTo must be in YYYY-MM-DD format' })
  invoiceDateTo?: string;

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
