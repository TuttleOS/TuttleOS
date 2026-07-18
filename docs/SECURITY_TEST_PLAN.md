# Tuttle OS — Security Test Plan

Regression matrix for auth, RLS, actor attribution, soft-delete, and (when adopted) document access. Run after Phase 1 and after every phase that touches roles, schemas, or storage.

Related: [SECURITY_PROTOCOLS.md](SECURITY_PROTOCOLS.md), [COMPLIANCE_GATES.md](COMPLIANCE_GATES.md), `sql/tests/test_v2.5_battery.sql`.

---

## 1. Test roles (seed fixtures)

Use **fictional** staff only. Minimum fixtures:

| Code | role_code | Capabilities | Purpose |
|---|---|---|---|
| `R_INT` | intake | none special | Prove medical/litigation/doc blocks |
| `R_CM` | case_manager | — | Baseline case access |
| `R_LIT` | litigation_paralegal | — | Discovery content allowed |
| `R_ATTY` | attorney | `is_attorney`, `can_approve_level`, `can_clear_conflicts` | Finance + clear conflicts |
| `R_LIEN` | lien_disbursement | — | Finance tier with attorney |
| `R_DEM` | demand_writer | — | Non-finance, non-discovery baseline |
| `R_OFF` | case_manager | `active = false` | Must not authenticate into app |
| `R_UNL` | Auth user with **no** `core.staff.auth_user_id` | — | Must not act / writes fail |

Each role maps to a Supabase Auth user with MFA enrolled in staging.

---

## 2. Auth / MFA checks

| ID | Case | Expect |
|---|---|---|
| A1 | Login without MFA when MFA enforced | Blocked / challenged |
| A2 | Login with MFA as linked active staff | Session OK; `app.current_staff_id()` resolves |
| A3 | Login as `R_OFF` (inactive staff) | App denied |
| A4 | Login as `R_UNL` (unlinked Auth) | App denied or writes fail loud |
| A5 | Logout | Session cleared; subsequent API calls 401 |
| A6 | Browser never receives `service_role` key | Inspect bundle / network |
| A7 | Password reset / MFA reset | Logged as security event (when monitoring live) |

---

## 3. RLS matrix — data domains

Assert via **API / SQL as that role** (not UI alone). `ALLOW` = rows returned / write succeeds when otherwise valid. `DENY` = empty / error / policy rejection.

| Domain / action | intake | CM | lit. paralegal | attorney | lien_disb. |
|---|---|---|---|---|---|
| Read `core.client_matter` (active) | ALLOW* | ALLOW | ALLOW | ALLOW | ALLOW |
| Read `medical.*` treatment / clinical | **DENY** | ALLOW | ALLOW | ALLOW | ALLOW† |
| Read `litigation.*` court / service | **DENY** | ALLOW‡ | ALLOW | ALLOW | ALLOW† |
| Read `insurance.*` / `property.*` | **DENY** | ALLOW | ALLOW | ALLOW | ALLOW† |
| Read `resolution.*` / `liens.*` | **DENY** | ALLOW‡ | ALLOW‡ | ALLOW | ALLOW |
| Read finance detail (`finance.*`) | **DENY** | **DENY** | **DENY** | ALLOW | ALLOW |
| Read discovery work product | **DENY** | **DENY** | ALLOW | ALLOW | **DENY** |
| Clear conflict (`can_clear_conflicts`) | **DENY** | **DENY** | **DENY** | ALLOW | **DENY** |
| Level approval (`can_approve_level`) | **DENY** | **DENY** | **DENY** | ALLOW | **DENY** |

\* Intake may see matters/leads in their world; not medical/insurance detail.  
† Confirm against live policies — if lien role is finance-only, medical may still be ALLOW for active staff; the critical DENY rows are intake + finance + discovery. Re-check against `sql/02_upgrade_v2.1.sql` policies when implementing tests; this matrix is the **product intent** from MASTER_PROMPT.  
‡ CM may see high-level litigation milestones in UI (Phase 6 reverse switcher) but discovery **content** remains discovery-tier.

