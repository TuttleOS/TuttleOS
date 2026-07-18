# Tuttle OS — UX/UI Handoff from ChatGPT

## 1. Design system (1 page)

### Color tokens

#### Light theme — Parchment

| Token | Value | Use |
|---|---:|---|
| `--page` | `#F4F3F0` | App canvas |
| `--surface` | `#FFFFFF` | Tables, panels, dialogs |
| `--ink` | `#1F2933` | Primary text |
| `--muted` | `#69727D` | Secondary text |
| `--grid` | `#DDDCD7` | Borders, separators |
| `--accent` | `#3E7DB8` | Primary actions, links |
| `--accent-dk` | `#255F98` | Hover/active accent |
| `--accent-lt` | `#E7F0F8` | Accent backgrounds |
| `--sidebar` | `#182331` | Left navigation |
| `--sidebar-ink` | `#E7EDF4` | Sidebar text/icons |
| `--top` | `#FFFFFF` | Sticky top bar |
| `--top-ink` | `#1F2933` | Top bar content |
| `--danger` | `#C73943` | JX, overdue, blocking |
| `--danger-bg` | `#FDECEE` | Danger badge/callout |
| `--warning` | `#A66213` | Watch, caution |
| `--warning-bg` | `#FFF4DF` | Warning badge/callout |
| `--success` | `#287A56` | Done, clear |
| `--success-bg` | `#E7F5EE` | Success badge/callout |

Blue informational states use `--accent` and `--accent-lt`.

#### Dark theme — Midnight

| Token | Value | Use |
|---|---:|---|
| `--page` | `#11161D` | App canvas |
| `--surface` | `#1A212A` | Tables, panels, dialogs |
| `--ink` | `#E7EBF0` | Primary text |
| `--muted` | `#9AA4AF` | Secondary text |
| `--grid` | `#303946` | Borders, separators |
| `--accent` | `#6EA6D8` | Primary actions, links |
| `--accent-dk` | `#93BDE3` | Hover/active accent |
| `--accent-lt` | `#20354A` | Accent backgrounds |
| `--sidebar` | `#0D131A` | Left navigation |
| `--sidebar-ink` | `#DCE4EC` | Sidebar text/icons |
| `--top` | `#151C24` | Sticky top bar |
| `--top-ink` | `#EFF3F7` | Top bar content |
| `--danger` | `#F07178` | JX, overdue, blocking |
| `--danger-bg` | `#42252A` | Danger badge/callout |
| `--warning` | `#E3AC57` | Watch, caution |
| `--warning-bg` | `#3C3020` | Warning badge/callout |
| `--success` | `#65BA8E` | Done, clear |
| `--success-bg` | `#20382F` | Success badge/callout |

### Typography

Primary UI font:

```css
font-family: "Source Sans 3", "Segoe UI", sans-serif;
```

Brand wordmark only:

```css
font-family: "IBM Plex Serif", Georgia, serif;
```

Do not use the serif face for screen headings, tables, forms, or navigation.

| Role | Size / line-height | Weight |
|---|---:|---:|
| Display | `32px / 40px` | 650 |
| Page title | `24px / 32px` | 650 |
| Section title | `18px / 24px` | 650 |
| Card/table title | `16px / 22px` | 600 |
| Body | `14px / 20px` | 400 |
| Body strong | `14px / 20px` | 600 |
| Small | `13px / 18px` | 400 |
| Caption | `12px / 16px` | 500 |
| Overline | `11px / 14px` | 650, uppercase, `0.08em` tracking |

Dates, money, phone numbers, statutes, and task counts:

```css
font-variant-numeric: tabular-nums;
```

### Spacing, radius, borders, elevation

Use an 8px spacing system:

```text
4px only for icon/label micro-spacing
8px  = xs
16px = sm
24px = md
32px = lg
48px = xl
64px = 2xl
```

Radius:

- Inputs, buttons, badges: `6px`
- Panels, tables, dialogs: `8px`
- Large modal/drawer: `10px`
- Avoid pill shapes except compact status chips and segmented controls.

Borders:

```css
border: 1px solid var(--grid);
```

Use borders before shadows.

Elevation:

```css
--shadow-1: 0 1px 2px rgba(16, 24, 40, 0.06);
--shadow-2: 0 8px 24px rgba(16, 24, 40, 0.10);
```

Use `--shadow-1` for floating search results and sticky headers. Use `--shadow-2` only for dialogs, drawers, and command palettes.

### Status badge recipes

All statuses require icon + visible label.

#### JX / overdue

```text
Icon: CircleAlert or Scale
Text: JX, Overdue, Filing deadline
Text color: --danger
Background: --danger-bg
Border: color-mix(in srgb, var(--danger) 35%, transparent)
```

Example:

