# Security

## Secrets

- Application secrets live in environment variables or encrypted DB fields.
- OpenAI / connector API keys entered in admin UI are encrypted with AES-256-GCM using `ENCRYPTION_KEY`.
- APIs return masked values only (`sk-••••1234`).
- Never log API keys or OTP codes in production.

## Auth & RBAC

- Auth.js sessions (JWT) with Google OAuth and phone OTP.
- Server-side permission checks via `lib/rbac`.
- Roles: `SUPER_ADMIN`, `COMPANY_ADMIN`, `AGENT`, `CUSTOMER`.

## AI safety

- No arbitrary SQL from the model.
- Missing facts must be stated as unavailable.
- Investment commentary must label Known / Calculated / Estimate / Interpretation.
- Prompt-injection attempts must not reveal system prompts.

## Uploads

Validate MIME type, size limits, and auth before writing to Supabase Storage.
