-- ══════════════════════════════════════════════════════════════════════════════
-- 💰 PHASE 2: ACCOUNTING RECONCILIATION — لمسة أنوثة POS/ERP
-- التاريخ: 2026-05-01
-- الهدف: التحقق من توازن 10 معادلات ذهبية محاسبية
-- Tolerance: 0.001 OMR (1 بيسة)
-- ══════════════════════════════════════════════════════════════════════════════

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- المعادلة 1: رأس الفاتورة = مجموع البنود
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT 'EQ1_header_vs_items' AS equation,
       COUNT(*) AS discrepancies,
       ROUND(SUM(ABS(diff)), 3) AS total_diff_omr,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM (
  SELECT s.id,
         s.subtotal::decimal AS header_subtotal,
         SUM(si.total::decimal) AS items_subtotal,
         s.subtotal::decimal - SUM(si.total::decimal) AS diff
  FROM sales s
  JOIN sale_items si ON si.sale_id = s.id
  WHERE s.status NOT IN ('cancelled')
  GROUP BY s.id, s.subtotal
  HAVING ABS(s.subtotal::decimal - SUM(si.total::decimal)) > 0.001
) d;

-- تفاصيل الفروق في المعادلة 1
SELECT s.id, s.invoice_number, s.created_at::date,
       s.subtotal AS header_subtotal,
       SUM(si.total::decimal) AS items_subtotal,
       ROUND(s.subtotal::decimal - SUM(si.total::decimal), 3) AS diff
FROM sales s
JOIN sale_items si ON si.sale_id = s.id
WHERE s.status NOT IN ('cancelled')
GROUP BY s.id, s.invoice_number, s.created_at, s.subtotal
HAVING ABS(s.subtotal::decimal - SUM(si.total::decimal)) > 0.001
ORDER BY ABS(s.subtotal::decimal - SUM(si.total::decimal)) DESC
LIMIT 20;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- المعادلة 2: المدفوع = المبيعات النقدية المكتملة
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT 'EQ2_payments_vs_completed_sales' AS equation,
       COUNT(*) AS discrepancies,
       ROUND(SUM(ABS(diff)), 3) AS total_diff_omr,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END AS status
FROM (
  SELECT id, invoice_number,
         amount_paid::decimal AS paid,
         total::decimal AS total,
         amount_paid::decimal - total::decimal AS diff
  FROM sales
  WHERE status = 'completed'
    AND payment_method = 'cash'
    AND ABS(amount_paid::decimal - total::decimal) > 0.001
    AND change_amount::decimal = 0  -- لا يجب أن يكون هناك فكّة غير محسوبة
) d;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- المعادلة 3: أرصدة العملاء (total_spent vs فعلي)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT 'EQ3_customer_total_spent' AS equation,
       COUNT(*) AS discrepancies,
       ROUND(SUM(ABS(diff)), 3) AS total_diff_omr,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM (
  SELECT c.id, c.name,
         c.total_spent::decimal AS stored_total,
         COALESCE(SUM(s.total::decimal), 0) AS computed_total,
         c.total_spent::decimal - COALESCE(SUM(s.total::decimal), 0) AS diff
  FROM customers c
  LEFT JOIN sales s ON s.customer_id = c.id AND s.status NOT IN ('cancelled')
  WHERE c.active = true
  GROUP BY c.id, c.name, c.total_spent
  HAVING ABS(c.total_spent::decimal - COALESCE(SUM(s.total::decimal), 0)) > 0.001
) d;

-- تفاصيل فروق أرصدة العملاء
SELECT c.id, c.name, c.phone,
       c.total_spent AS stored_total,
       COALESCE(SUM(s.total::decimal), 0) AS computed_total,
       ROUND(c.total_spent::decimal - COALESCE(SUM(s.total::decimal), 0), 3) AS diff
