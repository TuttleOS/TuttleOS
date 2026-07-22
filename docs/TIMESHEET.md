# Tuttle OS — Developer Timesheet

**Client:** Michael Tuttle / Tuttle Law Firm d/b/a Crash Guy Injury Attorneys  
**Developer:** Solo builder  
**Rate:** **$125.00 / hour**  
**Period covered:** Through **2026-07-20** (MVP delivery + hardenings)  
**Currency:** USD  

> **Method:** Hours are **reconstructed estimates** from delivered scope and git history (not punch-clock logs). Grouped by work package for invoicing. Adjust any line before sending if you tracked differently.

---

## Summary

| | |
|---|---|
| **Total hours** | **412.0** |
| **Rate** | $125.00 |
| **Amount due** | **$51,500.00** |

| Category | Hours | Amount |
|---|---:|---:|
| A. Foundation (Phase 0–2) | 72.0 | $9,000.00 |
| B. Case Manager (Phase 3) | 56.0 | $7,000.00 |
| C. Litigation (Phase 4) | 36.0 | $4,500.00 |
| D. Owner + cross-workspace (Phase 5–6) | 40.0 | $5,000.00 |
| E. Contingent fee e-sign (C2) | 52.0 | $6,500.00 |
| F. Documents storage (Phase 8 storage) | 36.0 | $4,500.00 |
| G. Product polish & owner UX | 40.0 | $5,000.00 |
| H. Production / signing / ops fixes | 24.0 | $3,000.00 |
| I. Recent hardenings (address, minors, fees, DOI) | 32.0 | $4,000.00 |
| J. Docs, briefs, costing / overview | 24.0 | $3,000.00 |
| **Total** | **412.0** | **$51,500.00** |

---

## Line items

### A. Foundation — Phase 0–2  
**72.0 hrs · $9,000.00**

| Date (approx) | Description | Hrs |
|---|---|---:|
| Prior–2026-07-18 | Schema kit adopt/apply path (sql/01–05), env, Supabase wiring | 16.0 |
| 2026-07-18 | Phase 1: Auth, AppShell, roles, search, theme | 16.0 |
| 2026-07-18 | Phase 2: Intake queue, new lead, gate, SOL preview, activity | 24.0 |
| 2026-07-18 | Seeds / demo path / local runbook alignment | 8.0 |
| 2026-07-18–19 | Intake companions (multi-person same crash) + polish | 8.0 |

### B. Case Manager — Phase 3  
**56.0 hrs · $7,000.00**

| Date (approx) | Description | Hrs |
|---|---|---:|
| 2026-07-18 | Caseload, matter page shell, My Tasks, provider calls | 20.0 |
| 2026-07-18 | Deepen matter cards (coverage N/A, PD, records, demand/negotiate, notes) | 24.0 |
| 2026-07-18–19 | CM assignment on matter header; contact copy / soft-delete patterns | 12.0 |

### C. Litigation — Phase 4  
**36.0 hrs · $4,500.00**

| Date (approx) | Description | Hrs |
|---|---|---:|
| 2026-07-18 | Lit caseload, Deadline Horizon, tasks, matter Focus MVP | 28.0 |
| 2026-07-18 | Lit/CM shared patterns + identity switch prep | 8.0 |

### D. Owner + cross-workspace — Phase 5–6  
**40.0 hrs · $5,000.00**

| Date (approx) | Description | Hrs |
|---|---|---:|
| 2026-07-18 | Owner stalled / Approvals / SOL Watch MVP + phase docs | 16.0 |
| 2026-07-18 | CM ↔ Lit switcher (Phase 6) | 8.0 |
| 2026-07-18 | Owner UX restyle, firm-wide attorney sidebar, walkthrough/checklist | 12.0 |
| 2026-07-18 | Phase 7 skeletons + Phase 9 calendar scaffold + Phase 10 migrate scaffold (light) | 4.0 |

### E. Contingent fee e-sign — C2  
**52.0 hrs · $6,500.00**

| Date (approx) | Description | Hrs |
|---|---|---:|
| 2026-07-19 | Contract package/signer SQL + draft/send/void flows | 16.0 |
| 2026-07-19 | Public `/sign/[token]`, drawn signature pad, multi-signer | 16.0 |
| 2026-07-19 | Firm countersign, PDF artifact, staff contract view | 12.0 |
| 2026-07-19 | Companion signer linker; public URL / localhost prod fix | 8.0 |

