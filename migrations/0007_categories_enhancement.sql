-- Migration 0007: Enhance categories table
-- Adds: description, image, is_active columns

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS image       TEXT,
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN NOT NULL DEFAULT true;
