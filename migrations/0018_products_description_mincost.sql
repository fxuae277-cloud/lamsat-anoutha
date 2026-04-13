-- Migration 0018: إضافة حقول الوصف والتكلفة وحد المخزون لجدول products

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS description    TEXT,
  ADD COLUMN IF NOT EXISTS cost_default   DECIMAL(10,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_qty        INTEGER DEFAULT 5;
