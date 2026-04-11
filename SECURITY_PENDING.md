# Security Improvements - Pending

Items to implement in the future. Tell Claude to implement any of these when ready.

---

## 1. Leaked Password Protection (Supabase Dashboard)

**Priority:** High
**Where:** Supabase Dashboard > Auth > Settings

Enable HaveIBeenPwned integration to prevent users from using compromised passwords.

Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

---

## 2. CORS Policy for API Routes

**Priority:** Medium
**Where:** `next.config.js` or `src/middleware.ts`

Add explicit CORS headers to API routes restricting allowed origins to the production domain only. Currently relies on browser same-origin defaults.

Changes needed:
- Define allowed origins (production URL)
- Add `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`
- Handle preflight OPTIONS requests

---

## 3. Rate Limiting on API Routes

**Priority:** Medium
**Where:** New middleware or per-route logic

Add rate limiting to prevent abuse on:
- `/api/csv/template` (currently public, no auth)
- `/api/reports/[reportId]/pdf`
- `/auth/callback`

Options:
- Use Vercel's built-in rate limiting (if deployed on Vercel)
- Use `@upstash/ratelimit` with Redis
- Custom in-memory rate limiter for simple cases

---

## 4. SMTP TLS Certificate Validation

**Priority:** Medium
**Where:** `src/lib/email.ts`

Currently `rejectUnauthorized: false` on all TLS configurations (lines 32, 34, 38). This disables certificate validation and allows MITM attacks.

Change needed:
- Set `rejectUnauthorized: true` in production
- Ensure SMTP provider has valid TLS certificates
- Can use environment variable to toggle for development vs production

---

## 5. Authentication on CSV Template Route

**Priority:** Low
**Where:** `src/app/api/csv/template/route.ts`

The CSV template download endpoint is public (no auth required). Consider adding authentication to prevent unauthorized access.

---

## 6. Content Security Policy Refinement

**Priority:** Low
**Where:** `next.config.js` (already has base CSP)

The current CSP uses `'unsafe-inline'` and `'unsafe-eval'` for scripts which weakens protection. Once the app is stable:
- Replace `'unsafe-inline'` with nonce-based or hash-based script loading
- Remove `'unsafe-eval'` if not needed by dependencies
- Add `report-uri` or `report-to` directive for CSP violation monitoring

---

## 7. Security Monitoring & Logging

**Priority:** Low
**Where:** New middleware or edge function

Consider adding:
- Failed login attempt monitoring
- Suspicious activity alerts
- CSP violation reporting endpoint
