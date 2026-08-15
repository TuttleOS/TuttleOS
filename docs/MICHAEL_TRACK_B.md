# Track B — what we need from you (Michael)

**For:** Michael Tuttle  
**From:** Brett / eng  
**Date:** August 15, 2026  
**Where this lives:** preview only — https://tuttle-os-git-role-partition-tuttle-os.vercel.app  
**Not production.** Mark’s CM pilot stays on this URL. We will not merge to `main`.

Reply in this file (check boxes / one line under each). We will not start Track B until you pick.

---

## One-sentence summary

Track A (warnings and the non-engagement-letter lock) is done. Track B is the next slice: **stop a demand package going to Kate with holes**, **capture futures or “no futures”**, and **decide whether the one-click records packet waits until after Mark’s week**.

---

## Where this sits in the whole plan

| Stage | What it is | Status |
|---|---|---|
| 0–2 | Roles, PD integrity, CM / Lit dashboards | Done on preview |
| **3 · CM beta** | Mark on preview, demo data | **Locked — running now** |
| **Track A** | Harden what already exists | **Done** (NEL lock, coverage *warn*, dual-track banner, negotiation side lock) |
| **Track B (this note)** | CM package spine — demand blockers, futures, records packet | **Waiting on you** |
| Later | Kate’s full screens, litigation depth, settlement / disbursement | Not this week |

Track B does **not** rebuild Demand. It uses flags already on the matter. Kate still gets a skeleton until her walkthrough.

---

## What Mark can already see (so you know the starting point)

| On the matter today | What happens if it is incomplete |
|---|---|
| PD **demand blocker** toggle | Visible. Does **not** stop **Create draft demand**. |
| **Level** missing | Visible. Does **not** stop a draft. |
| **Coverage boxes** unanswered | Red banner. Draft still works; it **warns**. |
| Liens screen | Table exists in the database. **No CM screen** to record “screened.” |
| Futures (amount + procedure) | **Nothing.** No field, no gate. |
| Records / bills / §18.001 | Manual requests. **No** one-click packet. **No** 7-day follow-up that respawns. |

So a CM can still draft a demand with PD unresolved, no Level, empty coverage, no futures, and no lien screen. That is the hole Track B is about.

---

## The three items (plain English)

### 1. Demand-ready blockers — “don’t send Kate a hole”

**Risk:** the demand number goes out (or to Kate) with PD still blocking, Level missing, coverage unanswered, or liens never screened.

**What we would build:** the **Create draft demand** button (and later “package to Kate”) **refuses** until the blockers you name are clear. Same Demand card. No new Kate screens.

**We will not invent** which flags refuse vs warn, or who can override.

### 2. Futures — “the number we cannot recover later”

**Risk:** future medicals are a damages element. If the demand goes out without amount + procedure (or an explicit **No futures**), that figure is gone.

**What we would build (if you say capture now):** two fields on the matter — amount and procedure — plus **No futures**, same idea as **No treatment** on coverage. Unanswered would warn or refuse, per your call.

**Or** we document “no futures in the CM beta” and wait.

### 3. One-click records packet + 7-day follow-up

**What “done” looks like in the firm:** on last discharge, one click per provider fires records + custodian affidavit + billing + billing affidavit + §18.001 forms, then a follow-up that **comes back every 7 days** until the document is in the file.

**Today:** types exist; CM still does it by hand. Mark was already told not to expect this in the beta.

**This is the large one.** Easy to defer until after his week.

---

## Decisions (check one per row)

### A. Demand blockers (item 1)

Which of these should **refuse** a demand draft? (Unchecked = warn only, like coverage today.)

- [ ] Unresolved PD (demand-blocker flag on)
- [ ] Level not approved
- [ ] Coverage box with neither a provider nor **No treatment**
- [ ] Liens not screened *(there is no CM screen yet — saying yes means we also need a simple “screened / not yet” control)*

Override:

- [ ] No override — clear the blocker or don’t draft
- [ ] Attorney / you only
- [ ] CM may override with a typed reason (logged)

Which button does the refuse apply to?

- [ ] **Create draft demand** (the button on the matter now)
- [ ] Only a later “send package to Kate” (drafts can still be messy)
- [ ] Both

### B. Futures (item 2)

- [ ] **Capture now** — amount + procedure, plus **No futures**
- [ ] **Document none for the pilot** — Mark knows it is a known gap; we build after his week

If capture now, unanswered futures should:

- [ ] **Refuse** the demand draft
- [ ] **Warn** only (same as coverage today)
- [ ] Block **records clear** as well as the demand *(the original “futures before records clear” rule)*

Who may check **No futures**?

- [ ] CM, after calling the facility
- [ ] Attorney only

### C. Records packet (item 3)

- [ ] **Defer** until after the CM beta *(recommended unless you want this in Mark’s week)*
- [ ] Build a **thin** version now: one click = full packet for **one provider** on last discharge; 7-day follow-up until the document is in file

If build now, the 7-day loop dies when:

- [ ] The document is in the file (system)
- [ ] CM marks received

---

## Our recommendation (you can just say “yes to the recs”)

| Item | Rec |
|---|---|
| Demand blockers | **Refuse** on unresolved PD and missing Level. Coverage **stays warn** until you say otherwise. Liens **wait** until there is a CM screen (don’t refuse on a flag nobody can set). Refuse **Create draft demand**. Override = **you only**. |
| Futures | **Document none for the pilot** unless you want the two fields this week. If you want them, **warn** first, don’t refuse yet. CM may check **No futures** after the facility call. |
| Records packet | **Defer.** Mark already knows. Don’t start a respawn engine during the preview week. |

---

## What we will not do without this reply

- Hard-block demand on coverage (that is still a warn)
- Invent a futures table
- Build the one-click packet / 7-day respawn
- Touch Kate’s Demand Writer screens
- Merge preview to production

---

## How this is not Track A

Track A already shipped on preview:

- Rejected lead cannot close until the non-engagement letter is recorded
- Coverage **warns**; it does not block
- CLIENT STILL TREATING banner (dates do **not** auto-change — that rule is still yours)
- Negotiation offer/counter side lock

Track B is the next spine: **package quality**, not more banners.

---

*Check the boxes or write “yes to the recs.” We build only what you pick, on `role-partition`, then you and Mark can see it on preview.*
