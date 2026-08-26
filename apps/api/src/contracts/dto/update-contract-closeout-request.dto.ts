import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateContractCloseoutRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  closeoutSummary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  requestedRemarks?: string;
}
