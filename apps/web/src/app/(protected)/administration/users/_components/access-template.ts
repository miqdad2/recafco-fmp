// FMP-UI-02 — deliberately NOT in new-user-wizard.tsx ('use client'): Next.js's
// RSC compiler turns every export of a 'use client' module into a client
// reference when imported from a Server Component, not just the component
// itself — so a plain runtime array like ACCESS_TEMPLATE_VALUES would no
// longer be a real array when imported into new/page.tsx (a Server
// Component), breaking `.includes()` at runtime despite typechecking fine.
// This tiny shared module has no 'use client' directive, so both the client
// wizard and the server page can import the real value safely.
export type AccessTemplate =
  | 'EXECUTIVE_MANAGER'
  | 'MODULE_MANAGER'
  | 'MODULE_STAFF'
  | 'ERECTION_MANAGER'
  | 'MULTI_MODULE'
  | 'VIEWER'
  | 'PLATFORM_ADMIN'
  | 'CUSTOM';

/** Runtime list of every valid AccessTemplate value — used by new/page.tsx to validate `?template=` from a card link before trusting it. */
export const ACCESS_TEMPLATE_VALUES: AccessTemplate[] = [
  'EXECUTIVE_MANAGER', 'MODULE_MANAGER', 'MODULE_STAFF', 'ERECTION_MANAGER', 'MULTI_MODULE', 'VIEWER', 'PLATFORM_ADMIN', 'CUSTOM',
];
