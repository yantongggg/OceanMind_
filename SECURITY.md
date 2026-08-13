# Security & Audit Trail

OceanMind implements enterprise-grade security measures:

## Audit Logging

Every decision is recorded:
- **Decision Approval** — user, timestamp, rationale
- **Decision Override** — user, timestamp, reason given
- **Signal Ingestion** — source, time, severity
- **Report Generation** — evidence items, compliance checks

## API Security

- **Rate Limiting:** 120 requests/minute per IP (returns 429 if exceeded)
- **Request Validation:** Max 10MB payload, XSS/SQLi pattern detection
- **Security Headers:** CSP, HSTS, X-Content-Type-Options, X-Frame-Options

## Secret Detection

Pre-commit hook automatically scans for hardcoded secrets:
- AWS keys (`AKIA...`)
- API keys (`sk-ant-`, `sbp_`, etc.)
- Private keys (RSA, DSA, EC, OPENSSH, PGP)
- JWT tokens, database connection strings

## Static Code Analysis (SAST)

Checks for:
- Hardcoded secrets
- Weak crypto (MD5, SHA1)
- Cleartext HTTP
- Code injection (eval, exec)
- SQL injection patterns
- XSS vulnerabilities

---

**All decisions are non-repudiable.** Approval chains are cryptographically auditable.
