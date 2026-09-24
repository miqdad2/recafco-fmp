export type ModuleAccent =
  | 'contracts'
  | 'technical'
  | 'erection'
  | 'qaqc'
  | 'storage'
  | 'safety'
  | 'incident'
  | 'production'
  | 'maintenance'
  | 'tasks';

export interface AccentPalette {
  /** Solid base color — button background, accent border, accent dot, icon foreground. */
  base: string;
  /** Soft tint — icon badge background and metric tile background. */
  light: string;
}

/**
 * FMP-UI-05 — extracted from executive-module-card.tsx (FMP-UI-07) so the
 * Executive Module Landing Pages can reuse the exact same per-module colors
 * as the Executive Dashboard's cards, instead of redefining them. Literal
 * hex only — never a CSS custom property or Tailwind color utility. See
 * executive-module-card.tsx's own history/doc comment for why: `var(--color-
 * module-*)` and the Tailwind class both ultimately depend on the same
 * custom property being present in whatever CSS the browser loaded, which
 * broke repeatedly; a literal hex in `style` needs no CSS resolution at all.
 */
export const ACCENT_PALETTE: Record<ModuleAccent, AccentPalette> = {
  contracts: { base: '#1e3a8a', light: '#eff6ff' }, // navy / blue
  technical: { base: '#4338ca', light: '#eef2ff' }, // indigo / steel blue
  erection: { base: '#b45309', light: '#fffbeb' }, // amber / orange
  // FMP-UI-10 — deliberately NOT amber/purple: erection already owns amber
  // and production already owns purple/indigo, and QA/QC + Storage &
  // Delivery sit close to those two in the card order, so a genuinely
  // distinct hue was picked for each rather than reusing a near-neighbor.
  qaqc: { base: '#7e22ce', light: '#faf5ff' }, // violet — distinct from production's purple/indigo
  storage: { base: '#475569', light: '#f1f5f9' }, // slate / logistics blue-grey — distinct from erection's amber
  safety: { base: '#15803d', light: '#eaf7ef' }, // green
  incident: { base: '#b91c1c', light: '#fdecec' }, // red
  production: { base: '#6d28d9', light: '#f5f3ff' }, // purple / blue
  maintenance: { base: '#0f766e', light: '#ecfdfa' }, // teal
  tasks: { base: '#0e7490', light: '#ecfeff' }, // slate / cyan
};
