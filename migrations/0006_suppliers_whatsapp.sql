-- ═══════════════════════════════════════════════════════════════════
-- Migration 0006: Add whatsapp column to suppliers
-- Date: 2026-03-31
-- Strategy: ADD COLUMN only — no DROP, no data deletion
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS whatsapp TEXT;