### Concrete negative tests (must automate)

| ID | Actor | Action | Expect |
|---|---|---|---|
| R1 | `R_INT` | `SELECT` medical.treatment_episode | 0 rows / denied |
| R2 | `R_INT` | REST GET medical via supabase-js | denied |
| R3 | `R_CM` | Read finance fee/trust detail | denied |
| R4 | `R_LIT` | Read finance fee/trust detail | denied |
| R5 | `R_CM` | Read discovery content tier | denied |
| R6 | `R_LIT` | Read discovery content tier | allowed |
| R7 | `R_CM` | Clear conflict | denied |
| R8 | `R_ATTY` | Clear conflict | allowed + audit row |
| R9 | `R_INT` | Cross-matter note copy while conflict pending | denied |

---

## 4. Actor attribution

| ID | Case | Expect |
|---|---|---|
| C1 | Insert/update with valid staff session | Succeeds; `audit.change_log` has actor |
| C2 | Write with `app.staff_id` unset and no auth bridge | **Loud fail** (exception) |
| C3 | Paralegal using CM workspace switcher | Audit attributes **paralegal**, not CM |
| C4 | Task override without reason | Rejected |
| C5 | Task override with reason | Succeeds; override pattern feedable |

---

## 5. Soft delete

| ID | Case | Expect |
|---|---|---|
| S1 | UI delete on matter-related row | Sets `deleted_at`; no hard DELETE |
| S2 | Default list query | Excludes `deleted_at IS NOT NULL` |
| S3 | Attempt hard DELETE as `authenticated` | Denied by policy/grants |
| S4 | Supersede document (Phase 8) | Old row remains; new points `supersedes_document_id` |

---

## 6. Document metadata & file access (Phase 8 — after v2.2)

| ID | Case | Expect |
|---|---|---|
| D1 | `R_INT` SELECT `workflow.document` medical category | denied (`app.can_view_doc_type`) |
| D2 | `R_CM` SELECT same medical doc metadata | allowed |
| D3 | `R_INT` storage read on medical object | denied |
| D4 | `R_CM` request signed URL for medical doc | URL issued + `document_access_log` row (`view`/`download`) |
| D5 | Access log UPDATE/DELETE | no policy — denied |
| D6 | `R_ATTY` read all access log; `R_CM` read own only | per policy |
| D7 | Raw `storage_path` not usable as public URL | bucket private |
| D8 | AI search `workflow.search_documents` as intake on medical text | no medical hits (RLS) |

---

## 7. Legal-engine integrity (security-adjacent)

Wrong deadlines are malpractice risk. Keep in this suite:

| ID | Case | Expect |
|---|---|---|
| L1 | `test_v2.5_battery.sql` full run | all PASS |
| L2 | Answer-due / 18.001 dates not writable as “truth” from client without triggers | client cannot bypass engine |
| L3 | UI shows ATTORNEY-VERIFY on rule-computed dates | badge present (Playwright) |

---

## 8. How to run (when app exists)

1. **DB behavior:** `psql` / Supabase SQL → `sql/tests/test_v2.5_battery.sql`  
2. **RLS SQL:** set role / JWT claims per fixture; run matrix queries  
3. **API:** Playwright or Vitest with supabase-js clients per role  
4. **UI:** Playwright locked-nav + denied deep links  
5. **Phase 8:** storage policy tests + access_log assertions  

Suggested CI order: battery → RLS SQL → API role matrix → Playwright smoke.

---

## 9. Pass / fail log (copy per release)

```
Date:
Commit / migration set:
Battery: PASS | FAIL
Auth/MFA (A1–A7): 
RLS (R1–R9): 
Actor (C1–C5): 
Soft delete (S1–S4): 
Documents (D1–D8) N/A | PASS | FAIL
Blockers:
Tester:
```