```tsx
<Badge icon={CircleAlert}>JX · Verify</Badge>
```

#### Watch / caution

```text
Icon: TriangleAlert
Text color: --warning
Background: --warning-bg
```

#### Done / clear

```text
Icon: CircleCheck
Text color: --success
Background: --success-bg
```

#### Court / information

```text
Icon: Landmark, Info, or Gavel
Text color: --accent-dk
Background: --accent-lt
```

#### ATTORNEY-VERIFY

This is not a normal status.

- Always uppercase.
- Use `ShieldAlert`.
- Danger outline with neutral surface.
- Never present a rule-computed legal date as final without this label.
- Keep it visually adjacent to the computed date.

#### UNASSIGNED

- Use `UserRoundX`.
- Danger text and border.
- Label must read `UNASSIGNED`.
- Flag the missing assignment but do not block unrelated work.

### Do

1. Use tables and aligned rows for operational queues.
2. Put the next required action and urgency before historical reference data.
3. Keep interactive forms inline where staff are already working.

### Don’t

1. Do not place every metric, field, or section inside a separate card.
2. Do not use color without an icon and visible text label.
3. Do not hide years from dates or use relative-only labels such as “next Tuesday.”

---

## 2. CSS token blocks

```css
:root {
  color-scheme: light;

  --page: #f4f3f0;
  --surface: #ffffff;
  --ink: #1f2933;
  --muted: #69727d;
  --grid: #dddcd7;

  --accent: #3e7db8;
  --accent-dk: #255f98;
  --accent-lt: #e7f0f8;

  --sidebar: #182331;
  --sidebar-ink: #e7edf4;
  --top: #ffffff;
  --top-ink: #1f2933;

  --danger: #c73943;
  --danger-bg: #fdecee;
  --warning: #a66213;
  --warning-bg: #fff4df;
  --success: #287a56;
  --success-bg: #e7f5ee;

  --font-ui: "Source Sans 3", "Segoe UI", sans-serif;
  --font-brand: "IBM Plex Serif", Georgia, serif;

  --radius-control: 6px;
  --radius-panel: 8px;
  --radius-dialog: 10px;

  --shadow-1: 0 1px 2px rgba(16, 24, 40, 0.06);
  --shadow-2: 0 8px 24px rgba(16, 24, 40, 0.1);
}

[data-theme="midnight"] {
  color-scheme: dark;

  --page: #11161d;
  --surface: #1a212a;
  --ink: #e7ebf0;
  --muted: #9aa4af;
  --grid: #303946;

  --accent: #6ea6d8;
  --accent-dk: #93bde3;
  --accent-lt: #20354a;

  --sidebar: #0d131a;
  --sidebar-ink: #dce4ec;
  --top: #151c24;
  --top-ink: #eff3f7;

  --danger: #f07178;
  --danger-bg: #42252a;
  --warning: #e3ac57;
  --warning-bg: #3c3020;
  --success: #65ba8e;
  --success-bg: #20382f;

  --shadow-1: 0 1px 2px rgba(0, 0, 0, 0.28);
  --shadow-2: 0 12px 28px rgba(0, 0, 0, 0.36);
}
```

Recommended Tailwind mapping:

```ts
// tailwind.config.ts
extend: {
  colors: {
    page: "var(--page)",
    surface: "var(--surface)",
    ink: "var(--ink)",
    muted: "var(--muted)",
    grid: "var(--grid)",
    accent: "var(--accent)",
    "accent-dk": "var(--accent-dk)",
    "accent-lt": "var(--accent-lt)",
    sidebar: "var(--sidebar)",
    "sidebar-ink": "var(--sidebar-ink)",
    top: "var(--top)",
    "top-ink": "var(--top-ink)",
    danger: "var(--danger)",
    "danger-bg": "var(--danger-bg)",
    warning: "var(--warning)",
    "warning-bg": "var(--warning-bg)",
    success: "var(--success)",
    "success-bg": "var(--success-bg)",
  },
  fontFamily: {
    sans: ["Source Sans 3", "Segoe UI", "sans-serif"],
    brand: ["IBM Plex Serif", "Georgia", "serif"],
  },
}
```

---

## 3. Screen specs

### 3.1 Owner — Firm attention dashboard

#### A) Purpose

Give Michael a firm-wide view of matters requiring intervention, approval, reassignment, or deadline review.

