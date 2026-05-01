-- ══════════════════════════════════════════════════════════════════════════════
-- 📦 PHASE 3: INVENTORY AUDIT — لمسة أنوثة POS/ERP
-- التاريخ: 2026-05-01
-- الهدف: التحقق من صحة المخزون والتكاليف
-- ══════════════════════════════════════════════════════════════════════════════

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- I1: معادلة المخزون الذهبية
-- products.stock_qty = SUM(location_inventory.qty_on_hand)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT 'I1_stock_qty_vs_location_sum' AS check_name,
       COUNT(*) AS discrepancies,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM (
  SELECT p.id, p.name, p.stock_qty,
         COALESCE(SUM(li.qty_on_hand), 0) AS location_sum
  FROM products p
  LEFT JOIN location_inventory li ON li.product_id = p.id
  WHERE p.active = true
  GROUP BY p.id, p.name, p.stock_qty
  HAVING p.stock_qty != COALESCE(SUM(li.qty_on_hand), 0)
) d;

-- تفاصيل فروق المخزون
SELECT p.id, p.name, p.barcode,
       p.stock_qty AS products_stock_qty,
       COALESCE(SUM(li.qty_on_hand), 0) AS location_sum,
       p.stock_qty - COALESCE(SUM(li.qty_on_hand), 0) AS diff
FROM products p
LEFT JOIN location_inventory li ON li.product_id = p.id
WHERE p.active = true
GROUP BY p.id, p.name, p.barcode, p.stock_qty
HAVING p.stock_qty != COALESCE(SUM(li.qty_on_hand), 0)
ORDER BY ABS(p.stock_qty - COALESCE(SUM(li.qty_on_hand), 0)) DESC
LIMIT 50;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- I2: قيمة المخزون الكاملة (Cost + Retail)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT
  COUNT(DISTINCT p.id) AS products_count,
  SUM(p.stock_qty) AS total_units,
  ROUND(SUM(p.stock_qty * COALESCE(p.avg_cost::decimal, p.cost_default::decimal, 0)), 3) AS inventory_cost_value_omr,
  ROUND(SUM(p.stock_qty * p.price::decimal), 3) AS inventory_retail_value_omr,
  ROUND(SUM(p.stock_qty * p.price::decimal) - SUM(p.stock_qty * COALESCE(p.avg_cost::decimal, p.cost_default::decimal, 0)), 3) AS potential_gross_profit_omr
FROM products p
WHERE p.active = true AND p.stock_qty > 0;

-- قيمة المخزون مفصّلة حسب الفئة
SELECT c.name AS category_name,
       COUNT(p.id) AS products_count,
       SUM(p.stock_qty) AS total_units,
       ROUND(SUM(p.stock_qty * COALESCE(p.avg_cost::decimal, 0)), 3) AS cost_value_omr,
       ROUND(SUM(p.stock_qty * p.price::decimal), 3) AS retail_value_omr
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.active = true AND p.stock_qty > 0
GROUP BY c.name
ORDER BY retail_value_omr DESC;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- I3: منتجات بطيئة الحركة (>90 يوم بدون بيع)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT p.id, p.name, p.barcode,
       p.stock_qty,
       ROUND(p.avg_cost::decimal * p.stock_qty, 3) AS stuck_cost_omr,
       MAX(s.created_at)::date AS last_sale_date,
       CURRENT_DATE - MAX(s.created_at)::date AS days_since_last_sale
FROM products p
LEFT JOIN sale_items si ON si.product_id = p.id
LEFT JOIN sales s ON s.id = si.sale_id AND s.status != 'cancelled'
WHERE p.active = true AND p.stock_qty > 0
GROUP BY p.id, p.name, p.barcode, p.stock_qty, p.avg_cost
HAVING (MAX(s.created_at) IS NULL OR MAX(s.created_at) < NOW() - INTERVAL '90 days')
ORDER BY stuck_cost_omr DESC
LIMIT 50;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- I4: منتجات تحت الحد الأدنى
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT p.id, p.name, p.barcode,
       p.stock_qty AS current_qty,
       p.min_qty AS min_qty,
       p.min_qty - p.stock_qty AS shortage
