# Security & Compliance Roadmap ↔ Phase Gates

**Roadmap source (Dropbox):** `TUTTLEOS/TUTTLE_OS_SECURITY_COMPLIANCE_ROADMAP.md`  
**In-repo gates:** [COMPLIANCE_GATES.md](COMPLIANCE_GATES.md)

Use this when implementing “later in the build”: pick a roadmap ID → open the matching gate(s) → don’t invent parallel checklists.

**Legend:** Gate IDs are from `COMPLIANCE_GATES.md` (`0.x`, `1.x`, `W.x`, `8.x`, `G.x`, …).

---

## How we’re set up

| Layer | Position |
|---|---|
| Application spine (RLS, soft delete, actor, typed delete, doc access log) | Already in product patterns + `W.*` / Phase 8 gates |
| Paper (BAAs, risk assessment, policies) | Owner/vendor gates — **blocks real PHI**, not current feature work |
| Hygiene (MFA, secrets, PHI-in-logs, backups, pen test) | Phase 1 + **Go-live pack `G.*`** |
| AI | Phase 8 only; BAA-gated |

None of this blocks Phase 1–3 / intake–contract feature work (same as roadmap critical path).

---

## Crosswalk — roadmap ID → gate(s)

### 0 · Regimes (context only — no gate)

HIPAA-grade controls, Tex. Disc. R. 1.01/1.05, Tex. ch. 521, TDPSA, SOC 2 as control spine → inform `G.13`–`G.16`, `G.21`. Never claim “HIPAA certified.”

### 1 · Legal / contractual

| Roadmap | Gate(s) | Notes |
|---|---|---|
| **L1** Supabase BAA | **0.6** | Hard stop before production PHI / CasePeer |
| **L2** Vercel BAA | **G.1** | Vercel BAA does not cover external DB |
| **L3** AI/OCR BAA + no-retention | **8.7**, **8.8** | Before any PHI to OCR/Claude |
| **L4** Firm ↔ builder BAA | **G.2** | Counsel-driven |
| **L5** DPA + subprocessors + breach terms | **G.3** | Keep list current |
| **L6** Client cloud/AI consent trackable | **G.4** | Firm owns language; system tracks state |

### 2 · Infrastructure

| Roadmap | Gate(s) | Notes |
|---|---|---|
| **I1** TLS 1.2+ | **G.5** | Verify defaults |
| **I2** Encryption at rest | **G.5** | Verify tier |
| **I3** No public DB exposure | **G.6** | Pooler, network lock-down |
| **I4** Secrets management | **1.9** | Vercel env; no secrets in git |
| **I5** Backups + PITR + tested restore | **G.7** | Untested backup ≠ backup |
| **I6** US data residency | **G.8** | Pin region |
| **I7** Vercel Secure Compute | **G.22** | Optional Enterprise |

### 3 · Application controls

| Roadmap | Gate(s) | Notes |
|---|---|---|
| **A1** RLS every table | **0.5**, **1.10**, **W.3**, **W.4**, **8.11** | Battery + RLS matrix + Playwright |
| **A2** MFA mandatory | **1.1**, **1.11** | Enforce + enroll staff |
| **A3** Least-privilege RBAC | **1.5**, **1.6**, **W.3**, **5.a** | Role routing + capability holders |
| **A4** Access (read) audit | **8.4**, **G.9** | Doc access log exists; extend views |
| **A5** Sensitive-field edit + history | **W.1** + product (contacts history) | Keep on contact/doc patterns |
| **A6** Destructive-delete typed confirm | Product (`ConfirmDeleteDialog`) + **W.2** | Soft delete only |
| **A7** Soft delete + audit posture | **W.1**, **W.2**, **6.1** | Non-negotiable |
| **A8** Document versioning | **8.1**–**8.5** | Supersede + access log (`sql/16`) |
| **A9** Session hardening | **G.10** (+ **1.7** headers) | Idle timeout / cookies |
| **A10** No PHI in logs/URLs/analytics | **1.8**, **6.3**, **9.2** | Audit continuously |
| **A11** Rate limit login + `/sign` | **G.11** | Public signing is attack surface |
| **A12** Dependency scanning | **G.12** | CI Dependabot / `npm audit` |

### 4 · AI-specific

| Roadmap | Gate(s) | Notes |
|---|---|---|
| **AI1** Human gate on AI | **8.6**, **8.10** | Flag off; pilot with human verify |
| **AI2** BAA before model sees PHI | **8.7**, **8.8** | Same as L3 |
| **AI3** Block PHI to non-BAA tools | **8.6** + training (**G.15**) | Guardrails + culture |
| **AI4** Court AI-use certificates | Design under Phase 8; attorney-verify | Aligns Op. 705 / ATTORNEY-VERIFY |

### 5 · Operational

| Roadmap | Gate(s) | Notes |
|---|---|---|
| **O1** HIPAA Security Risk Assessment | **G.13** | Firm + HIPAA professional |
| **O2** Written policies (WISP / HIPAA) | **G.14** | Firm-owned |
| **O3** Workforce training | **G.15** | Ethics + IT |
| **O4** Incident / breach runbook | **G.14** | HIPAA 60-day + Tex. ch. 521 |
| **O5** Access reviews + offboarding | **G.15** | Revoke Auth + rotate secrets |
| **O6** Cyber insurance | **G.16** | Flag to Michael |

### 6 · Data lifecycle

| Roadmap | Gate(s) | Notes |
|---|---|---|
| **D1** Go-live data gate (not Phase 7) | **0.6** + Go-live pack | Explicit in PROJECT_PHASES |
| **D2** Secure CasePeer migration | **10.1**–**10.4** | After BAA |
| **D3** Retention & destruction | **G.17** | Legal-hold carve-outs |
| **D4** Heavy-media / Dropbox | **G.18**, **10.4** | DEC-DBX |

### 7 · Verification

| Roadmap | Gate(s) | Notes |
|---|---|---|
| **V1** Pen test before go-live | **G.19** | Public `/sign`, portal |
| **V2** Continuous monitoring | **G.20** | With **G.12** |
| **V3** Periodic access/config review | **G.20**, **G.15** | Schedule it |
| **V4** SOC 2 Type II (optional) | **G.21** | Decide |

---

## Critical path (same as roadmap)

1. **Now (no BAA cost):** `1.8`, `1.9`, `G.12`, `1.1`/`1.11`, `1.10`/`W.3`, `G.11`  
2. **Before real data:** `0.6`, `G.1`–`G.3`, `G.7`, `G.13`, `G.19`  
3. **Firm parallel:** `G.14`–`G.16`, `G.4`, `G.17`  
4. **AI later:** `8.6`–`8.11` only after `8.7`/`8.8`

---

## When status changes

1. Check the box on [COMPLIANCE_GATES.md](COMPLIANCE_GATES.md).  
2. Optionally note date next to the roadmap ID in Dropbox.  
3. Do **not** duplicate a third checklist — this map is the join table.

*Not legal advice — counsel + HIPAA professional confirm regime applicability before go-live.*