#### B) Layout regions

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Top bar: Tuttle OS | Workspace | Global search | User              │
├──────────────┬──────────────────────────────────────────────────────┤
│ Left nav     │ Page header                                          │
│              │ Firm attention                  [Date range/filter]   │
│ Owner        ├──────────────────────────────────────────────────────┤
│ Intake       │ Needs you now                                        │
│ Case Mgmt    │ [JX review] [Stalled case] [Approval] [Unassigned]   │
│ Litigation   ├──────────────────────────────────────────────────────┤
│ Queues       │ Attention table                                      │
│              │ Case | Area | Issue | Owner | Age | Next action      │
│ Walkthrough  ├──────────────────────────────────────────────────────┤
│              │ Secondary right rail                                 │
│              │ Approval queue / Firm health summary                 │
└──────────────┴──────────────────────────────────────────────────────┘
```

#### C) Components and Tailwind-style intent

Page container:

```text
min-h-screen bg-page text-ink
```

Header:

```text
flex items-start justify-between gap-6 px-8 pt-8 pb-6
```

Title:

```text
text-2xl leading-8 font-semibold
```

Needs-you-now strip:

```text
border-y border-grid bg-surface
grid grid-cols-4 divide-x divide-grid
```

Each attention item:

```text
group min-h-32 p-5 hover:bg-accent-lt/40
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
```

Do not make these floating cards. They should feel like a single operational strip.

Attention table:

```text
overflow-hidden rounded-lg border border-grid bg-surface
```

Table header:

```text
bg-page/70 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted
```

Rows:

```text
border-t border-grid hover:bg-accent-lt/30
```

Case link:

```text
font-semibold text-accent-dk hover:underline
```

Right rail:

```text
w-[320px] shrink-0 space-y-4
```

#### D) Interaction notes

- Clicking an attention item opens the target case or queue row.
- JX dates show `ATTORNEY-VERIFY` adjacent to the date.
- Clicking a status opens or expands the exact record that generated the status.
- Table filters persist in URL query parameters.
- Completed or cleared items leave the active table and appear under `Show cleared`.
- Empty state: `No firm-wide items require attention` with a secondary link to all active cases.
- The owner view must not default to Christina’s personal caseload.
- Firm health values should be simple counts, not a wall of KPI cards.

#### E) What not to change

- Do not turn this into a personal “My Day.”
- Do not add financial reporting where the current product lacks finance data.
- Do not invent automated legal conclusions.
- Do not mark computed legal dates as verified without attorney action.
- Do not expose records blocked by RLS.

#### F) Responsive

Desktop primary at 1440px.

At 1024–1279px:

- Collapse right rail below the table.
- Needs-you-now becomes two columns.
- Keep the full left navigation.

Below 768px:

- Navigation becomes a drawer.
- Attention items stack.
- Tables become horizontally scrollable rather than converting all data into cards.

---

### 3.2 Case Manager — Case Focus view

#### A) Purpose

Show the case manager exactly what needs action now while keeping the complete matter record available through progressive disclosure.

#### B) Layout regions

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Sticky case header                                                  │
│ Delgado, Rosa | same-crash badge             [Focus / Full]         │
│ Phone | email copy | DOB + age | CM | PL | Atty                    │
│ [Client called — create follow-up]                                  │
├─────────────────────────────────────────────────────────────────────┤
│ Needs you now                                                       │
│ JX filing date | records follow-up | lien review | client call      │
├─────────────────────────────────────────────────────────────────────┤
│ Case sections                                                       │
│ > Coverage                                                     3/4  │
│ > Property damage                                              Open  │
│ > Medical records                                     2 outstanding  │
│ > Demand                                                     Pending  │
│ > Insurance                                               Confirmed  │
│ > Show 8 completed                                                v  │
└─────────────────────────────────────────────────────────────────────┘
```

#### C) Components and Tailwind-style intent

Sticky case header:

```text
sticky top-16 z-20 border-b border-grid bg-page/95 backdrop-blur
```

Header main row:

```text
flex flex-wrap items-start justify-between gap-5 px-8 py-5
```

Identity block:

```text
min-w-0 flex-1
```

Case name:

```text
text-2xl font-semibold text-ink
```

Contact metadata:

```text
mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted
```

Assignment fields:

```text
inline-flex items-center gap-1.5
```

Missing assignment:

```text
border border-danger/40 bg-danger-bg px-2 py-1 text-xs font-semibold text-danger
```

Client follow-up button:

```text
inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4
font-semibold text-white hover:bg-accent-dk
```

Needs-you-now:

```text
mx-8 mt-6 overflow-hidden rounded-lg border border-grid bg-surface
```

Items:

```text
grid grid-cols-4 divide-x divide-grid
```

Collapsed section rows:

```text
flex min-h-14 w-full items-center justify-between border-b border-grid
px-4 text-left hover:bg-accent-lt/30
```

Expanded section:

```text
border-b border-grid bg-surface
```

Inline action form:

```text
grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-grid p-4
```

#### D) Interaction notes

