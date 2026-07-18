# Tuttle OS — Security Protocols

**Posture:** HIPAA-ready law-firm baseline (strong controls, reasonable cost)  
**Identity:** Supabase Auth with mandatory MFA for all staff  
**Enforcement:** Postgres RLS + audit triggers are the source of truth; the UI never grants what the database forbids  
**Owner:** Michael (attorney decisions); build team implements and verifies gates

This document is the standing security rulebook for build, deploy, and operations. When it conflicts with convenience, this document wins. Related: [COMPLIANCE_GATES.md](COMPLIANCE_GATES.md), [SECURITY_TEST_PLAN.md](SECURITY_TEST_PLAN.md), [SECURITY_ADDONS_BACKLOG.md](SECURITY_ADDONS_BACKLOG.md), [documents-feature-review.md](documents-feature-review.md).

---

## 1. Architecture (one model)

```
Staff → Supabase Auth + MFA → JWT (auth.uid)
     → Next.js app shell (locked nav / role routing)
     → Supabase API (authenticated role = app_staff)
     → Postgres RLS + app.* helpers
     → Domain data + immutable audit.change_log
     → (Phase 8) Private case-documents bucket
     → document_access_log + AI/OCR only after BAAs
```

**Prime rule:** Security lives in the database. The UI shows 🔒 and tooltips; it does not re-implement access control.

---

## 2. Identity and access

| Protocol | Requirement |
|---|---|
| Authentication | Supabase Auth, email login |
| MFA | **Mandatory** for every staff account before production PHI |
| Account model | One human = one Auth user = one `core.staff` row |
| Linking | Set `core.staff.auth_user_id` to the Auth UUID; unlinked users cannot act |
| Shared logins | **Forbidden** |
| Roles | From `core.staff.role_code` (`ref.staff_role`) + capability flags (`is_attorney`, `can_approve_level`, `can_clear_conflicts`) |
| Frontend roles | Cosmetics / routing only — never authoritative |
| Session | Short-lived access tokens; refresh via Supabase; logout clears client session |
| Offboarding | Disable Auth user + set `staff.active = false` the same day |

### RLS tiers (do not soften)

| Tier | Who | Effect |
|---|---|---|
| All active staff | Any active `core.staff` | Read cases they are allowed by policy |
| Intake | `intake` | **DB-blocked** from medical, litigation, resolution, liens, insurance, property |
| Finance detail | attorney + `lien_disbursement` | Fee/trust/disbursement detail |
| Discovery content | attorney + `litigation_paralegal` | Discovery work product |
| Conflict clearance | `can_clear_conflicts` only | Clears cross-matter copy / waiver |
| Document categories (v2.2) | via `app.can_view_doc_type` | Intake blocked from restricted doc metadata **and** files |

Locked nav items show 🔒 + tooltip naming the enforcing tier.

---

## 3. Database enforcement

| Protocol | Requirement |
|---|---|
| Actor on every write | Resolvable via `app.staff_id` / Auth bridge; missing actor **fails loud** |
| Soft delete only | UI "delete" = set `deleted_at`; no hard deletes of case data |
| List queries | Always filter `deleted_at IS NULL` |
| Legal deadlines | Computed in DB functions/triggers only; UI formats, never invents |
| Schema changes | New numbered migrations + tested rollbacks; never edit shipped `01`–`05` |
| Battery | `sql/tests/test_v2.5_battery.sql` stays green after every migration |
| Service role | Server-only; never ship `service_role` key to the browser |

---

## 4. Audit and monitoring

