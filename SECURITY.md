# Security

Security hardening notes for the Ikizamini driving-test platform (Express + Mongoose API, React client, MongoDB Atlas, Vercel).

## Reporting

Report suspected vulnerabilities privately to **support@ikizamini.rw**. Do not open public issues for exploitable bugs.

## Threat model (summary)

Multi-tenant learner app handling: accounts (email + Rwandan phone numbers), manual Mobile Money payments with screenshot proofs (stored in GridFS), exam results, and staff/admin operations. Primary risks: privilege escalation, payment fraud, exam answer leakage, account takeover, abuse (spam/brute force), and PII exposure.

## Controls by area

### Input validation
- Every request body/query is validated with Zod via the `validate()` middleware; unknown keys are stripped, no raw `req.body` reaches business logic.
- Payment uploads are multipart; `transactionReference` is bounded to 80 chars, phone numbers must be valid Rwandan numbers (normalised server-side).

### Authentication & sessions
- Passwords: bcrypt cost 12 (test: 4), minimum length enforced, password may not equal the e-mail address, register requires `confirmPassword`.
- JWT access tokens (20 min) + refresh tokens (30 days) with rotation and **token versioning**: changing or resetting a password invalidates all previously issued tokens (`TOKEN_REVOKED`).
- Refresh/logout are **cookie-only and require the `x-csrf-protection` header** (custom-header CSRF defence; state-changing endpoints also enforce it).
- Login lockout after `MAX_LOGIN_ATTEMPTS` (default 5) failed attempts per account, 15-minute lockout, counters incremented atomically.
- Anti-enumeration: login failures are always `INVALID_CREDENTIALS`; verify-email and resend-verification respond generically regardless of whether the account exists. (Register still returns e-mail-taken for UX — accepted trade-off.)
- OTP codes are never logged; mail bodies are not logged at all.

### Rate limiting (express-rate-limit)
- Global API limiter, stricter auth limiter, `writeLimiter` on state-changing admin/quiz endpoints, OTP limiter (email-flooding protection).
- Login limiter keys on **IP + e-mail** (IPv6-safe key: addresses normalised to their /64 subnet) and does not count successful logins.
- Behind Vercel: `TRUST_PROXY` is on in production so limits key on real client IPs.

### Authorisation / IDOR / mass assignment
- Role + permission checks via `requirePermission` (`users:*`, `billing:manage`, `roles:manage`, ...); staff routes sit behind `authenticate + requireStaff`.
- `PATCH /admin/users/:id` only accepts profile/status fields — `role` and `permissions` are **not** accepted on that endpoint (they require `PATCH /users/:id/role`, permission-gated with an enum-validated permission list).
- No endpoint allows a user to change their own role (`CANNOT_CHANGE_OWN_ROLE`).
- Learner-scoped resources (quizzes, payments, proofs, reports) are always filtered by the authenticated user id; proof downloads require owner or `billing:manage`.
- Public question endpoints (`GET /questions`, `/questions/random`) strip `correctOptionIds`, `explanation` and per-option `isCorrect`; staff endpoints keep them.

### Payments
- Proof screenshot is **mandatory** server-side (`noProof` flag removed; magic-byte sniffing rejects non-image bytes, MIME/extension mismatches).
- `transactionReference` has a **partial unique index** (nulls excluded) → duplicate MoMo references rejected (`PAYMENT_DUPLICATE_REF`). See “Index maintenance” below.
- Review flow is race-safe:
  - `claimForReview` is an atomic `findOneAndUpdate` — only one admin can hold a transaction (stale `UNDER_REVIEW` older than 10 min can be reclaimed).
  - Approval flips `UNDER_REVIEW → APPROVED` **before** creating the subscription; a concurrent deny aborts the approval (`PAYMENT_REVIEW_RACE`) — no subscription is ever created for a denied payment.
  - Subscription creation is idempotent (unique index on `payment`, E11000 reuse); re-approval returns `PAYMENT_ALREADY_APPROVED`; a crashed approval (APPROVED without subscription) is repaired only after the flip is older than the stale window.
  - Learner submissions have a 1-minute duplicate cooldown and a server-set verification window (`expiresAt`, auto-expire sweep).

