import { IsDateString, IsUUID } from 'class-validator';

export class ScheduleInspectionDto {
  @IsDateString()
  scheduledAt!: string;

  @IsUUID('4')
  inspectorUserId!: string;
}
