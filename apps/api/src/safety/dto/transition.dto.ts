import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';

export class CompleteInspectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  conclusion!: string;
}

export class CancelInspectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}

export class ReopenInspectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}

export class CreateFindingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  description!: string;

  @IsString()
  @IsNotEmpty()
  severity!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  actionRequired?: string;

  @IsOptional()
  @IsString()
  dueAt?: string;
}

export class AssignFindingDto {
  @IsString()
  @IsNotEmpty()
  assignedToUserId!: string;
}

export class RequireActionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  actionRequired!: string;
}

export class ResolveFindingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  resolutionSummary!: string;
}

export class ReopenFindingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}
