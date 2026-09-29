import type { Metadata } from 'next';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { safetyApi } from '../../../../lib/safety-api';
import { createInspectionAction } from '../actions';
import { SafetyInspectionForm } from '../_components/safety-inspection-form';

export const metadata: Metadata = { title: 'New Safety Inspection — RECAFCO FMP' };

/**
 * FMP-UI-21B — this page used to define its own inline `SafetyInspectionForm`
 * function component and wire `createInspectionAction` straight into a plain
 * `<form action={action as unknown as string}>` with no `useActionState` —
 * the exact cause of the "Cannot read properties of undefined (reading
 * 'get')" crash on submit reported for this unit. Extracted the form into
 * `_components/safety-inspection-form.tsx` (a proper client component using
 * `useActionState`, matching how every other create/edit form in this app
 * is wired) and this page now just supplies data + the action — see that
 * component's own doc comment for the full root-cause explanation.
 *
 * FMP-UI-21C — fixed the Department/Plant dropdowns, which only ever
 * rendered "— None —" for a normal `safety.create`-only user. Root cause:
 * this page called the ADMIN-gated `organizations-api.ts`
 * (`departments.list()`/`plants.list()`, `GET /organizations/departments`/
 * `/plants` — requiring `org.departments.read`/`org.plants.read`); the 403
 * was silently swallowed by `Promise.allSettled`, so `depts`/`plantsData`
 * were always `[]` with no error shown. Switched to `safetyApi.departments()`/
 * `.plants()` (new `GET /safety-compliance/departments`/`/plants`, gated by
 * `safety.read` — the same permission already required to reach this page
 * at all — see safety.service.ts's own doc comment). `deptsFailed`/
 * `plantsFailed` are now tracked and passed through so the form can show a
 * real error state instead of a silently empty dropdown.
 */
export default async function NewSafetyInspectionPage(): Promise<React.JSX.Element> {
  const [deptsRes, plantsRes] = await Promise.allSettled([
    safetyApi.departments(),
    safetyApi.plants(),
  ]);

  const depts = deptsRes.status === 'fulfilled' ? deptsRes.value : [];
  const deptsFailed = deptsRes.status === 'rejected';
  const plantsData = plantsRes.status === 'fulfilled' ? plantsRes.value : [];
  const plantsFailed = plantsRes.status === 'rejected';

  return (
    <div className="min-h-full p-8">
      <div className="max-w-3xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Safety & Compliance', href: '/safety-compliance' },
          { label: 'New Inspection' },
        ]} />

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">New Safety Inspection</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Creates a DRAFT inspection. Schedule it once an inspector and date are confirmed.
          </p>
        </div>

        <SafetyInspectionForm
          action={createInspectionAction}
          submitLabel="Create inspection"
          cancelHref="/safety-compliance"
          departments={depts}
          deptsFailed={deptsFailed}
          plants={plantsData}
          plantsFailed={plantsFailed}
        />
      </div>
    </div>
  );
}
