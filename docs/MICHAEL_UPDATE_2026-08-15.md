# What we built — preview update for Michael (August 15, 2026)

**For:** Michael Tuttle  
**From:** Brett / eng  
**Where to test:** https://tuttle-os-git-role-partition-tuttle-os.vercel.app  
**Not production.** Do not merge to `main`. Mark’s CM pilot stays on this preview URL.

---

## One-sentence summary

We hardened the preview that Mark is using: dual-track and coverage warnings on the matter, a rejected lead cannot be closed until the non-engagement letter is recorded, and PD/photos behave more like the file. Production is unchanged.

---

## What is live vs what is not

| | Production (`main`) | This preview (`role-partition`) |
|---|---|---|
| Mark’s CM workspace (assigned caseload, queues, matter cards) | No | Yes |
| CLIENT STILL TREATING banner | No | Yes |
| Coverage unanswered banner | No | Yes (warns; does **not** block a demand draft) |
| Rejected lead blocked until NEL recorded | No | Yes |
| Negotiation offer/counter side lock (app + database) | App may vary | Yes on this preview DB |

---

## What we built recently (this week)

1. **CLIENT STILL TREATING** — amber banner on CM and Lit when the file is in litigation and the client is still treating. Does **not** auto-change §18.001 / discovery / plaintiff-depo dates (that rule is still yours to decide).
2. **Coverage boxes** — red banner if a category has neither a provider nor **No treatment**. Create draft demand still works; it warns about surprise ambulance liens.
3. **Non-engagement letter** — a rejected intake lead stays incomplete until NEL is recorded. Soft-delete and skipping out of Rejected are refused until then.
4. **PD / photos** — pending queue is **Unresolved vehicles**; near-miss duplicates (Civic / Civik) are blocked; photos tagged to a vehicle hide when that track is removed; you can remove a wrong photo.
5. **Editable fields** look editable (white), not locked.
6. **Litigation tasks** stay off the CM checklist.

Mark already walked the CM morning list (Needs attention → PD pending → Records pending, assigned-only). This note is for **you** to spot-check the new gates and banners.

---

## How to sign in

| Who | Email | Home |
|---|---|---|
| You | `michael@tuttlelawfirm.com` | `/owner` |
| CM rehearsal | `cm.demo@tuttlelawfirm.com` | `/cases` |
| Intake rehearsal | `intake.demo@tuttlelawfirm.com` | `/intake` |

Demo password: ask Brett (not in this file). Header **role preview** lets you look at CM/Lit without signing out; writes still audit as you.

---

## What to test (about 20 minutes)

Check the box in your reply, or note what failed in plain English.

### A. Owner home (you)

- [ ] Sign in → land on **Firm attention** / owner home.
- [ ] Open a matter you know (Delgado or Okafor).
- [ ] Confirm you still see the firm-wide picture, not only one CM’s list.

### B. Dual-track banner

- [ ] Open **Delgado** or **Okafor** on preview.
- [ ] Amber **CLIENT STILL TREATING** banner sits under **Back to caseload**.
- [ ] Wording is acceptable on both the CM view and the Lit view (use the switcher or role preview).

### C. Coverage boxes

- [ ] On a matter with empty coverage boxes, a red **Coverage boxes unanswered** banner appears.
- [ ] **Open coverage boxes** jumps to the nine categories.
- [ ] **Create draft demand** still works and shows a warning (it should **not** be blocked).

### D. Intake — reject + non-engagement letter

Sign in as `intake.demo@tuttlelawfirm.com` (or use Intake from your account if you have it).

- [ ] New lead → **Reject lead**.
- [ ] Red banner: non-engagement letter not yet sent.
- [ ] Intake home **NEL due** tile counts this lead.
- [ ] **Record non-engagement letter sent** clears the banner.
- [ ] Until NEL is recorded, the lead cannot be deleted (attorney/admin delete is hidden or refused).

### E. Property damage (optional, if you have 5 minutes)

As CM demo or role-preview as CM:

- [ ] PD pending queue says **Unresolved vehicles**, not a vague “PD pending.”
- [ ] Adding a second car with the same year / make / model is blocked; a different car still saves.

---

## Do not expect yet (known, not bugs)

- One-click records + bills + §18.001 packet
- Futures amount / procedure on the demand
- Kate’s full Demand Writer screens (`/demands` is a skeleton)
- Liens / disbursement finance UI
- File-suit memo / suit authorization
- Auto CM rotation / Spanish routing
- Merge to production

If Mark or you hit one of these, it is a known gap, not a regression.

---

## Decisions still sitting with you

Not needed to finish this preview week. Needed before we invent more workflow:

- Minor / parent matter structure (F-01) — **locked 2026-08-15:** parent signs the child’s contract and acts for them; not automatically their own client
- Conflict-waiver workflow (F-04)
- Contract variants EN/ES × standard / minor / WD (F-05)
- Dual-track **calendaring** rule (banner is live; dates do not auto-change)
- Whether unanswered coverage should **block** a demand (today it only warns)
- Later: “CMs may use prod” — that is the merge gate, not this week

---

## What we will not start without asking

Track B (demand-package refuse, futures schema, one-click records packet). Kate’s screens. Litigation depth. Settlement / disbursement.

---

*Failed step or wrong wording → reply in plain English. We fix on `role-partition` before any talk of production.*

**Related:** `docs/CM_BETA_RUNBOOK.md` (Mark’s known gaps) · `docs/ROLE_TEST_ACCOUNTS.md` (demo logins)
