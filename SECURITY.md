# Security

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's **private vulnerability reporting** (Security → Report a
vulnerability) on this repository. We aim to acknowledge reports within 3 business days.

## What the template does for you

- No service-account keys: CI authenticates with Workload Identity Federation restricted to one repository id.
- The browser never writes to Firestore; rules deny all writes and limit reads to the caller's own data.
- Every API route requires a verified Firebase ID token unless explicitly marked `@Public()`; workspace routes
  check membership and role permissions.
- Invitation tokens are random 256-bit values; only their SHA-256 is stored.
- CORS is an explicit allow-list; security headers via `helmet` (API) and `next.config.ts` (web).
- Secrets belong in Secret Manager, never in `.env`, `apphosting.*.yaml` or GitHub variables.

## What is still your job

- Rate limiting / abuse protection for public endpoints (App Check, Cloud Armor, or a limiter).
- Enabling Firebase Auth protections you need (email enumeration protection, MFA, password policy).
- Reviewing IAM after you add services, and keeping dependencies updated (Dependabot is configured).
