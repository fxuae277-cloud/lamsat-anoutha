# 📖 RUNBOOK — دليل تشغيل التدقيق
_لمسة أنوثة POS/ERP_

## الإعداد الأولي (مرة واحدة)

### 1. إنشاء ملف .env.audit
```bash
# في جذر المشروع
cat > .env.audit << 'EOF'
DATABASE_URL=postgresql://USER:PASS@HOST:PORT/DB
EOF
```
أو من Railway:
1. Dashboard → lamsat-anoutha → Variables
2. انسخ قيمة DATABASE_URL
3. ضعها في `.env.audit`

> ⚠️ لا تضف `.env.audit` لـ git (مُدرج في .gitignore تلقائياً)

---

## تشغيل فحص سريع

```bash
# فحص سلامة البيانات (Phase 1)
npm run audit:integrity

# مطابقة المحاسبة (Phase 2)
npm run audit:accounting

# تدقيق المخزون (Phase 3)
npm run audit:inventory

# الكل دفعة واحدة
npm run audit:all
```

---

## تشغيل SQL مباشر

```bash
# أمر واحد
psql $DATABASE_URL -c "SELECT COUNT(*) FROM sales WHERE created_at > NOW() - INTERVAL '7 days'"

# ملف SQL
psql $DATABASE_URL -f audit/sql/01-integrity-checks.sql

# مع output لملف
psql $DATABASE_URL -f audit/sql/02-accounting-reconciliation.sql > audit/reports/accounting-$(date +%Y%m%d).txt
```

---

## فحص يومي (5 دقائق)

```bash
# الفحص اليومي السريع
psql $DATABASE_URL -c "
  SELECT
    (SELECT COUNT(*) FROM sales WHERE created_at::date = CURRENT_DATE) AS today_sales,
    (SELECT SUM(total) FROM sales WHERE created_at::date = CURRENT_DATE) AS today_revenue,
    (SELECT COUNT(*) FROM shifts WHERE status='open') AS open_shifts,
    (SELECT COUNT(*) FROM location_inventory WHERE qty_on_hand < 0) AS negative_inventory
"
```

---

## إجراء الجرد الشهري

1. **قبل الجرد:** شغّل `npm run audit:inventory` → يولّد `audit/reports/physical-count-YYYY-MM-DD.csv`
2. **افتح الملف** في Excel
3. **الفريق يملأ** عمود `counted_qty` للكل منتج
4. **Excel يحسب** الفرق تلقائياً
5. **بعد الجرد:** أدخل التسويات في النظام

---

## حل مشاكل شائعة

### مخزون سالب
```bash
# عرض المشكلة
psql $DATABASE_URL -c "SELECT p.name, li.qty_on_hand FROM location_inventory li JOIN products p ON p.id = li.product_id WHERE li.qty_on_hand < 0"

# الإصلاح (تلقائي في inventory-runner)
npm run audit:inventory
```

### فاتورة برقم مكرر
```bash
psql $DATABASE_URL -c "SELECT invoice_number, COUNT(*) FROM sales GROUP BY invoice_number HAVING COUNT(*) > 1"
```

### عميل بـ total_spent خاطئ
```bash
# إعادة حساب للعميل ID=123
psql $DATABASE_URL -c "
  UPDATE customers SET
    total_spent = (SELECT COALESCE(SUM(total),0) FROM sales WHERE customer_id=123 AND status!='cancelled'),
    invoice_count = (SELECT COUNT(*) FROM sales WHERE customer_id=123 AND status!='cancelled')
  WHERE id = 123
"
```

---

## التقارير المتولّدة

| الملف | المحتوى |
|-------|---------|
| `audit/reports/integrity-YYYY-MM-DD.json` | نتائج Phase 1 |
| `audit/reports/accounting-YYYY-MM-DD.json` | نتائج Phase 2 |
| `audit/reports/inventory-YYYY-MM-DD.json` | نتائج Phase 3 |
| `audit/reports/physical-count-YYYY-MM-DD.csv` | ورقة الجرد الفعلي |

---

_آخر تحديث: 2026-05-01_
