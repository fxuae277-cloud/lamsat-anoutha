-- Migration 0021: جدول مرفقات الفواتير (مخزّنة في PostgreSQL لضمان الثبات)
CREATE TABLE IF NOT EXISTS purchase_attachments (
  id          SERIAL PRIMARY KEY,
  purchase_id INTEGER NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  filename    TEXT    NOT NULL,
  content_type TEXT   NOT NULL DEFAULT 'image/jpeg',
  data        TEXT    NOT NULL, -- base64 encoded file content
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_attachments_purchase_id
  ON purchase_attachments(purchase_id);
