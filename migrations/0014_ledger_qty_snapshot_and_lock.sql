-- Migration 0014
-- ① عمودا qty_before / qty_after في inventory_ledger
-- ② trigger يملؤهما تلقائياً عند كل INSERT
-- (أعمدة failed_login_count / locked_until / last_login موجودة من migration 0011)

-- ── inventory_ledger: إضافة العمودين ─────────────────────────────────────
ALTER TABLE inventory_ledger ADD COLUMN IF NOT EXISTS qty_before INTEGER;
ALTER TABLE inventory_ledger ADD COLUMN IF NOT EXISTS qty_after  INTEGER;

-- ── دالة trigger: تقرأ qty_on_hand الحالية من inventory_balances ──────────
-- المنطق:
--   qty_after  = القيمة الموجودة في inventory_balances بعد تحديثها
--   qty_before = qty_after - qty_change
-- (الكود يُحدّث inventory_balances أولاً ثم يُدرج في inventory_ledger،
--  لذا نعكس العملية للحصول على الرصيد السابق)
CREATE OR REPLACE FUNCTION fn_ledger_qty_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  v_after INTEGER;
BEGIN
  -- القيمة بعد العملية (موجودة بالفعل في inventory_balances)
  SELECT COALESCE(qty_on_hand, 0)
    INTO v_after
    FROM inventory_balances
   WHERE variant_id = NEW.variant_id
     AND location_id = NEW.location_id;

  IF NOT FOUND THEN
    v_after := COALESCE(NEW.qty_change, 0);
  END IF;

  NEW.qty_after  := v_after;
  NEW.qty_before := v_after - COALESCE(NEW.qty_change, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── إنشاء الـ trigger ──────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_ledger_qty_snapshot ON inventory_ledger;
CREATE TRIGGER trg_ledger_qty_snapshot
  BEFORE INSERT ON inventory_ledger
  FOR EACH ROW EXECUTE FUNCTION fn_ledger_qty_snapshot();
