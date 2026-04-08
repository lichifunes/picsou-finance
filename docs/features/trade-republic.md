# Feature: Trade Republic Sync

> Last updated: 2026-04-08

## Context

Trade Republic is a German neobroker popular in France. Picsou syncs portfolio balances and holdings via TR's unofficial WebSocket API. Authentication requires a Python sidecar (`tr-auth`) because TR uses AWS WAF browser challenges that cannot be solved from plain Java HTTP. A CSV import fallback exists for when the automated sync is unavailable.

## How it works

### Authentication (delegated to Python sidecar)

The `TradeRepublicAdapter` delegates auth to the `tr-auth` Python microservice (FastAPI + Playwright, running on port 8001). The Java adapter calls three HTTP endpoints on the sidecar:

1. **`POST /initiate`** -- Sends phone number + PIN. TR dispatches a 2FA code via SMS/app notification. Returns a `processId`.
2. **`POST /complete`** -- Sends processId + TAN (6-digit code). Returns `sessionToken` + `refreshToken`.
3. **`POST /refresh`** -- Sends refreshToken. Returns new sessionToken (+ possibly rotated refreshToken).

Credentials (phone/PIN) are never stored -- they are used only for the `/initiate` call and discarded.

### Session persistence

`TradeRepublicSyncService.completeAuth()` stores tokens in a `TradeRepublicSession` entity. Both `sessionToken` and `refreshToken` are **encrypted at rest** with AES-256-GCM via `CryptoEncryption` before storage, and decrypted on read. The refresh token has ~2-hour validity. On sync, if the session token is expired (`SESSION_EXPIRED` error), the service attempts to refresh using the stored refresh token. If refresh also fails, the session is cleared and the user must re-authenticate. See [encryption-at-rest.md](./encryption-at-rest.md) for encryption details.

### Data fetching (WebSocket, no sidecar)

The `TradeRepublicAdapter.fetchAccounts()` connects directly to `wss://api.traderepublic.com/` (protocol version 31) using `ReactorNettyWebSocketClient`. No WAF challenge is needed for the WebSocket endpoint. The adapter:

1. Sends a `connect` message with locale, platform info, and client version.
2. Subscribes to `availableCash` (cash balance) and `compactPortfolio` (list of positions with ISIN, netSize, averageBuyIn).
3. For each position, subscribes to `ticker` to get the live market price.
4. Computes portfolio value as `sum(ticker.last.price * position.netSize)`.
5. Extracts secAccNo (securities account numbers) from the JWT to handle multiple sub-portfolios.
6. Builds `TrPosition` records from `positionsByIsin` map: each position includes ISIN, quantity (netSize), averageBuyIn, and currentPrice (from ticker, or averageBuyIn as fallback if ticker price is missing).

Returns a list of `TrAccountData` records: one for securities (type COMPTE_TITRES with `List<TrPosition>`) and one for cash (type CHECKING with empty position list).

### Holding deduplication

When persisting holdings, multiple ISINs can convert to the same Yahoo Finance ticker symbol (e.g., different listings of the same security). Before inserting into the database, `upsertAccount()` deduplicates holdings by ticker, combining quantities when necessary. This prevents `DataIntegrityViolationException` on the `(account_id, ticker)` unique constraint. See [trade-republic-holding-deduplication.md](./trade-republic-holding-deduplication.md) for implementation details.

### CSV import fallback

`TradeRepublicSyncService.importCsv()` parses a CSV file with columns `name,type,balance`. Accounts are deduplicated via a stable external ID derived from the name (`tr_csv_` prefix + slugified name).

### Scheduled sync

`SchedulerService.dailyBankSync()` calls `TradeRepublicSyncService.resyncIfSessionActive()`, which is a no-op if no session exists or if the session has expired.

### Key files

- `adapter/TradeRepublicAdapter.java` -- WebSocket data fetching + sidecar auth delegation
- `port/TradeRepublicPort.java` -- Port interface with `TrTokens`, `TrAccountData`, `TrPosition` records
- `service/TradeRepublicSyncService.java` -- Auth flow, sync orchestration, CSV import, session management
- `controller/TradeRepublicController.java` -- REST endpoints under `/api/tr/`
- `model/TradeRepublicSession.java` -- Session entity with token storage

### Flow

