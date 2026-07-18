# Tuttle OS — Visual Workflows for Claude

**Use:** Paste this whole file into Claude, or copy one diagram at a time.  
**Ask Claude:** “Render these Mermaid diagrams and use them when presenting to Michael. Keep explanations short.”

Claude (and most Markdown viewers) render the ```mermaid blocks as flowcharts.

---

## 1. Build spine (phases 0–10)

**When to use:** “Where are we in the project?”

```mermaid
flowchart TD
  subgraph foundation ["Foundation"]
    P0["Phase 0 — Database"]
    P1["Phase 1 — App shell"]
    P0 --> P1
  end

  subgraph workspaces ["Role workspaces — MVP shipped"]
    P2["Phase 2 — Intake"]
    P3["Phase 3 — Case Manager"]
    P4["Phase 4 — Litigation"]
    P5["Phase 5 — Owner"]
    P1 --> P2 --> P3 --> P4 --> P5
  end

  subgraph connect ["Connect the firm"]
    P6["Phase 6 — CM ↔ Lit switcher"]
    P5 --> P6
  end

  subgraph expand ["Waiting on Michael"]
    P7["Phase 7 — Demand / Liens / Review"]
    P6 --> P7
  end

  subgraph gated ["Owner-gated / later"]
    P8["Phase 8 — Documents + AI"]
    P9["Phase 9 — Live calendar"]
    P10["Phase 10 — CasePeer load"]
    P7 --> P8 --> P9 --> P10
  end
```

**Talking point:** Green path through Phase 6 exists. Pause at Phase 7 for Michael’s screen sign-off. 8–10 stay gated.

---

## 2. How a matter moves through the firm

**When to use:** “What does the product do day to day?”

```mermaid
flowchart LR
  A["Lead<br/>Intake"] --> B["Signed matter<br/>Case Manager"]
  B --> C["Treating / Records<br/>CM"]
  C --> D["Demand / Negotiate<br/>CM + Demand Writer"]
  D --> E["Litigation<br/>PL + Attorney"]
  E --> F["Settlement / Liens<br/>CM + Lien"]
  F --> G["Close<br/>Owner oversight"]

  O["Owner<br/>SOL · Level · stalled"] -.-> B
  O -.-> C
  O -.-> D
  O -.-> E
```

**Talking point:** Owner watches across the firm; he is not a separate stage.

---

## 3. Matter stage lifecycle (database stages)

**When to use:** “What stages does a case go through?”

```mermaid
stateDiagram-v2
  [*] --> intake
  intake --> viability: contract executed
  viability --> treating: 7-day accept
  treating --> records
  records --> demand
  demand --> negotiation
  negotiation --> litigation: file suit
  negotiation --> settlement
  litigation --> settlement
  settlement --> closed
  viability --> closed: decline / withdraw
```

---

## 4. Who lands where after login

**When to use:** “Who sees what when they sign in?”

```mermaid
flowchart TD
  Login["Staff signs in"] --> Role{"staff.role_code"}
  Role -->|intake| I["/intake"]
  Role -->|case_manager| CM["/cases"]
  Role -->|litigation_paralegal| L["/litigation"]
  Role -->|attorney / admin / senior_paralegal| OW["/owner"]
  Role -->|demand_writer| D["/demands — skeleton"]
  Role -->|lien_disbursement| LN["/liens — skeleton"]
```

**Talking point:** Nav is a hint. RLS is the real gate.

---

## 5. Data spine (one crash → matters)

**When to use:** “How is the database structured?”

```mermaid
flowchart TD
  P["person / organization"]
  IG["incident_group<br/>ONE crash"]
  CM["client_matter<br/>ONE client's case<br/>own SOL · medicals · settlement"]

  P --> CM
  IG -->|"1 : N"| CM

  CM --> MED["medical"]
  CM --> INS["insurance"]
  CM --> PROP["property"]
  CM --> LIT["litigation"]
  CM --> RES["resolution"]
  CM --> LIEN["liens"]
  CM --> FIN["finance"]
  CM --> WF["workflow<br/>tasks · deadlines · notes"]

  IL["intake lead"] -.->|"converts to"| CM
  STAFF["staff assignment"] --> CM
