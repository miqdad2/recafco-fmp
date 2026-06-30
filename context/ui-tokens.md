# UI Tokens

Use semantic tokens throughout. Never hardcode colors in feature components and never use raw Tailwind product colors.

```css
@import "tailwindcss";

@theme {
  --font-sans: "Inter", "Segoe UI", Arial, sans-serif;
  --font-mono: "JetBrains Mono", Consolas, monospace;

  --color-background: #f5f7fa;
  --color-surface: #ffffff;
  --color-surface-secondary: #eef2f6;
  --color-surface-hover: #f8fafc;

  --color-nav: #172033;
  --color-nav-hover: #243047;
  --color-nav-active: #2f3d59;

  --color-border: #d8dee8;
  --color-border-strong: #b8c2d1;

  --color-text-primary: #172033;
  --color-text-secondary: #475467;
  --color-text-muted: #667085;
  --color-text-inverse: #ffffff;

  --color-accent: #c62828;
  --color-accent-hover: #a91f1f;
  --color-accent-light: #fdecec;
  --color-accent-foreground: #ffffff;

  --color-secondary-accent: #b58a3a;
  --color-secondary-accent-light: #f8f0df;

  --color-success: #157f3d;
  --color-success-light: #eaf7ef;
  --color-warning: #a15c00;
  --color-warning-light: #fff4e5;
  --color-error: #b42318;
  --color-error-light: #fdecec;
  --color-info: #175cd3;
  --color-info-light: #eaf2ff;
  --color-focus: #2563eb;

  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 10px;
  --radius-xl: 14px;
  --radius-full: 9999px;
}
```

## Rules

- Use generated semantic utilities such as `bg-surface`, `text-text-primary`, and `border-border`.
- RECAFCO red is for branding and primary actions, not large page backgrounds.
- Status colors are consistent across modules.
- Color never communicates status alone.
- Cards: white surface, subtle border, `rounded-lg`, light shadow.
- Inputs/buttons: minimum 40px height, `rounded-md`.
- Badges: `rounded-full`, explicit text.
- Minimum mobile touch target: 44px.
