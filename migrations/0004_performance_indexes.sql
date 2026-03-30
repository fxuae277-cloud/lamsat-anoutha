-- =============================================================
-- Phase 4: Performance Indexes
-- Created: 2026-03-30
-- Safe to run in production: all indexes use CONCURRENTLY
-- (builds in background, zero table locking)
-- =============================================================

-- ── sales (most queried table) ────────────────────────────────
-- Functional index for DATE(created_at) used in every dashboard query
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_date_func
  ON sales ((DATE(created_at)));

-- Composite for branch + date range (most common filter combo)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_branch_created
  ON sales (branch_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_cashier_id
  ON sales (cashier_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_customer_id
  ON sales (customer_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_shift_id
  ON sales (shift_id);

-- ── sale_items ────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_items_sale_id
  ON sale_items (sale_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_items_product_id
  ON sale_items (product_id);

-- ── expenses ─────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_branch_date
  ON expenses (branch_id, date DESC);

-- ── purchase_invoices ─────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_invoices_status
  ON purchase_invoices (status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_invoices_supplier_id
  ON purchase_invoices (supplier_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_invoices_invoice_date
  ON purchase_invoices (invoice_date DESC);

-- ── purchase_items ────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_items_purchase_id
  ON purchase_items (purchase_id);

-- Critical: DISTINCT ON (product_id) ORDER BY invoice_date DESC runs in every dashboard
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_items_product_id
  ON purchase_items (product_id);

-- ── shifts ───────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_branch_status
  ON shifts (branch_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_cashier_id
  ON shifts (cashier_id);

-- ── orders ───────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_branch_status
  ON orders (branch_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_at
  ON orders (created_at DESC);

-- ── order_items ───────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id
  ON order_items (order_id);

-- ── locations ─────────────────────────────────────────────────
-- Called 5-10 times per request to resolve branch locations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_locations_branch_id
  ON locations (branch_id);

-- ── product_variants ──────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_variants_product_id
  ON product_variants (product_id);

-- ── inventory_balances ────────────────────────────────────────
-- Composite unique (location_id, variant_id) exists but doesn't help
-- queries filtering by variant_id alone
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_balances_variant_id
  ON inventory_balances (variant_id);

-- ── inventory_ledger ──────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_ledger_variant_location
  ON inventory_ledger (variant_id, location_id);

-- ── stock_transfer_lines ──────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_transfer_lines_transfer_id
  ON stock_transfer_lines (transfer_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_transfer_lines_variant_id
  ON stock_transfer_lines (variant_id);

-- ── journal_entries ───────────────────────────────────────────
-- Auto-journal dedup check on every sale/purchase/expense write
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_journal_entries_source
  ON journal_entries (source_type, source_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_journal_entries_branch_date
  ON journal_entries (branch_id, date DESC);

-- ── journal_entry_lines ───────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_journal_entry_lines_entry_id
  ON journal_entry_lines (entry_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_journal_entry_lines_account_id
  ON journal_entry_lines (account_id);

-- ── payroll ───────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payroll_details_payroll_id
  ON payroll_details (payroll_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payroll_details_employee_id
  ON payroll_details (employee_id);

-- ── employee_advances ─────────────────────────────────────────
-- WHERE employee_id=$1 AND (amount - total_repaid) > 0
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employee_advances_employee_settled
  ON employee_advances (employee_id, settled);

-- ── employee_deductions ───────────────────────────────────────
-- WHERE employee_id=$1 AND applied_in_payroll_id IS NULL
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employee_deductions_employee_payroll
  ON employee_deductions (employee_id, applied_in_payroll_id);

-- ── salary_payments ───────────────────────────────────────────
-- SUM subquery runs on every row of payroll list
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_salary_payments_payroll_id
  ON salary_payments (payroll_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_salary_payments_employee_id
  ON salary_payments (employee_id);

-- ── employee_financial_ledger ─────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_emp_financial_ledger_employee_id
  ON employee_financial_ledger (employee_id);

-- ── customers ─────────────────────────────────────────────────
-- find-or-create by phone called on every POS sale
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_phone
  ON customers (phone);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_branch_id
  ON customers (branch_id);

-- ── users ─────────────────────────────────────────────────────
-- Looked up on every authenticated request
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_branch_id
  ON users (branch_id);

-- PIN verification on POS login
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_pin
  ON users (pin);

-- ── sale_returns ──────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_returns_branch_created
  ON sale_returns (branch_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_returns_sale_id
  ON sale_returns (sale_id);

-- ── audit_log ─────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_entity
  ON audit_log (entity_type, entity_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_created_at
  ON audit_log (created_at DESC);

-- ── cash_ledger / bank_ledger ─────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cash_ledger_branch_date
  ON cash_ledger (branch_id, date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bank_ledger_branch_date
  ON bank_ledger (branch_id, date DESC);

-- ── inventory_transactions ────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_transactions_branch_id
  ON inventory_transactions (branch_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_transactions_product_id
  ON inventory_transactions (product_id);

-- ── location_transfers ────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_location_transfers_branch_created
  ON location_transfers (branch_id, created_at DESC);

-- ── stocktake_items ───────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stocktake_items_stocktake_id
  ON stocktake_items (stocktake_id);

-- ── purchase_extra_costs ──────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_extra_costs_invoice_id
  ON purchase_extra_costs (purchase_invoice_id);
