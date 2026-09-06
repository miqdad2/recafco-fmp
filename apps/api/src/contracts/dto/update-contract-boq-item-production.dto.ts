import { IsString, IsOptional, MaxLength, IsNumber, Min, IsIn } from 'class-validator';

export const CONTRACT_BOQ_PRODUCTION_STATUSES = [
  'NOT_STARTED',
  'IN_PRODUCTION',
  'PARTIALLY_DELIVERED',
  'COMPLETED',
  'DELAYED',
] as const;

export class UpdateContractBoqItemProductionDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  producedQty?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  deliveredQty?: number;

  @IsOptional()
  @IsIn(CONTRACT_BOQ_PRODUCTION_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  remarks?: string;
}
