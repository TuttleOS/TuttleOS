-- ================================================================================
-- TUTTLE OS — v2.6 ROLLBACK: removes the AI enrichment + search layer.
-- Restores the schema to its v2.2 shape (run v2.2's rollback afterward if you
-- also want the storage layer gone). Enrichment DATA in the dropped columns and
-- queue history are discarded — files in Storage are untouched.
-- ================================================================================
BEGIN;
SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', true);

DROP FUNCTION IF EXISTS workflow.search_documents(uuid, text);
DROP TABLE IF EXISTS workflow.document_chunk;

DROP TRIGGER IF EXISTS trg_document_enqueue_enrich ON workflow.document;
DROP FUNCTION IF EXISTS workflow.enqueue_document_enrich();
DROP FUNCTION IF EXISTS workflow.claim_ai_job(text);
DROP FUNCTION IF EXISTS workflow.complete_ai_job(bigint, jsonb);
DROP FUNCTION IF EXISTS workflow.fail_ai_job(bigint, text);
DROP TABLE IF EXISTS workflow.document_ai_job;

DROP INDEX IF EXISTS workflow.idx_document_search_tsv;
ALTER TABLE workflow.document
  DROP COLUMN IF EXISTS search_tsv,
  DROP COLUMN IF EXISTS ocr_page_count,
  DROP COLUMN IF EXISTS ai_extracted,
  DROP COLUMN IF EXISTS extracted_text,
  DROP COLUMN IF EXISTS ai_description;

DELETE FROM ref.document_type r
 WHERE r.code IN ('acknowledgment_letter','counter_demand','negotiation_correspondence','client_document','client_photo','disbursement_doc')
   AND NOT EXISTS (SELECT 1 FROM workflow.document d WHERE d.doc_type_code = r.code);

COMMIT;
