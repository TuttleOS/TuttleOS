# Tuttle OS — Developer Costing Guide (Solo Builder)

**Purpose:** Internal pricing reference for charging Michael Tuttle / Crash Guy for Tuttle OS work.  
**Builder model:** Single developer (“vibe coder” / solo product+engineering) — **not** agency rates.  
**Date:** 2026-07-20  
**Repo:** https://github.com/TuttleOS/TuttleOS  

---

## 1. Positioning (how to talk about price)

You are **not** billing for:
- Account managers, design squads, or weekly status theater  
- A CasePeer-style monthly seat license  

You **are** billing for:
- Working, firm-owned software in production  
- Postgres schema + RLS (the hard part)  
- Intake → matter path, e-sign, documents, owner oversight  
- One person who can keep shipping  

**Compare to:** “Hire one strong full-stack + legal-ops builder for N months.”  
**Do not compare to:** Agency SOWs at $175–$250/hr or six-figure “platform” quotes unless Michael asks for that tier.

---

## 2. What’s in the build (cost basis)

### Shipped / live MVP
| Area | Notes |
|---|---|
| Phase 0–1 | Database (12 schemas), auth, AppShell, search, theme |
| Phase 2 | Intake queue, new lead, gate, companions, SOL preview |
| Phase 3 | Case Manager caseload + Focus cards (coverage, PD, records, demand/negotiate) |
| Phase 4 | Litigation caseload, Deadline Horizon, matter Focus |
| Phase 5 | Owner stalled / Approvals / SOL Watch |
| Phase 6 | CM ↔ Lit workspace switcher |
| C2 | Contingent-fee e-sign (`/sign/[token]`), multi-signer, firm countersign |
| Phase 8 | Case documents (storage-only; no AI) |
| Hardening | Mailing address, queue phone gate, fee tiers, minors/next-friend, DOI max, prod DB/signing ops |

### Explicitly *not* in MVP price (change orders / later)
| Area | Status |
|---|---|
| Phase 7 Demand / Liens / Review **actions** | Skeleton only |
| Document AI / OCR | Deferred by owner |
| Live Outlook / Google calendar | Scaffold / dry-run only |
| CasePeer production CSV load | Scaffold; owner-run later |
| Full lit pizza tracker / discovery machine | Later |
| Firm Settings page, RingCentral | Not built |

---

## 3. Recommended solo rates

| Mode | Solo rate | Notes |
|---|---|---|
| Hourly (T&M) | **$90–$110/hr** (anchor **$100/hr**) | Ceiling ~$125 if urgent/prod-only |
| Light retainer | **$2,000–$3,500/mo** | ~15–25 hrs |
| Active product retainer | **$4,000–$6,000/mo** | ~30–45 hrs |
| Small UX tweak | **$250–$750** flat | Change order |
| Medium feature (1–3 days) | **$1,500–$4,000** | Estimate first |
| Emergency / same-day prod | **1.5× hourly** | State in writing |

Agency bands ($175–$250/hr, $125k+ fixed) are **out of scope** for this guide unless Michael wants an agency-style engagement.

---

## 4. Fixed fee for work already delivered

### Single number (pick one stance)

| Stance | Fixed fee (USD) | When to use |
|---|---|---|
| **Relationship / founding partner** | **$35,000** | Early trust, prior informal work, want continuity |
| **Fair solo market (recommended)** | **$55,000** | Default ask for MVP as shipped |
| **Sticky / high dependency** | **$70,000** | Firm already runs daily on it; you’d otherwise stop |

**Include with fixed fee:** short hypercare (2–4 weeks bugfix + deploy help).  
**Exclude:** Phase 7 actions, AI, live calendar, CasePeer production migrate, BAAs, hosting.

If money was already paid along the way, quote **remaining balance toward a $45k–$55k total**, not a brand-new stack of fees.

---

## 5. Milestone map (solo) — for itemized invoices

Use midpoints when summing; adjust ±20% for depth.

