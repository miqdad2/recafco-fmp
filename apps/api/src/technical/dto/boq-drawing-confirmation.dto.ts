import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);
const trimOrUndefined = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? undefined : t;
};

/** DRAFT saves without locking; CONFIRM requires a positive whole number of pieces. */
export const BOQ_CONFIRMATION_ACTIONS = ['DRAFT', 'CONFIRM'] as const;
export type BoqConfirmationAction = (typeof BOQ_CONFIRMATION_ACTIONS)[number];

// Whole-number / positive checks live in the service so the messages stay plain.
export class SaveBoqDrawingConfirmationDto {
  @IsIn(BOQ_CONFIRMATION_ACTIONS)
  action!: BoqConfirmationAction;

  // Required when creating; ignored when editing an existing row.
  @IsOptional()
  @IsUUID('4')
  boqItemId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(trim)
  drawingNo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(trimOrUndefined)
  drawingTitle?: string;

  @IsOptional()
  @IsNumber()
  confirmedPieces?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(trimOrUndefined)
  sizeOrSpecification?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(trimOrUndefined)
  revision?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(trimOrUndefined)
  remarks?: string;
}
