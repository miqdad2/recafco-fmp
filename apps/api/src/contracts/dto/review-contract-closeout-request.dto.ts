import { IsString, IsOptional, MaxLength } from 'class-validator';

export class ReviewContractCloseoutRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  reviewRemarks?: string;
}