```

**Talking point:** Companions = multiple matters on the same crash.

---

## 6. The two engines (WHEN + WHO)

**When to use:** “Why don’t screens invent deadlines?”

```mermaid
flowchart TB
  EVENT["Real-world event<br/>contract · service · answer · DCO"]

  EVENT --> DL["deadline = WHEN<br/>court_order > agreement > rule > manual"]
  EVENT --> TK["task = WHO does WHAT<br/>system / manual / override"]

  DL --> UI1["Deadline Horizon / SOL Watch"]
  TK --> UI2["My Tasks / caseload"]
  TK --> OWN["Owner: override patterns"]
```

**Talking point:** Rule-computed dates always show **ATTORNEY-VERIFY**.

---

## 7. Litigation branch (per defendant)

**When to use:** “How does filing / service / answer work?”

```mermaid
flowchart TD
  CM["client_matter"] --> CC["court_case"]
  CC --> LP["lit_party<br/>per defendant"]
  LP --> SVC["service"]
  SVC -->|"SERVED"| ANS["TRCP 99 answer due<br/>DB-computed"]
  LP -->|"answer filed"| A18["§ 18.001 clocks"]
  CC --> SO["scheduling order"]
  SO -->|"vacates superseded rules"| DL["workflow.deadline"]
  A18 --> DL
  ANS --> DL
```

---

## 8. Security tiers (RLS)

**When to use:** “Is this HIPAA-ready / who can see medicals?”

```mermaid
flowchart TD
  AUTH["Supabase Auth"] --> ST["core.staff"]
  ST --> ROLE{"role / capabilities"}

  ROLE -->|"all active staff"| ALL["Active matters"]
  ROLE -->|"intake"| BLOCK["Blocked from medical / lit / liens / finance…"]
  ROLE -->|"attorney + lien"| FIN["finance"]
  ROLE -->|"attorney + lit PL"| DISC["discovery work product"]
  ROLE -->|"can_approve_level"| LVL["Level approval"]
  ROLE -->|"can_clear_conflicts"| CF["conflict clearance"]
```

---

## 9. App workspaces → data

**When to use:** “What does each screen actually read?”

```mermaid
flowchart LR
  subgraph app ["App"]
    I["/intake"]
    C["/cases"]
    L["/litigation"]
    O["/owner"]
  end

  I --> IL["leads · conflicts"]
  C --> VS["stalled / tasks / medical…"]
  L --> VH["deadline horizon · court"]
  O --> VS
  O --> SOL["SOL reconciliation"]
  O --> AP["Level · demand readiness"]
```

---

## 10. Owner decision funnel (checkpoint)

**When to use:** End of the Michael briefing — “what do you need from me?”

```mermaid
flowchart TD
  NOW["Owner checkpoint"] --> D1{"Confirm 0–10 direction?"}
  D1 -->|yes| D2{"Keep AI + live calendar deferred?"}
  D1 -->|pause| STOP["Rework plan"]
  D2 -->|yes| D3{"Sign Phase 7 screens?"}
  D2 -->|reopen| R["Reopen Phase 8 and/or 9"]
  D3 -->|sign| PRI{"Pick one next priority"}
  D3 -->|rework| P7["Revise PHASE7 proposals"]
  PRI --> A["Deepen CM / Lit"]
  PRI --> B["Build Phase 7 actions"]
  PRI --> C["CasePeer rehearsal<br/>after BAA"]
  NOW --> BAA{"Supabase BAA?"}
  BAA -->|signed| PHI["Path to real PHI open"]
  BAA -->|not yet| DEMO["Demo / fictional data only"]
```

---

## Suggested Claude prompt

```
You are briefing Michael Tuttle (attorney / owner of Crash Guy Injury Attorneys) on Tuttle OS.

Use docs/MICHAEL_OWNER_BRIEF.md for facts and the Mermaid diagrams in this file for visuals.

Rules:
- Plain language, short
- Database is the product
- Do not invent Phase 7/8/9 work
- End with the owner decision funnel and the sign-off questions
- Render each diagram when it helps; do not dump all ten at once unless asked
```

---

## Source files in the repo

| Diagram set | File |
|---|---|
| Phases + firm flow + login | `docs/PROJECT_PHASES.md` |
| Spine, engines, lit, RLS | `docs/SCHEMA_FLOW.md` |
| Owner narrative | `docs/MICHAEL_OWNER_BRIEF.md` |
| This pack | `docs/VISUAL_WORKFLOWS_FOR_CLAUDE.md` |