| Milestone | Solo fee range |
|---|---|
| Phase 0–1 — Database + auth/shell | $4,000–$8,000 |
| Phase 2 — Intake | $4,000–$7,000 |
| Phase 3 — Case Manager | $8,000–$14,000 |
| Phase 4 — Litigation MVP | $5,000–$9,000 |
| Phase 5 — Owner dashboard | $3,000–$6,000 |
| Phase 6 — Cross-workspace switcher | $2,000–$4,000 |
| C2 — Contingent fee e-sign | $6,000–$12,000 |
| Phase 8 — Documents (storage-only) | $3,000–$6,000 |
| Minors / next-friend / gate & prod hardenings | $2,000–$5,000 |
| **Typical MVP sum (midpoints)** | **≈ $50,000–$55,000** |

---

## 6. Ongoing / roadmap pricing

| Workstream | Suggested | Model |
|---|---|---|
| Bug fix + small polish | Retainer **$2.5k–$3.5k/mo** or **$100/hr** | After MVP |
| Phase 7 specialty actions | **$8k–$18k** fixed *or* retainer | After screen sign-off |
| CasePeer production load | **$5k–$12k** + owner ops | After BAA |
| Live calendar sync | **$4k–$10k** | When owner reopens |
| Document AI / OCR | Separate SOW; do not bundle | Owner-gated |

---

## 7. Suggested quote language (copy/paste)

> **Tuttle OS — MVP delivery (solo build)**  
> Custom staff practice OS for Crash Guy / Tuttle Law: intake through case management and litigation MVP, owner oversight, contingent-fee e-sign, case document storage, multi-client crash linking, and minor/next-friend intake — built on Next.js + Supabase with RLS and audit posture.  
>  
> **Fee:** **$55,000** (fixed)  
> **Includes:** delivered MVP as of [date], 2–4 weeks bug-fix hypercare, assistance deploying to Vercel/Supabase.  
> **Excludes:** Phase 7 specialty workflow actions, AI document review, live calendar OAuth, CasePeer production migration, third-party BAAs, hosting fees.  
> **Ongoing (optional):** **$3,000/month** retainer **or** **$100/hour** T&M for roadmap work.  
> **Payment:** 40% on MVP acceptance · 40% on production readiness · 20% at end of hypercare  
> *(Or net-15 invoices if already live — remaining balance only.)*

**Shorter verbal ask:**

> “I’m pricing this as a solo build, not an agency. For the working system you have now — intake through CM/lit, e-sign, documents, minors — my fixed fee is **$55k**, with a short hypercare window. New roadmap items are **$3k/mo** or **$100/hr**.”

---

## 8. What Michael still pays separately (not your build fee)

- Supabase BAA, MFA / password manager policy  
- Domain, Vercel, email/SMS vendors  
- Attorney review of contract wording  
- Hosting / usage (typically firm card; often ~$50–$300+/mo)  
- CasePeer CSV ownership and migrate go/no-go  

Ops support can be retainer; don’t include forever for free.

---

## 9. Change-order rule

Anything not on the signed MVP list is a **change order**:
1. One-paragraph scope  
2. Fixed estimate or hours cap  
3. 50% deposit on larger items  
4. Written “yes” from Michael before work  

---

## 10. Floor (don’t go below)

For this much shipped product, **below ~$25,000 total** usually means subsidizing the firm.  
If the relationship requires a discount, discount **hypercare or retainer**, not the entire MVP to a token amount.

---

## 11. Quick reference card

| Decision | Number |
|---|---|
| Default fixed MVP ask | **$55,000** |
| Soft relationship ask | **$35,000** |
| High-dependency ask | **$70,000** |
| Hourly | **$100/hr** |
| Light retainer | **$2,500–$3,500/mo** |
| Active retainer | **$4,000–$6,000/mo** |

---

*Internal guide — adjust for any amounts already paid. Update when a major phase ships or a written SOW is signed.*
