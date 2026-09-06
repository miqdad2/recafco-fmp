import { IsString, IsOptional, IsIn, IsNumber, IsInt, Min, MaxLength, IsBoolean, IsArray, ValidateNested, ArrayMinSize, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export const CONTRACT_SCHEDULE_STAGE_KEYS = [
  'CONTRACT_SIGN',
  'ADVANCE_PAYMENT',
  'DRAWING_APPROVAL',
  'ESTIMATION_SHEET',
  'CASTING_PRODUCTION',
  'DELIVERY',
  'ERECTION',
  'FINAL_CLOSEOUT',
] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class UpdateContractScheduleStageDto {
  @IsIn(CONTRACT_SCHEDULE_STAGE_KEYS)
  stageKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  stageName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  responsibleTeam?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'plannedStartDate must be in YYYY-MM-DD format' })
  plannedStartDate?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'plannedEndDate must be in YYYY-MM-DD format' })
  plannedEndDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  plannedQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  plannedMolds?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

// CM-68A — a manager saves the full 8-stage planned schedule in one call
// (upsert per stageKey, unique on [contractId, stageKey] — see
// contract-schedule-plan.service.ts). Never touches actual/derived values.
export class UpdateContractSchedulePlanDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateContractScheduleStageDto)
  items!: UpdateContractScheduleStageDto[];
}
