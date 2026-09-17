import { IsString, IsOptional, IsNotEmpty, MaxLength, IsIn, Matches, IsNumber, Min, IsArray, ValidateNested, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export const CONTRACT_ERECTION_DELIVERY_START_STATUSES = ['DRAFT', 'STARTED', 'HOLD', 'RETURNED'] as const;
export const CONTRACT_ERECTION_DELIVERY_ITEM_STATUSES = ['READY_TO_DISPATCH', 'DISPATCHED', 'DELIVERED', 'HOLD'] as const;
// CM-71E — the fixed 4-document checklist this unit's own task specifies;
// a request naming any other document is rejected by @IsIn below rather
// than silently creating an arbitrary 5th row.
export const CONTRACT_ERECTION_DELIVERY_DOCUMENT_NAMES = [
  'Packing List',
  'Material Test Certificates',
  'Delivery Note / Invoice',
  'Bill of Lading / LR',
] as const;
export const CONTRACT_ERECTION_DELIVERY_DOCUMENT_REQUESTED_STATUSES = ['PENDING', 'NOT_REQUIRED'] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class CreateContractErectionDeliveryItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  packageNo?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  volume?: number;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  quantity!: number;

  @IsOptional()
  @IsIn(CONTRACT_ERECTION_DELIVERY_ITEM_STATUSES)
  status?: string;
}

// CM-71E — `status` here is only ever a REQUEST: PENDING or NOT_REQUIRED
// (the user's own manual override). ATTACHED is never accepted from the
// client — the service derives it itself, purely from whether attachmentId
// genuinely resolves to a real uploaded attachment on this delivery start,
// per this unit's own "do not fake attached documents" instruction (see
// computeDeliveryDocumentStatus in contract-erection-delivery-start.service.ts).
export class DeliveryDocumentInputDto {
  @IsIn(CONTRACT_ERECTION_DELIVERY_DOCUMENT_NAMES)
  documentName!: string;

  @IsOptional()
  @IsIn(CONTRACT_ERECTION_DELIVERY_DOCUMENT_REQUESTED_STATUSES)
  status?: string;

  @IsOptional()
  @IsUUID()
  attachmentId?: string;
}

export class CreateContractErectionDeliveryStartDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  deliveryReferenceNo!: string;

  @IsString()
  @Matches(DATE_PATTERN, { message: 'deliveryDate must be in YYYY-MM-DD format' })
  deliveryDate!: string;

  @IsString()
  @Matches(DATE_PATTERN, { message: 'plannedDeliveryWindowStart must be in YYYY-MM-DD format' })
  plannedDeliveryWindowStart!: string;

  @IsString()
  @Matches(DATE_PATTERN, { message: 'plannedDeliveryWindowEnd must be in YYYY-MM-DD format' })
  plannedDeliveryWindowEnd!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  transportMode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  dispatchProductionSource!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  dispatchFromYard!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  deliveryToSiteLocation!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  gateEntryContact?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deliveryNoteOrLrNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  vehicleNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  driverName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  driverContact?: string;

  @IsOptional()
  @IsIn(CONTRACT_ERECTION_DELIVERY_START_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  comments?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateContractErectionDeliveryItemDto)
  items?: CreateContractErectionDeliveryItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliveryDocumentInputDto)
  documents?: DeliveryDocumentInputDto[];
}
