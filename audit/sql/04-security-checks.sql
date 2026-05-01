-- ══════════════════════════════════════════════════════════════════════════════
-- 🔐 PHASE 5: SECURITY CHECKS — لمسة أنوثة POS/ERP
-- التاريخ: 2026-05-01
-- الهدف: فحوصات أمنية على مستوى البيانات
-- ══════════════════════════════════════════════════════════════════════════════

-- S1: مستخدمون بكلمات مرور قصيرة أو ضعيفة (hash length check)
-- bcrypt hash طوله دائماً 60 حرف — أي hash أقصر مشبوه
SELECT 'S1_weak_password_hashes' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM users
WHERE LENGTH(password) < 60 AND is_active = true;

SELECT id, username, role, LENGTH(password) AS hash_length
FROM users
WHERE LENGTH(password) < 60 AND is_active = true;

-- S2: حسابات owner/admin متعددة (مخاطرة أمنية)
SELECT 'S2_multiple_owners' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) <= 2 THEN 'PASS' ELSE 'WARN' END AS status
FROM users
WHERE role IN ('owner', 'admin') AND is_active = true;

SELECT id, username, name, role, branch_id
FROM users
WHERE role IN ('owner', 'admin') AND is_active = true
ORDER BY role, id;

-- S3: مستخدمون بـ PIN قصير (< 4 أرقام)
SELECT 'S3_short_pin' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END AS status
FROM users
WHERE pin IS NOT NULL AND LENGTH(pin) < 4 AND is_active = true;

-- S4: مستخدمون بدون كلمة مرور (NULL password)
SELECT 'S4_null_password' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM users
WHERE (password IS NULL OR password = '') AND is_active = true;

-- S5: حسابات معطّلة لها مبيعات حديثة (في آخر 30 يوم)
SELECT 'S5_inactive_users_recent_sales' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END AS status
FROM (
  SELECT DISTINCT u.id
  FROM users u
  JOIN sales s ON s.cashier_id = u.id
  WHERE u.is_active = false
    AND s.created_at > NOW() - INTERVAL '30 days'
) x;

SELECT u.id, u.username, u.name,
       MAX(s.created_at)::date AS last_sale_date,
       COUNT(s.id) AS recent_sales_count
FROM users u
JOIN sales s ON s.cashier_id = u.id
WHERE u.is_active = false
  AND s.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.id, u.username, u.name
ORDER BY last_sale_date DESC;

-- S6: audit_log فارغ أو لا يسجّل عمليات حرجة
SELECT 'S6_audit_log_coverage' AS check_name,
       COUNT(*) AS total_audit_records,
       COUNT(CASE WHEN action LIKE '%delete%' OR action LIKE '%update%' THEN 1 END) AS sensitive_actions,
       CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'WARN' END AS status
FROM audit_log
WHERE created_at > NOW() - INTERVAL '30 days';

-- S7: مبيعات بمبالغ غير عادية (outliers > 10x average)
SELECT 'S7_unusual_sale_amounts' AS check_name,
       COUNT(*) AS count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END AS status
FROM (
  SELECT s.id, s.total::decimal,
         AVG(s2.total::decimal) OVER () AS avg_total,
         10 * AVG(s2.total::decimal) OVER () AS threshold
  FROM sales s
  CROSS JOIN sales s2
  WHERE s.status != 'cancelled'
  LIMIT 1
) x
WHERE total > threshold;

-- أكبر 10 مبيعات (للمراجعة اليدوية)
SELECT id, invoice_number, created_at::date,
       cashier_id, customer_id, total, payment_method, status
FROM sales
WHERE status != 'cancelled'
ORDER BY total::decimal DESC
LIMIT 10;
