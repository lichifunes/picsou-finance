# Convention: REST API

## Endpoints

All REST controllers live in `com.picsou.controller` and are mapped under `/api/`.

- **Base URL:** `/api` (nginx proxies `/api/` to the backend)
- **No URL versioning** — all endpoints sit directly under `/api/` without a version segment
- **Naming:** plural resource nouns, e.g. `/api/accounts`, `/api/goals`, `/api/sync`
- **Standard HTTP verbs:** GET (read), POST (create or action), PUT (replace), DELETE (remove)
- **No PATCH** — not currently used in the codebase

### Auth

JWT authentication via **HttpOnly SameSite=Strict cookies** — no Authorization header.

| Cookie | TTL | Purpose |
|--------|-----|---------|
| `access_token` | 15 minutes | Authenticates requests |
| `refresh_token` | 7 days | Rotated on every use via `POST /api/auth/refresh` |

- `JwtAuthenticationFilter` reads the `access_token` cookie and populates the `SecurityContext`.
- CSRF is disabled — `SameSite=Strict` provides equivalent protection for same-origin cookie-based auth.
- The `Secure` flag is controlled by `app.secure-cookies` (default `true`; set to `false` for local HTTP dev).

### Rate limiting

Bucket4j (`io.github.bucket4j`) enforces per-IP rate limits. Buckets are created in `RateLimitConfig` and consumed in controller methods.

| Endpoint group | Limit |
|---------------|-------|
| `POST /api/auth/login` | 5 requests / IP / 15 min |
| `POST /api/sync/initiate` | Throttled |
| `POST /api/tr/auth/initiate` | Throttled |

When a limit is exceeded, the controller returns a 429 ProblemDetail directly (not via the exception handler).

### Success responses

| Status | Usage |
|--------|-------|
| `200 OK` | GET, PUT, POST (non-creation) |
| `201 Created` | POST that creates a resource (annotated `@ResponseStatus(HttpStatus.CREATED)`) |
| `204 No Content` | DELETE, logout |

## Error format

All errors use [RFC 7807 ProblemDetail](https://datatracker.ietf.org/doc/html/rfc7807).

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Invalid credentials"
}
```

Validation errors (422) include an `errors` map with field-level messages:

```json
{
  "type": "about:blank",
  "title": "Validation failed",
  "status": 422,
  "detail": null,
  "errors": {
    "name": "must not be blank",
    "targetAmount": "must be greater than 0.01"
  }
}
```

Stack traces are never exposed (`server.error.include-stacktrace: never`).

## Validation

- Jakarta Validation annotations on DTO records (`@NotBlank`, `@NotNull`, `@Size`, `@DecimalMin`, `@Future`, etc.)
- `@Valid` on controller method parameters triggers automatic validation
- Validation failures produce 422 via `GlobalExceptionHandler.handleMethodArgumentNotValid()`
- No manual validation in services unless it is business logic (e.g., `IllegalArgumentException`)

## Pagination

Not currently used. The app is single-user with limited data volumes. All list endpoints return full arrays.

## JSON configuration

```yaml
spring.jackson:
  write-dates-as-timestamps: false          # ISO-8601 dates
  default-property-inclusion: non_null      # omit null fields
  deserialization.fail-on-unknown-properties: false
```

## Reference

The complete endpoint reference is in [`backend/docs/API.md`](../../backend/docs/API.md). When adding or changing an endpoint, update that file.