### F. Case documents — storage only  
**36.0 hrs · $4,500.00**

| Date (approx) | Description | Hrs |
|---|---|---:|
| 2026-07-19 | sql/16 storage schema; upload/list/supersede APIs | 12.0 |
| 2026-07-19 | CM Documents panel + section quick upload | 10.0 |
| 2026-07-19 | List embed fix, preview modal, CSP/file stream, service-role wiring | 14.0 |

### G. Product polish & owner-facing UX  
**40.0 hrs · $5,000.00**

| Date (approx) | Description | Hrs |
|---|---|---:|
| 2026-07-18–19 | MM/DD/YYYY dates, intake/CM polish, Wave 1–2 UX fixes | 12.0 |
| 2026-07-19 | Contact history + typed soft-delete confirms | 8.0 |
| 2026-07-19 | What’s New popup + Version updates page | 6.0 |
| 2026-07-18–19 | Owner briefs, TESTNOTES, Vercel/Git setup notes | 8.0 |
| 2026-07-19 | Build/TS fixes (eslint, Set iteration, etc.) | 6.0 |

### H. Production / signing / ops  
**24.0 hrs · $3,000.00**

| Date (approx) | Description | Hrs |
|---|---|---:|
| 2026-07-19 | Vercel env diagnosis (DATABASE_URL, service role, feature flags) | 6.0 |
| 2026-07-19 | Lead page 500 soft-fail (PDF probe) + PG SSL normalize | 8.0 |
| 2026-07-19 | Signing unavailable / pool connectivity debugging | 6.0 |
| 2026-07-19 | Queue gate: live phone/email from contact_point | 4.0 |

### I. Recent hardenings (local + shipped)  
**32.0 hrs · $4,000.00**

| Date (approx) | Description | Hrs |
|---|---|---:|
| 2026-07-19 | Client mailing address on lead + CM matter (EditableAddress) | 6.0 |
| 2026-07-19 | Incident date cannot be future (UI + gate + server) | 3.0 |
| 2026-07-19 | Fee tiers: pre-suit 33.333–40, filed 40–45, appeal locked 50 | 4.0 |
| 2026-07-19–20 | Minors MVP: adult on case, next friend, signer capacity, relationship-to-driver (sql/17) | 16.0 |
| 2026-07-19 | Minor checkbox / DOB precedence bugfix | 3.0 |

### J. Documentation & commercial pack  
**24.0 hrs · $3,000.00**

| Date (approx) | Description | Hrs |
|---|---|---:|
| 2026-07-18–19 | PROJECT_PHASES, workflow briefs, owner audit/brief updates | 10.0 |
| 2026-07-19 | PROJECT_OVERVIEW.md (full system overview) | 8.0 |
| 2026-07-20 | DEVELOPER_COSTING.md + this timesheet | 6.0 |

---

## Invoice block (copy/paste)

```
Tuttle OS — Development services (solo)
Period: through 2026-07-20
Rate: $125.00 / hour
Hours: 412.0
Subtotal: $51,500.00
Tax: — (if applicable)
Total: $51,500.00

Payment terms: Net 15
Less amounts previously paid: $________
Balance due: $________
```

---

## Notes for Michael

1. Hours reflect **delivered MVP value**, reconstructed from shipped features and repo history (esp. 2026-07-18–19 intensives plus foundation).  
2. **Not included:** Phase 7 specialty *actions*, document AI, live calendar OAuth, CasePeer production migrate.  
3. Ongoing work after acceptance: same rate **$125/hr** or monthly retainer (see `docs/DEVELOPER_COSTING.md`).  
4. If you prefer a **fixed MVP fee** instead of T&M, **$51,500** aligns with this timesheet at $125/hr (~412 hrs).

---

## Optional: thinner / thicker versions

| Version | Hours | @ $125 | Use when |
|---|---:|---:|---|
| Lean (AI-assisted discount) | 320 | $40,000 | Relationship / founding price |
| **This sheet (recommended)** | **412** | **$51,500** | Fair solo delivery |
| Full credit (no AI discount) | 480 | $60,000 | If defending against underpricing |

---

*Update this file when logging future days: date · description · hours · running total.*
