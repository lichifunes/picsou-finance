# Project: Picsou

Self-hosted personal finance dashboard -- bank sync, crypto, goals, net worth tracking.

## Stack

- Backend: Java 21 / Spring Boot 3.4.9 / Maven
- Frontend: React 19 / TypeScript 5.9 / Vite 7 / Tailwind v4
- DB: PostgreSQL 16 / Flyway
- Build: Maven (backend), bun (frontend)
- Deployment: Docker Compose

## Essential commands

```bash
# Backend
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev   # Run locally (needs PostgreSQL on :5432)
./mvnw test                                              # Run all tests
./mvnw test -Dtest=GoalServiceTest                       # Run a single test class
./mvnw package -DskipTests                               # Build JAR

# Frontend
cd frontend
bun run dev          # Dev server on :5173 -- proxies /api/* to http://localhost:8080
bun run build        # tsc + vite build (fails on type errors)
bun run preview      # Serve the production build locally
bun run typecheck    # TypeScript type checking only
npx vitest run       # Run all unit tests
```

## Code conventions

- Naming: camelCase for methods/variables, PascalCase for classes
- Packages: `com.picsou.{model,repository,service,controller,dto,port,adapter,finary,config,exception}`
- DTOs are Java records, no MapStruct
- No business logic in controllers
- Tests: Mockito unit tests, `@DataJpaTest` with H2 for integration

## Project architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full architecture overview, data flows, and external dependencies.

For module-specific details, see:
- [`backend/CLAUDE.md`](backend/CLAUDE.md) -- package structure, ports & adapters, auth, configuration
- [`frontend/CLAUDE.md`](frontend/CLAUDE.md) -- component hierarchy, API layer, demo mode, i18n

## Technical documentation

Before coding, check the relevant docs in `docs/`.

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) -- project macro view
- [`docs/decisions/`](docs/decisions/) -- technical decisions (ADR). Check them BEFORE proposing an alternative that was already evaluated.
- [`docs/features/`](docs/features/) -- technical notes per feature. Read the relevant note before touching an existing feature.
- [`docs/conventions/`](docs/conventions/) -- project-specific patterns and conventions
- [`docs/INDEX.md`](docs/INDEX.md) -- full documentation index

## Development workflow

1. **Before coding**: read [`docs/INDEX.md`](docs/INDEX.md), identify relevant docs, read them
2. **During**: follow conventions from [`docs/conventions/`](docs/conventions/)
3. **After each significant feature/fix**: create or update the technical note in [`docs/features/`](docs/features/) following the [`docs/templates/FEATURE.md`](docs/templates/FEATURE.md) template
4. **Architectural decision**: before deciding, check [`docs/decisions/`](docs/decisions/) for existing decisions. If new, create an ADR using the [`docs/templates/DECISION.md`](docs/templates/DECISION.md) template

## Git

- Branches: `feature/xxx`, `fix/xxx`, `refactor/xxx`
- Conventional commits: `feat(scope):`, `fix(scope):`, `refactor(scope):`, `docs:`, `test:`
- Always commit `docs/` updates alongside the related code
