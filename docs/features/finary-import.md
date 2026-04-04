# Feature: Finary Import

> Last updated: 2026-04-04

## Context

Finary is a French personal finance app. Picsou supports importing data from Finary via two methods: uploading an xlsx export file, or direct API sync using Finary credentials. Both methods use a two-phase flow (preview then execute) to let users review and map accounts before committing. Daily auto-sync is available via the scheduler.

## How it works

### Two import paths

**1. XLSX file import** (`FinaryImportService`)

The user exports their Finary data as an xlsx file and uploads it via the API. The file contains sheets per asset category (Checkings, Savings, Investments, Real Estate, Cryptos, Fonds Euro, Commodities, Credits, Other Assets, Startups) plus a Transactions sheet.

- **Preview**: `preview(MultipartFile)` parses the xlsx with Apache POI, extracts accounts and transactions, generates a UUID `fileToken`, stores parsed data in a `ConcurrentHashMap` cache, and returns account previews with suggested types and existing Picsou accounts for mapping.
- **Execute**: `executeImport(FinaryImportRequest)` retrieves cached data by `fileToken`, applies user mappings (SKIP / MAP_EXISTING / CREATE_NEW), creates accounts, reconstructs balance snapshots from transactions, and imports transactions.

**2. Direct API sync** (`FinaryApiSyncService`)

Authenticates directly with Finary via Clerk (their auth provider) and fetches accounts + transactions through the Finary API.

- **Authentication**: `FinaryApiClient.authenticate()` performs a 6-step Clerk OAuth flow: GET environment, GET client, POST sign_ins, (optionally POST TOTP), POST session touch, POST tokens. Returns a JWT for API calls.
- **Preview**: `preview(totp)` authenticates, fetches accounts from all 10 categories, fetches transactions (paginated, 200 per page), caches everything with a `syncToken`, returns previews.
- **Execute**: `execute(syncToken, mappings)` retrieves cached data, applies user mappings, creates/updates accounts, imports transactions.

### Account mapping

Both paths present the user with a mapping screen where they choose for each Finary account:

- **SKIP** -- Ignore this account entirely.
- **MAP_EXISTING** -- Link the Finary account to an existing Picsou account (balance is updated).
- **CREATE_NEW** -- Create a new Picsou account with user-specified name, type, provider, and color.

Type suggestions are auto-computed from the Finary category via `FinaryPersistenceHelper.suggestTypeFromDisplayCategory()` or `suggestTypeFromApiCategory()`.

### Cache and session management

- `FinaryImportService` uses a `ConcurrentHashMap` with 30-minute expiry (cleaned every 60s by `@Scheduled`).
- `FinaryApiSyncService` uses a `ConcurrentHashMap` with 10-minute expiry (cleaned every 60s by `@Scheduled`).
- Cache tokens are UUIDs. The preview+execute must complete within the TTL or the user must re-upload.

### Daily auto-sync

`SchedulerService.dailyFinaryAutoSync()` runs at midnight. It calls `FinaryApiSyncService.preview(null)` (no TOTP), then auto-maps accounts by case-insensitive name matching against existing Picsou accounts. Unmatched accounts are created with default types. Requires TOTP to be disabled on the Finary account.

### Key files

- `service/FinaryImportService.java` -- XLSX file import (Apache POI parsing, two-phase flow)
- `finary/FinaryApiSyncService.java` -- Direct API sync (Clerk auth, two-phase flow, cache)
- `finary/client/FinaryApiClient.java` -- Finary/Clerk HTTP client (6-step auth, pagination)
- `finary/FinaryPersistenceHelper.java` -- Shared helper: account creation, snapshot reconstruction, transaction import, type suggestion
- `controller/FinaryImportController.java` -- REST endpoints for xlsx upload
- `controller/FinaryApiSyncController.java` -- REST endpoints for API sync
- `finary/dto/` -- 13 DTOs for Finary API responses
- `finary/SyncSessionData.java` -- Cache record for API sync session

### Flow

