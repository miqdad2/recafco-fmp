'use client';

import { Info } from 'lucide-react';
import { SCOPE_OF_WORK_OPTIONS, CRANE_REQUIRED_OPTIONS, CRANE_PROVIDED_BY_OPTIONS } from '../_lib/contract-ui-helpers';

export const inputCls =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
export const labelCls = 'block text-sm font-medium text-text-primary mb-1';
export const gridCls3 = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4';
const textareaCls = `${inputCls} resize-y`;

export function InfoBox({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-start gap-2 rounded-md border border-info/20 bg-info-light px-3 py-2.5 text-xs text-info">
      <Info className="size-3.5 shrink-0 mt-0.5" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Client Contact
// ---------------------------------------------------------------------------

export interface ClientContactDefaults {
  clientContactName?: string;
  clientContactPhone?: string;
}

export function ClientContactFields({ defaults }: { defaults?: ClientContactDefaults }): React.JSX.Element {
  return (
    <div className={gridCls3}>
      <div>
        <label htmlFor="clientContactName" className={labelCls}>Client Main Contact Name</label>
        <input
          id="clientContactName"
          name="clientContactName"
          type="text"
          maxLength={150}
          defaultValue={defaults?.clientContactName ?? ''}
          placeholder="Enter client contact name"
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="clientContactPhone" className={labelCls}>Client Telephone</label>
        <input
          id="clientContactPhone"
          name="clientContactPhone"
          type="text"
          maxLength={50}
          defaultValue={defaults?.clientContactPhone ?? ''}
          placeholder="Enter client telephone"
          className={inputCls}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contract Dates
// ---------------------------------------------------------------------------

export interface ContractDatesDefaults {
  startDate?: string;
  endDate?: string;
  forecastCompletionDate?: string;
}

export function ContractDatesFields({ defaults }: { defaults?: ContractDatesDefaults }): React.JSX.Element {
  return (
    <div className={gridCls3}>
      <div>
        <label htmlFor="startDate" className={labelCls}>Start Date</label>
        <input
          id="startDate"
          name="startDate"
          type="date"
          defaultValue={defaults?.startDate ?? ''}
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="endDate" className={labelCls}>End Date</label>
        <input
          id="endDate"
          name="endDate"
          type="date"
          defaultValue={defaults?.endDate ?? ''}
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="forecastCompletionDate" className={labelCls}>Forecast Completion Date</label>
        <input
          id="forecastCompletionDate"
          name="forecastCompletionDate"
          type="date"
          defaultValue={defaults?.forecastCompletionDate ?? ''}
          className={inputCls}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contract Value (Original Value — current/BOQ value is shown separately,
// next to the BOQ table, since it's calculated rather than entered here)
// ---------------------------------------------------------------------------

export interface ContractValueDefaults {
  originalContractValue?: string;
  originalCurrency?: string;
}

export function ContractValueFields({ defaults }: { defaults?: ContractValueDefaults }): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="originalContractValue" className={labelCls}>Original Value</label>
          <input
            id="originalContractValue"
            name="originalContractValue"
            type="number"
            step="0.001"
            min="0"
            defaultValue={defaults?.originalContractValue ?? ''}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="originalCurrency" className={labelCls}>Currency</label>
          <input
            id="originalCurrency"
            name="originalCurrency"
            type="text"
            maxLength={3}
            placeholder="KWD"
            defaultValue={defaults?.originalCurrency ?? ''}
            className={inputCls}
          />
        </div>
      </div>
      <InfoBox>Current Contract Value is calculated from BOQ items when BOQ is entered.</InfoBox>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project / Site Details
// ---------------------------------------------------------------------------

export interface ProjectSiteDefaults {
  projectSiteLocation?: string;
  scopeDescription?: string;
  scopeExclusions?: string;
  deliverables?: string;
  milestones?: string;
  scheduleSummary?: string;
  quantitiesSpecifications?: string;
}

export function ProjectSiteFields({ defaults }: { defaults?: ProjectSiteDefaults }): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="projectSiteLocation" className={labelCls}>Project / Site Location</label>
        <input
          id="projectSiteLocation"
          name="projectSiteLocation"
          type="text"
          maxLength={255}
          defaultValue={defaults?.projectSiteLocation ?? ''}
          placeholder="Enter project or site location"
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="scopeDescription" className={labelCls}>Scope Description</label>
        <textarea
          id="scopeDescription"
          name="scopeDescription"
          rows={3}
          maxLength={10000}
          defaultValue={defaults?.scopeDescription ?? ''}
          className={textareaCls}
        />
      </div>
      <div>
        <label htmlFor="scopeExclusions" className={labelCls}>Scope Exclusions</label>
        <textarea
          id="scopeExclusions"
          name="scopeExclusions"
          rows={3}
          maxLength={10000}
          defaultValue={defaults?.scopeExclusions ?? ''}
          className={textareaCls}
        />
      </div>
      <div>
        <label htmlFor="deliverables" className={labelCls}>Deliverables</label>
        <textarea
          id="deliverables"
          name="deliverables"
          rows={3}
          maxLength={10000}
          defaultValue={defaults?.deliverables ?? ''}
          className={textareaCls}
        />
      </div>
      <div>
        <label htmlFor="milestones" className={labelCls}>Milestones</label>
        <textarea
          id="milestones"
          name="milestones"
          rows={3}
          maxLength={10000}
          defaultValue={defaults?.milestones ?? ''}
          className={textareaCls}
        />
      </div>
      <div>
        <label htmlFor="scheduleSummary" className={labelCls}>Schedule</label>
        <textarea
          id="scheduleSummary"
          name="scheduleSummary"
          rows={3}
          maxLength={10000}
          defaultValue={defaults?.scheduleSummary ?? ''}
          className={textareaCls}
        />
      </div>
      <div>
        <label htmlFor="quantitiesSpecifications" className={labelCls}>Quantities and Specifications</label>
        <textarea
          id="quantitiesSpecifications"
          name="quantitiesSpecifications"
          rows={3}
          maxLength={10000}
          defaultValue={defaults?.quantitiesSpecifications ?? ''}
          className={textareaCls}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scope of Work — fully controlled: parent owns the state so it can also
// drive Erection/Crane section visibility and the submit-time payload.
// ---------------------------------------------------------------------------

export interface ScopeOfWorkFieldsetProps {
  scope: Record<string, boolean>;
  onScopeChange: (scope: Record<string, boolean>) => void;
  exFactory: boolean;
  onExFactoryChange: (value: boolean) => void;
  otherDescription: string;
  onOtherDescriptionChange: (value: string) => void;
}

const NORMAL_SCOPE_KEYS = ['shopDrawing', 'designProduction', 'production', 'delivery', 'erection'];

export function ScopeOfWorkFieldset({
  scope,
  onScopeChange,
  exFactory,
  onExFactoryChange,
  otherDescription,
  onOtherDescriptionChange,
}: ScopeOfWorkFieldsetProps): React.JSX.Element {
  const notApplicable = scope['notApplicable'] === true;
  const other = scope['other'] === true;
  const anyActiveSelected =
    exFactory || other || NORMAL_SCOPE_KEYS.some((k) => scope[k] === true);

  function toggleNormal(key: string, checked: boolean): void {
    const next = { ...scope, [key]: checked };
    if (checked) next['notApplicable'] = false;
    onScopeChange(next);
  }

  function toggleOther(checked: boolean): void {
    const next: Record<string, boolean> = { ...scope, other: checked };
    if (checked) next['notApplicable'] = false;
    else onOtherDescriptionChange('');
    onScopeChange(next);
  }

  function toggleExFactory(checked: boolean): void {
    onExFactoryChange(checked);
    if (checked) onScopeChange({ ...scope, notApplicable: false });
  }

  function toggleNotApplicable(checked: boolean): void {
    if (checked) {
      onScopeChange({ notApplicable: true });
      onExFactoryChange(false);
      onOtherDescriptionChange('');
    } else {
      onScopeChange({ ...scope, notApplicable: false });
    }
  }

  return (
    <div className="space-y-4">
      <div className={gridCls3}>
        {SCOPE_OF_WORK_OPTIONS.filter((opt) => !['exFactory', 'other', 'notApplicable'].includes(opt.key)).map((opt) => {
          const disabled = (exFactory && (opt.key === 'delivery' || opt.key === 'erection')) || notApplicable;
          return (
            <label
              key={opt.key}
              className={`flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm ${disabled ? 'opacity-50 cursor-not-allowed bg-surface-secondary' : 'text-text-primary'}`}
            >
              <input
                type="checkbox"
                name={`scope_${opt.key}`}
                disabled={disabled}
                checked={disabled ? false : (scope[opt.key] ?? false)}
                onChange={(e) => toggleNormal(opt.key, e.target.checked)}
                className="rounded border-border text-accent focus:ring-accent"
              />
              {opt.label}
            </label>
          );
        })}

        <label
          className={`flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm bg-surface-secondary ${notApplicable ? 'opacity-50 cursor-not-allowed' : 'text-text-primary'}`}
        >
          <input
            type="checkbox"
            name="scope_exFactory"
            disabled={notApplicable}
            checked={notApplicable ? false : exFactory}
            onChange={(e) => toggleExFactory(e.target.checked)}
            className="rounded border-border text-accent focus:ring-accent"
          />
          Ex-Factory
        </label>

        <label
          className={`flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm ${notApplicable ? 'opacity-50 cursor-not-allowed bg-surface-secondary' : 'text-text-primary'}`}
        >
          <input
            type="checkbox"
            name="scope_other"
            disabled={notApplicable}
            checked={notApplicable ? false : other}
            onChange={(e) => toggleOther(e.target.checked)}
            className="rounded border-border text-accent focus:ring-accent"
          />
          Other
        </label>

        <label
          className={`flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm ${anyActiveSelected ? 'opacity-50 cursor-not-allowed bg-surface-secondary' : 'text-text-primary bg-surface-secondary'}`}
        >
          <input
            type="checkbox"
            name="scope_notApplicable"
            disabled={anyActiveSelected}
            checked={anyActiveSelected ? false : notApplicable}
            onChange={(e) => toggleNotApplicable(e.target.checked)}
            className="rounded border-border text-accent focus:ring-accent"
          />
          Not Applicable
        </label>
      </div>

      {other && !notApplicable && (
        <div>
          <label htmlFor="scope_otherDescription" className={labelCls}>
            Other Description <span className="text-danger">*</span>
          </label>
          <input
            id="scope_otherDescription"
            name="scope_otherDescription"
            type="text"
            required
            maxLength={300}
            value={otherDescription}
            onChange={(e) => onOtherDescriptionChange(e.target.value)}
            placeholder="Describe the additional scope item"
            className={inputCls}
          />
        </div>
      )}

      <InfoBox>
        If &ldquo;Ex-Factory&rdquo; is selected, Delivery and Erection will be disabled. &ldquo;Not
        Applicable&rdquo; cannot be combined with any other scope option.
      </InfoBox>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Erection / Crane — only rendered by the parent when Erection is selected.
// ---------------------------------------------------------------------------

export interface CraneFieldsDefaults {
  craneRequired?: string;
  craneProvidedBy?: string;
  estimatedCraneCapacity?: string;
}

export function CraneFields({ defaults }: { defaults?: CraneFieldsDefaults }): React.JSX.Element {
  return (
    <div className={gridCls3}>
      <div>
        <label htmlFor="craneRequired" className={labelCls}>Crane Required</label>
        <select id="craneRequired" name="craneRequired" defaultValue={defaults?.craneRequired ?? ''} className={inputCls}>
          <option value="">— Select —</option>
          {CRANE_REQUIRED_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="craneProvidedBy" className={labelCls}>Crane Provided By</label>
        <select id="craneProvidedBy" name="craneProvidedBy" defaultValue={defaults?.craneProvidedBy ?? ''} className={inputCls}>
          <option value="">— Select —</option>
          {CRANE_PROVIDED_BY_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="estimatedCraneCapacity" className={labelCls}>Estimated Crane Capacity</label>
        <input
          id="estimatedCraneCapacity"
          name="estimatedCraneCapacity"
          type="text"
          maxLength={100}
          defaultValue={defaults?.estimatedCraneCapacity ?? ''}
          placeholder="e.g. 50 tons"
          className={inputCls}
        />
      </div>
    </div>
  );
}
