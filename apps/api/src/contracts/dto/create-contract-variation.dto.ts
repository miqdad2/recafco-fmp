import { IsString, IsOptional, IsNotEmpty, MaxLength, IsNumber, IsBoolean, IsIn, Matches } from 'class-validator';

export const CONTRACT_VARIATION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class CreateContractVariationDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  variationNo?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  // No @Min — a deductive variation is a real negative amount (see the
  // approved design's own "-12,000.000" row), never clamped to zero.
  @IsNumber({ maxDecimalPlaces: 3 })
  amount!: number;

  @IsOptional()
  @IsBoolean()
  affectsContractValue?: boolean;

  @IsOptional()
  @IsIn(CONTRACT_VARIATION_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'submittedDate must be in YYYY-MM-DD format' })
  submittedDate?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'approvedDate must be in YYYY-MM-DD format' })
  approvedDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  supportingDocumentName?: string;

  // Plain text/link, not strictly validated as a URL — a manager may
  // reference an already-existing document (e.g. an internal file path or a
  // Documents & Obligations entry) rather than only a web URL. This unit
  // does not implement document upload (see model comment).
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  supportingDocumentUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  remarks?: string;
}