```
User triggers auth
        |
        v
TRController.initiateAuth() --> TRSyncService --> TRAdapter.initiateAuth()
        |                                           |
        |                               sidecar POST /initiate (phone+PIN)
        |                                           |
        |                               <-- processId (SMS dispatched)
        v
User enters TAN
        |
        v
TRController.completeAuth() --> TRSyncService.completeAuth()
        |                             |
        |                   TRAdapter.completeAuth()
        |                             |
        |                   sidecar POST /complete (processId+tan)
        |                             |
        |                   <-- sessionToken + refreshToken
        |                             |
        |                   Save TradeRepublicSession
        |                             |
        |                   TRAdapter.fetchAccounts(sessionToken)
        |                             |
        |                   WebSocket: connect -> sub availableCash
        |                             -> sub compactPortfolio
        |                             -> sub ticker (per ISIN)
        |                             |
        |                   Build TrAccountData list
        |                             |
        |                   Upsert accounts + holdings
        v
SchedulerService.dailyBankSync()
        |
        v
TRSyncService.resyncIfSessionActive()
        |
        v (if session active)
TRAdapter.fetchAccounts() --> upsert accounts
        |
        v (if SESSION_EXPIRED)
TRAdapter.refreshSession() --> retry with new token
```

## Technical choices

| Choice | Why | Rejected alternative |
|--------|-----|----------------------|
| Python sidecar for auth | TR uses AWS WAF browser challenge; only a real browser (Playwright) can solve it | Headless Java HTTP (blocked by WAF) |
| WebSocket for data | No WAF on the WS endpoint; direct Java access works; real-time price data | REST API scraping (would also hit WAF) |
| Single session entity (`deleteAll` before save) | Single-user app; only one TR session is meaningful at a time | Multiple sessions (not needed) |
| CSV import fallback | When tr-auth is down or session expired, user can manually export and import | No fallback (bad UX) |
| Protocol version 31 hardcoded | TR protocol is undocumented and reverse-engineered; pinning avoids silent breakage | Dynamic version negotiation (not possible) |
| Input validation with `@NotBlank` on DTOs | Prevents null phone/PIN from reaching Map.of() constructor, which rejects nulls and throws NullPointerException | Try-catch in adapter (less clear, reactive) |
| User-friendly error messages on frontend | HTTP errors from sidecar are technical and nested JSON; frontend parses HTTP status + error codes to show user-friendly messages in both FR and EN | Display raw API error (confusing to users) |
| TrPosition record in port interface | Encapsulates position data (ISIN, quantity, prices) in a named record; returned within TrAccountData | Flatten positions into TrAccountData directly (less structured, harder to evolve) |

## Gotchas / Pitfalls

- **tr-auth must be running**: The Python sidecar must be accessible at `app.tr-auth.url` (default `http://tr-auth:8001`). If it is down, auth calls will timeout after 60 seconds.
- **Input validation is strict**: `InitiateAuthRequest` and `CompleteAuthRequest` DTOs enforce `@NotBlank` on all fields. Empty or null values result in a 422 response before reaching the service layer. Ensure frontend sends valid non-blank values.
- **Frontend API field mapping**: Frontend sends `phoneNumber` and `pin` (not `phone` and `pin`). The API uses ISO field names; if frontend is updated, verify the DTO record field names match.
- **Error message parsing on frontend**: Error handling extracts specific error codes from deeply nested JSON responses (e.g., `NUMBER_INVALID`, `PIN_INVALID`). If the sidecar changes the error response format, frontend error messages must be updated to match. See `TradeRepublicTab.tsx` `formatAuthError()`.
- **Session expires ~2h**: The refresh token validity is approximately 2 hours. If auto-sync fails after 2h of inactivity, the user must re-authenticate manually.
- **WebSocket protocol is reverse-engineered**: The TR WebSocket API is undocumented. Raw responses are logged at INFO level. If TR changes the protocol, the adapter will break and need updating.
- **timeout-driven completion**: The WebSocket session completes when either all data is received (cash + all portfolios + all tickers) or a 30-second timeout is hit.
- **Multiple sub-portfolios**: The adapter extracts `secAccNo` from the JWT to subscribe to per-account compactPortfolio. If extraction fails, it falls back to a default subscription.
- **Holding deduplication by ticker**: Multiple ISINs can map to the same ticker. When syncing, holdings are deduplicated in-memory before insertion to avoid unique constraint violations. Quantities are combined, but `averageBuyIn` is kept from the first position—a simplification, but acceptable since duplicates typically represent the same security at different stages.
- **TrPosition currentPrice fallback**: When a ticker price is missing (ticker subscription timed out or failed), TrPosition.currentPrice is set to averageBuyIn. This allows the sync to complete without blocking on missing real-time data. Portfolio value calculation already uses this fallback logic.

## Tests

- `TradeRepublicSyncServiceTest` -- unit tests for auth flow, session refresh, CSV import
- Manual integration testing against real TR accounts

## Links

- Related ADR: [Ports and adapters](../decisions/2026-01-01-ports-and-adapters.md)
- Related feature: [Encryption at rest](./encryption-at-rest.md)
