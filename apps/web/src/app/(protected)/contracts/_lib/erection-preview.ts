// ---------------------------------------------------------------------------
// CM-71H.9 — Manager Preview Mode. Lets a manager-tier viewer (contracts.
// update — Contract Manager/Admin/Super Admin) open any of the 6 guided
// erection screens for layout/design review even when the step's own real
// prerequisite record doesn't exist yet, via `?preview=1`. A staff-tier
// viewer (Contract Staff/Erection Manager, contracts.workflow_update only)
// passing the exact same query param gets no effect whatsoever — real
// workflow gating for them is completely untouched by this file. Preview
// mode never bypasses save/submit/issue/approve/confirm validation on the
// backend, and each guided panel disables those actions client-side too
// whenever preview mode is the only reason the form is rendering.
// ---------------------------------------------------------------------------

/** True only when the actor holds contracts.update AND the URL explicitly asked for `?preview=1`. */
export function resolveErectionPreviewMode(
  permissions: string[],
  previewParam: string | string[] | undefined,
): boolean {
  return permissions.includes('contracts.update') && previewParam === '1';
}