| Protocol | Requirement |
|---|---|
| Source of truth | Immutable `audit.change_log` (who / when / what) |
| My Activity | Per-user slice of audit/task/communication stream (every role) |
| Overrides | Doc-backed task overrides require reason; feed owner override patterns |
| Security events to log (app layer) | Login failure spikes, MFA reset, role/capability changes, document view/download, failed RLS writes, high-risk exports |
| Logging hygiene | **No PHI in application logs, analytics, or error traces** (names, DOB, claim #, medical detail, document text) |

---

## 5. Document security (Phase 8 — when adopted)

Adopt `sql/optional/06_upgrade_v2.2_documents.sql` only with owner go-ahead.

| Protocol | Requirement |
|---|---|
| Bucket | Private `case-documents` (not public) |
| Authorization | Same as document row: `app.can_view_doc_type(doc_type_code)` |
| Files | Immutable; corrections via `supersedes_document_id`, never overwrite |
| Signed URLs | Short-lived; issued only after policy check; each issuance → `workflow.document_access_log` |
| UI | Never expose raw `storage_path` as a navigable secret |
| Access log actions | `view`, `download`, `upload`, `replace`, `share_link` |
| Access log RLS | Append-only; attorneys read all; staff read own |

---

## 6. AI / OCR security (Phase 8 — gated)

Adopt `sql/optional/07_upgrade_v2.6_documents_ai.sql` only after storage (v2.2) and BAAs.

| Protocol | Requirement |
|---|---|
| Default | Feature **off** until owner enables |
| BAAs required | Cloud OCR vendor **and** Anthropic/Claude HIPAA/zero-retention arrangement |
| Prefer local OCR | Tesseract first; cloud OCR only for low-confidence pages after BAA |
| PHI leaving the building | **Attorney decision**; no real medicals until BAAs signed |
| Jobs | `workflow.document_ai_job`; 3 strikes → loud `failed` with error surfaced |
| Search | `workflow.search_documents` runs as invoker (RLS applies) |
| Pilot | Closed case first, then one active, then batch |

---

## 7. Vendor and contract controls

Maintain a vendor register (owner-owned). Minimum entries:

| Vendor | Control |
|---|---|
| Supabase | **BAA signed before production PHI** |
| Vercel | DPA review; no PHI in request/body logs |
| RingCentral | BAA/DPA if call metadata ties to PHI |
| Dropbox | Frozen parallel archive; not bidirectional sync |
| OCR (Document AI / Textract / etc.) | BAA before cloud OCR |
| Anthropic / Claude | HIPAA arrangement before summarize/extract |
| Microsoft / Google Calendar | Org DPA; calendar titles must not dump medical detail |
| Email provider | DPA; templates for non-engagement / preservation attorney-reviewed |

No third-party AI or OCR keys in client bundles. Worker keys stay on firm-controlled hardware or server env only.

---

## 8. Deployment and environment separation

| Environment | Data | Access |
|---|---|---|
| Local | Fictional seeds only | Dev machines |
| Staging / preview | Fictional or scrubbed only | Protected deployments |
| Production | Real client data | MFA-enrolled staff only |

Rules:

- Separate Supabase projects (or fully isolated schemas) for prod vs non-prod.
- Preview deployments on Vercel must be **deployment-protected** (password or SSO) once PHI could appear; prefer never putting PHI on previews.
- Secrets only via environment variables / platform secret stores — never committed.
- CasePeer CSVs stay out of git (Dropbox only; owner-run migration).

---

## 9. Application hardening (Next.js / Vercel)

| Control | Requirement |
|---|---|
| Security headers | CSP, HSTS, `X-Frame-Options` / `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy` |
| Cookies / session | Secure, HttpOnly where applicable; SameSite appropriate for Auth flow |
| Error UI | Generic messages to users; details only in PHI-scrubbed server logs |
| Exports | Role-gated; log as high-risk security events |
| Dependency hygiene | Dependabot/Renovate; no known criticals in production deps |

See `.env.example` for expected variable names (no secrets).

---

## 10. Incident response (lightweight baseline)

1. **Contain** — revoke affected Auth sessions; rotate compromised keys; disable affected staff if needed.  
2. **Assess** — what data, which matters, which staff/vendor path.  
3. **Notify** — Michael (owner) immediately; counsel/vendor per BAA as required.  
4. **Preserve** — do not wipe audit logs or access logs; export evidence.  
5. **Remediate** — patch, rotate, re-verify MFA and access reviews.  
6. **Record** — short incident note for the firm file.

Formal legal breach analysis is an attorney decision; engineering supplies logs and timeline.

---

## 11. Operational protocols (people)

| Protocol | Cadence |
|---|---|
| Password manager for all staff | Before go-live |
| MFA enrollment checklist | Before production PHI |
| Access review (active staff, roles, MFA, last login) | Monthly after go-live |
| Backup restore drill | Quarterly |
| Vendor register review | Quarterly / on new vendor |
| Retention schedule | Owner policy decision; enforce later via soft-delete + job |

---

## 12. Add-on summary

**Must-have for go-live:** password manager, MFA checklist, Supabase backups + restore drill, env secrets only, security headers, PHI-safe error monitoring.

**After Phase 1:** Sentry with PHI scrubbing, Vercel preview protection, Dependabot/Renovate, branch protection, access-review report, admin audit dashboard.

**Later / scale:** Entra SSO, SIEM, endpoint management, download device posture, DLP on bulk export, annual pen test.

Full prioritized backlog: [SECURITY_ADDONS_BACKLOG.md](SECURITY_ADDONS_BACKLOG.md).

---

## 13. Non-negotiables (checklist)

- [ ] Supabase BAA before production PHI  
- [ ] MFA on for every production staff user  
- [ ] Every Auth user linked to `core.staff`  
- [ ] No `service_role` in the browser  
- [ ] No hard deletes of case data  
- [ ] No client-side legal deadline computation stored as truth  
- [ ] No PHI in logs  
- [ ] No real medicals to OCR/AI without BAAs  
- [ ] RLS regression matrix green ([SECURITY_TEST_PLAN.md](SECURITY_TEST_PLAN.md))  
- [ ] Phase gates satisfied ([COMPLIANCE_GATES.md](COMPLIANCE_GATES.md))  

— Prepared for Tuttle OS build kit; aligns with MASTER_PROMPT prime directives and v2.1–v2.5 schema enforcement.
