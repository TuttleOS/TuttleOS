# C2 — Native Contingent Fee Contract + E-Sign (Proposal)

**Status:** Proposal for Michael sign-off — **not approved to build yet**  
**Owner brief:** Replaces PandaDock copy-paste for the one-page contingent fee contract  
**Source of truth (body):** Dropbox `CLAUDE FILES/CONTRACT_VERBATIM.md` (screenshots Jul 19, 2026)  
**Call register:** Michael walkthrough **C2** (C3 welcome cadence = later)  
**Prepared:** 2026-07-19 · **Updated:** 2026-07-19 (companion co-sign + decisions)

---

## 0. Decisions already recorded (Brett / product)

| # | Decision | Detail |
|---|---|---|
| D-C2-1 | **Multi-party companions on one document** | Companions share the **same public link** and sign **within the same contract packet**. PDF is **filed only after every required party has signed**. |
| D-C2-2 | **Typo stays for now** | Keep verbatim *“seize to pay expenses”* until Michael explicitly approves a wording change. Do **not** auto-correct in code. |
| D-C2-3 | **Welcome email later** | **C3** (post-signature welcome + reminders) is **out of C2 scope** — park until a later decision. |

Still open for Michael: fee tiers, who may send, TTL/OTP, auto-open matter vs staff click (§10).

---

## 1. Verdict (CTO)

**Yes — we can build this in Tuttle OS**, including shared companion co-sign on one packet.

Recommended placement: **Intake module (Phase 2 extension)**, with durable PDF storage gated like Phase 8 until Supabase Storage + BAA for real client data. Demo / staging can ship earlier with fake leads.

---

## 2. What staff and clients get

| Actor | Capability |
|---|---|
| **Staff** | Compose contract → blanks + fee % → select which companions/parties must sign → send **one** public link (email/SMS/copy) to all parties → track who viewed / who signed |
| **Each client / companion** | Opens the **same URL** (no login) → reads the packet → signs **their** signature block → sees who still needs to sign |
| **System** | Status → `contract_sent` on send. While awaiting signatures: `partially_signed` (or equivalent). **Only when all required signers are done** → generate PDF → file to each related matter/lead → mark package `executed` → communication log |

---

## 3. Companion co-sign model (replaces “one contract per person” for this module)

### Product rule (this proposal)
- **One signing package** per crash / engagement send (typically tied to `incident_group` once matters exist, or to a primary lead + linked companion leads before convert).
- **One public token / link** for that package.
- Document lists all named clients (or repeated signature blocks per party — template layout TBD with Michael).
- Filing is **all-or-nothing on signature completeness**: no final PDF until required signers = complete.

### How this relates to call note D3
Call D3 said each client is their **own matter** legally (no single “lead client”). That still holds:

- Each person still gets (or will get) their **own `client_matter`**.
- The **engagement PDF is shared evidence** of joint/companion signup; after full execution we **file a copy onto every participating matter** (and/or one package doc linked to the incident group + per-matter pointers).
- Conflict / `representation_link` rules still apply to cross-matter sharing of *other* case content; the signed engagement itself is intentionally multi-party.

### Signer roster
Staff picks required signers at compose time (primary + companions). Edge cases for Michael later:

- Minor + next friend (extra signature line)
- Someone drops off before signing (revoke package / new send)
- Adding a late companion after others signed (new package or amendment — v2)

### Staff UI (minimal)
```text
Required signers
 ☑ Rosa Delgado     signed 07/19
 ☑ Alex Reyes       awaiting
 ☐ …
[ Copy public link ]  [ Resend ]
```

---

## 4. Contract blanks → system fields

From `CONTRACT_VERBATIM.md`:

| Blank in template | Source in Tuttle OS | Staff editable at send? |
|---|---|---|
| Client legal name(s) | Primary + companion names on roster | Yes (override) |
| Cause / location (`car accident in ______, Texas`) | Case type + incident city/county | Yes |
| Date of incident (`on or about ______`) | DOI | Yes |
| Fee % before suit | Default **40%** (see §5) | Yes (policy-limited) |
| Fee % after suit filed | Default **45%** | Yes (policy-limited) |
| Fee % on appeal | Default **50%** | Yes (attorney unless locked) |
| Date line | Each signer’s sign timestamp (or package completion date on PDF cover) | System |
| Client signature block(s) | One per required signer on the **same** public page | Client(s) only |
| Firm “By:” line | Optional v2 | Optional |

**Wording:** Verbatim template including *“seize to pay expenses”* until Michael approves a change (**D-C2-2**).

---

## 5. Adjustable commission %

**Yes — staff can adjust % at send/resend.**

