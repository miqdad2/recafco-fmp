import type { ContractProductionItem } from '@/lib/contracts-api';
import { csvField } from './contract-payment-csv';
import { PRODUCTION_STATUS_LABELS } from './contract-production-helpers';

export const PRODUCTION_CSV_HEADERS = [
  'S/N', 'Item Code', 'Category', 'Item Description', 'Unit', 'Total Qty', 'Casted / Produced',
  'Delivered', 'Stock / Not Delivered', 'Remaining to Cast', 'Progress %', 'Production Status',
  'Last Update', 'Remarks',
];

export function productionItemToCsvRow(item: ContractProductionItem, index: number): string {
  return [
    csvField(index + 1),
    csvField(item.itemCode),
    csvField(item.category),
    csvField(item.description),
    csvField(item.unitOfMeasure),
    csvField(item.totalQty),
    csvField(item.producedQty),
    csvField(item.deliveredQty),
    csvField(item.stockNotDelivered),
    csvField(item.remainingToCast),
    csvField(item.progressPercent),
    csvField(PRODUCTION_STATUS_LABELS[item.status]),
    csvField(item.updatedAt),
    csvField(item.remarks),
  ].join(',');
}

export function buildProductionCsv(items: ContractProductionItem[]): string {
  const lines = [PRODUCTION_CSV_HEADERS.map(csvField).join(',')];
  items.forEach((item, index) => lines.push(productionItemToCsvRow(item, index)));
  return lines.join('\r\n');
}