```
XLSX Import:
User uploads xlsx file
        |
        v
FinaryImportService.preview(file)
        |
        +-- Apache POI: parse account sheets (10 categories)
        +-- Apache POI: parse Transactions sheet
        +-- Cache parsed data (UUID fileToken, 30-min TTL)
        +-- Return: account previews + existing Picsou accounts
        |
        v
User reviews + maps accounts (SKIP / MAP_EXISTING / CREATE_NEW)
        |
        v
FinaryImportService.executeImport(fileToken + mappings)
        |
        +-- Retrieve cached data
        +-- For each mapping:
        |       +-- SKIP: skip
        |       +-- MAP_EXISTING: update balance, set externalAccountId
        |       +-- CREATE_NEW: create account, set externalAccountId
        |       +-- Reconstruct balance snapshots from transactions
        |       +-- Import transactions
        +-- Remove from cache
        +-- Return result (counts + imported accounts)

API Sync:
User triggers sync (optional TOTP)
        |
        v
FinaryApiSyncService.preview(totp)
        |
        +-- FinaryApiClient.authenticate() via Clerk (6 steps)
        +-- Fetch accounts from all 10 categories
        +-- Fetch transactions (paginated, 200/page)
        +-- Cache with syncToken (10-min TTL)
        +-- Return: account previews + existing Picsou accounts
        |
        v
User reviews + maps accounts
        |
        v
FinaryApiSyncService.execute(syncToken + mappings)
        |
        +-- Retrieve cached session
        +-- Apply mappings + import transactions
        +-- Remove from cache
        +-- Return result

Auto-sync (daily at midnight):
        |
        v
SchedulerService.dailyFinaryAutoSync()
        |
        +-- FinaryApiSyncService.preview(null) -- no TOTP
        +-- Auto-map: match by account name (case-insensitive)
        +-- CREATE_NEW for unmatched
        +-- FinaryApiSyncService.execute()
```

## Technical choices

| Choice | Why | Rejected alternative |
|--------|-----|----------------------|
| Two-phase preview+execute | Lets users review accounts and fix mappings before committing data | Direct import (no review, risk of duplicates/wrong types) |
| ConcurrentHashMap cache | Simple, no Redis dependency, single-user app | Redis or DB-backed cache (overkill) |
| Apache POI for xlsx | Standard Java library for Excel; Finary exports in xlsx format | CSV parsing (Finary does not export CSV) |
| Clerk auth flow reimplemented | Finary uses Clerk for auth; no official API; must reverse-engineer the 6-step flow | Finary API key (does not exist) |
| Auto-mapping by name | Simple heuristic that works for most cases after first manual import | ML-based matching (unnecessary complexity) |

## Gotchas / Pitfalls

- **TOTP must be disabled for auto-sync**: `dailyFinaryAutoSync()` passes `null` for TOTP. If 2FA is enabled on the Finary account, auto-sync will fail silently (logged as warning).
- **Preview tokens expire quickly**: XLSX tokens expire after 30 minutes, API sync tokens after 10 minutes. Users must complete the mapping within that window or re-upload.
- **Clerk API version is hardcoded**: The `__clerk_api_version` and `_clerk_js_version` query parameters are hardcoded in `FinaryApiClient`. If Clerk updates, these may need to be updated.
- **Account name matching is case-insensitive but exact**: Auto-mapping matches Finary account name to Picsou account name. If the user renamed an account in Picsou, it won't match.
- **Transactions are per-category**: API sync fetches transactions only from checkings, savings, investments, and credits categories. Other categories (real estate, cryptos) do not have a transactions endpoint.
- **External IDs use Finary category + ID**: Format is `finary_{category}_{finaryId}`. This means the same Finary account always maps to the same external ID, preventing duplicates across imports.

## Tests

- `FinaryImportServiceTest` -- unit tests for xlsx parsing, type suggestion, mapping
- `FinaryApiSyncServiceTest` -- unit tests for API sync flow
- Manual integration testing with real Finary accounts

## Links

- Related ADR: [Ports and adapters](../decisions/2026-01-01-ports-and-adapters.md)