- Focus View is the default.
- Hot sections auto-open only when they contain a currently actionable item.
- Full View opens all case sections but does not alter saved case data.
- Every status chip scrolls to and expands its source section.
- After scrolling, apply a 1.5-second highlight ring to the target record.
- Completed rows collapse under `Show N completed`.
- `Client called — create follow-up` opens a compact drawer or inline form with:
  - call timestamp,
  - summary,
  - owner,
  - due date,
  - save task.
- Email and phone have copy actions.
- Every date includes the year.
- Same-crash companion matters appear in a narrow companion strip under the header.
- Empty section state should state what has not been added, with one relevant action.

#### E) What not to change

- Do not block work because CM, PL, or attorney is unassigned.
- Do not replace missing staff with inferred names.
- Do not remove the permanent case contact details from the header.
- Do not turn Focus View into a summary-only page that hides editing.
- Do not add AI-generated summaries.
- Do not add DocuSign controls.

#### F) Responsive

At 1440px, content width may reach 1280px.

At 1024px:

- Needs-you-now becomes two columns.
- Assignment metadata moves to a second header row.

Below 768px:

- Sticky header becomes compact.
- Contact information moves to an expandable `Case details` area.
- Needs-you-now stacks.
- Section rows remain full-width and touch-friendly.

---

### 3.3 Login and MFA

#### A) Purpose

Provide a calm, secure staff entry point without consumer marketing language.

#### B) Layout regions

```text
┌──────────────────────────────────────────────────────────────┐
│ Left: restrained firm identity                               │
│ Tuttle OS                                                    │
│ Crash Guy Injury Attorneys                                   │
│                                                              │
│ Right: sign-in panel                                         │
│ Email                                                        │
│ Password                                                     │
│ [Sign in]                                                    │
│                                                              │
│ MFA step: six-digit code                                     │
└──────────────────────────────────────────────────────────────┘
```

#### C) Components

Canvas:

```text
min-h-screen bg-page
```

Two-column shell:

```text
grid min-h-screen lg:grid-cols-[minmax(320px,42%)_1fr]
```

Brand panel:

```text
hidden border-r border-grid bg-sidebar p-12 text-sidebar-ink lg:flex
```

Form panel:

```text
flex items-center justify-center p-6
```

Form container:

```text
w-full max-w-[420px]
```

Inputs:

```text
h-11 w-full rounded-md border border-grid bg-surface px-3
text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20
```

MFA code:

```text
grid grid-cols-6 gap-2
```

#### D) Interaction notes

- Enter submits.
- MFA fields auto-advance and support paste.
- Show plain-language error messages.
- Preserve email when moving from password to MFA.
- Lockout/error state must not reveal whether an account exists.
- Use standard Supabase auth behaviour already present.

#### E) What not to change

- Do not add consumer lead capture.
- Do not add social login unless already supported.
- Do not imply permissions before RLS evaluates the session.
- Do not include case statistics on login.

#### F) Responsive

Single-column form on phone and tablet. Hide the brand panel below `lg`.

---

### 3.4 Owner — firm-wide left navigation

#### A) Purpose

Give authorised staff a stable, grouped map of all operational workspaces.

#### B) Layout regions

```text
Tuttle OS
Current workspace

OWNER
- Firm attention
- Approvals
- Reports

INTAKE
- Lead queue
- New lead

CASE MANAGEMENT
- Caseload
- Tasks
- Activity

LITIGATION
- Lit caseload
- Court dates

QUEUES
- Demand
- Liens
- Review

FIRM
- Documents
- Settings [locked where applicable]

Walkthrough callout
User profile
```

#### C) Components

Sidebar:

```text
fixed inset-y-0 left-0 z-40 w-64 bg-sidebar text-sidebar-ink
```

Group label:

```text
px-3 pt-5 pb-2 text-[11px] font-semibold uppercase
tracking-[0.08em] text-sidebar-ink/55
```

Nav item:

```text
mx-2 flex h-9 items-center gap-3 rounded-md px-3 text-sm
hover:bg-white/7
```

Active:

```text
bg-white/10 font-semibold text-white
before:absolute before:left-0 before:h-5 before:w-0.5 before:bg-accent
```

Locked:

```text
opacity-60 cursor-default
```

Walkthrough callout:

```text
mx-3 mt-5 border border-white/12 bg-white/5 p-3
```

#### D) Interaction notes

- Group sections remain expanded by default.
- Locked items show `Lock` and a tooltip such as `Restricted — finance tier`.
- Do not disable visible routes by pretending the UI knows more than RLS.
- On route denial, show an authorised-access error page rather than an empty screen.
- Walkthrough callout dismisses per user.
- Workspace identity appears beneath the logo, not as a large dashboard heading.

#### E) What not to change

- Do not merge all role workspaces into one flat list.
- Do not hide locked areas without product approval.
- Do not add unread counters to every link.
- Do not use bright accent fills for inactive navigation.

