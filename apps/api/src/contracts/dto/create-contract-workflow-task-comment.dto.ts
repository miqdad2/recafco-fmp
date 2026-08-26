import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateContractWorkflowTaskCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  comment!: string;
}
