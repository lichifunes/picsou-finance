# Feature: Bank Sync

> Last updated: 2026-04-04

## Context

Picsou syncs bank accounts from French banks using two providers: Enable Banking (PSD2, open banking) and Powens/Budget Insight (screen scraping). Both are optional and can coexist. Powens takes priority when configured because it accesses account types that PSD2 cannot (LEP, PEA, livrets). The scheduler runs daily auto-sync at 08:00 for all linked requisitions.

## How it works

### Provider architecture

Both providers implement the `BankConnectorPort` interface with four operations: `initiateConnection`, `exchangeCode`, `fetchBalances`, and `searchInstitutions`. The service layer (`SyncService`) never imports adapters directly -- it depends only on the port.

**Enable Banking** (`EnableBankingBankConnector`): Uses the PSD2 Bank Account Data API. Auth is JWT-based (RS256 signed with an RSA private key). Sessions are created via OAuth redirect. After the user authorizes, accounts are linked asynchronously and polled up to 8 times with 3-second delays.

**Powens** (`PowensBankConnector`): Uses screen scraping via the Budget Insight API. Auth is an OAuth webview that handles bank selection and credential entry. The OAuth code is exchanged for a permanent access token. Marked `@Primary` + `@ConditionalOnExpression` so it takes over when `POWENS_CLIENT_ID` is set.

### Requisition lifecycle

1. **CREATED** -- `SyncService.initiateConnection()` calls the port and stores a `Requisition` with `authLink`.
2. **LINKED** -- `SyncService.completeConnection()` exchanges the OAuth callback code, fetches balances, upserts accounts, and marks the requisition as LINKED.
3. **FAILED** -- If the code exchange or balance fetch fails, the requisition is marked FAILED and can be retried via `retrySync()`.

### Account type detection

`SyncService.detectType()` maps provider metadata (product name, cash account type) to the `AccountType` enum. Keywords like "pea", "lep", "livret", "titre" in the product string are matched case-insensitively. The `cashAccountType` field (e.g. "SVGS") is used as a fallback. Default is `CHECKING`.

### Key files

- `adapter/EnableBankingBankConnector.java` -- PSD2 adapter (RSA JWT, async account linking)
- `adapter/PowensBankConnector.java` -- Scraping adapter (`@Primary`, OAuth webview)
- `port/BankConnectorPort.java` -- Port interface with `AccountData`, `InstitutionData` records
- `service/SyncService.java` -- Orchestration: initiate, complete, retry, resync, type detection
- `controller/SyncController.java` -- REST endpoints under `/api/sync/`
- `model/Requisition.java` -- Tracks connection lifecycle (CREATED/LINKED/FAILED)

### Flow

```
User initiates connection
        |
        v
SyncController.initiate() --> SyncService --> BankConnectorPort.initiateConnection()
        |                                         |
        |                          Enable Banking: POST /auth (RSA JWT)
        |                          Powens: build webview URL
        |
        v
User authorizes in browser --> redirect to /api/sync/complete?code=xxx
        |
        v
SyncController.complete() --> SyncService.completeConnection()
        |                         |
        |                         v
        |               BankConnectorPort.exchangeCode() --> session_id
        |                         |
        |                         v
        |               BankConnectorPort.fetchBalances(session_id)
        |                         |
        |                         v
        |               upsertAccount() with detectType()
        |                         |
        |                         v
        |               AccountService.upsertSnapshot()
        |
        v
SchedulerService.dailyBankSync() --> SyncService.resyncAll()
```

## Technical choices

| Choice | Why | Rejected alternative |
|--------|-----|----------------------|
| Dual providers with `@Primary` | PSD2 can't access LEP/PEA/livrets; scraping covers all French account types | Single provider only |
| `@ConditionalOnExpression` for Powens | No-code activation: set env var, adapter appears; unset, it disappears | Feature toggles, profiles |
| Keyword-based type detection | Banks rarely expose a standardized type field; product name is the most reliable signal | Hardcoded institution-to-type mapping |
| Async polling for Enable Banking accounts | EB links accounts asynchronously after OAuth; polling (8x3s) handles the delay | Webhook (EB does not provide one) |
| Permanent access token for Powens | Powens tokens do not expire; stored directly as the requisition ID | Refresh token rotation (not needed) |

## Gotchas / Pitfalls

- **Powens is `@Primary`**: When `POWENS_CLIENT_ID` is set, Spring injects `PowensBankConnector` as the `BankConnectorPort`. Enable Banking is still registered but never injected. To switch back, unset the env var.
- **Enable Banking RSA key**: The private key must be PKCS8 PEM format. The `ENABLEBANKING_PRIVATE_KEY` env var can contain literal `\n` characters -- both formats are handled in `parsePrivateKey()`.
- **ALREADY_AUTHORIZED**: If the OAuth code is reused (e.g. browser back button), `SyncService.completeConnection()` catches the error and falls back to refreshing the latest linked session instead of failing.
- **Type upgrade on resync**: If the user has not customized an account's type, `upsertAccount()` will upgrade it from CHECKING to the detected type on the next sync. Manual user changes are preserved (only CHECKING is auto-upgraded).
- **Both providers are optional**: The app starts fine without either. No `BankConnectorPort` bean is required at startup.

## Tests

- `SyncServiceTest` -- unit tests for type detection, upsert logic, retry flow
- Manual integration testing against real provider APIs

## Links

- Related ADR: [Dual bank providers](../decisions/2026-03-01-dual-bank-providers.md)
- Related ADR: [Ports and adapters](../decisions/2026-01-01-ports-and-adapters.md)
