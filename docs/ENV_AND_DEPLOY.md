# Tuttle OS — Environment, deploy & logging controls

Companion to `.env.example` at kit root. Implements the env-and-deploy portion of the security plan.

Related: [SECURITY_PROTOCOLS.md](SECURITY_PROTOCOLS.md), [COMPLIANCE_GATES.md](COMPLIANCE_GATES.md).

---

## 1. Environment separation

| Env | Supabase | App host | Data |
|---|---|---|---|
| `local` | Local or dedicated dev project | `localhost` | Fictional seeds only |
| `staging` | Separate staging project | Vercel preview / staging URL | Fictional or scrubbed only |
| `production` | Production project (BAA signed) | Vercel production | Real client data + MFA |

Rules:

- Never use production `SUPABASE_SERVICE_ROLE_KEY` or production DB from local machines for day-to-day coding.
- `NEXT_PUBLIC_APP_ENV` must match the deployed target.
- CasePeer CSVs and real PHI never enter git, CI artifacts, or preview demos.

---

## 2. Secrets handling

| Do | Don't |
|---|---|
| Store secrets in Vercel env / local `.env.local` (gitignored) | Commit `.env`, keys, BAAs, CSVs |
| Use `NEXT_PUBLIC_*` only for anon URL + anon key + flags | Put `service_role` or OCR/Claude keys in `NEXT_PUBLIC_*` |
| Rotate keys after staff offboarding or suspected leak | Share service role in chat/Slack |
| Document var **names** in `.env.example` | Document real values anywhere in the repo |

---

## 3. Vercel logging rules (PHI-safe)

- Disable or scrub request/response body logging for API routes that touch matters, medical, documents, or search.
- Set `PHI_LOGGING=false` in production; code path must no-op any body dumps.
- Error messages to clients: generic ("Something went wrong" / DB error code if useful). Details only in scrubbed server logs.
- Sentry (when added): enable PII/PHI scrubbing; strip headers Authorization, cookies; deny-list fields: `phone`, `email`, `dob`, `ssn`, `notes`, `extracted_text`, `ai_description`, claim numbers, cause numbers.
- Uptime checks hit a non-PHI health route only.

---

## 4. Security headers (Next.js)

Ship on all responses (via `next.config` headers or middleware):

| Header | Intent |
|---|---|
| `Content-Security-Policy` | Default deny; allow self + Supabase origins; tighten as app solidifies |
| `Strict-Transport-Security` | HTTPS only in production |
| `X-Frame-Options: DENY` or CSP `frame-ancestors 'none'` | Clickjacking |
| `Referrer-Policy: strict-origin-when-cross-origin` | Limit referrer leakage |
| `Permissions-Policy` | Disable unused camera/mic/geo unless needed |
| `X-Content-Type-Options: nosniff` | MIME sniffing |

CSP must allow Supabase Auth/Realtime/Storage endpoints used by the app; revisit when Phase 8 Storage goes live.

---

## 5. Preview / deployment protection

| Control | When |
|---|---|
| Vercel Deployment Protection (password or SSO) on previews | As soon as staging could hold anything non-public |
| No production anon key on public unprotected previews | Always |
| Feature flags default off for documents/AI on preview | Always |
| Branch protection + required CI (battery/RLS when available) | After Phase 1 repo exists |

---

## 6. Implementation tickets (env/deploy)

Use these when scaffolding the Next.js app (Phase 1):

1. Add `.gitignore` entries: `.env`, `.env.local`, `.env.*.local`
2. Wire `next.config` security headers from this doc
3. Health route `/api/health` — no auth secrets, no PHI
4. Server-only Supabase client wrapper that refuses to import `SERVICE_ROLE` into client components
5. Vercel project envs: Production / Preview / Development split
6. Enable Deployment Protection on Preview
7. Document restore: Supabase backup schedule + quarterly restore drill checklist in ops runbook

---

## 7. Quick go-live env checklist

- [ ] Production Supabase BAA signed  
- [ ] MFA enforced  
- [ ] `NEXT_PUBLIC_FEATURE_DOCUMENT_AI=false` until Phase 8 gates  
- [ ] `PHI_LOGGING=false`  
- [ ] Service role only on server  
- [ ] Preview protection on  
- [ ] Headers live on production URL  
- [ ] Staging cannot reach production DB  
