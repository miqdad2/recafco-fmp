import { IsString, IsNotEmpty, MaxLength, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class TerminateContractDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}
