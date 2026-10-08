import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, ArrayUnique } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);
const trimOrUndefined = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? undefined : t;
};

export const DRAWING_GROUP_ACTIONS = ['DRAFT', 'SUBMIT'] as const;
export type DrawingGroupAction = (typeof DRAWING_GROUP_ACTIONS)[number];

export const MAX_GROUP_PIECES = 2000;

// Drawing No / pieces are checked in the service so the messages stay plain.
export class SaveDrawingGroupDto {
  @IsIn(DRAWING_GROUP_ACTIONS)
  action!: DrawingGroupAction;

  // Required when creating; ignored when editing.
  @IsOptional()
  @IsUUID('4')
  boqItemId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trim)
  drawingNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trimOrUndefined)
  calculationRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(trimOrUndefined)
  groupTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(trimOrUndefined)
  remarks?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_GROUP_PIECES)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  pieceIds?: string[];
}