FROM customers c
LEFT JOIN sales s ON s.customer_id = c.id AND s.status NOT IN ('cancelled')
WHERE c.active = true
GROUP BY c.id, c.name, c.phone, c.total_spent
HAVING ABS(c.total_spent::decimal - COALESCE(SUM(s.total::decimal), 0)) > 0.001
ORDER BY ABS(c.total_spent::decimal - COALESCE(SUM(s.total::decimal), 0)) DESC
LIMIT 20;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- المعادلة 4: عدد زيارات العملاء
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT 'EQ4_customer_invoice_count' AS equation,
       COUNT(*) AS discrepancies,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM (
  SELECT c.id,
         c.invoice_count AS stored_count,
         COUNT(s.id) AS computed_count
  FROM customers c
  LEFT JOIN sales s ON s.customer_id = c.id AND s.status NOT IN ('cancelled')
  WHERE c.active = true
  GROUP BY c.id, c.invoice_count
  HAVING ABS(c.invoice_count - COUNT(s.id)) > 0
) d;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- المعادلة 5: رصيد الموردين (total_purchases vs فعلي)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT 'EQ5_supplier_total_purchases' AS equation,
       COUNT(*) AS discrepancies,
       ROUND(SUM(ABS(diff)), 3) AS total_diff_omr,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM (
  SELECT sup.id, sup.name,
         sup.total_purchases::decimal AS stored_total,
         COALESCE(SUM(pi.grand_total::decimal), 0) AS computed_total,
         sup.total_purchases::decimal - COALESCE(SUM(pi.grand_total::decimal), 0) AS diff
  FROM suppliers sup
  LEFT JOIN purchase_invoices pi ON pi.supplier_id = sup.id
    AND pi.status IN ('received', 'partial')
  WHERE sup.active = true
  GROUP BY sup.id, sup.name, sup.total_purchases
  HAVING ABS(sup.total_purchases::decimal - COALESCE(SUM(pi.grand_total::decimal), 0)) > 0.001
) d;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- المعادلة 6: COGS إجمالي النظام
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT 'EQ6_system_cogs_consistency' AS equation,
       ROUND(SUM(s.cogs_total::decimal), 3) AS stored_total_cogs,
       ROUND(SUM(items_cogs.total_cogs), 3) AS computed_total_cogs,
       ROUND(ABS(SUM(s.cogs_total::decimal) - SUM(items_cogs.total_cogs)), 3) AS total_diff,
       CASE WHEN ABS(SUM(s.cogs_total::decimal) - SUM(items_cogs.total_cogs)) < 1 THEN 'PASS' ELSE 'FAIL' END AS status
FROM sales s
JOIN (
  SELECT sale_id, SUM(line_cogs::decimal) AS total_cogs
  FROM sale_items
  GROUP BY sale_id
) items_cogs ON items_cogs.sale_id = s.id
WHERE s.status NOT IN ('cancelled');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- المعادلة 7: الوردية — التوازن النقدي
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- expected_cash = opening_cash + cash_sales - cash_expenses + cash_in - cash_out
SELECT 'EQ7_shift_cash_balance' AS equation,
       sh.id AS shift_id,
       sh.cashier_id,
       sh.opening_cash,
       sh.total_cash,
       sh.expected_cash,
       sh.actual_cash,
       sh.difference,
       COALESCE(cash_sales.total, 0) AS computed_cash_sales,
       COALESCE(cash_exp.total, 0) AS cash_expenses,
       COALESCE(ledger_in.total, 0) AS cash_in,
       COALESCE(ledger_out.total, 0) AS cash_out,
       sh.opening_cash::decimal
         + COALESCE(cash_sales.total, 0)
         - COALESCE(cash_exp.total, 0)
         + COALESCE(ledger_in.total, 0)
         - COALESCE(ledger_out.total, 0) AS computed_expected_cash,
       sh.expected_cash::decimal - (
         sh.opening_cash::decimal
         + COALESCE(cash_sales.total, 0)
         - COALESCE(cash_exp.total, 0)
         + COALESCE(ledger_in.total, 0)
         - COALESCE(ledger_out.total, 0)
       ) AS diff
