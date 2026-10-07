import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/** Statuses a user can move a piece to. "Not Started" is not offered (pieces start as Drawing Ready). */
export const PIECE_UPDATE_TARGET_STATUSES = [
  'DRAWING_READY',
  'IN_PRODUCTION',
  'PRODUCED',
  'IN_STORE',
  'DELIVERED',
  'ERECTED',
  'COMPLETED',
  'ON_HOLD',
  'REJECTED',
  'CANCELLED',
] as const;
export type PieceUpdateTargetStatus = (typeof PIECE_UPDATE_TARGET_STATUSES)[number];

export const MAX_BULK_PIECES = 500;

const trimOrUndefined = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? undefined : t;
};

export class UpdatePieceStatusDto {
  @IsIn(PIECE_UPDATE_TARGET_STATUSES, { message: 'Please select a status.' })
  status!: PieceUpdateTargetStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(trimOrUndefined)
  note?: string;
}

export class BulkUpdatePieceStatusDto extends UpdatePieceStatusDto {
  // FMP-BOQ-08 — optional place (Yard A, Bay 3, Site …); only applied when moving to In Store or Delivered.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(trimOrUndefined)
  location?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Please select at least one piece.' })
  @ArrayMaxSize(MAX_BULK_PIECES)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  pieceIds!: string[];
}
