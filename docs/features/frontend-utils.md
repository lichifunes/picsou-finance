# Feature: Frontend utility library (`lib/utils.ts`)

> Last updated: 2026-04-08

## Context

Shared formatting and helper functions used across the whole frontend. Centralised in one file to ensure consistent number/date formatting (locale, currency) and avoid ad-hoc `Intl` calls scattered across components.

## How it works

### Key files

- `frontend/src/lib/utils.ts` — all helpers
- `frontend/src/lib/utils.test.ts` — Vitest unit tests

### API surface

| Function | Signature | Output example |
|----------|-----------|---------------|
| `cn` | `(...inputs: ClassValue[]) => string` | Merges Tailwind classes via clsx + tailwind-merge |
| `formatCurrency` | `(value, currency='EUR', locale='fr-FR')` | `"1 234,50 €"` |
| `formatDate` | `(dateStr, locale='fr-FR')` | `"08/04/2026"` (dd/mm/yyyy) |
| `formatLocalDate` | `(dateStr, locale='fr-FR')` | `"8 avril 2026"` (long month) |
| `formatPercent` | `(value, locale='fr-FR')` | `"50,0 %"` — value is a ratio (0.5 → 50%) |
| `formatTimeAgo` | `(dateStr, locale='fr-FR')` | `"il y a 3 heures"` via `Intl.RelativeTimeFormat` |
| `todayLabel` | `(locale='fr-FR')` | `"mardi 8 avril 2026"` (weekday + full date) |
| `accountTypeLabel` | `(type: string)` | `"Compte courant"`, `"PEA"`, etc. |
| `safeRedirect` | `(redirect, fallback='/')` | Returns the path only if it starts with `/`, else fallback |

## Technical choices

| Choice | Why | Rejected alternative |
|--------|-----|----------------------|
| `Intl.NumberFormat` / `Intl.DateTimeFormat` for all formatting | Native, locale-aware, no extra dependency | date-fns / numeral.js |
| `Intl.RelativeTimeFormat` for `formatTimeAgo` | Locale-correct relative strings (fr/en) | Manual string building per locale |
| `formatPercent` takes a ratio (0–1) | Matches `Intl.NumberFormat` `style: 'percent'` convention | Percent value (0–100) — inconsistent with Intl |

## Gotchas / Pitfalls

- **`formatDate` vs `formatLocalDate`**: `formatDate` outputs `dd/mm/yyyy` (compact, for tables); `formatLocalDate` outputs long-month form (for readable labels). Don't swap them.
- **`formatPercent` expects a ratio** (0.5 = 50%), not a percentage value. Passing `50` instead of `0.5` will output `"5 000 %"`.
- **`formatDate` uses `new Date(dateStr)`** — ISO datetime strings work fine; bare date strings like `"2026-04-08"` may shift by timezone offset. Use `formatLocalDate` for LocalDate (date-only) values from the backend to avoid off-by-one-day issues.
- **`safeRedirect` is a security guard** — always use it before redirecting to a URL from query params to prevent open redirect attacks.
- **`accountTypeLabel` returns the raw type if unknown** — if new `AccountType` values are added to the backend, add them here to avoid displaying enum keys in the UI.

## Tests

- `frontend/src/lib/utils.test.ts` — covers `cn`, `formatCurrency`, `formatDate`, `formatPercent`
