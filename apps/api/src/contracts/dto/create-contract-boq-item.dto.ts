import { IsString, IsNotEmpty, IsOptional, MaxLength, IsNumber, IsIn, Min } from 'class-validator';

export const CONTRACT_BOQ_UNIT_OPTIONS = ['m²', 'm³', 'lm', 'nos', 'ton', 'kg', 'set', 'lot', 'other'] as const;
export const CONTRACT_BOQ_MIX_DESIGN_TYPES = ['GRAY', 'WHITE', 'NOT_APPLICABLE'] as const;

// Deliberately has no invoiceQty / p/r / remainingAmount fields — those are
// calculated later from the payment/progress modules, never entered at registration.
export class CreateContractBoqItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  itemCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  drawingReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  specificationReference?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  originalEstimatedQty?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  revisedQty?: number;

  @IsOptional()
  @IsString()
  @IsIn(CONTRACT_BOQ_UNIT_OPTIONS)
  unitOfMeasure?: string;

  @IsOptional()
  @IsIn(CONTRACT_BOQ_MIX_DESIGN_TYPES)
  mixDesignType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  concreteGrade?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  unitPrice?: number;
}
