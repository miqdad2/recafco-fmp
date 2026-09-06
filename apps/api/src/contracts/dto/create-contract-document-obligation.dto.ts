import { IsString, IsOptional, IsNotEmpty, MaxLength, IsIn, Matches } from 'class-validator';

export const CONTRACT_DOCUMENT_OBLIGATION_CATEGORIES = [
  'PERFORMANCE_BOND',
  'INSURANCE',
  'GUARANTEE',
  'TAX_STATUTORY',
  'TECHNICAL_SUBMISSION',
  'APPROVAL_DOCUMENT',
  'HEALTH_SAFETY',
  'OTHER',
] as const;

export const CONTRACT_DOCUMENT_OBLIGATION_STATUSES = [
  'PENDING',
  'SUBMITTED',
  'EXPIRING_SOON',
  'EXPIRED_OVERDUE',
  'NOT_REQUIRED',
  'CANCELLED',
] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * responsibleParty is a plain free-text field (e.g. "Contractor", "Client",
 * a specific consultant name) — deliberately NOT a User FK like
 * ContractRisk.responsibleUserId/ContractClaim.responsibleUserId, since the
 * approved design's Responsible Party column shows organizational roles
 * ("Contractor"/"Client"), not a specific system user, and this unit's own
 * spec gives the field as "responsibleParty string nullable".
 */
export class CreateContractDocumentObligationDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  itemNo?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsIn(CONTRACT_DOCUMENT_OBLIGATION_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  responsibleParty?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'requiredDate must be in YYYY-MM-DD format' })
  requiredDate?: string;

  /** CM-70E — legacy combined field, kept for backward compatibility. New callers should use submissionDate/expiryDate instead. */
  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'submissionOrExpiryDate must be in YYYY-MM-DD format' })
  submissionOrExpiryDate?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'submissionDate must be in YYYY-MM-DD format' })
  submissionDate?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'expiryDate must be in YYYY-MM-DD format' })
  expiryDate?: string;

  @IsOptional()
  @IsIn(CONTRACT_DOCUMENT_OBLIGATION_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  remarks?: string;
}
