import type { ContractRisk } from '@/lib/contracts-api';
import { csvField } from './contract-payment-csv';
import { RISK_LEVEL_LABELS, RISK_RESPONSE_LABELS, RISK_STATUS_LABELS } from './contract-risk-helpers';

export const RISK_CSV_HEADERS = [
  'Risk ID', 'Risk Clause / Description', 'Risk Evaluation', 'Risk Response', 'Risk Response Description',
  'Residual Risk', 'Status', 'Responsible Person', 'Action Due Date', 'Days to Deadline', 'Last Update',
];

export function riskToCsvRow(r: ContractRisk): string {
  return [
    csvField(r.riskNo),
    csvField(r.description),
    csvField(RISK_LEVEL_LABELS[r.riskEvaluation]),
    csvField(RISK_RESPONSE_LABELS[r.riskResponse]),
    csvField(r.riskResponseDescription),
    csvField(r.residualRisk ? RISK_LEVEL_LABELS[r.residualRisk] : undefined),
    csvField(RISK_STATUS_LABELS[r.status]),
    csvField(r.responsibleUser?.displayName),
    csvField(r.actionDueDate),
    csvField(r.daysToDeadline),
    csvField(r.updatedAt),
  ].join(',');
}

export function buildRisksCsv(risks: ContractRisk[]): string {
  const lines = [RISK_CSV_HEADERS.map(csvField).join(',')];
  for (const r of risks) lines.push(riskToCsvRow(r));
  return lines.join('\r\n');
}