#### F) Responsive

Desktop uses persistent 256px sidebar.

Tablet may use a compact 72px icon rail with tooltips.

Phone uses a modal drawer.

---

### 3.5 Intake — Lead queue and New Lead

#### A) Purpose

Allow intake staff to qualify, track, and open new leads with the required minimum information.

#### B) Layout regions

Lead queue:

```text
Header: Intake leads                   [New lead]
Filter bar: Status | Owner | Source | Search
Table:
Lead | Phone | Incident date | Gate | Owner | Status | Updated
```

New Lead:

```text
Page title
Six-minimums progress: 4 of 6 complete
Identity section
Contact section
Incident section
Qualification section
Status section
Sticky footer: Save draft | Create lead
```

#### C) Components

Queue filter bar:

```text
flex flex-wrap items-center gap-2 border-b border-grid bg-surface p-3
```

Six-minimums gate:

```text
sticky top-16 z-10 border-b border-grid bg-warning-bg/60 px-6 py-3
```

Required field section:

```text
border-b border-grid py-6
```

Form grid:

```text
grid gap-5 md:grid-cols-2
```

Field label:

```text
mb-1.5 block text-sm font-semibold text-ink
```

Required marker:

```text
text-danger
```

DateField input:

```text
tabular-nums placeholder:text-muted/60
```

Phone country selection:

```text
segmented control: US | MX
```

#### D) Interaction notes

Six minimums should map to existing product rules. Present completion status clearly without inventing additional qualification criteria.

Recommended visible structure:

1. First name
2. Last name
3. Phone
4. Incident date
5. Incident type or summary
6. Intake disposition or owner

Only use this exact mapping if it matches current code. Otherwise bind the component to the existing six-rule validator.

Additional behaviour:

- Entry date format is `MM/DD/YYYY`.
- Displayed date becomes `Jul 14, 2026`.
- US and MX phone formatting changes with the selected country.
- Save draft remains available below the gate threshold.
- Final create/advance action respects the existing gate logic.
- `Contract sent` is a status only.
- Empty queue state shows `No leads match these filters`.
- Row click opens the lead; name remains a link.

#### E) What not to change

- Do not add DocuSign.
- Do not add AI lead scoring.
- Do not alter the six-minimums rules in the front end.
- Do not create a lead stage that does not exist in the database.
- Do not auto-convert leads to cases.

#### F) Responsive

At 1440px, form max width is 960px.

On tablet, form remains two columns where space allows.

On phone, use one column and a sticky bottom action bar.

---

### 3.6 Case Manager — Caseload table

#### A) Purpose

Let case managers scan their active caseload by next required action, urgency, stage, and assignment.

#### B) Layout regions

```text
Page header: My caseload
Saved view / search / filters
Summary line: 48 active · 7 need action today
Table:
Case | Stage | Assignments | Last activity | Next action | Due | Status
```

#### C) Components

Toolbar:

```text
sticky top-16 z-10 flex flex-wrap items-center justify-between
border-b border-grid bg-page/95 px-6 py-3 backdrop-blur
```

Table container:

```text
border-y border-grid bg-surface
```

Primary row:

```text
min-h-16
```

Secondary case metadata:

```text
mt-0.5 text-xs text-muted
```

Due date:

```text
font-medium tabular-nums
```

Overdue:

```text
text-danger
```

Filter chips:

```text
h-8 rounded-md border border-grid bg-surface px-3
```

#### D) Interaction notes

- Default sort: next required action, then due date.
- Column sorting must be explicit and reversible.
- Filters persist in the URL.
- Clicking the case name opens the case Focus View.
- Clicking the status expands or opens the source section.
- Missing assignment shows `UNASSIGNED`.
- Completed cases do not mix into the active default view.
- Zero-result state offers `Clear filters`.
- Keep table density comfortable-compact, about 56–64px per row.

#### E) What not to change

- Do not replace the table with cards at desktop width.
- Do not hide next action behind hover.
- Do not use year-less due dates.
- Do not add aggregate performance scoring.

#### F) Responsive

Use horizontal scrolling below 900px.

Freeze the case-name column where practical.

Do not convert every row into a large mobile card unless the table becomes unusable.

---

### 3.7 Litigation — Caseload and matter timeline

#### A) Purpose

Show litigation staff the current procedural stage, next filing or hearing, and the full matter progression.

#### B) Layout regions

Litigation queue:

```text
Tabs: Active | Filing watch | Hearings | Discovery | Closed
Table:
Case | Court | Stage | Next milestone | Due | Attorney | Status
```

Matter page timeline:

