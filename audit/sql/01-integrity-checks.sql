-- ══════════════════════════════════════════════════════════════════════════════
-- 🔍 PHASE 1: DATA INTEGRITY CHECKS — لمسة أنوثة POS/ERP
-- التاريخ: 2026-05-01
-- الهدف: اكتشاف كل مشاكل سلامة البيانات قبل الإطلاق
-- ══════════════════════════════════════════════════════════════════════════════

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- A. سجلات يتيمة (Orphan Records)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- A1: sale_items بدون sale
SELECT 'A1_orphan_sale_items' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM sale_items si
LEFT JOIN sales s ON si.sale_id = s.id
WHERE s.id IS NULL;

-- A2: sale_items بمنتجات محذوفة
SELECT 'A2_sale_items_deleted_product' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM sale_items si
LEFT JOIN products p ON si.product_id = p.id
WHERE p.id IS NULL;

-- A3: purchase_items بدون purchase_invoice
SELECT 'A3_orphan_purchase_items' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM purchase_items pi2
LEFT JOIN purchase_invoices pi ON pi2.purchase_id = pi.id
WHERE pi.id IS NULL;

-- A4: order_items بدون order
SELECT 'A4_orphan_order_items' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM order_items oi
LEFT JOIN orders o ON oi.order_id = o.id
WHERE o.id IS NULL;

-- A5: inventory بدون منتج
SELECT 'A5_inventory_no_product' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM inventory i
LEFT JOIN products p ON i.product_id = p.id
WHERE p.id IS NULL;

-- A6: location_inventory بدون موقع
SELECT 'A6_location_inventory_no_location' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM location_inventory li
LEFT JOIN locations l ON li.location_id = l.id
WHERE l.id IS NULL;

-- A7: sale_return_items بدون sale_return
SELECT 'A7_orphan_return_items' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM sale_return_items sri
LEFT JOIN sale_returns sr ON sri.return_id = sr.id
WHERE sr.id IS NULL;

-- A8: cash_ledger بدون branch
SELECT 'A8_cash_ledger_no_branch' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM cash_ledger cl
LEFT JOIN branches b ON cl.branch_id = b.id
WHERE b.id IS NULL;

-- A9: journal_entry_lines بدون entry
SELECT 'A9_orphan_journal_lines' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM journal_entry_lines jel
LEFT JOIN journal_entries je ON jel.entry_id = je.id
WHERE je.id IS NULL;

-- A10: payroll_details بدون payroll_run
SELECT 'A10_orphan_payroll_details' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM payroll_details pd
LEFT JOIN payroll_runs pr ON pd.payroll_id = pr.id
WHERE pr.id IS NULL;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- B. تكرارات (Duplicates)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- B1: فواتير بيع مكررة (نفس رقم الفاتورة)
SELECT 'B1_duplicate_invoice_numbers' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM (
  SELECT invoice_number, COUNT(*) AS cnt
  FROM sales
  GROUP BY invoice_number
  HAVING COUNT(*) > 1
) dups;

-- B1-detail: تفاصيل الفواتير المكررة
SELECT invoice_number, COUNT(*) AS duplicate_count,
       MIN(id) AS first_id, MAX(id) AS last_id,
       SUM(total) AS total_amount
FROM sales
GROUP BY invoice_number
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- B2: منتجات بنفس الباركود
SELECT 'B2_duplicate_product_barcodes' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM (
  SELECT barcode, COUNT(*) AS cnt
  FROM products
  WHERE barcode IS NOT NULL AND barcode != ''
  GROUP BY barcode
  HAVING COUNT(*) > 1
) dups;

-- B3: مستخدمون بنفس اسم المستخدم
SELECT 'B3_duplicate_usernames' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM (
  SELECT username, COUNT(*) AS cnt
  FROM users
  GROUP BY username
  HAVING COUNT(*) > 1
) dups;

-- B4: فواتير شراء مكررة
SELECT 'B4_duplicate_purchase_numbers' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM (
  SELECT invoice_number, supplier_id, COUNT(*) AS cnt
  FROM purchase_invoices
  GROUP BY invoice_number, supplier_id
  HAVING COUNT(*) > 1
) dups;

-- B5: سجلات مخزون مكررة في location_inventory
SELECT 'B5_duplicate_location_inventory' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM (
  SELECT location_id, product_id, COUNT(*) AS cnt
  FROM location_inventory
  GROUP BY location_id, product_id
  HAVING COUNT(*) > 1
) dups;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- C. حقول فارغة/null في بيانات حرجة (NULL/Empty Critical Fields)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- C1: مبيعات بدون رقم فاتورة
SELECT 'C1_sales_no_invoice_number' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM sales
WHERE invoice_number IS NULL OR invoice_number = '';

-- C2: منتجات بأسعار صفر أو سالبة
SELECT 'C2_products_zero_or_neg_price' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END AS status
FROM products
WHERE price::decimal <= 0 AND active = true;

