import { IsString, IsNotEmpty, IsOptional, MaxLength, IsInt, Min, IsObject, IsDateString, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

// FMP-CONTRACT-04 — same 5 manager-facing values as Contract.scheduleStatus (CM-55);
// never a lifecycle ContractStatus value.
const SCHEDULE_STATUSES = ['IN_PROGRESS', 'ON_TRACK', 'DELAYED', 'COMPLETED', 'AHEAD_OF_SCHEDULE'];

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/**
 * FMP-CONTRACT-03 — safe "Edit Contract Details" from the Overview page.
 * Deliberately a separate, narrow shape from UpdateContractDto: no BOQ,
 * no scope-of-work flags (they drive generated workflow tasks), no
 * contract value/currency, no owner/department, no status. Optional
 * fields accept `null` (IsOptional) to clear them.
 */
export class UpdateContractBasicDetailsDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(trim)
  jobOrder!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  @Transform(trim)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  @Transform(trim)
  counterpartyName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trim)
  quotationNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trim)
  projectNumber?: string | null;

  @IsOptional()
  @IsDateString()
  contractDate?: string | null;

  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsIn(SCHEDULE_STATUSES, { message: 'Schedule Status is invalid.' })
  scheduleStatus?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  @Transform(trim)
  scopeDescription?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  @Transform(trim)
  notes?: string | null;

  @IsOptional()
  @IsObject()
  paymentTerms?: Record<string, boolean>;

  // FMP-CONTRACT-06 — per-term percentages / types / status; validated in payment-terms.ts.
  @IsOptional()
  @IsObject()
  paymentTermDetails?: Record<string, unknown>;
}