```text
Case header
Next litigation action
Stage timeline
1 Pleadings
2 Service
3 Answer
4 Discovery
5 Depositions
6 Mediation
7 Trial prep
8 Trial
Expandable detailed nodes beneath each major stage
```

The 17-node concept should remain in the data model but be visually grouped into major phases.

#### C) Components

Stage rail:

```text
relative border-l border-grid pl-8
```

Node:

```text
relative py-4
before:absolute before:-left-[37px] before:top-5
before:h-4 before:w-4 before:rounded-full before:border-2
```

Current node:

```text
before:border-accent before:bg-accent-lt
```

Completed node:

```text
before:border-success before:bg-success-bg
```

Critical node:

```text
before:border-danger before:bg-danger-bg
```

Node button:

```text
w-full text-left
```

Phase heading:

```text
text-xs font-semibold uppercase tracking-[0.08em] text-muted
```

#### D) Interaction notes

- Timeline nodes are clickable.
- Clicking a node expands the corresponding details and actions.
- Current stage is visually distinct but not shown by color alone.
- Court-order events use blue information styling.
- Rule-computed filing dates require `ATTORNEY-VERIFY`.
- Completed stages collapse by default.
- A compact `Show all 17 stages` control reveals the complete procedural tree.
- Timeline supports an empty scaffold where court/calendar sync is not yet connected.
- Do not imply live calendar synchronization.

#### E) What not to change

- Do not eliminate the underlying 17-node stage tree.
- Do not invent automatic court docket ingestion.
- Do not infer a procedural stage from unrelated tasks.
- Do not add AI document analysis.
- Do not label a date “final” unless verified.

#### F) Responsive

At desktop, timeline and stage details may use a 40/60 split.

At tablet and below, stack the timeline above the details.

Keep node labels fully readable; do not reduce them to dots alone.

---

### 3.8 Global search dropdown and results page

#### A) Purpose

Let staff locate cases, leads, tasks, and documents from every screen.

#### B) Layout regions

Dropdown:

```text
Search input
Recent or matching cases
Matching leads
Matching tasks
Matching documents
Footer: View all results for “query”
```

Results page:

```text
Search title and query
Category tabs or grouped sections
Cases
Leads
Tasks
Documents
```

#### C) Components

Top-bar search:

```text
relative w-full max-w-[640px]
```

Input:

```text
h-10 rounded-md border border-grid bg-page px-10
```

Dropdown:

```text
absolute top-full mt-2 max-h-[70vh] w-full overflow-auto
rounded-lg border border-grid bg-surface shadow-[var(--shadow-2)]
```

Group heading:

```text
sticky top-0 bg-surface px-3 py-2 text-[11px] font-semibold
uppercase tracking-[0.08em] text-muted
```

Result row:

```text
flex items-start gap-3 px-3 py-2.5 hover:bg-accent-lt/45
```

#### D) Interaction notes

- Autocomplete cases as `Last, First — Jul 2, 2025`.
- Include DOI for disambiguation.
- Enter without selecting routes to the grouped results page.
- Keyboard controls:
  - `⌘K` or `Ctrl+K` focuses search.
  - Arrow keys move.
  - Enter selects.
  - Escape closes.
- Case names are links.
- Do not expose search results denied by RLS.
- Empty state: `No results found for “…”`.
- Search result metadata must use full dates with year.

#### E) What not to change

- Do not create an AI-answer interface.
- Do not run OCR or show OCR confidence.
- Do not merge unrelated entity types into one undifferentiated list.
- Do not omit DOI from case autocomplete.

#### F) Responsive

Desktop dropdown width: 560–640px.

On phone, search opens as a full-screen command surface beneath the top bar.

---

### 3.9 Component sheet

#### A) Purpose

Provide reusable states and interaction patterns for implementation across all workspaces.

#### B) Layout regions

```text
Buttons
Inputs and DateField
Select / combobox
Status badges
ATTORNEY-VERIFY
UNASSIGNED
Locked navigation
Empty states
Toasts and callouts
Focus / Full toggle
Tables and pagination
```

#### C) Component recipes

Primary button:

```text
h-10 rounded-md bg-accent px-4 font-semibold text-white
hover:bg-accent-dk disabled:cursor-not-allowed disabled:opacity-50
```

Secondary button:

```text
h-10 rounded-md border border-grid bg-surface px-4 font-semibold
hover:bg-accent-lt/40
```

Tertiary button:

```text
h-9 rounded-md px-3 font-semibold text-accent-dk hover:bg-accent-lt
```

Destructive button:

```text
h-10 rounded-md border border-danger bg-danger-bg px-4
font-semibold text-danger
```

Input:

```text
h-10 rounded-md border border-grid bg-surface px-3
focus:border-accent focus:ring-2 focus:ring-accent/20
```

DateField:

