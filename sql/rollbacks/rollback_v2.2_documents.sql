-- ================================================================================
-- TUTTLE OS — v2.2 ROLLBACK: fully backs out upgrade_v2.2_documents.sql
-- Restores the database to its exact v2.1 shape.
--
-- WARNING: dropping the columns discards any storage pointers / upload metadata
-- recorded in them, and dropping document_access_log discards the access history.
-- Files already uploaded to the Supabase 'case-documents' bucket are NOT touched
-- by this script — delete the bucket in Supabase if you also want the files gone.
-- ================================================================================

BEGIN;

SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', true);

-- D. access log
DROP TABLE IF EXISTS workflow.document_access_log;

-- C. restore the v2.1 read policy verbatim
DROP POLICY IF EXISTS p_read ON workflow.document;
CREATE POLICY p_read ON workflow.document
  FOR SELECT USING (app.is_active_staff());

-- B. visibility helper
DROP FUNCTION IF EXISTS app.can_view_doc_type(text);

-- A. file-storage columns + indexes
DROP INDEX IF EXISTS workflow.uq_document_storage_path;
DROP INDEX IF EXISTS workflow.idx_document_supersedes;
DROP INDEX IF EXISTS workflow.idx_document_uploaded_by;

ALTER TABLE workflow.document
  DROP CONSTRAINT IF EXISTS document_byte_size_check;

ALTER TABLE workflow.document
  DROP COLUMN IF EXISTS supersedes_document_id,
  DROP COLUMN IF EXISTS uploaded_by,
  DROP COLUMN IF EXISTS uploaded_at,
  DROP COLUMN IF EXISTS original_filename,
  DROP COLUMN IF EXISTS byte_size,
  DROP COLUMN IF EXISTS mime_type,
  DROP COLUMN IF EXISTS storage_path;

COMMIT;

-- Supabase-only cleanup (run in Supabase SQL editor if section E was applied):
-- drop policy if exists "doc_read"   on storage.objects;
-- drop policy if exists "doc_insert" on storage.objects;
-- -- and remove the 'case-documents' bucket from the Storage UI if desired.
