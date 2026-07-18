# Tuttle OS — Schema & Domain Flow

**Purpose:** Visual map of how data hangs together. The UI displays and captures state; **Postgres + RLS invent nothing.**  
**Detail:** `docs/schema-overview-for-designer.md` · **DDL:** `sql/01`→`05` · **v2.5 applied.**

---

## The spine (one crash → one or more matters)

```mermaid
flowchart TD
  P["core.person / organization<br/>people & companies"]
  IG["core.incident_group<br/>ONE crash / event"]
  CM["core.client_matter<br/>ONE client's case from that crash<br/>own SOL · medicals · settlement"]

  P --> CM
  IG -->|"1 : N"| CM

  CM --> MED["medical.*"]
  CM --> INS["insurance.*"]
  CM --> PROP["property.*"]
  CM --> LIT["litigation.*"]
  CM --> RES["resolution.*"]
  CM --> LIEN["liens.*"]
  CM --> FIN["finance.*"]
  CM --> WF["workflow.*<br/>tasks · deadlines · notes · docs"]

  IL["intake.intake_lead"] -.->|"converts to"| CM
  STAFF["core.staff + staff_assignment<br/>CM / PL / attorney roles"] --> CM
```

**Companions:** multiple `client_matter` rows on the **same** `incident_group` = same crash, different clients. Cross-file copy requires `representation_link` conflict clearance.

---

## 12 schemas (domains)

```mermaid
flowchart LR
  subgraph always ["Always on"]
    CORE["core"]
    WF["workflow"]
    REF["ref"]
    AUD["audit"]
  end

  subgraph case_data ["Per-matter case data"]
    MED["medical"]
    INS["insurance"]
    PROP["property"]
    LIT["litigation"]
    RES["resolution"]
    LIEN["liens"]
    FIN["finance"]
  end

  subgraph other ["Supporting"]
    INTAKE["intake"]
    AN["analytics"]
  end

  CORE --> case_data
  CORE --> WF
  REF -.-> case_data
  AUD -.-> CORE
```

| Schema | Holds |
|---|---|
| `core` | person, incident_group, client_matter, staff, SOL/limitations, conflicts |
| `intake` | leads before a matter exists |
| `medical` | treatment episodes, records, injuries, § 18.001 |
| `insurance` | claims, policies, adjusters |
| `property` | vehicles, PD claims |
| `litigation` | court_case, lit_party, service, DCO, discovery, mediation |
| `resolution` | demands, negotiation, settlement |
| `liens` | lien screen / holders |
| `finance` | fees, trust, disbursement (attorney + lien role) |
| `workflow` | **task** (WHO) + **deadline** (WHEN) + notes + documents |
| `ref` | dropdown codes (never hard-code in UI) |
| `audit` | immutable change_log |
| `analytics` | closed-case snapshots, velocity |

---

## Matter stage flow (lifecycle)

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

Owner watches **across** stages via stalled flags, Level approval, and SOL reconciliation — not a separate stage.

---

## The two engines (every workspace)

```mermaid
flowchart TB
  EVENT["Real-world / form event<br/>answer filed · service · DCO · contract executed"]

  EVENT --> DL["workflow.deadline = WHEN<br/>sources: court_order > agreement > rule > manual<br/>Horizon · matter Deadlines card · calendar Phase 9"]
  EVENT --> TK["workflow.task = WHO does WHAT<br/>owner_staff_id · completion: system / manual / override"]

  DL --> UI1["Deadline Horizon / SOL Watch"]
  TK --> UI2["My Tasks / caseload chips"]
  TK --> OWN["Owner: override patterns"]
```

UI **never** invents authoritative legal dates — engines + `ref.deadline_rule` do; badge **ATTORNEY-VERIFY**.

---

## Litigation branch (per defendant)

```mermaid
flowchart TD
  CM["client_matter"] --> CC["litigation.court_case<br/>cause # · court · filed"]
  CC --> LP["litigation.lit_party<br/>one row per pleaded party"]
  LP --> SVC["service_of_process / attempts"]
  SVC -->|"SERVED"| ANS["TRCP 99 answer-due<br/>DB-computed deadline"]
  LP -->|"answer_filed_date"| A18["§ 18.001 clocks<br/>per defendant"]
  CC --> SO["scheduling_order<br/>apply_scheduling_order()"]
  SO -->|"vacates superseded rule rows"| DL["workflow.deadline"]
  A18 --> DL
  ANS --> DL
```

---

## Security tiers (RLS — not UI)

```mermaid
flowchart TD
  AUTH["Supabase Auth user"] --> ST["core.staff.auth_user_id"]
  ST --> ROLE{"role / capabilities"}

  ROLE -->|"all active staff"| ALL["See active matters<br/>soft-delete filtered"]
  ROLE -->|"intake"| BLOCK["Blocked from medical / litigation / liens / resolution / insurance / property"]
  ROLE -->|"attorney + lien"| FIN["finance.*"]
  ROLE -->|"attorney + lit PL"| DISC["discovery work product"]
  ROLE -->|"can_approve_level"| LVL["approved_level stamp"]
  ROLE -->|"can_clear_conflicts"| CF["representation_link clearance"]
```

Nav 🔒 is a hint; **API/RLS is the gate.**

---

## App → schema (what each workspace reads)

```mermaid
flowchart LR
  subgraph app ["Next.js workspaces"]
    I["/intake"]
    C["/cases"]
    L["/litigation"]
    O["/owner"]
  end

  I --> IL["intake_lead · conflict_check"]
  C --> VS["v_stalled_cases · task · note · medical…"]
  L --> VH["v_deadline_horizon · court_case · task"]
  O --> VS
  O --> SOL["v_sol_reconciliation"]
  O --> AP["client_matter.recommended_level<br/>v_demand_readiness"]
  O --> OV["v_task_override_patterns"]
```

---

## Intentionally parked (not in live schema yet)

- **v2.2** Storage documents (`sql/optional/06`) — Phase 8  
- **v2.6** AI / OCR (`sql/optional/07`) — Phase 8 after BAAs  

---

## Related

| Doc | Use |
|---|---|
| `docs/schema-overview-for-designer.md` | Prose overview |
| `docs/PROJECT_PHASES.md` | Build order / phase status |
| `docs/DESIGN_NOTES.md` | Naming = API contract |
| `MASTER_PROMPT.md` §5–§6 | Engines + form→table map |
