import type { ContractWorkflowTeam } from '@recafco/database';

// ---------------------------------------------------------------------------
// Default task templates (CM-29) — exact task names as specified. taskKey is
// a stable per-template identifier used for idempotent lazy generation: a
// contract never gets the same taskKey twice (enforced by the DB's unique
// (contractId, taskKey) constraint), so re-running generation is always safe.
// ---------------------------------------------------------------------------

export interface WorkflowTaskTemplate {
  team: ContractWorkflowTeam;
  taskKey: string;
  taskName: string;
  sortOrder: number;
}

const TECHNICAL_TEMPLATES: WorkflowTaskTemplate[] = [
  { team: 'TECHNICAL', taskKey: 'technical_drawing_received', taskName: 'Drawing Received', sortOrder: 1 },
  { team: 'TECHNICAL', taskKey: 'technical_sd_calculation_submission', taskName: 'SD & Calculation Submission', sortOrder: 2 },
  { team: 'TECHNICAL', taskKey: 'technical_getting_approval', taskName: 'Getting Approval', sortOrder: 3 },
  { team: 'TECHNICAL', taskKey: 'technical_fd_issuance', taskName: 'FD Issuance', sortOrder: 4 },
];

const PRODUCTION_TEMPLATES: WorkflowTaskTemplate[] = [
  { team: 'PRODUCTION', taskKey: 'production_mix_design_submission', taskName: 'Submission of Mix Design', sortOrder: 1 },
  { team: 'PRODUCTION', taskKey: 'production_mix_design_approval', taskName: 'Mix Design Approval', sortOrder: 2 },
  { team: 'PRODUCTION', taskKey: 'production_mould_preparation', taskName: 'Mould Preparation', sortOrder: 3 },
  { team: 'PRODUCTION', taskKey: 'production_issue_schedule', taskName: 'Issue Production Schedule', sortOrder: 4 },
  { team: 'PRODUCTION', taskKey: 'production_start', taskName: 'Production Start', sortOrder: 5 },
];

// CM-71H.2 — wording corrected to match the CM-71A-G guided screens' own
// step titles exactly ("Issued of..."/"Issued..."/"Issue Checklist" were the
// original CM-29 copy, predating those guided screens). taskKey (the stable
// identifier every guided-routing/detection helper keys off — see
// guided-erection-workflow-route.ts) is UNCHANGED — only the display string
// moved. Already-generated ContractWorkflowTask rows still hold the OLD
// stored taskName (this is a template for future generation, not a live
// re-sync) — getGuidedErectionTaskDisplayName() on the frontend corrects the
// display for both old and new rows uniformly, so no data migration or
// backfill was needed for this to be "corrected wherever visible."
const ERECTION_TEMPLATES: WorkflowTaskTemplate[] = [
  { team: 'ERECTION', taskKey: 'erection_method_statement_issued', taskName: 'Issue Erection Method Statement', sortOrder: 1 },
  { team: 'ERECTION', taskKey: 'erection_statement_approval', taskName: 'Erection Method Statement Approval', sortOrder: 2 },
  { team: 'ERECTION', taskKey: 'erection_schedule_issued', taskName: 'Issue Erection Schedule', sortOrder: 3 },
  { team: 'ERECTION', taskKey: 'erection_delivery_start', taskName: 'Delivery Start', sortOrder: 4 },
  { team: 'ERECTION', taskKey: 'erection_start', taskName: 'Erection Start', sortOrder: 5 },
  { team: 'ERECTION', taskKey: 'erection_issue_checklist', taskName: 'Erection Checklist', sortOrder: 6 },
];

const QS_COMMERCIAL_TEMPLATES: WorkflowTaskTemplate[] = [
  { team: 'QS_COMMERCIAL', taskKey: 'qs_payment_issued', taskName: 'Payment Issued', sortOrder: 1 },
];

export type ScopeOfWork = Record<string, boolean | string | undefined> | null | undefined;

/** Technical tasks apply when Shop Drawing or Production Drawings (designProduction) is in scope. */
export function shouldIncludeTechnical(scope: ScopeOfWork): boolean {
  if (!scope || scope['notApplicable'] === true) return false;
  return scope['shopDrawing'] === true || scope['designProduction'] === true;
}

/** Production tasks apply when Production is in scope. */
export function shouldIncludeProduction(scope: ScopeOfWork): boolean {
  if (!scope || scope['notApplicable'] === true) return false;
  return scope['production'] === true;
}

/** Erection tasks (which include Delivery Start) apply when Delivery or Erection is in scope — never when Ex-Factory is selected. */
export function shouldIncludeErection(scope: ScopeOfWork): boolean {
  if (!scope || scope['notApplicable'] === true) return false;
  if (scope['exFactory'] === true) return false;
  return scope['delivery'] === true || scope['erection'] === true;
}

/** QS/Commercial applies to any non-"Not Applicable" contract that has payment terms selected or a contract value set — independent of the other scope keys. */
export function shouldIncludeQsCommercial(
  scope: ScopeOfWork,
  hasPaymentTerms: boolean,
  hasContractValue: boolean,
): boolean {
  if (scope?.['notApplicable'] === true) return false;
  return hasPaymentTerms || hasContractValue;
}

export interface WorkflowGenerationInput {
  scopeOfWork: ScopeOfWork;
  paymentTerms: Record<string, boolean> | null | undefined;
  contractValue: unknown;
}

/** Pure decision function: which default task templates apply to this contract's saved scope. Never invents dates or responsible persons — callers insert only status/sortOrder/name/team. */
export function generateWorkflowTaskTemplates(input: WorkflowGenerationInput): WorkflowTaskTemplate[] {
  const templates: WorkflowTaskTemplate[] = [];

  if (shouldIncludeTechnical(input.scopeOfWork)) templates.push(...TECHNICAL_TEMPLATES);
  if (shouldIncludeProduction(input.scopeOfWork)) templates.push(...PRODUCTION_TEMPLATES);
  if (shouldIncludeErection(input.scopeOfWork)) templates.push(...ERECTION_TEMPLATES);

  const hasPaymentTerms = Boolean(
    input.paymentTerms && Object.values(input.paymentTerms).some((v) => v === true),
  );
  const hasContractValue = input.contractValue !== null && input.contractValue !== undefined;
  if (shouldIncludeQsCommercial(input.scopeOfWork, hasPaymentTerms, hasContractValue)) {
    templates.push(...QS_COMMERCIAL_TEMPLATES);
  }

  return templates;
}
