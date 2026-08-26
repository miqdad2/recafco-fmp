import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateContractCloseoutRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  closeoutSummary!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  requestedRemarks?: string;
}
