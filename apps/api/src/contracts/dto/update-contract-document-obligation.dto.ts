import { IsString, IsOptional, IsNotEmpty, MaxLength, IsIn, Matches } from 'class-validator';
import {
  CONTRACT_DOCUMENT_OBLIGATION_CATEGORIES,
  CONTRACT_DOCUMENT_OBLIGATION_STATUSES,
} from './create-contract-document-obligation.dto';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class UpdateContractDocumentObligationDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  itemNo?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title?: string;

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
