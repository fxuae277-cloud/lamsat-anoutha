-- Migration 0019: إضافة حقلي العنوان والهاتف لجدول branches
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS phone   TEXT;
