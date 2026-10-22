/** FMP-SALES-01 — shared state shape of every Sales form (kept out of the 'use server' file, which may only export async functions). */
export interface SalesFormState {
  /** A message to show at the top of the form (null = none). */
  error: string | null;
  fieldErrors: Record<string, string[]>;
  /** What the user typed, so the form can be refilled after an error. */
  values: Record<string, string>;
  /** Set after a successful change that stays on the same page. */
  ok?: string | null;
  /** Set by the quick-entry popup after a successful save (the new enquiry's id). */
  savedId?: string | null;
}

export const EMPTY_FORM_STATE: SalesFormState = { error: null, fieldErrors: {}, values: {}, ok: null };
