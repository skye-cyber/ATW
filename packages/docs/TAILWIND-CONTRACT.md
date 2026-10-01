# Tailwind CSS 4 Integration Contract

This document mirrors ADR 0002 and is the operational reference for anyone
touching `packages/app/src/styles/app.css` or any file under
`packages/react/src` or `packages/app/src`.

## Setup (locked)

Dependencies:

    pnpm add -D tailwindcss @tailwindcss/vite

`packages/app/vite.config.ts`:

    plugins: [react(), tailwindcss()]

`packages/app/src/styles/app.css`:

- Line 1, unwrapped: `@import "tailwindcss";`
- Then `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));`
- Then `@theme { ... }` with all design tokens
- Then `[data-theme="dark"] { ... }` overrides
- Then any `@utility` definitions

## Rules (locked)

1. **No `postcss.config.js`.** TW4-via-Vite does not use PostCSS. If a
   `postcss.config.*` exists, delete it. Mixing the two is the #1 cause of
   silent CSS loss.
2. **No `tailwind.config.js`.** TW4's Vite plugin discovers sources. If content
   globs are ever needed, use `@source` directives in CSS, not a config file.
3. **`@import "tailwindcss"` is line 1 of the entry CSS.** Not after a comment,
   not inside a `@layer`, not conditionally.
4. **No dynamic class construction.** Ever. `className={\`text-${x}-500\`}` is
   banned. Conditional classes go through `cn(...)` with literal strings.
5. **No `!important` overrides.** If a style doesn't apply, the class vocabulary
   is wrong. Fix the vocabulary, not the specificity.
6. **No inline `style={{}}`** except for genuinely dynamic values (progress bar
   width, virtualized row transform). Colors and spacing go through tokens.
7. **Tokens live in `@theme`.** Component code references utilities that resolve
   to tokens. Re-theming is a token change, not a class change.

## Custom utilities

Defined once in `app.css`:

- `method-*` — HTTP method badges (`method-get`, `method-post`, …)
- `sev-*` — severity pills (`sev-critical`, `sev-high`, `sev-medium`, `sev-low`, `sev-info`)
- `role-*` — role pills (`role-guest`, `role-user`, `role-premium`, `role-admin`)
- `heat-*` — matrix cell heat (`heat-ok`, `heat-warn`, `heat-danger`)

Class names are literals in markup. The `@utility` block uses `--value(--color-*)`
to read tokens; it does not hardcode colors.

## Dark mode

Dark is a token swap. `[data-theme="dark"]` overrides the `--color-*` variables.
Components do not use `dark:` prefixes for color. This keeps markup clean and
keeps re-theming cheap.

`data-theme` is set on `<html>` by `useUi.setTheme` and by the `Root` component
on mount.

## Hardening phase (before project freeze)

| # | Check | Pass criteria |
|---|---|---|
| 1 | Full build CSS size | Reasonable; no duplicate utilities |
| 2 | Dark theme parity audit | Every surface, border, input, badge readable in dark |
| 3 | Contrast audit | Body text ≥ 4.5:1; muted ≥ 4.5:1; badges ≥ 4.5:1 |
| 4 | Class-collision scan | No `!important`, no specificity hacks |
| 5 | Dynamic-class scan | Static grep — zero template-literal class names |
| 6 | Source-glob sanity | Every `src/**/*.{ts,tsx}` scanned by TW4 |
| 7 | Print / export CSS | Exports unaffected; HTML evidence prints legibly |
| 8 | Single-file build | `vite-plugin-singlefile` output renders identically |
| 9 | Reduced-motion | Animations respect `prefers-reduced-motion` |
| 10 | Reduced-transparency | No `backdrop-blur` for critical contrast |
| 11 | Zoom 200% | No clipped controls, no horizontal scroll on primary flows |
| 12 | Firefox + Safari smoke | No `:has()` or `color-mix()` regressions |

Only after this passes do we freeze the CSS layer. Post-freeze changes are token
changes, not class changes.

## Guardrail script

`scripts/check-tailwind.mjs` runs in CI and enforces items 1, 2, 5 of the rules
above. It also asserts the entry CSS declares the dark variant and an `@theme`
block. If it fails, the message points to this document.
