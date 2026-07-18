# Documents Feature Spec — Review & Integration Plan

**Reviewed:** July 14, 2026 · against the live build (v2.5 schema, 96 tables / 12 schemas — the spec's "93 tables" predates the v2.4/v2.6-draft additions).
**Verdict: entirely possible, and ~70% was already designed.** The v2.2 storage draft (built July 13, quarantined at Michael's request) covers goals 1, 3, and most of 6. This review adds the rest as a **v2.6 draft** — written, scratch-tested end-to-end, and NOT applied, same back-out guarantees as v2.2.

---

## What already existed before this spec arrived

- `workflow.document` — the metadata table the spec asks for, already richer than the spec's field list: 42 typed categories, status lifecycle, full date trail, Bates range fields, `dropbox_path` (the spec's `original_dropbox_path` — provenance was designed in from day one), owner, SHA-256 hash, soft delete, audit.
- **v2.2 draft (unapplied):** Supabase Storage pointers (`storage_path`, mime, bytes, uploader), signed-URL viewing, immutable versioning via `supersedes_document_id`, per-category RLS (intake blocked from medical documents — row AND file), append-only access log, bucket policies that call the same `app.*` security helpers as the data tiers.
- Document-driven automation already live in the applied schema: an executed contract generates the sign-up checklist; a CR-3 completes the police-report task; the DCO document anchors the deadline engine.

## What the spec adds — now drafted as v2.6 (scratch-proven, not adopted)

- **Enrichment columns** on `workflow.document`: `ai_description`, `extracted_text` (every page — the spec's legal-grade completeness rule is honored structurally), `ai_extracted` jsonb (key dates, parties, sender/recipient, amounts, providers, ICD codes), `ocr_page_count`.
- **Full-text search**: a generated, weighted `tsvector` (title > description > full text) with a GIN index, plus `workflow.search_documents(matter, query)` — ranked results with highlighted snippets. **The spec's own test passed on scratch: searching "driver fatigue" across a case file returned the production volume with the page-87 snippet.** Runs as invoker, so RLS applies — intake can't full-text-search medical records.
- **Processing queue** `workflow.document_ai_job` exactly per spec §5: upload trigger enqueues `enrich`; worker claims via `FOR UPDATE SKIP LOCKED` (safe under concurrency); 3 attempts then **loud** `failed` with the error preserved and surfaced in the UI (proven in the smoke test); on-demand job types: `summarize`, `extract_medical`, `reclassify`, `embed`.
- **Semantic layer (optional)**: `workflow.document_chunk` with pgvector embeddings — the extension is already installed in the build. Full-text answers "which documents say fatigue"; embeddings later answer "which documents are *about* driver exhaustion" without the word appearing. Harmless if never populated.
- **UI**: the document-upload demo now shows the whole loop — per-document 🤖 chips (queued → processing → enriched · page count; FAILED with one-click retry), AI descriptions under each title, case-wide search box with highlighted snippets, and Summarize / Extract-treatment buttons on enriched documents.

## Answers to the spec's open questions (§9)

**1. Which schema? Conflicts?** `workflow` — the document table already lives there; the queue and chunks sit beside it. **One real conflict avoided:** the spec's standalone `documents` table would have duplicated `workflow.document`; everything lands as columns/companions on the existing table instead. The spec's `matter_id`/`category`/`uploaded_at` map to the existing `client_matter_id`/`doc_type_code`/`uploaded_at` (v2.5 naming standard applies).

**2. Edge Function vs. Mac mini worker?** Recommendation: **start with the Mac mini** for the heavy work, keep Edge Functions for light triggers later. Reasons: a 120-page OCR+full-summary job outlives Edge Function execution limits; the M4 handles long jobs, can run local OCR (free), and keeps the Claude API key on hardware you control. Tradeoffs to accept: it's a single point of failure (run the worker under launchd with auto-restart; the queue's `attempts`/`failed` design means a dead worker loses nothing — jobs wait), and it must be on/online for the pipeline to move. The queue-in-Postgres design makes the worker swappable — start on the mini, move to hosted later without schema changes.

**3. OCR vendor?** **Hybrid, decided by the pilot:** Tesseract first (free, local on the mini) with per-page confidence scores; pages below threshold retry through a cloud engine. Both Google Document AI and AWS Textract are HIPAA-eligible **with a signed BAA** — that's the deciding constraint, not accuracy benchmarks. ⚠ **Attorney decision required before any PHI leaves the building:** BAAs for the OCR vendor AND the Claude API (Anthropic offers zero-retention/HIPAA arrangements on appropriate plans) must be in place before the first medical record enters the pipeline. Costs at your scale: cloud OCR ≈ $1.50/1,000 pages; a full 120-page summary ≈ $0.50 (the spec's math checks out); the whole 300–400-case backfill is realistically **hundreds of dollars, not thousands**.

**4. Buckets & RLS?** Already designed in v2.2: one private `case-documents` bucket; per-file authorization derives from the document row via `app.can_view_doc_type()` — the same tiers as the data, so there is exactly one security model to reason about. Files immutable; corrections via supersede; access log rows on every view (HIPAA trail).

**5. Taxonomy — flat vs. subcategory, multi-category?** Keep the existing two-level structure: `ref.document_type.code` (specific type — the AI classifies to this) grouped by `category` (the filter chips in the UI). The spec's 15 categories mapped onto the existing 42 types with only **6 gaps**, added in the draft: acknowledgment letters, counter-demands, negotiation correspondence, client documents, client photos, disbursement paperwork. Multi-category documents: one primary `doc_type_code` (a document IS one thing) — if cross-filing proves necessary in practice, a `tags text[]` column is a five-minute addition; don't build it speculatively.

**6. Retention / versioning / Dropbox afterward?** Versioning is solved (immutable files + supersede chain + soft delete + audit). **Recommendation: keep Dropbox as a frozen parallel archive** through at least the first year — `dropbox_path` on every migrated row preserves provenance both directions, and it costs nothing. Never mirror ongoing edits both ways; the system is the record after migration, Dropbox is the historical backstop. Formal retention schedule = attorney policy decision, enforceable later via `deleted_at` + a retention job.

## Suggested rollout (matches the spec's instinct, with a safety rail added)

1. **Adopt the schema stack** when ready: run v2.2 then v2.6 (one command each; both rollbacks tested byte-identical).
2. **Pilot one closed case first, then one active case** (spec says pilot one — do a closed one before touching a live file). Migrate its Dropbox folder: folder name → presumptive category, AI pass verifies/refines, staff spot-check the classifications.
3. **Tune, then batch** the ~300–400 active cases overnight in groups, watching the `failed` queue each morning — nothing fails silently.
4. **UI page** (the demo's real version) once the pilot data proves the classifications are trustworthy.

**Nothing has been applied.** Both drafts sit in the same quarantine as before: adopt = run two scripts + create the bucket + stand up the worker; back out = two rollback scripts.
