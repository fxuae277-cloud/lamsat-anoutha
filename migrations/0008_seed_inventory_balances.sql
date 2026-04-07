-- Migration 0008: Seed inventory_balances for all product variants
-- يضيف سجلات مخزون تجريبية لكل متغير منتج غير مسجّل في المخزون

DO $$
DECLARE
  v_location_id INT;
BEGIN
  -- اختر أول موقع متاح (المستودع المركزي أولاً، ثم أي موقع)
  SELECT id INTO v_location_id
  FROM locations
  WHERE active = true
  ORDER BY is_central DESC, id ASC
  LIMIT 1;

  IF v_location_id IS NULL THEN
    RAISE NOTICE 'No active location found — skipping seed';
    RETURN;
  END IF;

  -- أضف سجلات مخزون بكميات تجريبية لكل متغير منتج لا يملك سجلاً بعد
  INSERT INTO inventory_balances (variant_id, location_id, qty_on_hand, qty_reserved)
  SELECT
    pv.id                                      AS variant_id,
    v_location_id                              AS location_id,
    (10 + (pv.id * 7) % 41)::int              AS qty_on_hand,   -- كمية 10-50 حسب ID
    0                                          AS qty_reserved
  FROM product_variants pv
  WHERE pv.active = true
    AND NOT EXISTS (
      SELECT 1 FROM inventory_balances ib2
      WHERE ib2.variant_id = pv.id
        AND ib2.location_id = v_location_id
    )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Inventory seed completed at location_id=%', v_location_id;
END;
$$;
