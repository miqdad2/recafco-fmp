import { IsString, IsOptional, IsNotEmpty, MaxLength, IsIn, IsISO8601, IsInt, Min, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export const CONTRACT_ERECTION_START_STATUSES = ['DRAFT', 'STARTED', 'HOLD', 'RETURNED'] as const;
export const CONTRACT_ERECTION_START_CHECKLIST_STATUSES = ['PENDING', 'COMPLETED', 'NOT_APPLICABLE'] as const;

// CM-71F — the fixed 10-item pre-erection checklist this unit's own task
// specifies; a request naming any other item is rejected by @IsIn below.
export const CONTRACT_ERECTION_START_CHECKLIST_ITEMS = [
  'Method Statement Reviewed',
  'Erection Schedule Reviewed',
  'Delivery Confirmed',
  'Site Access Confirmed',
  'Crane / Trailer Arranged',
  'Tools & Tackles Checked',
  'Manpower Available',
  'Pre-Erection Meeting Conducted',
  'Weather Acceptable',
  'Work Area Ready',
] as const;

export class ErectionStartManpowerInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  trade!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  plannedNos?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  actualDeployedNos?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;
}

export class ErectionStartEquipmentInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  equipmentType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  descriptionCapacity!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  ownedOrRental!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  assignedQty?: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  operatorDriver?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;
}

export class ErectionStartChecklistInputDto {
  @IsIn(CONTRACT_ERECTION_START_CHECKLIST_ITEMS)
  checklistItem!: string;

  @IsOptional()
  @IsIn(CONTRACT_ERECTION_START_CHECKLIST_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;
}

export class CreateContractErectionStartDto {
  @IsOptional()
  @IsISO8601()
  actualStartDateTime?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  workLocationYard!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  erectionCrewTeam!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  supervisor!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  weatherCondition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  windSpeed?: string;

  @IsString()
  @IsNotEmpty()
  scopeOfWorkToday!: string;

  @IsOptional()
  @IsIn(CONTRACT_ERECTION_START_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  comments?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ErectionStartManpowerInputDto)
  manpowerRows?: ErectionStartManpowerInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ErectionStartEquipmentInputDto)
  equipmentRows?: ErectionStartEquipmentInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ErectionStartChecklistInputDto)
  checklistRows?: ErectionStartChecklistInputDto[];
}