```text
inputMode="numeric"
placeholder="MM/DD/YYYY"
tabular-nums
calendar icon secondary action
error text below field
```

Badge base:

```text
inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2
text-xs font-semibold
```

ATTORNEY-VERIFY:

```text
inline-flex items-center gap-1 rounded-md border border-danger/60
bg-surface px-2 py-1 text-[11px] font-bold uppercase tracking-wide
text-danger
```

UNASSIGNED:

```text
inline-flex items-center gap-1 rounded-md border border-danger/40
bg-danger-bg px-2 py-1 text-xs font-semibold text-danger
```

Toast:

```text
w-[360px] rounded-lg border border-grid bg-surface p-4 shadow-[var(--shadow-2)]
```

Locked nav tooltip:

```text
Restricted — [tier name]
```

Empty state:

```text
border border-dashed border-grid bg-surface px-6 py-10 text-center
```

#### D) Interaction notes

- All buttons need visible keyboard focus.
- DateField parses only supported date entry and stores an ISO-safe value through the existing data layer.
- Error text is persistent until resolved, not toast-only.
- Toasts confirm non-critical actions; destructive or failed actions remain visible.
- Locked nav cannot be clicked through to a fake page.
- Focus/Full toggle changes presentation only.
- Empty states include one primary recovery action at most.

#### E) What not to change

- Do not introduce new status names without mapping to existing values.
- Do not use icons without accessible labels.
- Do not rely on placeholder text as the only input label.
- Do not use toast messages as the only error reporting.
- Do not silently reformat an invalid date.

#### F) Responsive

Controls remain at least 40px high.

Tables may scroll horizontally.

Dialogs become bottom sheets only on narrow mobile screens.

---

## 4. Implementation checklist for engineering

### Shell

1. Update `app/globals.css` with the supplied light and Midnight token blocks.
2. Map all Tailwind semantic colors to CSS variables in `tailwind.config.ts`.
3. Load `Source Sans 3` through `next/font/google`.
4. Load `IBM Plex Serif` only for the Tuttle OS wordmark.
5. Replace direct hex colours in shared layout components with semantic token classes.
6. Build a persistent desktop shell:
   - `256px` left sidebar,
   - `64px` top bar,
   - scrollable main content.
7. Place `GlobalSearch` in the top bar on every authenticated route.
8. Add `data-theme="midnight"` to the app root through the existing theme preference.
9. Add consistent focus-visible styles globally.
10. Ensure all numeric/date cells use tabular numerals.

Likely file areas:

```text
app/globals.css
app/(authenticated)/layout.tsx
components/shell/AppSidebar.tsx
components/shell/TopBar.tsx
components/theme/ThemeToggle.tsx
tailwind.config.ts
```

### Owner

1. Replace the personal greeting treatment on owner home with `Firm attention`.
2. Remove the four oversized KPI cards as the primary content.
3. Implement a unified `NeedsYouNowStrip` with divided operational items.
4. Add firm-wide attention table columns:
   - case,
   - workspace,
   - issue,
   - assigned owner,
   - age,
   - next action,
   - status.
5. Add explicit items for:
   - JX verification,
   - stalled case,
   - missing assignment,
   - approval required.
6. Add `Show cleared` disclosure.
7. Add a compact right rail for approvals and firm-health counts.
8. Confirm all queries are firm-wide and RLS-backed.

Likely file areas:

```text
app/(authenticated)/owner/page.tsx
components/owner/OwnerDashboard.tsx
components/owner/FirmAttentionTable.tsx
components/shared/NeedsYouNowStrip.tsx
```

### Intake

1. Restyle lead queue as a dense table, not a card grid.
2. Add URL-persisted filters.
3. Implement the New Lead form in logical field sections.
4. Bind `SixMinimumsGate` to the current validator rather than duplicating rule logic.
5. Add `US | MX` phone-country control.
6. Standardise entry dates to `MM/DD/YYYY`.
7. Display all saved dates with a year.
8. Keep `Contract sent` as a simple status.
9. Add draft and final-action states using existing workflow actions.
10. Add filter and no-results empty states.

Likely file areas:

```text
app/(authenticated)/intake/page.tsx
app/(authenticated)/intake/new/page.tsx
components/intake/LeadQueueTable.tsx
components/intake/NewLeadForm.tsx
components/intake/SixMinimumsGate.tsx
```

### Cases

1. Make the case header sticky within the main content area.
2. Always show:
   - phone,
   - email with copy action,
   - DOB and age,
   - CM,
   - paralegal,
   - attorney where available.
