'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import type { ActionResult } from '../../actions';
import { createContractAction } from '../../actions';

interface OrgItem {
  id: string;
  code: string;
  name: string;
}

interface PersonItem {
  id: string;
  displayName: string;
}

interface Props {
  depts: OrgItem[];
  plantsData: OrgItem[];
  people: PersonItem[];
}

export function NewContractForm({ depts, plantsData, people }: Props): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    createContractAction,
    { error: null },
  );

  return (
    <>
      {state.error && (
        <div className="mb-6 rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-6 rounded-lg border border-border bg-surface p-6">
        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-text-primary mb-1">
            Title <span className="text-danger">*</span>
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            maxLength={300}
            placeholder="Brief description of the contract"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Counterparty name */}
        <div>
          <label htmlFor="counterpartyName" className="block text-sm font-medium text-text-primary mb-1">
            Counterparty Name <span className="text-danger">*</span>
          </label>
          <input
            id="counterpartyName"
            name="counterpartyName"
            type="text"
            required
            maxLength={300}
            placeholder="Vendor or service provider name"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-text-primary mb-1">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            maxLength={10000}
            placeholder="Describe the scope and key terms of this contract…"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
          />
        </div>

        {/* Counterparty contact */}
        <div>
          <label htmlFor="counterpartyContact" className="block text-sm font-medium text-text-primary mb-1">
            Counterparty Contact
          </label>
          <input
            id="counterpartyContact"
            name="counterpartyContact"
            type="text"
            maxLength={300}
            placeholder="Contact name or email at the counterparty"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Value + Currency */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="contractValue" className="block text-sm font-medium text-text-primary mb-1">
              Contract Value
            </label>
            <input
              id="contractValue"
              name="contractValue"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label htmlFor="currency" className="block text-sm font-medium text-text-primary mb-1">
              Currency
            </label>
            <input
              id="currency"
              name="currency"
              type="text"
              maxLength={10}
              placeholder="e.g. SAR, USD"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        {/* Start + End date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-text-primary mb-1">
              Start Date
            </label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-text-primary mb-1">
              End Date
            </label>
            <input
              id="endDate"
              name="endDate"
              type="date"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        {/* Renewal notice date */}
        <div>
          <label htmlFor="renewalNoticeDate" className="block text-sm font-medium text-text-primary mb-1">
            Renewal Notice Date
          </label>
          <input
            id="renewalNoticeDate"
            name="renewalNoticeDate"
            type="date"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <p className="mt-1 text-xs text-text-muted">Date by which a renewal decision must be made.</p>
        </div>

        {/* Owner */}
        <div>
          <label htmlFor="ownerUserId" className="block text-sm font-medium text-text-primary mb-1">
            Contract Owner
          </label>
          <select
            id="ownerUserId"
            name="ownerUserId"
            defaultValue=""
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">— Select owner —</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.displayName}</option>
            ))}
          </select>
        </div>

        {/* Department + Plant */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="departmentId" className="block text-sm font-medium text-text-primary mb-1">Department</label>
            <select
              id="departmentId"
              name="departmentId"
              defaultValue=""
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">— None —</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="plantId" className="block text-sm font-medium text-text-primary mb-1">Plant</label>
            <select
              id="plantId"
              name="plantId"
              defaultValue=""
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">— None —</option>
              {plantsData.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-text-primary mb-1">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            maxLength={10000}
            placeholder="Internal notes about this contract…"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/contracts"
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
          >
            {isPending ? 'Creating…' : 'Create contract'}
          </button>
        </div>
      </form>
    </>
  );
}