Call / Daniel rule: adjustable percentage must **not be visually highlighted** on the client-facing document. Plain contract text only.

### Proposed fee policy (needs Michael OK)

| Tier | Pre-suit | Suit filed | Appeal | Who may pick |
|---|---|---|---|---|
| **Standard** (default) | 40% | 45% | 50% | Any intake/CM |
| **Reduced A** | 35% | 40% | 50% | CM+ / attorney |
| **Reduced B** | 30% | 35% | 50% | Attorney only |
| **Custom** | typed | typed | typed | Attorney only + reason logged |

Fee snapshot is frozen for the package when first sent (or when first signature lands — prefer **freeze at send** so all parties see the same %). Resend with new % = new package / new token; old link expires.

---

## 6. Public link (no login) — security model

1. **One unguessable token** per package (`/sign/[token]`), 128+ bits  
2. **TTL** (e.g. 14 days); after full execution, link becomes read-only receipt or expires  
3. **Minimal PHI** on page (names on roster, DOI, city, fee text) — no medicals  
4. Rate-limit; HTTPS only  
5. OTP optional later — not required for MVP unless Michael insists  
6. Audit per **signer**: viewed_at, signed_at, IP/UA, signature blob hash + document body hash  

Not a full client portal (C4). Multi-signer surface on one token.

---

## 7. PDF filing — only after all parties signed

### Target state
When **last required signer** completes:

1. Render PDF of frozen text + **all** signature blocks + timestamps  
2. File to **each** participating matter (copy or shared storage object + `workflow.document` rows)  
3. Flip package → `executed`; update lead(s) toward `signed`  
4. Staff converts / opens matters as today (or later auto-open — still open)

Until then: show “3 of 4 signed” — **do not** treat as executed for checklist / matter conversion gates that require a signed engagement.

### Engineering options (unchanged)
Prefer **HTML → PDF server-side** for native C2; Storage under Phase 8 path for real clients.

---

## 8. Workflow

```text
Gate OK → Compose (blanks, %, companion roster)
  → Send one public link to all parties → contract_sent
  → Each companion opens same link → signs own block
  → Partially signed… (staff dashboard)
  → Last signature → PDF generated → filed to all matters/leads
  → Staff: Open matter(s) (recommended explicit click)
```

**C3 welcome email:** later (**D-C2-3**) — not triggered in this module for now.

---

## 9. Phased build

### Slice 1 — Compose + preview
Verbatim template, blanks, fee %, companion roster picker, draft save.

### Slice 2 — Shared public multi-sign
Same token; per-signer blocks; progress UI; lead status updates; no PDF until complete.

### Slice 3 — File on full execution
PDF + attach to each matter; wire signature automation.

### Slice 4 — Delivery polish
Email/SMS the shared link; resend; revoke.

### Slice 5 — C3 (parked)
Welcome + HIPAA reminders — **later**.

---

## 10. Gates & compliance

| Gate | Why |
|---|---|
| Michael sign-off on multi-party packet vs separate contracts | Product + ethics posture |
| Demo/staging until BAA | Real names on signed PDF |
| Fee tiers attorney-OK | §5 |
| Phase 8 storage | Durable PDF |
| Intent capture | Agree checkbox + each signature + hashes |

---

## 11. Decisions still needed from Michael

1. **Approve fee tier table** in §5.  
2. **Wording fix “seize”→“cease”** — parked until he approves (not blocking build of verbatim).  
3. **Public link TTL** / OTP for v1?  
4. **After full execution:** staff “Open matter” vs automatic?  
5. **Who may send** contracts?  
6. ~~C3 welcome cadence~~ → **later** (recorded).  
7. **Spanish template** for v1 or later?  
8. **Confirm multi-party same-link design** vs reverting to one-PDF-per-client (call D3 style) — this doc assumes same-link / all-must-sign (**D-C2-1**).

---

## 12. Effort (order-of-magnitude)

| Slice | Rough | Note |
|---|---|---|
| 1 Compose | 2–4 days | + roster UI |
| 2 Multi-sign public | 4–7 days | Slightly more than single-signer |
| 3 PDF + multi-matter file | 3–5 days | Copy to N matters |
| 4 Email/SMS | 2–4 days | Same link to N recipients |
| **MVP 1–3** | **~2–3 weeks** focused | Sign-off + staging |

---

## 13. Recommendation

1. Michael confirms §11 (especially fee tiers + multi-party model).  
2. Build Slice 1–2 with **verbatim** English template (typo retained).  
3. Slice 3 on full execution only.  
4. **No C3** in this workstream.

---

*Proposal only. No production PHI / live client signing until gates clear.*
