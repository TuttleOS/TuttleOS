-- ================================================================================
-- TUTTLE OS — v2.15 STORAGE-ONLY CASE DOCUMENTS
-- Promoted from sql/optional/06_upgrade_v2.2_documents.sql (no AI / do not apply 07).
--
-- Adds:
--   A. File-storage columns on workflow.document
--   B. app.can_view_doc_type(code) — intake blocked from restricted categories
--   C. Tightened SELECT policy on workflow.document
--   D. workflow.document_access_log
--   E. Two general doc types used by the upload UI (correspondence, other)
--
-- After apply (Supabase SQL editor — storage schema only exists there):
--   See comments at bottom for case-documents bucket + storage.objects policies.
--
-- BACKING OUT: sql/rollbacks/rollback_v2.2_documents.sql
--   (also DELETE correspondence / other from ref.document_type if desired)
-- ================================================================================

BEGIN;

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
  'v2.15: object key in Supabase Storage (bucket case-documents). NULL = metadata-only / Dropbox.';
COMMENT ON COLUMN workflow.document.supersedes_document_id IS
  'v2.15: points at the version this file replaces. Old row stays for the record.';

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
    ELSE true
  END;
$$;
REVOKE ALL ON FUNCTION app.can_view_doc_type(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.can_view_doc_type(text) TO app_staff;

-- ------------------------------------------------------------------
-- C. tighten workflow.document read policy
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS p_read ON workflow.document;
CREATE POLICY p_read ON workflow.document
  FOR SELECT USING (app.can_view_doc_type(doc_type_code));

-- ------------------------------------------------------------------
-- D. access log
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

GRANT SELECT, INSERT ON workflow.document_access_log TO app_staff;

-- ------------------------------------------------------------------
-- E. upload UI general types (mockup: correspondence, other)
-- ------------------------------------------------------------------
INSERT INTO ref.document_type (code, label, category) VALUES
  ('correspondence', 'Correspondence', 'intake'),
  ('other', 'Other', 'intake')
ON CONFLICT (code) DO NOTHING;

COMMIT;

-- ================================================================================
-- SUPABASE-ONLY — run in the Supabase SQL editor after this migration:
-- --------------------------------------------------------------------------------
-- insert into storage.buckets (id, name, public, file_size_limit)
-- values ('case-documents', 'case-documents', false, 524288000)  -- 500 MB/file
-- on conflict (id) do nothing;
--
-- create policy "doc_read" on storage.objects for select using (
--   bucket_id = 'case-documents' and exists (
--     select 1 from workflow.document d
--     where d.storage_path = storage.objects.name
--       and d.deleted_at is null
--       and app.can_view_doc_type(d.doc_type_code))
-- );
--
-- create policy "doc_insert" on storage.objects for insert with check (
--   bucket_id = 'case-documents' and app.is_active_staff()
-- );
--
-- (No update/delete policies — files are immutable; corrections use supersedes.)
--
-- App uploads use service-role signed upload URLs, so bucket must exist even if
-- you defer the storage.objects policies until later.
-- ================================================================================
