-- Migration 0015: Add payment_method, due_date, discount, vat columns to purchase_invoices

ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS discount DECIMAL(10,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'value',
  ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(10,3) DEFAULT 0;
