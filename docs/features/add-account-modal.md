# Feature: Add Account Modal

> Last updated: 2026-04-09

## Context

Creating a new account or connecting a sync provider required two separate entry points: a simple `AccountForm` dialog for manual accounts, and the `/sync` page for all provider connections. This unified both flows into a single modal accessible from the Accounts page "Add account" button.

## How it works

The `AddAccountModal` is a state-machine dialog with two levels:

1. **Selector screen** — 6 buttons in a grid (Banks, Exchanges, Wallets, Trade Republic, Finary, Manual). Each sync button enters its wizard; the Manual button opens the existing `AccountForm` in a separate dialog.
2. **Wizard screens** — Each sync type has its own compact wizard with a back button. On mutation success, a `SuccessState` is shown. While any request is pending, the entire wizard content is replaced by a loading spinner (`Empty` component).

### Key files

- `frontend/src/components/shared/AddAccountModal.tsx` — main component (975 lines, contains all sub-wizards)
- `frontend/src/pages/accounts/AccountsPage.tsx` — wires `AddAccountModal` for create, keeps `AccountForm` for edit
- `frontend/src/pages/sync/SyncPage.tsx` — reads `?tab=` query param for initial tab
- `frontend/src/features/sync/hooks.ts` — all sync mutation hooks reused by the wizards
- `frontend/src/components/ui/input-otp.tsx` — shadcn InputOTP component (installed for TR PIN/TAN)
- `frontend/src/components/ui/empty.tsx` — shadcn Empty component (used for pending spinner)

### Flow

```
AccountsPage → "Add account" button
  └─ AddAccountModal (step = "selector")
       ├─ Banks → BankWizard
       │    └─ search institutions → select → initiate OAuth (new tab) → success
       ├─ Exchanges → ExchangeWizard
       │    └─ pick type → API key + secret → add → success
       ├─ Wallets → WalletWizard
       │    └─ pick chain → address + label → add → success
       ├─ Trade Republic → TradeRepublicWizard
       │    └─ phone + PIN (InputOTP 4-digit) → TAN (InputOTP 6-digit) → success
       ├─ Finary → FinaryWizard (3-step)
       │    └─ upload file / API sync → account mapping → results
       └─ Manual → AccountForm (separate dialog)
```

### Loading state

Each wizard calls `onPending(true/false)` around its mutations. The parent `AddAccountModal` replaces all wizard content with an `Empty` spinner when `isPending` is true.

### SyncPage integration

`SyncPage` now reads `?tab=` from the URL query params to set the initial tab (`useSearchParams`). This was added for forward-compatibility but the modal no longer redirects there — all wizards are inline.

## Technical choices

| Choice | Why | Rejected alternative |
|--------|-----|----------------------|
| Single file with sub-components | All wizards share the same imports, hooks, and patterns; splitting into 6 files would add overhead with minimal readability gain | Separate file per wizard |
| `InputOTP` for TR PIN/TAN | shadcn component, consistent UX for digit-only inputs | Regular password input |
| `Empty` component for loading state | Matches the project's shadcn patterns, accessible | Custom spinner div |
| `AccountForm` reused for manual | Already existed, handles validation and color picking | Inline form in the modal |
| `onPending` callback pattern | Simpler than lifting mutation state up; each wizard controls when loading starts/stops | Global context or mutation observer |

## Gotchas / Pitfalls

- **`input-otp` package must be in root `node_modules`** — Vite resolves from the project root. If installed only in `frontend/`, it fails at runtime with "error loading dynamically imported module".
- **Trade Republic PIN is 4 digits, TAN is 6 digits** — the `maxLength` prop on `InputOTP` controls this.
- **Bank OAuth is fire-and-forget** — `window.open(authLink, '_blank')` opens the OAuth flow in a new tab. The modal shows a success message immediately; actual account creation happens asynchronously via the `/sync/callback` route.
- **Finary wizard is the only multi-step wizard** (3 steps: upload → mapping → results). All others are single-step forms.
- **Edit flow is unchanged** — `AccountsPage` still uses `AccountForm` for editing. The new modal is create-only.
- **`SyncPage` reads `?tab=` but the modal doesn't redirect there** — the query param support exists but is currently unused.

## Tests

No dedicated test files for this feature yet.

## Links

- i18n keys: `addAccount.*`, sync keys reused from `sync.*` namespace in `en.json` / `fr.json`
- Related: [Finary import](./finary-import.md), [Trade Republic](./trade-republic.md), [Crypto tracking](./crypto-tracking.md)
