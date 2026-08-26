import { IsString, IsOptional, MaxLength, IsIn, Matches, IsUUID, IsNumber, IsInt, Min } from 'class-validator';
import { CONTRACT_CLAIM_TYPES, CONTRACT_CLAIM_STATUSES } from './create-contract-claim.dto';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class UpdateContractClaimDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  claimNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  claimTitle?: string;

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
