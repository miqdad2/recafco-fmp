import { IsString, IsOptional, MaxLength, IsInt, Min, IsIn, Matches } from 'class-validator';
import { CONTRACT_ERECTION_SCHEDULE_STATUSES } from './create-contract-erection-schedule.dto';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class UpdateContractErectionScheduleDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  scheduleReferenceNo?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'scheduleDate must be in YYYY-MM-DD format' })
  scheduleDate?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'plannedStartDate must be in YYYY-MM-DD format' })
  plannedStartDate?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'plannedEndDate must be in YYYY-MM-DD format' })
  plannedEndDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  jobOrderNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  erectionCrewTeam?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedManpowerPlanned?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  requiredEquipmentPlanned?: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  preparedBy?: string;

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
