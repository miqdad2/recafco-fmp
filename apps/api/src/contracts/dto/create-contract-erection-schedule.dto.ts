import { IsString, IsOptional, IsNotEmpty, MaxLength, IsInt, Min, IsIn, Matches } from 'class-validator';

export const CONTRACT_ERECTION_SCHEDULE_STATUSES = ['DRAFT', 'ISSUED', 'HOLD', 'RETURNED'] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class CreateContractErectionScheduleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  scheduleReferenceNo!: string;

  @IsString()
  @Matches(DATE_PATTERN, { message: 'scheduleDate must be in YYYY-MM-DD format' })
  scheduleDate!: string;

  @IsString()
  @Matches(DATE_PATTERN, { message: 'plannedStartDate must be in YYYY-MM-DD format' })
  plannedStartDate!: string;

  @IsString()
  @Matches(DATE_PATTERN, { message: 'plannedEndDate must be in YYYY-MM-DD format' })
  plannedEndDate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  jobOrderNo!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  erectionCrewTeam!: string;

  @IsInt()
  @Min(0)
  estimatedManpowerPlanned!: number;

  @IsInt()
  @Min(0)
  requiredEquipmentPlanned!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  preparedBy!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  reviewedByErectionManager?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'reviewedOn must be in YYYY-MM-DD format' })
  reviewedOn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  documentRevision?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalActivities?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  criticalActivities?: number;

  @IsOptional()
  @IsIn(CONTRACT_ERECTION_SCHEDULE_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  remarks?: string;
}
