# Architecture

> Project overview. This file describes the macro structure.
> Update when a new module is added or a flow changes.

## Overview

Picsou is a self-hosted, single-user personal finance dashboard. It aggregates accounts from banks (PSD2/scraping), brokers (Trade Republic), crypto exchanges (Binance), and on-chain wallets (BTC/ETH/SOL). It tracks balances over time, computes net worth, and helps users set and track savings goals.

## Backend modules

```
com.picsou/
├── model/          JPA entities: Account, Goal, Transaction, BalanceSnapshot,
│                   AccountHolding, Requisition, TradeRepublicSession,
│                   CryptoExchangeSession, WalletAddress, GoalMonthOverride, AppUser
├── repository/     Spring Data JPA interfaces (11 repos)
├── service/        Business logic (AccountService, GoalService, DashboardService,
│                   SyncService, TradeRepublicSyncService, CryptoExchangeSyncService,
│                   WalletSyncService, PriceService, SchedulerService,
│                   FinaryImportService, FinaryApiSyncService)
├── controller/     REST controllers under /api/ (11 controllers)
├── dto/            Request/response records (18 DTOs)
├── port/           5 port interfaces (BankConnectorPort, PriceProviderPort,
│                   TradeRepublicPort, CryptoExchangePort, WalletPort)
├── adapter/        Port implementations + util/BitcoinKeyUtils
│   ├── EnableBankingBankConnector, PowensBankConnector (bank sync)
│   ├── CoinGeckoPriceProvider, YahooFinancePriceProvider (prices)
│   ├── TradeRepublicAdapter (broker)
│   ├── BinanceAdapter (crypto exchange)
│   ├── BitcoinWalletAdapter, EthereumWalletAdapter, SolanaWalletAdapter (on-chain)
│   └── util/BitcoinKeyUtils (BIP32 key derivation, Base58Check, Bech32)
├── finary/         Finary import subsystem
│   ├── client/FinaryApiClient.java
│   ├── dto/ (13 DTOs for Finary API)
│   └── SyncSessionData
├── config/         SecurityConfig, JwtUtil, JwtAuthenticationFilter, DataSeeder,
│                   RateLimitConfig, AppProperties, FinaryProperties, CryptoEncryption
└── exception/      GlobalExceptionHandler, ResourceNotFoundException, SyncException
```

## Frontend modules

```
frontend/src/
├── app/             Entry: App.tsx, providers, routes (lazy-loaded chunks)
├── pages/           Route pages: accounts/, dashboard/, goals/, login/, settings/, sync/
├── components/
│   ├── layout/      AppSidebar, AppLayout
│   ├── ui/          shadcn/ui generated (do not edit)
│   └── shared/      App-specific reusable components
├── features/        Feature slices: api.ts + hooks.ts per feature
├── stores/          Zustand stores (auth-store, app-store)
├── lib/             api-client, utils, constants, query-client
├── types/           api.ts (DTOs), app.ts (frontend types)
├── demo/            Demo mode interceptor + mock data
├── i18n/            i18next setup + FR/EN translations
└── main.tsx         Bootstrap + demo mode setup
```

## Main data flows

### 1. Bank sync

```
Client → SyncController → SyncService → BankConnectorPort → Enable Banking / Powens
```

Dual-provider: Powens (scraping, `@Primary`) and Enable Banking (PSD2). Powens takes over when `POWENS_CLIENT_ID` is set. `SyncService.detectType()` maps provider types to `AccountType` enum.

### 2. Price refresh

```
SchedulerService (cron) → PriceService → PriceProviderPort → CoinGecko / Yahoo Finance → 15-min cache
```

`SchedulerService` triggers daily refresh. `PriceService` holds a 15-minute in-memory cache. CoinGecko for crypto, Yahoo Finance for stocks/ETFs.

### 3. Trade Republic

```
Client → TradeRepublicController → TRSyncService → TRAdapter → tr-auth (Python) → TR WebSocket
```

Broker sync via Python microservice (Playwright automation). Two modes: automatic WebSocket sync and CSV import fallback. Session persisted in `TradeRepublicSession` entity.

### 4. Crypto exchange

```
Client → CryptoExchangeController → CryptoSyncService → BinanceAdapter → Binance API
```

Binance API credentials encrypted at rest with AES-256-GCM (`CryptoEncryption`). `CRYPTO_ENCRYPTION_KEY` env var required.

### 5. Wallet sync

```
Client → WalletController → WalletSyncService → WalletPort → blockchain RPCs
```

Three adapters: Bitcoin (mempool.space/Esplora, BIP32 xpub/zpub/descriptors), Ethereum (Cloudflare RPC), Solana (RPC).

### 6. Dashboard

```
Client → DashboardController → DashboardService → Account + Snapshot + PriceService aggregation
```

Aggregates all account balances, applies current prices via `PriceService`, computes net worth and allocation breakdown.

### 7. Goals

```
Client → GoalController → GoalService → Goal + GoalMonthOverride repos
```

Savings goals with deadlines, linked to accounts via M:N join table (`goal_account`). Monthly tracking with optional per-month overrides.

## External dependencies

| Service | Usage | Config |
|---------|-------|--------|
| PostgreSQL 16 | Persistence | `SPRING_DATASOURCE_URL` |
| Flyway | Schema migrations | `db/migration/` (13 files) |
| Enable Banking | PSD2 bank sync (optional) | `ENABLEBANKING_*` |
| Powens / Budget Insight | Scraping bank sync (optional, priority) | `POWENS_*` |
| Trade Republic | Broker sync via Python microservice | `TR_AUTH_URL` |
| Binance | Crypto exchange balances | Via CryptoExchangePort |
| CoinGecko | Crypto prices (free) | No config |
| Yahoo Finance | Stock/ETF prices (free) | No config |
| Cloudflare ETH RPC | Ethereum wallet balances | No config |
| Solana RPC | Solana wallet balances | No config |
| mempool.space (Blockstream) | Bitcoin wallet balances | No config |
| Finary | Import xlsx or API sync (optional) | `FINARY_*` |

## Key constraints

- **Ports & adapters:** controllers/services never import adapters directly. All external integrations go through 5 port interfaces.
- **Flyway owns schema:** never use `ddl-auto: create/update`. Every schema change is a new migration file.
- **Single-user:** one `AppUser`, bcrypt auth, no multi-tenancy. JWT in HttpOnly SameSite=Strict cookies.
- **AES-256-GCM encryption:** crypto exchange API secrets encrypted at rest. `CRYPTO_ENCRYPTION_KEY` must be backed up -- lost key means re-authenticating all exchanges.
- **Scheduled tasks:** `SchedulerService` handles daily balance snapshots and price cache refresh.
- **Demo mode:** frontend-only, mock interceptor short-circuits API calls, no backend needed.
- **Secrets from environment variables:** never hardcoded. Required at startup: `JWT_SECRET`, `APP_USERNAME`, `APP_PASSWORD_HASH`.