FROM shifts sh
LEFT JOIN (
  SELECT shift_id, SUM(total::decimal) AS total
  FROM sales
  WHERE payment_method = 'cash' AND status NOT IN ('cancelled')
  GROUP BY shift_id
) cash_sales ON cash_sales.shift_id = sh.id
LEFT JOIN (
  SELECT shift_id, SUM(amount::decimal) AS total
  FROM expenses
  WHERE source = 'cash'
  GROUP BY shift_id
) cash_exp ON cash_exp.shift_id = sh.id
LEFT JOIN (
  SELECT shift_id, SUM(amount_in::decimal) AS total
  FROM cash_ledger
  WHERE type IN ('owner_cash_in', 'owner_transfer_in', 'adjustment_in')
  GROUP BY shift_id
) ledger_in ON ledger_in.shift_id = sh.id
LEFT JOIN (
  SELECT shift_id, SUM(amount_out::decimal) AS total
  FROM cash_ledger
  WHERE type IN ('owner_handover', 'bank_deposit', 'adjustment_out')
  GROUP BY shift_id
) ledger_out ON ledger_out.shift_id = sh.id
WHERE sh.status = 'closed'
  AND sh.expected_cash IS NOT NULL
  AND ABS(sh.expected_cash::decimal - (
    sh.opening_cash::decimal
    + COALESCE(cash_sales.total, 0)
    - COALESCE(cash_exp.total, 0)
    + COALESCE(ledger_in.total, 0)
    - COALESCE(ledger_out.total, 0)
  )) > 0.01
ORDER BY sh.id DESC
LIMIT 20;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- المعادلة 8: صحة المرتجعات
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT 'EQ8_returns_validity' AS equation,
       COUNT(*) AS invalid_returns,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM (
  -- مرتجع بمبلغ أكبر من الفاتورة الأصلية
  SELECT sr.id FROM sale_returns sr
  JOIN sales s ON sr.sale_id = s.id
  WHERE sr.refund_amount::decimal > s.total::decimal

  UNION ALL

  -- مرتجع لفاتورة ملغاة
  SELECT sr.id FROM sale_returns sr
  JOIN sales s ON sr.sale_id = s.id
  WHERE s.status = 'cancelled'
) x;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- المعادلة 9: سلامة الخصومات
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT 'EQ9_discount_sanity' AS equation,
       COUNT(*) AS anomalies,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END AS status
FROM (
  -- خصم نسبي > 100%
  SELECT id FROM sales
  WHERE discount_type = 'percentage' AND discount::decimal > 100

  UNION ALL

  -- خصم قيمة > الإجمالي
  SELECT id FROM sales
  WHERE discount_type = 'value' AND discount::decimal > subtotal::decimal
    AND status NOT IN ('cancelled')
) x;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- المعادلة 10: توازن القيود المحاسبية (Debit = Credit)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT 'EQ10_journal_debit_credit_balance' AS equation,
       COUNT(*) AS unbalanced_entries,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM (
  SELECT je.id, je.entry_number,
         SUM(jel.debit::decimal) AS total_debit,
         SUM(jel.credit::decimal) AS total_credit
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.entry_id = je.id
  WHERE je.status = 'posted'
  GROUP BY je.id, je.entry_number
  HAVING ABS(SUM(jel.debit::decimal) - SUM(jel.credit::decimal)) > 0.001
) unbalanced;

-- تفاصيل القيود غير المتوازنة
SELECT je.id, je.entry_number, je.date, je.description,
       SUM(jel.debit::decimal) AS total_debit,
       SUM(jel.credit::decimal) AS total_credit,
       ROUND(ABS(SUM(jel.debit::decimal) - SUM(jel.credit::decimal)), 3) AS diff
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.entry_id = je.id
WHERE je.status = 'posted'
GROUP BY je.id, je.entry_number, je.date, je.description
HAVING ABS(SUM(jel.debit::decimal) - SUM(jel.credit::decimal)) > 0.001
ORDER BY diff DESC
LIMIT 20;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ملخص تنفيذي
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT
  ROUND(SUM(total::decimal), 3) AS total_revenue_omr,
  ROUND(SUM(cogs_total::decimal), 3) AS total_cogs_omr,
  ROUND(SUM(gross_profit::decimal), 3) AS total_gross_profit_omr,
  ROUND(SUM(vat::decimal), 3) AS total_vat_omr,
  COUNT(*) AS total_invoices,
  ROUND(AVG(total::decimal), 3) AS avg_invoice_omr
FROM sales
WHERE status NOT IN ('cancelled');
