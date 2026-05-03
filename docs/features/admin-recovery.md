# Feature: Admin password recovery

> Last updated: 2026-05-03

## Context

Picsou is self-hosted and single-tenant. There is no email-based "forgot password" flow because instances may run on intranets without SMTP. If the operator loses the admin password, the instance becomes inaccessible. This feature provides a break-glass recovery path that requires shell access to the host.

## How it works

The operator sets `ADMIN_RECOVERY_ENABLED=true` in the environment and restarts the application. On boot, `AdminRecoveryRunner` (an `ApplicationRunner`) detects the flag, regenerates an activation token for every `ADMIN`-role user, and prints a WARN-level banner with the activation URL.

The operator opens the URL in a browser and follows the existing `/activate/{token}` flow (the same flow used for inviting new family members) to set a new password. Afterwards, the operator must set `ADMIN_RECOVERY_ENABLED=false` and restart.

### Key files

- `backend/src/main/java/com/picsou/config/AdminRecoveryRunner.java` — the boot-time runner
- `backend/src/main/java/com/picsou/controller/AuthController.java#activate` — consumes the token
- `backend/src/main/java/com/picsou/service/SetupAuditService.java` — records the audit entries
- `backend/src/main/resources/application.yml` — `app.admin-recovery.enabled` binding
- `.env.example` — `ADMIN_RECOVERY_ENABLED` variable documented

### Flow

```
operator: set ADMIN_RECOVERY_ENABLED=true
operator: restart picsou
   ↓
AdminRecoveryRunner.run()
  ├─ find all UserRole.ADMIN users
  ├─ for each: new SecureRandom token, expires now+1h
  ├─ user.activated = false
  ├─ user.tokenVersion++  (invalidates pre-existing sessions)
  ├─ log WARN banner with URL
  └─ audit "admin.recovery.token-generated"
   ↓
operator: opens URL in browser
   ↓
POST /api/auth/activate/{token}
  ├─ user.passwordHash = bcrypt(newPassword)
  ├─ user.activated = true
  └─ audit "admin.recovery.completed"  (only if user.role == ADMIN)
   ↓
operator: set ADMIN_RECOVERY_ENABLED=false, restart
```

## Technical choices

| Choice | Why | Rejected alternative |
|--------|-----|----------------------|
| Boot-time runner only | No runtime API surface → cannot be triggered by a compromised session | Admin endpoint guarded by env flag |
| Reuse existing `/activate/{token}` flow | Zero new endpoints, less attack surface | Dedicated `/recovery/{token}` endpoint |
| Token TTL = 1 h | Short enough to limit exfiltration risk, long enough for slow operators | 15 min (too aggressive) / 24 h (too loose) |
| Bump `tokenVersion` immediately | Invalidates any active session on the admin account, even if token was leaked | Wait until activation completes |
| `SecureRandom` 32 bytes base64url | 256 bits of entropy, URL-safe | UUID (only 122 bits) |

## Gotchas / Pitfalls

- The flag is read **only at boot** (Spring `@Value`). Setting it at runtime has no effect — the operator must restart.
- All ADMIN users get a new token, not just the one whose password was lost. Acceptable for self-hosted (typically 1 admin) but worth knowing.
- The activation URL is logged at `WARN` level. If your log aggregation forwards WARN to alerting, you'll get a notification — that's intentional (visibility).
- `tokenVersion` increment invalidates the admin's existing sessions immediately. If recovery is triggered while the admin is still logged in elsewhere, that session is killed.
- The token URL contains a secret. Be mindful where logs are stored — anyone with read access to logs during the 1-hour window can hijack the recovery.

## Tests

- Manual:
  1. Set `ADMIN_RECOVERY_ENABLED=true`, boot → expect WARN banner with valid URL.
  2. Open URL → activation form → set new password → expect "Account activated successfully".
  3. Old session: refresh dashboard → 401 → re-login required.
  4. Set `ADMIN_RECOVERY_ENABLED=false`, boot → expect no banner, no token rotation.
