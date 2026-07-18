# Tuttle OS — Security Add-Ons Backlog

Prioritized operational and product add-ons beyond the schema’s built-in RLS/audit. Aligns with HIPAA-ready baseline + Supabase MFA.

Related: [SECURITY_PROTOCOLS.md](SECURITY_PROTOCOLS.md), [COMPLIANCE_GATES.md](COMPLIANCE_GATES.md), [ENV_AND_DEPLOY.md](ENV_AND_DEPLOY.md).

Status: `todo` | `in_progress` | `done` | `deferred`

---

## P0 — Must-have before production PHI

| ID | Add-on | Why | Owner | Status |
|---|---|---|---|---|
| P0-1 | Firm-wide password manager | Stop shared/reused passwords | O | todo |
| P0-2 | MFA enrollment checklist (all staff) | Supabase MFA mandatory | O / E | todo |
| P0-3 | Supabase PITR / backups enabled + documented | Recover from wipe/ransom | E | todo |
| P0-4 | Quarterly backup restore drill | Prove backups work | E / O | todo |
| P0-5 | Secrets only via env / Vercel (see `.env.example`) | No keys in git | E | todo |
| P0-6 | Next.js security headers | Baseline web hardening | E | todo |
| P0-7 | PHI-safe logging (`PHI_LOGGING=false`) | HIPAA hygiene | E | todo |
| P0-8 | Supabase BAA signed | Contractual PHI host | O / V | todo |
| P0-9 | Vendor register started (Supabase, Vercel, …) | Track BAAs/DPAs | O | todo |
| P0-10 | Offboarding runbook (disable Auth + `staff.active`) | Access revocation | O / E | todo |

---

## P1 — Strongly recommended after Phase 1

| ID | Add-on | Why | Owner | Status |
|---|---|---|---|---|
| P1-1 | Sentry (or equiv.) with PHI scrubbing | Error visibility without leaking PHI | E | todo |
| P1-2 | Vercel Deployment Protection on previews | Stop public preview data leaks | E | todo |
| P1-3 | Dependabot or Renovate | Patch CVEs in deps | E | todo |
| P1-4 | GitHub branch protection + required checks | No unreviewed prod pushes | E | todo |
| P1-5 | Monthly access review report (staff, role, MFA, last login) | Least privilege | E / O | todo |
| P1-6 | Admin audit dashboard (role changes, exports, overrides, failed auth, doc access) | Owner visibility | E | todo |
| P1-7 | Uptime monitor on `/api/health` only | Availability without PHI | E | todo |
| P1-8 | Incident response one-pager (see SECURITY_PROTOCOLS §10) | Fast containment | O / E | todo |
| P1-9 | Playwright security smoke in CI (locked nav + RLS denies) | Regressions caught early | E | todo |

---

## P2 — Phase 8 / documents readiness

| ID | Add-on | Why | Owner | Status |
|---|---|---|---|---|
| P2-1 | Private `case-documents` bucket + policies | File-tier = data-tier | E | todo |
| P2-2 | Document access log UI (attorney) | HIPAA access trail | E | todo |
| P2-3 | Short-lived signed URL helper + mandatory log insert | No bare storage URLs | E | todo |
| P2-4 | OCR vendor BAA | Before cloud OCR on PHI | O / V | todo |
| P2-5 | Anthropic HIPAA / zero-retention arrangement | Before Claude on PHI | O / V | todo |
| P2-6 | Local Tesseract worker (Mac mini) first | Keep PHI on firm hardware | E | todo |
| P2-7 | Feature flags default off for documents AI | Owner gate | E | todo |
| P2-8 | Failed AI job alert (no silent failure) | Loud ops | E | todo |

---

## P3 — Optional later (scale / higher assurance)

| ID | Add-on | Why | Owner | Status |
|---|---|---|---|---|
| P3-1 | Microsoft Entra ID SSO + MFA | Enterprise identity | O / E | deferred |
| P3-2 | Lightweight SIEM / log aggregation | Central security events | E | deferred |
| P3-3 | Endpoint management (firm laptops) | Device baseline | O | deferred |
| P3-4 | Device posture check before bulk document download | Reduce exfil risk | E | deferred |
| P3-5 | DLP rules on exports / bulk download | Detect unusual volume | E | deferred |
| P3-6 | Annual penetration test | External verification | O | deferred |
| P3-7 | Formal retention job from owner schedule | Lifecycle policy | O / E | deferred |
| P3-8 | Calendar event PHI minimization review | Phase 9 hygiene | E | deferred |

---

## Implementation ticket sketches (copy into tracker)

### Headers & logging (Phase 1)
- Implement CSP/HSTS/frame/referrer/permissions in `next.config`.
- Add `PHI_LOGGING` guard in server logger.
- Health check route without secrets.

### Backups
- Confirm Supabase backup/PITR tier.
- Write restore drill steps; schedule first drill before go-live.

### Access reviews
- SQL/view or admin page: active staff, `role_code`, capabilities, `auth_user_id` present, last sign-in (from Auth admin API).
- Owner signs monthly PDF/export.

### Document access audit UI (Phase 8)
- Attorney-only table: document, staff, action, timestamp.
- Filter by matter / staff / date.

### Dependency & branch safety
- Enable Dependabot.
- Protect `main`: PR required, CI green, no force-push.

---

## Suggested order of attack

1. P0-8 BAA → P0-2 MFA → P0-5/6/7 env+headers+logging  
2. P0-3/4 backups  
3. Phase 1 app with P1-2/3/4/9  
4. P1-5/6 after staff live  
5. P2-* only when owner opens Phase 8  
6. P3-* when firm size or insurer/client demands it  