### Quiz integrity
- `feedbackMode` is ignored from client input: mock exams always run in `end`-of-exam feedback mode (immediate feedback cannot be forced on).
- `saveAnswer` enforces the server-side `expiresAt` timer (`QUIZ_EXPIRED`); answers submitted after expiry are rejected.
- Submission is a state-machine race: atomic claim `in_progress → submitted`, second submit → `QUIZ_ALREADY_SUBMITTED` (409). Past-deadline submissions grade only answers saved before expiry; client-supplied `durationSec` is ignored (server-computed).
- Free-tier question quota is reserved atomically at quiz start (`pendingReservedQuestions` on the entitlement, `$expr` guard) and released on submit/expire/reset, so concurrent quiz starts cannot exceed the allowance.
- Answer data (correctness, explanations) is never included in mock-exam feedback responses.

### Uploads
- Proofs go through multer memory storage → magic-byte sniff (PNG/JPEG/WebP) → GridFS. Proof responses are `Cache-Control: private, no-store`; GridFS id, not local path.

### Headers / CORS / transport
- Security headers set at the edge (Vercel `headers`): strict `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, HSTS in production.
- CORS restricted to the configured `CORS_ORIGINS` allowlist (no wildcard with credentials).
- Cookies: `Secure` + `HttpOnly` + `SameSite` (default `lax`); `SameSite=none` only when explicitly configured for cross-site setups.
- Request body limits: 2 MB (JSON/urlencoded) to blunt payload-flooding.

### Logging & data exposure
- No secrets, OTPs or mail bodies in logs; logger is silent in tests, info in production.
- Error responses expose detailed metadata only when the error is marked `expose=true`; everything else is a generic message (5xx never leaks internals to clients — the client also shows a generic message for 5xx).
- `tests/setup.js` refuses to run the test suite against any database whose name does not contain `test` or against `NODE_ENV=production`.
- The seed script refuses to write known default passwords in production.

### Client
- Access/refresh tokens are held **in memory only** (no `localStorage` mirror), so XSS cannot silently exfiltrate long-lived credentials; session existence is flagged by a non-sensitive `idt.hasSession` flag.
- Admin UI disables self role-change to match the server rule.

## Rate limit & lockout tunables

| Variable | Default | Meaning |
| --- | --- | --- |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | 600 / 15 min | Global API |
| `AUTH_RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_WINDOW_MS` | 25 / 15 min | Auth endpoints |
| `WRITE_RATE_LIMIT_MAX` | 120 / 15 min | State-changing endpoints |
| `MAX_LOGIN_ATTEMPTS` / `LOCKOUT_MINUTES` | 5 / 15 | Per-account lockout |

## Index maintenance

Production runs with Mongoose `autoIndex: false`. After any deploy that changes schema indexes (e.g. the partial unique index on `PaymentTransaction.transactionReference`), run once:

```bash
ALLOW_PRODUCTION_SYNC_INDEXES=1 node server/src/scripts/sync-indexes.js
```

The script compares each model's schema indexes against the ones in the database: it drops any index that shares a name with a desired index but has different options (e.g. an old non-unique `transactionReference_1` blocking the new partial-unique one), then calls `createIndexes()` (a no-op when already correct). It never touches documents, and re-running it is safe.

## Verification

```bash
npm run lint
npm run test:server          # includes server/tests/security.hardening.test.js
npm run build
```

`security.hardening.test.js` locks in: privilege-escalation and mass-assignment rules, public answer stripping, quiz timer/double-submit/feedback-mode integrity, token versioning on password change, duplicate payment references, magic-byte proof validation, approve/deny ordering (no double subscription), and the refresh CSRF requirement.

## Known trade-offs / open items

- **Register returns “e-mail taken”** (enumeration) — deliberate UX trade-off; all other auth endpoints are generic.
- Argon2 password hashing was considered; bcrypt cost 12 retained for now.
- MongoDB is Atlas M0 (no transactions) — consistency relies on atomic single-document updates and unique indexes instead of multi-document transactions.
