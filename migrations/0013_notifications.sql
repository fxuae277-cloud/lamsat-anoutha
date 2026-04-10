-- Migration 0013: نظام الإشعارات
-- إشعارات في التطبيق (in-app notifications)

CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  type        TEXT    NOT NULL,                          -- 'invoice_return' | 'low_stock' | ...
  title       TEXT    NOT NULL,
  body        TEXT,
  data        JSONB,                                     -- بيانات إضافية (returnId, saleId, amount...)
  target_role TEXT    NOT NULL DEFAULT 'owner',          -- 'owner' = يراها المالك فقط
  created_by  INTEGER REFERENCES users(id),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  is_read     BOOLEAN   NOT NULL DEFAULT FALSE,
  read_at     TIMESTAMP,
  read_by     INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_target_role ON notifications(target_role);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read     ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at  ON notifications(created_at DESC);
