-- Registration and identity documents. Contents are encrypted by the application before they reach the database.
CREATE TABLE IF NOT EXISTS chama_documents (
    doc_id BIGSERIAL PRIMARY KEY,
    chama_id BIGINT NOT NULL,
    doc_type VARCHAR(40) NOT NULL,
    subject_user_id BIGINT,
    original_name VARCHAR(120) NOT NULL,
    content_type VARCHAR(40) NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'ACTIVE',
    uploaded_by BIGINT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    retention_until TIMESTAMP WITH TIME ZONE NOT NULL,
    legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
    hold_reason VARCHAR(300),
    hold_by BIGINT,
    hold_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by BIGINT,
    delete_reason VARCHAR(300)
);
CREATE INDEX IF NOT EXISTS idx_docs_chama ON chama_documents (chama_id, status);

CREATE TABLE IF NOT EXISTS document_blobs (
    doc_id BIGINT PRIMARY KEY REFERENCES chama_documents (doc_id),
    key_id INTEGER NOT NULL DEFAULT 1,
    iv BYTEA NOT NULL,
    ciphertext BYTEA NOT NULL
);

-- A document's record is permanent. Its contents can only be removed after the retention date and when no legal hold applies.
DROP TRIGGER IF EXISTS trg_docs_no_delete ON chama_documents;
CREATE TRIGGER trg_docs_no_delete BEFORE DELETE ON chama_documents FOR EACH ROW EXECUTE FUNCTION journal_block_change();

CREATE OR REPLACE FUNCTION document_blob_guard() RETURNS trigger AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM chama_documents d WHERE d.doc_id = OLD.doc_id AND (d.legal_hold OR d.retention_until > now())) THEN
        RAISE EXCEPTION 'This document is under a legal hold or inside its retention period and cannot be deleted';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_blob_guard ON document_blobs;
CREATE TRIGGER trg_blob_guard BEFORE DELETE ON document_blobs FOR EACH ROW EXECUTE FUNCTION document_blob_guard();

INSERT INTO role_permissions (role_code, permission) VALUES
 ('SUPER_ADMIN','DOCUMENT_VIEW'),('SUPER_ADMIN','DOCUMENT_DELETE'),('SUPER_ADMIN','LEGAL_HOLD'),
 ('VERIFICATION_REVIEWER','DOCUMENT_VIEW'),
 ('LEGAL','DOCUMENT_VIEW'),('LEGAL','LEGAL_HOLD')
ON CONFLICT DO NOTHING;
