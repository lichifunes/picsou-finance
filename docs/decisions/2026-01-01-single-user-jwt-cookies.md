# ADR: Single-User JWT with HttpOnly Cookies

> Date: 2026-01-01
> Status: ✅ Active

## Context

Picsou is a self-hosted personal finance dashboard designed for a single user (or household). It needs authentication to protect financial data, but multi-user support is not a requirement. The frontend is a React SPA that communicates with the backend via REST APIs.

## Decision

Use a single hardcoded user with JWT tokens stored in HttpOnly, SameSite=Strict cookies. One user is seeded by `DataSeeder` at startup with credentials from environment variables (`APP_USERNAME`, `APP_PASSWORD_HASH`). Authentication flow:

1. `POST /api/auth/login` validates credentials (bcrypt, cost 12) and issues `access_token` (15 min) + `refresh_token` (7 days) as HttpOnly cookies.
2. `JwtAuthenticationFilter` reads the `access_token` cookie on every request and sets the Spring Security context.
3. `POST /api/auth/refresh` rotates the refresh token and issues a new access token.
4. CSRF protection is disabled because SameSite=Strict cookies provide equivalent protection against CSRF.

## Alternatives considered

### Server-side sessions

- **Pros**: Simpler token revocation, standard Spring Security support
- **Cons**: Requires session store (DB or Redis); sticky sessions for multi-instance; not RESTful

### OAuth2 / OpenID Connect

- **Pros**: Industry standard, delegated auth, supports social login
- **Cons**: Requires an external IdP (Keycloak, Auth0); adds complexity for a single-user app; another service to maintain

### Multi-user with registration

- **Pros**: Could share the app with others
- **Cons**: Adds user management, invitation flows, data isolation; not needed for a personal finance app

### Bearer token in Authorization header

- **Pros**: Standard REST pattern, stateless
- **Cons**: Tokens accessible to JavaScript (XSS risk); must be manually attached to every request

## Reasoning

JWT in HttpOnly cookies is the best fit for a self-hosted single-user app. HttpOnly prevents JavaScript access (mitigating XSS token theft). SameSite=Strict prevents CSRF without needing a CSRF token. The refresh token rotation provides a security mechanism to detect token theft (if a refresh token is reused, the stolen session can be invalidated). No external IdP or session store is needed.

## Trade-offs accepted

- Only one user: no registration, no multi-tenancy, no role-based access
- Refresh token rotation is basic: if both access and refresh tokens are stolen simultaneously, the attacker has a 15-minute window
- No token revocation mechanism (short access token TTL is the mitigation)

## Consequences

- `DataSeeder` creates the single user at startup from env vars
- `SecurityConfig` disables CSRF and authorizes all `/api/**` endpoints for authenticated users
- `JwtAuthenticationFilter` runs before the Spring Security filter chain
- Frontend does not need to manage tokens manually; cookies are sent automatically with `withCredentials: true`

Note: This decision was made during initial development. This ADR is documented retroactively.
