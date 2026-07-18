# ChatGPT Design Prompt — Tuttle OS UX/UI

Copy everything inside the box below into ChatGPT (or GPT-4o / o-series with vision). Attach screenshots of the existing HTML mockups if you have them. Ask for Figma-ready specs, or “generate UI mockup images,” depending on the model.

---

## PROMPT (copy from here)

```
You are a senior product designer specializing in modern professional legal-tech and practice-management software (think Clio / Filevine / CasePeer quality, but cleaner and more focused).

Design the UX/UI visual system and key screens for **Tuttle OS** — the internal practice-management web app for **Tuttle Law Firm (d/b/a Crash Guy Injury Attorneys)**, a Texas personal-injury firm in San Antonio. This is a STAFF tool (attorneys, case managers, litigation paralegals, intake), NOT a consumer marketing site.

# Product context
- Stack will be Next.js + Tailwind; design must be implementable with CSS design tokens.
- The database already enforces security (RLS). UI shows locked areas with a lock icon + tooltip naming the access tier; UI never invents permissions.
- Workspaces by role: Intake · Case Manager · Litigation Paralegal · Owner/Attorney · (later: Demand Writer, Liens, Senior Review).
- One app shell; role routing after login.

# Design goal
Modern, calm, professional, high-trust. Dense enough for power users who live in the system all day, but not cluttered. Act-first, reference-on-demand. Feels like a premium San Antonio PI firm tool — serious, sharp, confident — not startup purple SaaS, not cartoonish “Crash Guy,” not newspaper/broadsheet legal cliché.

# Visual direction (required)
Propose ONE primary light theme inspired by “Parchment” (warm off-white workspace, clean surfaces, restrained blue accent) PLUS a dark “Midnight” companion theme using the SAME token names.

Use this token structure (exact names). Refine hex values if needed for contrast/AA, but keep the spirit:

Light / Parchment baseline:
--page: #f4f3f0
--surface: #ffffff
--ink: #1f2328
--muted: #6d7178
--grid: #e3e1dc
--accent: #3b82c4
--accent-dk: #1c5cab
--accent-lt: #e3eefa
--sidebar: #ffffff
--sidebar-ink: #1f2328
--top: #ffffff
--top-ink: #1f2328

Dark / Midnight baseline:
--page: #14171c
--surface: #1d2128
--ink: #e6e8ec
--muted: #9aa0aa
--grid: #2c313a
--accent: #5b9bd9
--accent-dk: #8bbcec
--accent-lt: #24344a
--sidebar: #1a1e25
--sidebar-ink: #dfe3e9
--top: #1a1e25
--top-ink: #eceef2

Typography:
- UI/body: modern professional sans (NOT Inter/Roboto as the hero story — prefer something like Source Sans 3, IBM Plex Sans, or Geist). Specify font names and sizes.
- Optional display for brand wordmark only: restrained; do not make the whole app serif/newspaper.
- Base UI ~14px; tight but readable; tabular numbers for dates/money.

Status semantics (theme-invariant — NEVER color alone; always icon + label):
- Red = jurisdictional / overdue / missable (JX)
- Amber = watch / caution
- Green = done / clear
- Blue = court-order / informational

# Hard UX rules (must show in mockups)
0. Sticky GLOBAL SEARCH on every screen (top bar). Autocomplete clients with DOI (crash date) for disambiguation: “Last, First — Mon d, yyyy”. Enter without selection → full results page grouped by category.
1. Every case name is a hyperlink.
2. Case header always shows: phone, email (+ copy), DOB + age, assigned CM + Paralegal (missing = red UNASSIGNED — flag, never block).
3. Focus view by default on case pages: “Needs you now” strip, then cards collapsed to one-line headers; hot cards auto-open; “Full view” toggle.
4. No dead-end status: every status badge/chip/timeline node is clickable → scrolls/expands target (flash highlight).
5. Every displayed date includes day, month, AND year: “Jul 14, 2026”; timestamps “Jul 14, 2026, 3:15 PM”.
6. Completed work rolls up (“show N completed”); screen space for what’s LEFT.
7. Prominent “Client called — create follow-up” on every case header.
8. My Tasks + My Activity exist for every role.
9. Locked nav items: lock icon + tooltip (e.g. “Restricted — finance tier”).
10. Companion cases: badge “N of M · same crash” + companion strip when relevant.
11. ATTORNEY-VERIFY flag must be visually sacred on rule-computed legal dates (never look “final/official” without it).

# Anti-patterns (do NOT design)
- Purple-to-indigo gradient SaaS look
- Generic cream + terracotta “AI luxury” look
- Broadsheet / hairline newspaper legal layout
- Dashboard soup on every page (stats strips, pill clusters, floating badges on heroes)
- Cards-for-everything; cards only when they contain interaction/sections
- Color-only status
- Year-less dates
- Dark mode as the only option
- Consumer marketing landing-page energy inside the app
- Emoji decoration as primary UI (subtle status icons OK; don’t candy-coat)

# Layout system
- App shell: sticky top bar (brand + workspace identity + global search + user) + left nav (role workspace) + main content.
- Density: comfortable-compact (legal ops). 8px spacing scale.
- Radius: subtle (6–10px), not bubbly.
- Borders: 1px --grid; shadows minimal or none.
- Tables for queues; progressive disclosure for case detail.
- Forms live inline WHERE work happens (e.g. log call on provider row), not generic “Edit record” pages.

# Screens to design (deliver all)
1. Login (email + MFA step) — calm, trustworthy, brand wordmark “Tuttle OS” with Crash Guy Injury Attorneys as secondary.
2. Case Manager — My Caseload (queue/table).
3. Case Manager — Case page in FOCUS view (hero header + Needs you now + collapsed sections).
4. Intake — New Lead form with six-minimums gate (structured name; US/MX phone).
5. Litigation Paralegal — work queue tabs + case timeline (“pizza tracker” 17-node stage tree concept — modernize visually without losing scannability).
6. Owner dashboard — stalled cases / SOL watch / approvals (executive, not noisy).
7. Global search dropdown + Search results page (grouped categories).
8. Component sheet: buttons, inputs, badges (JX/watch/done/court), empty states, locked nav, UNASSIGNED, ATTORNEY-VERIFY, toast/callout, Focus/Full toggle.

# Deliverables format
For each screen:
A) One-sentence purpose
B) Layout wire description (regions)
C) Visual mockup (generate images if you can) OR detailed Figma-style frame description
D) Token usage notes (which surfaces/accents)
E) Interaction notes for the hard UX rules above
F) Mobile/responsive note (this is primarily desktop 1280–1440; tablet OK; phone is secondary)

Also deliver:
- A 1-page Design System summary (color, type, spacing, status, elevation)
- CSS :root token block for light + [data-theme="midnight"] dark
- Do / Don’t examples (3 each)

# Fictional sample data (use these names)
- Delgado, Rosa — DOI Jul 2, 2025
- Okafor, Chinedu — DOI Mar 18, 2026
- Ibarra, Marisol — DOI Nov 9, 2025
CM: Christina · Paralegal: Daniel · Attorney: Michael

Start with the Design System summary + Case Manager case page (Focus view), then the other screens.
```

## End of prompt

---

## How to use it well

1. Paste the prompt into ChatGPT.
2. Optionally attach: `mockups/case-manager-workspace-mockup.html` screenshots, `theme-preview-mockup.html`, firm logo if you have Crash Guy brand assets.
3. Follow-ups that work:
   - “Refine the Focus view case page — less chrome, stronger Needs-you-now hierarchy.”
   - “Generate a Figma component inventory as a checklist.”
   - “Show the same Case page in Midnight theme.”
   - “Design only the litigation pizza-tracker timeline, desktop 1440px.”
4. When Michael supplies exact Crash Guy brand reds/fonts, add one line:  
   `Brand accent override: primary #______ ; display font ______ . Keep token names; swap values only.`

## Note for implementation later

Whatever ChatGPT returns must still map to **one theme file of CSS variables** (MASTER_PROMPT rule). Treat ChatGPT output as visual exploration; `docs/ui-design-decisions.md` still wins on behavior.
