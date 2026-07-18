-- ================================================================================
-- TUTTLE OS — v2.6 OPTIONAL UPGRADE: AI DOCUMENT ENRICHMENT + FULL-TEXT SEARCH
-- Status: DRAFT / NOT ADOPTED. Implements the "Documents Feature Spec" (Michael,
-- 2026-07-14) on top of the v2.2 storage draft. APPLY ORDER: v2.2 first, then this.
-- Backing out: rollback_v2.6_documents_ai.sql (then v2.2's rollback if desired).
--
-- What this adds:
--   A. Enrichment columns on workflow.document: ai_description, extracted_text
--      (full OCR text — EVERY page, spec §6), ai_extracted jsonb (dates, parties,
--      amounts, providers), ocr_page_count, + a generated tsvector for search.
--   B. workflow.document_ai_job — the processing queue (spec §5). The database
--      orchestrates; a worker (Edge Function or Mac mini script) claims jobs with
--      FOR UPDATE SKIP LOCKED. Nothing fails silently: 'failed' rows carry the
--      error and surface in the UI.
--   C. workflow.search_documents() — case-wide full-text search ("every document
--      mentioning driver fatigue"), ranked, snippeted, RLS-respecting.
--   D. workflow.document_chunk — OPTIONAL semantic layer (pgvector is already
--      installed): page-range chunks + embeddings for concept search. Harmless
--      if never populated.
--   E. New ref.document_type rows covering the spec's category list gaps.
-- ================================================================================

BEGIN;

SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', true);

-- ------------------------------------------------------------------
-- A. enrichment columns + search vector
-- ------------------------------------------------------------------
ALTER TABLE workflow.document
  ADD COLUMN IF NOT EXISTS ai_description text,
  ADD COLUMN IF NOT EXISTS extracted_text text,
  ADD COLUMN IF NOT EXISTS ai_extracted   jsonb,
  ADD COLUMN IF NOT EXISTS ocr_page_count integer;

COMMENT ON COLUMN workflow.document.ai_description IS
  'v2.6: AI-written one-paragraph description of what this document IS. Machine-suggested; staff can overwrite.';
COMMENT ON COLUMN workflow.document.extracted_text IS
  'v2.6: full OCR/extracted text — EVERY page (spec: no first-pages-only shortcuts; page 100 of 120 matters). Source for full-text search.';
COMMENT ON COLUMN workflow.document.ai_extracted IS
  'v2.6: structured extraction — {key_dates:[], parties:[], sender, recipient, amounts:[], providers:[], icd_codes:[]}. Shape varies by doc type.';

-- generated search vector: title + AI description + full text. GIN-indexed.
ALTER TABLE workflow.document
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(ai_description,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(left(extracted_text, 800000),'')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_document_search_tsv ON workflow.document USING gin(search_tsv);

-- ------------------------------------------------------------------
-- B. the processing queue — database orchestrates, worker executes
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workflow.document_ai_job (
  job_id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id   uuid NOT NULL REFERENCES workflow.document(document_id) ON DELETE RESTRICT,
  job_type      text NOT NULL CHECK (job_type IN ('enrich','summarize','extract_medical','reclassify','embed')),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','complete','failed')),
  attempts      integer NOT NULL DEFAULT 0,
  last_error    text,
  requested_by  uuid REFERENCES core.staff(staff_id),   -- NULL = system-enqueued
  result        jsonb,                                   -- job output (summary text, extraction, …)
  created_at    timestamptz NOT NULL DEFAULT now(),
  claimed_at    timestamptz,
  claimed_by    text,                                    -- worker identity string
  completed_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_ai_job_pending  ON workflow.document_ai_job(job_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS idx_ai_job_document ON workflow.document_ai_job(document_id);
CREATE INDEX IF NOT EXISTS idx_ai_job_failed   ON workflow.document_ai_job(status) WHERE status='failed';

ALTER TABLE workflow.document_ai_job ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_read ON workflow.document_ai_job;
CREATE POLICY p_read ON workflow.document_ai_job FOR SELECT
  USING (app.is_active_staff());          -- job METADATA only; document content stays tiered
DROP POLICY IF EXISTS p_ins ON workflow.document_ai_job;
CREATE POLICY p_ins ON workflow.document_ai_job FOR INSERT
  WITH CHECK (app.is_active_staff());     -- staff enqueue on-demand jobs ("Summarize")
-- the worker connects with the service role and bypasses RLS by design.
GRANT SELECT, INSERT ON workflow.document_ai_job TO app_staff;

-- auto-enqueue: a document that lands with a file gets an 'enrich' job
CREATE OR REPLACE FUNCTION workflow.enqueue_document_enrich()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.storage_path IS NOT NULL
     AND (TG_OP='INSERT' OR OLD.storage_path IS DISTINCT FROM NEW.storage_path)
     AND NOT EXISTS (SELECT 1 FROM workflow.document_ai_job j
                      WHERE j.document_id = NEW.document_id
                        AND j.job_type='enrich' AND j.status IN ('pending','processing')) THEN
    INSERT INTO workflow.document_ai_job (document_id, job_type) VALUES (NEW.document_id, 'enrich');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_document_enqueue_enrich ON workflow.document;
CREATE TRIGGER trg_document_enqueue_enrich
  AFTER INSERT OR UPDATE OF storage_path ON workflow.document
  FOR EACH ROW EXECUTE FUNCTION workflow.enqueue_document_enrich();

-- worker API: claim one job safely under concurrency (FOR UPDATE SKIP LOCKED)
CREATE OR REPLACE FUNCTION workflow.claim_ai_job(p_worker text)
RETURNS workflow.document_ai_job LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE j workflow.document_ai_job;
BEGIN
  UPDATE workflow.document_ai_job
     SET status='processing', attempts=attempts+1, claimed_at=now(), claimed_by=p_worker
   WHERE job_id = (SELECT job_id FROM workflow.document_ai_job
                    WHERE status='pending' ORDER BY job_id
                    FOR UPDATE SKIP LOCKED LIMIT 1)
  RETURNING * INTO j;
  RETURN j;   -- NULL row when the queue is empty
END $$;

CREATE OR REPLACE FUNCTION workflow.complete_ai_job(p_job bigint, p_result jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$ UPDATE workflow.document_ai_job
         SET status='complete', completed_at=now(), result=p_result WHERE job_id=p_job; $$;

CREATE OR REPLACE FUNCTION workflow.fail_ai_job(p_job bigint, p_error text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$ UPDATE workflow.document_ai_job
         SET status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'pending' END,   -- 3 tries, then loud failure
             last_error = p_error, completed_at = CASE WHEN attempts >= 3 THEN now() END
       WHERE job_id=p_job; $$;

REVOKE ALL ON FUNCTION workflow.claim_ai_job(text), workflow.complete_ai_job(bigint,jsonb), workflow.fail_ai_job(bigint,text) FROM PUBLIC;
-- (worker connects as service role; staff never call these directly)

-- ------------------------------------------------------------------
-- C. case-wide full-text search — ranked, snippeted, RLS-respecting
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION workflow.search_documents(p_matter uuid, p_query text)
RETURNS TABLE (document_id uuid, title text, doc_type_code text, rank real, snippet text)
LANGUAGE sql STABLE
AS $$
  SELECT d.document_id, d.title, d.doc_type_code,
         ts_rank(d.search_tsv, websearch_to_tsquery('english', p_query)) AS rank,
         ts_headline('english', coalesce(d.extracted_text, d.ai_description, d.title),
                     websearch_to_tsquery('english', p_query),
                     'MaxFragments=2, MaxWords=18, MinWords=8') AS snippet
    FROM workflow.document d
   WHERE d.client_matter_id = p_matter
     AND d.deleted_at IS NULL
     AND d.search_tsv @@ websearch_to_tsquery('english', p_query)
   ORDER BY rank DESC
   LIMIT 50;
$$;
-- runs as INVOKER: the caller's RLS applies — intake can't search medical documents.
GRANT EXECUTE ON FUNCTION workflow.search_documents(uuid, text) TO app_staff;

-- ------------------------------------------------------------------
-- D. OPTIONAL semantic layer (pgvector already installed) — concept search
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workflow.document_chunk (
  chunk_id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id  uuid NOT NULL REFERENCES workflow.document(document_id) ON DELETE RESTRICT,
  page_from    integer,
  page_to      integer,
  content      text NOT NULL,
  embedding    vector(1024)
);
CREATE INDEX IF NOT EXISTS idx_chunk_document ON workflow.document_chunk(document_id);
ALTER TABLE workflow.document_chunk ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_read ON workflow.document_chunk;
CREATE POLICY p_read ON workflow.document_chunk FOR SELECT
  USING (EXISTS (SELECT 1 FROM workflow.document d
                  WHERE d.document_id = document_chunk.document_id
                    AND d.deleted_at IS NULL
                    AND app.can_view_doc_type(d.doc_type_code)));   -- same tiers as the document itself
GRANT SELECT ON workflow.document_chunk TO app_staff;
-- embedding index (create after data exists; ivfflat wants rows first):
-- CREATE INDEX idx_chunk_embedding ON workflow.document_chunk USING ivfflat (embedding vector_cosine_ops) WITH (lists=100);

-- ------------------------------------------------------------------
-- E. category gaps from the spec list → new ref.document_type rows
-- ------------------------------------------------------------------
INSERT INTO ref.document_type (code, label, category) VALUES
 ('acknowledgment_letter',      'Letter of acknowledgment (carrier)',        'claims'),
 ('counter_demand',             'Counter-demand / counter-offer letter',     'resolution'),
 ('negotiation_correspondence', 'Negotiation correspondence (back & forth)', 'resolution'),
 ('client_document',            'Client-provided document',                  'general'),
 ('client_photo',               'Client-provided photos',                    'investigation'),
 ('disbursement_doc',           'Disbursement paperwork',                    'resolution')
ON CONFLICT (code) DO NOTHING;

COMMIT;
