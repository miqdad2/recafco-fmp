import { IsString, IsOptional, MaxLength, IsNumber, IsBoolean, IsIn, Matches } from 'class-validator';
import { CONTRACT_VARIATION_STATUSES } from './create-contract-variation.dto';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class UpdateContractVariationDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  variationNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  amount?: number;

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

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  supportingDocumentUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  remarks?: string;
}