3. Render missing assignments as `UNASSIGNED`.
4. Add prominent `Client called — create follow-up`.
5. Default case pages to Focus View.
6. Add `NeedsYouNowStrip` directly beneath the case header.
7. Convert full-page section blocks into collapsed operational rows.
8. Auto-open hot sections only.
9. Add Focus/Full segmented toggle.
10. Add target scrolling and temporary flash highlight from status clicks.
11. Collapse completed work behind `Show N completed`.
12. Add companion-case strip when applicable.
13. Ensure every case name across the app is rendered through `CaseLink`.
14. Keep forms inline inside coverage, PD, records, demand, and insurance sections.

Likely file areas:

```text
app/(authenticated)/cases/[caseId]/page.tsx
components/cases/CaseHeader.tsx
components/cases/CaseFocusView.tsx
components/cases/CaseSection.tsx
components/cases/CompanionCasesStrip.tsx
components/cases/CreateFollowUp.tsx
components/cases/CaseLink.tsx
```

### Litigation

1. Preserve the existing 17-node data structure.
2. Group nodes visually into major procedural phases.
3. Build a clickable vertical `MatterTimeline`.
4. Add visible labels and icons to all node states.
5. Add `Show all 17 stages`.
6. Open node-specific details inline.
7. Apply `ATTORNEY-VERIFY` to rule-computed legal dates.
8. Add explicit scaffold/empty treatment for court dates without implying sync.
9. Restyle litigation caseload as a table with tabs.
10. Keep court-order/informational states blue with icon + label.

Likely file areas:

```text
app/(authenticated)/litigation/page.tsx
app/(authenticated)/litigation/[caseId]/page.tsx
components/litigation/LitigationQueue.tsx
components/litigation/MatterTimeline.tsx
components/litigation/TimelineNode.tsx
```

### Shared UI

1. Build semantic `StatusBadge` variants:
   - danger,
   - warning,
   - success,
   - info.
2. Build a dedicated `AttorneyVerifyBadge`.
3. Build an `UnassignedBadge`.
4. Build a reusable `DateField` with:
   - `MM/DD/YYYY` input,
   - validation,
   - calendar trigger,
   - tabular numerals.
5. Build `LockedNavItem` with tooltip.
6. Build `EmptyState` with optional single action.
7. Build `Toast` variants without using toast-only form errors.
8. Build `DisclosureRow` for collapsed case sections.
9. Build `FocusFullToggle`.
10. Build accessible `CopyButton`.
11. Add `Command/Ctrl + K` search shortcut.
12. Make autocomplete keyboard navigable.
13. Add full search results grouped by entity type.
14. Audit all displayed dates and remove year-less formats.
15. Audit status displays and remove color-only indicators.

Likely file areas:

```text
components/ui/StatusBadge.tsx
components/ui/AttorneyVerifyBadge.tsx
components/ui/UnassignedBadge.tsx
components/ui/DateField.tsx
components/ui/LockedNavItem.tsx
components/ui/EmptyState.tsx
components/ui/Toast.tsx
components/ui/DisclosureRow.tsx
components/ui/SegmentedToggle.tsx
components/search/GlobalSearch.tsx
components/search/SearchResults.tsx
lib/format/date.ts
```

---

## 5. Asset list

Use Lucide-style line icons with a consistent `1.75px` stroke.

### Shell and navigation

- `LayoutDashboard`
- `Search`
- `UserRound`
- `UsersRound`
- `ClipboardList`
- `BriefcaseBusiness`
- `Scale`
- `Gavel`
- `FileText`
- `ListChecks`
- `Settings`
- `Lock`
- `PanelLeft`
- `Moon`
- `Sun`

### Status and legal semantics

- `CircleAlert`
- `TriangleAlert`
- `CircleCheck`
- `Info`
- `ShieldAlert`
- `Landmark`
- `ClockAlert`
- `UserRoundX`

### Case actions

- `Phone`
- `Mail`
- `Copy`
- `MessageSquarePlus`
- `ChevronDown`
- `ChevronRight`
- `ExternalLink`
- `Link`
- `Paperclip`
- `CalendarDays`
- `History`
- `Check`

### Search entities

- `BriefcaseBusiness` for cases
- `UserPlus` for leads
- `ListTodo` for tasks
- `FileText` for documents

### Login

No illustration is required.

Use a restrained typographic wordmark and, optionally, a subtle monochrome San Antonio line-art motif in the desktop brand panel. Do not use courtroom stock photography, gavels as decoration, cartoon crash imagery, or emoji.

---

## 6. Open questions for Michael

1. What are the exact six minimum fields that currently satisfy the Intake gate in code?
2. Which current role or permission tiers should appear in locked-navigation tooltips?
3. Which existing case sections can generate “Needs you now” items, and what determines their priority order?
4. Does the owner approval queue already exist in the database, or should the first implementation only show stalled, JX, and unassigned matters?
5. What are the exact names and grouping of the existing 17 litigation timeline nodes?
