import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class RejectContractCloseoutRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  rejectionReason!: string;
}
