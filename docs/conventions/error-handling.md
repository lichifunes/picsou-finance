# Convention: Error Handling

## Exception hierarchy

```
RuntimeException
  +-- ResourceNotFoundException      404 NOT_FOUND
  +-- SyncException                  502 BAD_GATEWAY
  +-- BadCredentialsException        401 UNAUTHORIZED   (Spring Security)
  +-- IllegalArgumentException       400 BAD_REQUEST
  +-- MethodArgumentNotValidException 422 UNPROCESSABLE_ENTITY (via @Valid)

Exception (catch-all)               500 INTERNAL_SERVER_ERROR
```

There is **no** `AppException` base class. Each exception type is standalone.

## Rules

- **Services throw business exceptions** — controllers never catch or handle them.
- **Controllers never wrap responses in try/catch** — `GlobalExceptionHandler` handles everything.
- **External errors** (bank APIs, crypto exchanges, price providers) are wrapped in `SyncException` with the original cause.
- **Stack traces are never exposed** to clients (`server.error.include-stacktrace: never`, `include-message: never`).
- **Generic 500 errors** always return `"An unexpected error occurred"` — the real exception is logged server-side via `log.error()`.

## GlobalExceptionHandler

**File:** `com.picsou.exception.GlobalExceptionHandler`

A `@RestControllerAdvice` that extends `ResponseEntityExceptionHandler`. Returns `ProblemDetail` (RFC 7807) for every case.

| Handler method | Exception | Status | Detail |
|---------------|-----------|--------|--------|
| `handleNotFound` | `ResourceNotFoundException` | 404 | `ex.getMessage()` |
| `handleSync` | `SyncException` | 502 | `ex.getMessage()` (logged at WARN) |
| `handleBadCredentials` | `BadCredentialsException` | 401 | `"Invalid credentials"` |
| `handleIllegalArgument` | `IllegalArgumentException` | 400 | `ex.getMessage()` |
| `handleMethodArgumentNotValid` | `MethodArgumentNotValidException` | 422 | Field map under `"errors"` key |
| `handleGeneric` | `Exception` (fallback) | 500 | `"An unexpected error occurred"` |

### Validation error shape (422)

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

The `errors` map is built from `FieldError.getField()` and `FieldError.getDefaultMessage()`. When two errors hit the same field, the first wins.

## Custom exceptions

### ResourceNotFoundException

```java
// Static factories for consistent messages
ResourceNotFoundException.account(Long id);      // "Account not found: {id}"
ResourceNotFoundException.goal(Long id);          // "Goal not found: {id}"
ResourceNotFoundException.requisition(String id); // "Requisition not found: {id}"
```

### SyncException

```java
// Wraps upstream provider failures
new SyncException("Enable Banking API error: ...");
new SyncException("Binance API timeout", cause);  // with original cause
```

Logged at WARN level so upstream flakiness is trackable without alert fatigue.

## Adding a new exception type

1. Extend `RuntimeException` directly (no base class).
2. Add a handler method in `GlobalExceptionHandler` returning `ProblemDetail`.
3. Throw it from a service — never from a controller.
