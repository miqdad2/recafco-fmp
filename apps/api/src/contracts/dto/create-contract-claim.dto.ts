import { IsString, IsOptional, IsNotEmpty, MaxLength, IsIn, Matches, IsUUID, IsNumber, IsInt, Min } from 'class-validator';

export const CONTRACT_CLAIM_TYPES = [
  'VARIATION',
  'EXTENSION_OF_TIME',
  'DELAY',
  'PAYMENT',
  'DAMAGE',
  'SCOPE_CHANGE',
  'OTHER',
] as const;

export const CONTRACT_CLAIM_STATUSES = [
  'DRAFT',
  'UNDER_REVIEW',
  'SUBMITTED',
  'UNDER_NEGOTIATION',
  'APPROVED',
  'PARTIALLY_APPROVED',
  'REJECTED',
  'SETTLED',
  'CLOSED',
  'CANCELLED',
] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class CreateContractClaimDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  claimNo?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  claimTitle!: string;

  @IsOptional()
  @IsIn(CONTRACT_CLAIM_TYPES)
  claimType?: string;

  @IsOptional()
  @IsIn(CONTRACT_CLAIM_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'eventDate must be in YYYY-MM-DD format' })
  eventDate?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'claimDate must be in YYYY-MM-DD format' })
  claimDate?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  submittedValue?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  approvedValue?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  eotClaimedDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  eotApprovedDays?: number;

  @IsOptional()
  @IsUUID('4')
  responsibleUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  nextAction?: string;

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
  @MaxLength(5000)
  remarks?: string;
}
