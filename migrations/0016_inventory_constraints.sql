-- Migration 0016: منع الكميات السالبة في المخزون + فهارس الأداء

-- 1. قيد: qty_on_hand لا تقل عن صفر في inventory_balances
ALTER TABLE inventory_balances
  DROP CONSTRAINT IF EXISTS chk_inventory_balances_qty_non_negative;

ALTER TABLE inventory_balances
  ADD CONSTRAINT chk_inventory_balances_qty_non_negative
  CHECK (qty_on_hand >= 0);

-- 2. قيد: qty_on_hand لا تقل عن صفر في location_inventory
ALTER TABLE location_inventory
  DROP CONSTRAINT IF EXISTS chk_location_inventory_qty_non_negative;

ALTER TABLE location_inventory
  ADD CONSTRAINT chk_location_inventory_qty_non_negative
  CHECK (qty_on_hand >= 0);

-- 3. فهرس للبحث السريع بالباركود في product_variants
CREATE INDEX IF NOT EXISTS idx_product_variants_barcode
  ON product_variants (barcode)
  WHERE barcode IS NOT NULL;

-- 4. فهرس للبحث السريع في inventory_balances
CREATE INDEX IF NOT EXISTS idx_inventory_balances_variant
  ON inventory_balances (variant_id);

CREATE INDEX IF NOT EXISTS idx_inventory_balances_location
  ON inventory_balances (location_id);

-- 5. فهرس للبحث في المبيعات بالتاريخ
CREATE INDEX IF NOT EXISTS idx_sales_created_at
  ON sales (created_at DESC);

-- 6. فهرس للبحث في فواتير الشراء بالمورد
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier
  ON purchase_invoices (supplier_id);
