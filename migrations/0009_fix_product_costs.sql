-- Migration 0009: تحديث تكاليف المنتجات الثمانية + بيانات مصروفات تجريبية
-- لمسة أنوثة — نظام إدارة المتجر

-- تحديث cost_price للمنتجات حسب الأسماء
UPDATE products SET cost_price = '5.000' WHERE name ILIKE '%كريستال%' OR name ILIKE '%عمق قلب%';
UPDATE products SET cost_price = '2.000' WHERE name ILIKE '%جلد مطرز%' OR name ILIKE '%اسورة جلد%' OR name ILIKE '%إسورة جلد%';
UPDATE products SET cost_price = '3.000' WHERE name ILIKE '%فراشة%' OR name ILIKE '%سلسال%';
UPDATE products SET cost_price = '7.500' WHERE name ILIKE '%فضة%' OR name ILIKE '%خاتم فضة%';
UPDATE products SET cost_price = '22.000' WHERE name ILIKE '%زفاف%' OR name ILIKE '%طقم زفاف%';
UPDATE products SET cost_price = '2.500' WHERE name ILIKE '%ألماس%' OR name ILIKE '%الماس%' OR name ILIKE '%حلق%';
UPDATE products SET cost_price = '4.000' WHERE name ILIKE '%لؤلؤ%' OR name ILIKE '%اسورة لؤلؤ%' OR name ILIKE '%إسورة لؤلؤ%';
UPDATE products SET cost_price = '6.000' WHERE name ILIKE '%ذهبي وردي%' OR name ILIKE '%عقد ذهبي%';

-- تحديث lineCogs في sale_items بناءً على cost_price المحدّثة
UPDATE sale_items si
SET line_cogs = (si.quantity * p.cost_price::numeric)::text
FROM products p
WHERE si.product_id = p.id
  AND p.cost_price IS NOT NULL
  AND p.cost_price != '0'
  AND p.cost_price != '0.000';

-- بيانات مصروفات تجريبية لفرعَي شناص ولوى
-- ملاحظة: يتطلب وجود branch_id صحيح — يُضاف تلقائياً بـ DO block
DO $$
DECLARE
  v_shannas_id INTEGER;
  v_luwa_id    INTEGER;
  v_user_id    INTEGER;
BEGIN
  -- جلب معرفات الفروع
  SELECT id INTO v_shannas_id FROM branches WHERE name ILIKE '%شناص%' LIMIT 1;
  SELECT id INTO v_luwa_id    FROM branches WHERE name ILIKE '%لوى%'  LIMIT 1;
  SELECT id INTO v_user_id    FROM users    WHERE role IN ('owner','admin') LIMIT 1;

  -- مصروفات شناص
  IF v_shannas_id IS NOT NULL AND v_user_id IS NOT NULL THEN
    INSERT INTO expenses (branch_id, category, amount, source, date, notes, created_by, created_at)
    VALUES
      (v_shannas_id, 'rent',        '150.000', 'bank_transfer', '2026-04-01', 'إيجار شهر أبريل 2026',     v_user_id, NOW()),
      (v_shannas_id, 'electricity', '18.500',  'cash',          '2026-04-02', 'فاتورة الكهرباء مارس',      v_user_id, NOW()),
      (v_shannas_id, 'supplies',    '12.750',  'cash',          '2026-04-03', 'أكياس تغليف وورق هدايا',    v_user_id, NOW()),
      (v_shannas_id, 'transport',   '5.000',   'cash',          '2026-04-04', 'توصيل طلبية بضاعة',         v_user_id, NOW()),
      (v_shannas_id, 'marketing',   '25.000',  'bank_transfer', '2026-04-05', 'إعلان إنستغرام أبريل',      v_user_id, NOW())
    ON CONFLICT DO NOTHING;
  END IF;

  -- مصروفات لوى
  IF v_luwa_id IS NOT NULL AND v_user_id IS NOT NULL THEN
    INSERT INTO expenses (branch_id, category, amount, source, date, notes, created_by, created_at)
    VALUES
      (v_luwa_id, 'rent',        '120.000', 'bank_transfer', '2026-04-01', 'إيجار شهر أبريل 2026 — لوى',  v_user_id, NOW()),
      (v_luwa_id, 'phone',       '8.000',   'cash',          '2026-04-02', 'فاتورة إنترنت وهاتف',          v_user_id, NOW()),
      (v_luwa_id, 'maintenance', '30.000',  'cash',          '2026-04-06', 'صيانة مكيف صالة العرض',        v_user_id, NOW())
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
