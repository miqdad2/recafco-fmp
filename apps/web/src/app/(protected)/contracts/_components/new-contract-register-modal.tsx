'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { NewContractForm } from '../new/_components/new-contract-form';

interface OrgItem {
  id: string;
  code: string;
  name: string;
}

interface LocationItem {
  id: string;
  name: string;
  code: string;
}

interface PersonItem {
  id: string;
  displayName: string;
}

interface Props {
  depts: OrgItem[];
  plantsData: OrgItem[];
  locations: LocationItem[];
  people: PersonItem[];
  scope?: { type: 'OWN_DEPARTMENT' | 'SELECTED_DEPARTMENTS' | 'ALL_DEPARTMENTS'; departmentNames: string[] } | undefined;
}

export function NewContractRegisterModal({ depts, plantsData, locations, people, scope }: Props): React.JSX.Element {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center h-10 px-5 rounded-md bg-accent text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
      >
        + New Contract Register
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-start sm:items-center justify-center overflow-y-auto bg-black/40 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-contract-register-title"
        >
          <div className="flex h-[92vh] w-[min(94vw,1700px)] my-2 sm:my-4 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
            <div className="shrink-0 flex items-start justify-between gap-4 border-b border-border bg-surface px-8 py-5">
              <div>
                <h2 id="new-contract-register-title" className="text-xl font-semibold text-text-primary">
                  New Contract Register
                </h2>
                <p className="mt-1.5 text-sm text-text-secondary">
                  Create a new contract by entering the basic details, scope, payment terms and BOQ items.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="shrink-0 rounded-md p-1.5 text-text-muted hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <NewContractForm
              depts={depts}
              plantsData={plantsData}
              locations={locations}
              people={people}
              scope={scope}
              onCancel={() => setOpen(false)}
              layout="modal"
            />
          </div>
        </div>
      )}
    </>
  );
}
