# Feature: Frontend utility library (`lib/utils.ts`)

> Last updated: 2026-05-29 (comma/point decimal parsing + `NumericInput`)

## Context

Shared formatting functions used across the frontend. Centralised in one file to ensure consistent number/date formatting and avoid ad-hoc `Intl` calls scattered across components. The locale now defaults to the browser's language (`document.documentElement.lang`) instead of hardcoded `fr-FR`.

## How it works

### Key files

- `frontend/src/lib/utils.ts` — all helpers
- `frontend/src/lib/utils.test.ts` — Vitest unit tests

### API surface

| Function | Signature | Output example |
|----------|-----------|---------------|
| `cn` | `(...inputs: ClassValue[]) => string` | Merges Tailwind classes via clsx + tailwind-merge |
| `getLocale` | `() => string` | `'fr-FR'` or `'en-US'` based on `document.documentElement.lang` |
| `formatCurrency` | `(value, currency='EUR', locale=getLocale())` | `"1 234,50 €"` |
| `formatDate` | `(dateStr, locale=getLocale(), format?)` | `"08/04/2026"` (locale) or `"08-04-2026"` (iso) |
| `formatDateTime` | `(dateStr, locale=getLocale(), format?)` | `"08/04/2026 14:30"` (locale) or `"08-04-2026 14:30"` (iso) |
| `normalizeDecimal` | `(value: string \| null \| undefined) => string` | `"12,50"` → `"12.50"` (replaces first `,` with `.`) |
| `parseAmount` | `(value: string \| null \| undefined) => number` | `"12,50"` → `12.5`; tolerant `parseFloat` over `normalizeDecimal` |
| `formatLocalDate` | `(dateStr, locale=getLocale())` | `"8 avril 2026"` (long month) |
| `formatPercent` | `(value, locale=getLocale())` | `"50,0 %"` — value is a ratio (0.5 → 50%) |
| `formatTimeAgo` | `(dateStr, locale=getLocale())` | `"il y a 3 heures"` via `Intl.RelativeTimeFormat` |
| `todayLabel` | `(locale=getLocale())` | `"mardi 8 avril 2026"` (weekday + full date) |
| `accountTypeLabel` | `(type: string)` | `"Compte courant"`, `"PEA"`, etc. |
| `safeRedirect` | `(redirect, fallback='/')` | Returns the path only if it starts with `/`, else fallback |

## Technical choices

| Choice | Why | Rejected alternative |
|--------|-----|----------------------|
| `Intl.NumberFormat` / `Intl.DateTimeFormat` for all formatting | Native, locale-aware, no extra dependency | date-fns / numeral.js |
| `Intl.RelativeTimeFormat` for `formatTimeAgo` | Locale-correct relative strings (fr/en) | Manual string building per locale |
| `formatDate` reads `dateFormat` from Zustand store | User can toggle between locale-aware and fixed `DD-MM-YYYY` in settings | Hardcoded format — no user preference |
| `formatPercent` takes a ratio (0–1) | Matches `Intl.NumberFormat` `style: 'percent'` convention | Percent value (0–100) — inconsistent with Intl |
| `parseAmount` instead of bare `parseFloat` everywhere | French users type `12,50`; native `type="number"` inputs reject commas in FR locales and `parseFloat("12,50")` → `12`. One chokepoint fixes all amount entry | Per-field `.replace(',', '.')` (easy to forget on new fields) |

### Decimal input — `NumericInput`

`frontend/src/components/shared/NumericInput.tsx` is the shared amount-entry component. It wraps the shadcn `Input` as `type="text" inputMode="decimal"` (mobile numeric keypad, never rejects a comma) and sanitizes keystrokes to digits + a single `.`/`,` separator + an optional leading `-`. It rewrites `e.target.value` **before** calling the passed `onChange`, so it works with:

- **controlled-string forms** — `value`/`onChange` reading `e.target.value`, then `parseAmount(...)` at submit;
- **react-hook-form** — `register(name, { setValueAs: v => parseAmount(v) })` (RHF also reads the sanitized `e.target.value`). Relies on React 19 treating `ref` as a regular prop, so no `forwardRef` is needed.

All numeric inputs across Picsou (account balances & loan fields, goal target, month override/manual contribution, transaction qty/price/amount, holding qty/buy-in, month-end balances) use `NumericInput` + `parseAmount`.

## Gotchas / Pitfalls

- **`getLocale()` reads `document.documentElement.lang`** — this is set by the `<html lang>` attribute. It's updated by `i18next-browser-languagedetector` on init, not on every language change. In practice, this is fine because locale changes require a page reload.
- **`formatDate` vs `formatLocalDate`**: `formatDate` outputs `dd/mm/yyyy` (compact, for tables) or `DD-MM-YYYY` if the user selected the ISO format in settings; `formatLocalDate` outputs long-month form (for readable labels). Don't swap them.
- **`formatDate` format resolution**: reads `useAppStore.getState().dateFormat` at call time (`'locale'` or `'iso'`). The optional `format` parameter overrides the store value — used by callers that need a specific format regardless of user preference.
- **Store import in `utils.ts`**: `formatDate` imports `useAppStore` directly — safe because `app-store.ts` has no dependency on `utils.ts` (no circular dependency).
- **`formatPercent` expects a ratio** (0.5 = 50%), not a percentage value. Passing `50` instead of `0.5` will output `"5 000 %"`.
- **`formatDate` uses `new Date(dateStr)`** — ISO datetime strings work fine; bare date strings like `"2026-04-08"` may shift by timezone offset. Use `formatLocalDate` for LocalDate (date-only) values from the backend to avoid off-by-one-day issues.
- **`safeRedirect` is a security guard** — always use it before redirecting to a URL from query params to prevent open redirect attacks.
- **`accountTypeLabel` returns the raw type if unknown** — if new `AccountType` values are added to the backend, add them here to avoid displaying enum keys in the UI.

## Tests

- `frontend/src/lib/utils.test.ts` — covers `cn`, `formatCurrency`, `formatDate`, `formatPercent`
