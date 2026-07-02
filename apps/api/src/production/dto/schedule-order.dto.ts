import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ScheduleOrderDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}