-- C2-detail
SELECT id, name, barcode, price, cost_default
FROM products
WHERE price::decimal <= 0 AND active = true
ORDER BY id;

-- C3: مبيعات بمبالغ سالبة (ليست مرتجعات)
SELECT 'C3_negative_sale_totals' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM sales
WHERE total::decimal < 0 AND status NOT IN ('cancelled', 'refunded');

-- C4: sale_items بكميات صفر أو سالبة
SELECT 'C4_sale_items_zero_qty' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM sale_items
WHERE quantity <= 0;

-- C5: فواتير شراء بمجموع صفر أو سالب (مكتملة)
SELECT 'C5_purchase_zero_total' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END AS status
FROM purchase_invoices
WHERE grand_total::decimal = 0 AND status = 'received';

-- C6: مستخدمون بدون branch_id
SELECT 'C6_users_no_branch' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM users
WHERE branch_id IS NULL AND role != 'superadmin';

-- C7: منتجات بتكلفة NULL
SELECT 'C7_products_null_cost' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END AS status
FROM products
WHERE (cost_default IS NULL OR cost_default::decimal = 0)
  AND active = true;

-- C7-detail
SELECT id, name, barcode, cost_default, avg_cost, last_purchase_price
FROM products
WHERE (cost_default IS NULL OR cost_default::decimal = 0)
  AND active = true
ORDER BY id
LIMIT 50;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- D. شذوذات منطقية (Logical Anomalies)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- D1: مخزون سالب في location_inventory
SELECT 'D1_negative_location_inventory' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM location_inventory
WHERE qty_on_hand < 0;

-- D1-detail: المنتجات بمخزون سالب
SELECT li.id, p.name AS product_name, p.barcode,
       l.name AS location_name, l.code AS location_code,
       li.qty_on_hand
FROM location_inventory li
JOIN products p ON li.product_id = p.id
JOIN locations l ON li.location_id = l.id
WHERE li.qty_on_hand < 0
ORDER BY li.qty_on_hand;

-- D2: مخزون سالب في products.stock_qty
SELECT 'D2_negative_stock_qty' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM products
WHERE stock_qty < 0 AND active = true;

-- D3: sales بـ total != subtotal - discount + vat
SELECT 'D3_sales_total_mismatch' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM sales
WHERE ABS(
  total::decimal -
  (subtotal::decimal
   - CASE WHEN discount_type = 'percentage'
       THEN subtotal::decimal * discount::decimal / 100
       ELSE COALESCE(discount::decimal, 0)
     END
   + COALESCE(vat::decimal, 0))
) > 0.01;

-- D3-detail
SELECT id, invoice_number, subtotal, discount, discount_type, vat, total,
       (subtotal::decimal
        - CASE WHEN discount_type = 'percentage'
            THEN subtotal::decimal * discount::decimal / 100
            ELSE COALESCE(discount::decimal, 0)
          END
        + COALESCE(vat::decimal, 0)) AS calculated_total,
       total::decimal - (subtotal::decimal
        - CASE WHEN discount_type = 'percentage'
            THEN subtotal::decimal * discount::decimal / 100
            ELSE COALESCE(discount::decimal, 0)
          END
        + COALESCE(vat::decimal, 0)) AS diff
FROM sales
WHERE ABS(
  total::decimal -
  (subtotal::decimal
   - CASE WHEN discount_type = 'percentage'
       THEN subtotal::decimal * discount::decimal / 100
       ELSE COALESCE(discount::decimal, 0)
     END
   + COALESCE(vat::decimal, 0))
) > 0.01
ORDER BY ABS(total::decimal) DESC
LIMIT 20;

-- D4: sale_items total != quantity * unit_price
SELECT 'D4_sale_items_total_mismatch' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM sale_items
WHERE ABS(total::decimal - (quantity * unit_price::decimal) + COALESCE(line_discount::decimal, 0)) > 0.01;

-- D5: sales.cogs_total != SUM(sale_items.line_cogs)
SELECT 'D5_cogs_total_mismatch' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM sales s
WHERE ABS(
  s.cogs_total::decimal - COALESCE((
    SELECT SUM(si.line_cogs::decimal)
    FROM sale_items si WHERE si.sale_id = s.id
  ), 0)
) > 0.01
AND s.status != 'cancelled';

-- D5-detail
SELECT s.id, s.invoice_number, s.cogs_total,
       COALESCE(SUM(si.line_cogs::decimal), 0) AS computed_cogs,
       s.cogs_total::decimal - COALESCE(SUM(si.line_cogs::decimal), 0) AS diff
FROM sales s
LEFT JOIN sale_items si ON si.sale_id = s.id
WHERE s.status != 'cancelled'
GROUP BY s.id, s.invoice_number, s.cogs_total
HAVING ABS(s.cogs_total::decimal - COALESCE(SUM(si.line_cogs::decimal), 0)) > 0.01
ORDER BY ABS(s.cogs_total::decimal - COALESCE(SUM(si.line_cogs::decimal), 0)) DESC
LIMIT 20;

