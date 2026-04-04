# ADR: AES-256-GCM for Crypto Exchange Secrets

> Date: 2026-03-01
> Status: ✅ Active

## Context

Picsou connects to crypto exchanges (Binance) using API keys and secrets stored in the database. These credentials grant access to the user's exchange account. Storing them in plaintext in the database is a security risk -- if the database is compromised (backup leak, SQL injection, server access), the attacker gains full access to the exchange account.

## Decision

Encrypt API secrets at rest using AES-256-GCM before storing them in the database. The `CryptoEncryption` component handles encryption/decryption. The encryption key is provided via the `CRYPTO_ENCRYPTION_KEY` environment variable (Base64-encoded 256-bit key).

Implementation details:

- **Algorithm**: `AES/GCM/NoPadding` with 12-byte random IV and 128-bit authentication tag.
- **Storage format**: Base64-encoded `IV + ciphertext` (IV is prepended to the ciphertext before encoding).
- **Key management**: Single symmetric key from environment variable. No key rotation mechanism.
- **Fail-fast behavior**: If `CRYPTO_ENCRYPTION_KEY` is not set, `encrypt()` throws `IllegalStateException` -- secrets are never stored in plaintext. The app will not start sync operations without the key configured.
- **API keys**: Only the API secret is encrypted. The API key is stored as-is (it is not secret -- it identifies the user but cannot perform actions alone).

## Alternatives considered

### Plaintext storage

- **Pros**: Zero complexity; no key management
- **Cons**: Database compromise = full exchange access; unacceptable for financial credentials

### HashiCorp Vault

- **Pros**: Enterprise-grade secret management; key rotation; audit log
- **Cons**: Requires running a separate Vault server; complex setup for a self-hosted single-user app; overkill

### Cloud KMS (AWS KMS, GCP KMS)

- **Pros**: Managed key management; automatic rotation; hardware-backed
- **Cons**: Requires cloud account; adds external dependency; not suitable for self-hosted deployments

### Application-level key derivation (PBKDF2 from password)

- **Pros**: No separate key to manage; derived from user password
- **Cons**: Changing the password re-encrypts all secrets; complex migration; single-user app has no password change flow

## Reasoning

AES-256-GCM provides authenticated encryption (confidentiality + integrity) with a simple API. The single symmetric key from an environment variable fits the self-hosted deployment model -- the operator sets the key once and backs it up. GCM mode provides built-in tamper detection, preventing padding oracle attacks. The fail-fast behavior (`encrypt()` throws if key is missing) ensures secrets are never silently stored in plaintext.

## Trade-offs accepted

- No key rotation: if the encryption key is compromised, all stored secrets must be re-encrypted
- Lost key = lost access: if the encryption key is lost, encrypted secrets cannot be recovered; the user must re-enter exchange credentials
- Single key: all secrets use the same encryption key (no per-user or per-exchange key isolation, which is fine for a single-user app)

## Consequences

- `CryptoEncryption` is a `@Component` injected into `CryptoExchangeSyncService`
- `CryptoExchangeSession.apiSecret` stores the encrypted value; `CryptoExchangeSession.apiKey` stores plaintext
- `CRYPTO_ENCRYPTION_KEY` must be set in the environment before adding any exchange
- Adding a new exchange requires the key: `addExchange()` calls `encryption.encrypt(apiSecret)` which fails-fast if key is missing
