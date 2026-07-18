-- ================================================================================
-- TUTTLE OS — v2.2 OPTIONAL UPGRADE: NATIVE FILE STORAGE FOR CASE DOCUMENTS
-- Status: DRAFT / NOT ADOPTED — apply only when the firm decides to incorporate it.
--
-- What this adds (ADDITIVE ONLY — nothing in v2.0/v2.1 is modified in place):
--   A. File-storage columns on workflow.document (the table already tracks every
--      document type: medicals, petitions, answers, photos, contracts, etc.).
--      File BYTES live in Supabase Storage; the database stores the pointer.
--   B. app.can_view_doc_type(code) — category-aware visibility helper: intake
--      is blocked from document METADATA in restricted categories (medical,
--      litigation, liens, resolution, claims, damages, investigation), matching
--      the v2.1 intake data tiers.
--   C. Tightened SELECT policy on workflow.document using (B). v2.1's policy let
--      ALL active staff read every document row — including medical-records
--      metadata; this closes that gap while we're here.
--   D. workflow.document_access_log — who viewed/downloaded which file, when
--      (HIPAA posture: every signed-URL issuance gets a row).
--   E. Supabase Storage buckets + policies (COMMENTED — run in Supabase only;
--      storage.objects does not exist in a bare Postgres).
--
-- BACKING OUT: run rollback_v2.2_documents.sql — it removes everything this
-- script created and restores the v2.1 policy verbatim. Files already uploaded
-- to Storage buckets are NOT deleted by the rollback (remove them in Supabase
-- if desired); dropping the columns discards any pointers stored in them.
-- ================================================================================

BEGIN;

-- audit actor for this migration (v2.1 requires a loud actor on every write)
SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', true);

-- ------------------------------------------------------------------
-- A. file-storage columns on workflow.document
-- ------------------------------------------------------------------
ALTER TABLE workflow.document
  ADD COLUMN IF NOT EXISTS storage_path           text,
  ADD COLUMN IF NOT EXISTS mime_type              text,
  ADD COLUMN IF NOT EXISTS byte_size              bigint,
  ADD COLUMN IF NOT EXISTS original_filename      text,
  ADD COLUMN IF NOT EXISTS uploaded_at            timestamptz,
  ADD COLUMN IF NOT EXISTS uploaded_by            uuid REFERENCES core.staff(staff_id),
  ADD COLUMN IF NOT EXISTS supersedes_document_id uuid REFERENCES workflow.document(document_id);

ALTER TABLE workflow.document
  DROP CONSTRAINT IF EXISTS document_byte_size_check,
  ADD CONSTRAINT document_byte_size_check CHECK (byte_size IS NULL OR byte_size >= 0);

COMMENT ON COLUMN workflow.document.storage_path IS
  'v2.2: object key in Supabase Storage (bucket case-documents). NULL = metadata-only row (e.g. legacy Dropbox file — see dropbox_path).';
COMMENT ON COLUMN workflow.document.supersedes_document_id IS
  'v2.2: points at the version this file replaces (amended petition, corrected affidavit). Old row stays for the record.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_document_storage_path
  ON workflow.document(storage_path) WHERE storage_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_supersedes
  ON workflow.document(supersedes_document_id) WHERE supersedes_document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_uploaded_by
  ON workflow.document(uploaded_by) WHERE uploaded_by IS NOT NULL;

-- ------------------------------------------------------------------
-- B. category-aware document visibility (mirrors v2.1 intake tiers)
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.can_view_doc_type(p_code text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT CASE
    WHEN NOT app.is_active_staff() THEN false
    WHEN (SELECT dt.category FROM ref.document_type dt WHERE dt.code = p_code)
         IN ('medical','litigation','liens','resolution','claims','damages','investigation')
      THEN NOT app.is_intake_only()
    ELSE true   -- intake/general categories stay visible to all active staff
  END;
$$;
REVOKE ALL ON FUNCTION app.can_view_doc_type(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.can_view_doc_type(text) TO app_staff;

-- ------------------------------------------------------------------
-- C. tighten workflow.document read policy (was: any active staff)
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS p_read ON workflow.document;
CREATE POLICY p_read ON workflow.document
  FOR SELECT USING (app.can_view_doc_type(doc_type_code));

-- ------------------------------------------------------------------
-- D. access log — one row per view/download/upload of a stored file
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workflow.document_access_log (
  access_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES workflow.document(document_id) ON DELETE RESTRICT,
  staff_id    uuid NOT NULL REFERENCES core.staff(staff_id),
  action      text NOT NULL CHECK (action IN ('view','download','upload','replace','share_link')),
  accessed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doc_access_document ON workflow.document_access_log(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_access_staff    ON workflow.document_access_log(staff_id);

ALTER TABLE workflow.document_access_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_read ON workflow.document_access_log;
CREATE POLICY p_read ON workflow.document_access_log
  FOR SELECT USING (app.is_attorney() OR staff_id = app.current_staff_id());
DROP POLICY IF EXISTS p_ins ON workflow.document_access_log;
CREATE POLICY p_ins ON workflow.document_access_log
  FOR INSERT WITH CHECK (staff_id = app.current_staff_id());
-- no UPDATE / DELETE policies: the log is append-only for everyone.

GRANT SELECT, INSERT ON workflow.document_access_log TO app_staff;

COMMIT;

-- ================================================================================
-- E. SUPABASE-ONLY SECTION — run in the Supabase SQL editor AFTER deployment.
--    (storage.objects does not exist in a bare Postgres; kept commented so this
--    file remains runnable and testable locally.)
-- --------------------------------------------------------------------------------
-- -- one private bucket; per-file authorization comes from the document row
-- insert into storage.buckets (id, name, public, file_size_limit)
-- values ('case-documents', 'case-documents', false, 524288000)  -- 500 MB/file
-- on conflict (id) do nothing;
--
-- -- READ a file only if you may see its document row (same tiers as the data)
-- create policy "doc_read" on storage.objects for select using (
--   bucket_id = 'case-documents' and exists (
--     select 1 from workflow.document d
--     where d.storage_path = storage.objects.name
--       and d.deleted_at is null
--       and app.can_view_doc_type(d.doc_type_code))
-- );
--
-- -- UPLOAD only as yourself, only as active staff
-- create policy "doc_insert" on storage.objects for insert with check (
--   bucket_id = 'case-documents' and app.is_active_staff()
-- );
--
-- -- no update/delete policies: files are immutable; corrections go through
-- -- supersedes_document_id (new version), never overwrite. Soft-delete the row.
-- ================================================================================