-- D6: وردية مغلقة بـ total_sales لا يتطابق مع مبيعاتها
SELECT 'D6_shift_total_mismatch' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END AS status
FROM shifts sh
WHERE sh.status = 'closed'
AND ABS(
  sh.total_sales::decimal - COALESCE((
    SELECT SUM(s.total::decimal)
    FROM sales s
    WHERE s.shift_id = sh.id AND s.status NOT IN ('cancelled')
  ), 0)
) > 0.01;

-- D7: sale_returns بمبالغ استرداد أكبر من أصل الفاتورة
SELECT 'D7_return_exceeds_sale' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM sale_returns sr
JOIN sales s ON sr.sale_id = s.id
WHERE sr.refund_amount::decimal > s.total::decimal;

-- D8: منتجات فاعلة بدون location_inventory في أي موقع
SELECT 'D8_active_products_no_inventory' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END AS status
FROM products p
WHERE p.active = true
AND NOT EXISTS (
  SELECT 1 FROM location_inventory li WHERE li.product_id = p.id
);

-- D9: sales بـ amount_paid < total (غير مكتملة الدفع) بدون status مناسب
SELECT 'D9_underpaid_sales_wrong_status' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END AS status
FROM sales
WHERE amount_paid::decimal < total::decimal * 0.99  -- هامش 1%
  AND status = 'completed'
  AND payment_method = 'cash';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- E. سلامة المراجع (Referential Integrity — حقول بدون FK صريح)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- E1: orders.invoice_id يشير لـ sale غير موجود
SELECT 'E1_orders_invalid_invoice_id' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM orders o
WHERE o.invoice_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM sales s WHERE s.id = o.invoice_id
);

-- E2: purchase_items.variant_id يشير لـ variant غير موجود
SELECT 'E2_purchase_items_invalid_variant' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM purchase_items pi2
WHERE pi2.variant_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM product_variants pv WHERE pv.id = pi2.variant_id
);

-- E3: sales.shift_id يشير لـ shift غير موجود
SELECT 'E3_sales_invalid_shift' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM sales s
WHERE s.shift_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM shifts sh WHERE sh.id = s.shift_id
);

-- E4: expenses.shift_id يشير لـ shift غير موجود
SELECT 'E4_expenses_invalid_shift' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM expenses e
WHERE e.shift_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM shifts sh WHERE sh.id = e.shift_id
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- F. مشاكل الترميز (Encoding Issues — Arabic)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- F1: منتجات باسم "Item" أو اسم إنجليزي بحت (يجب أن تكون عربية أو ثنائية)
SELECT 'F1_products_english_only_name' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END AS status
FROM products
WHERE name ~ '^[A-Za-z0-9\s\-_]+$'  -- إنجليزي فقط
  AND name NOT SIMILAR TO '%(AR|ar)%'
  AND active = true;

-- F1-detail
SELECT id, name, barcode, active
FROM products
WHERE name ~ '^[A-Za-z0-9\s\-_]+$'
  AND active = true
ORDER BY id
LIMIT 30;

-- F2: منتجات باسم غير مناسب (Item, Test, Sample, تجريبي)
SELECT 'F2_test_or_placeholder_products' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END AS status
FROM products
WHERE (LOWER(name) LIKE '%item%' OR LOWER(name) LIKE '%test%'
    OR LOWER(name) LIKE '%sample%' OR name LIKE '%تجريب%'
    OR name LIKE '%dummy%')
  AND active = true;

-- F2-detail
SELECT id, name, barcode, stock_qty
FROM products
WHERE (LOWER(name) LIKE '%item%' OR LOWER(name) LIKE '%test%'
    OR LOWER(name) LIKE '%sample%' OR name LIKE '%تجريب%'
    OR name LIKE '%dummy%')
  AND active = true;

-- F3: عملاء بأسماء فارغة أو رقمية فقط
SELECT 'F3_customers_invalid_names' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END AS status
FROM customers
WHERE (name IS NULL OR name = '' OR name ~ '^\d+$')
  AND active = true;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- G. ملخص شامل
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ملخص إحصائي للنظام
SELECT
  (SELECT COUNT(*) FROM products WHERE active = true) AS active_products,
  (SELECT COUNT(*) FROM sales WHERE status != 'cancelled') AS total_sales,
  (SELECT SUM(total::decimal) FROM sales WHERE status != 'cancelled') AS total_revenue,
  (SELECT COUNT(*) FROM customers WHERE active = true) AS active_customers,
  (SELECT COUNT(*) FROM purchase_invoices) AS total_purchases,
  (SELECT COUNT(*) FROM shifts) AS total_shifts,
  (SELECT COUNT(*) FROM users WHERE is_active = true) AS active_users,
  (SELECT COUNT(*) FROM branches) AS branches_count;