FROM products p
WHERE p.active = true
  AND p.stock_qty < p.min_qty
  AND p.min_qty > 0
ORDER BY shortage DESC
LIMIT 50;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- I5: منتجات بكمية شاذة (>1000 وحدة)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT p.id, p.name, p.barcode,
       p.stock_qty,
       ROUND(p.avg_cost::decimal * p.stock_qty, 3) AS total_cost_omr
FROM products p
WHERE p.active = true AND p.stock_qty > 1000
ORDER BY p.stock_qty DESC;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- I6: التحقق من Weighted Average Cost
-- الصيغة: avg_cost = (old_qty * old_cost + new_qty * new_cost) / (old_qty + new_qty)
-- هنا نحسب avg_cost المتوقع من فواتير الشراء الأخيرة
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT 'I6_avg_cost_validation' AS check_name,
       COUNT(*) AS products_with_purchase_history,
       COUNT(CASE WHEN ABS(p.avg_cost::decimal - computed_avg) > 0.1 THEN 1 END) AS suspicious_avg_costs
FROM products p
JOIN (
  SELECT pi2.product_id,
         SUM(pi2.qty * pi2.unit_cost_final::decimal) / NULLIF(SUM(pi2.qty), 0) AS computed_avg
  FROM purchase_items pi2
  JOIN purchase_invoices pi ON pi.id = pi2.purchase_id
  WHERE pi.status = 'received'
  GROUP BY pi2.product_id
) latest_costs ON latest_costs.product_id = p.id
WHERE p.active = true AND p.avg_cost::decimal > 0;

-- تفاصيل منتجات avg_cost مشبوهة
SELECT p.id, p.name, p.barcode,
       p.avg_cost AS stored_avg_cost,
       ROUND(SUM(pi2.qty * pi2.unit_cost_final::decimal) / NULLIF(SUM(pi2.qty), 0), 3) AS purchase_avg_cost,
       ROUND(p.avg_cost::decimal - SUM(pi2.qty * pi2.unit_cost_final::decimal) / NULLIF(SUM(pi2.qty), 0), 3) AS diff
FROM products p
JOIN purchase_items pi2 ON pi2.product_id = p.id
JOIN purchase_invoices pi ON pi.id = pi2.purchase_id AND pi.status = 'received'
WHERE p.active = true
GROUP BY p.id, p.name, p.barcode, p.avg_cost
HAVING ABS(p.avg_cost::decimal - SUM(pi2.qty * pi2.unit_cost_final::decimal) / NULLIF(SUM(pi2.qty), 0)) > 0.1
ORDER BY ABS(p.avg_cost::decimal - SUM(pi2.qty * pi2.unit_cost_final::decimal) / NULLIF(SUM(pi2.qty), 0)) DESC
LIMIT 30;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- I7: مخزون سالب (تفصيلي)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT p.id, p.name, p.barcode,
       p.stock_qty AS product_stock_qty,
       l.name AS location_name,
       li.qty_on_hand AS location_qty,
       ROUND(ABS(li.qty_on_hand) * p.avg_cost::decimal, 3) AS cost_impact_omr
FROM products p
JOIN location_inventory li ON li.product_id = p.id
JOIN locations l ON l.id = li.location_id
WHERE li.qty_on_hand < 0 OR p.stock_qty < 0
ORDER BY li.qty_on_hand;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- I8: ملف الجرد الفعلي — بيانات للتصدير
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT
  p.id AS product_id,
  p.barcode,
  p.name AS product_name,
  c.name AS category,
  l.name AS location,
  l.code AS location_code,
  li.qty_on_hand AS system_qty,
  NULL AS counted_qty,      -- يملأها الفريق يدوياً
  NULL AS difference,        -- تُحسب بعد الجرد
  ROUND(p.avg_cost::decimal, 3) AS unit_cost,
  ROUND(p.price::decimal, 3) AS unit_price,
  ROUND(li.qty_on_hand * p.avg_cost::decimal, 3) AS total_cost_value
FROM products p
JOIN location_inventory li ON li.product_id = p.id
JOIN locations l ON l.id = li.location_id
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.active = true
ORDER BY c.name, p.name, l.code;
