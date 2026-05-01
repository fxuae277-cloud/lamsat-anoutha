# 📐 Architecture Decision Records (ADR)
_لمسة أنوثة POS/ERP — جلسة التدقيق_

## ADR-001: Dry-Run Mode للـ Database Queries

**التاريخ:** 2026-05-01
**الحالة:** مُقرَّر ✅

### السياق
DATABASE_URL غير متوفر في البيئة المحلية. قاعدة البيانات على Railway ولا يمكن الوصول إليها مباشرة من بيئة التطوير الحالية.

### القرار
تنفيذ Phase 0 كاملاً (Discovery + ERD + Scripts) بدون اتصال فعلي بالـ DB. إنشاء:
1. كل ملفات SQL جاهزة للتنفيذ
2. Runner scripts تقرأ DATABASE_URL من البيئة
3. تعليمات واضحة لتشغيلها

### البدائل المرفوضة
- طلب DATABASE_URL من المستخدم: يخالف التعليمات (لا نسأل)
- استخدام mock DB: يُفقد دقة التدقيق

### النتيجة
Script جاهز للتشغيل الفوري بمجرد توفر DATABASE_URL.

---

## ADR-002: SQL Scripts بدلاً من ORM

**التاريخ:** 2026-05-01
**الحالة:** مُقرَّر ✅

### السياق
التدقيق يحتاج استعلامات معقدة (aggregations, cross-table joins, window functions) لا يدعمها Drizzle بسهولة.

### القرار
كتابة استعلامات SQL خام (raw SQL) في ملفات `.sql` منفصلة، وتشغيلها عبر `pg` client مباشرة.

### الأسباب
- مرونة أكبر في EXPLAIN ANALYZE
- وضوح للـ DBA
- يمكن تشغيلها مستقلاً عن Node.js

---

## ADR-003: حل ازدواجية نظام المخزون

**التاريخ:** 2026-05-01
**الحالة:** قيد التقييم 🔄

### السياق
يوجد نظامان متوازيان للمخزون:
1. **قديم:** `warehouses` + `inventory` + `inventory_transfers`
2. **جديد:** `locations` + `location_inventory` + `inventory_balances` + `inventory_ledger`

### المشكلة
`products.stock_qty` قد لا يتزامن مع كلا النظامين.

### القرار المؤقت
في Phase 3: فحص كلا النظامين وتحديد أيهما هو "مصدر الحقيقة" (source of truth) للعمليات الحالية، ثم التوثيق.

---

## ADR-004: معالجة FK المفقودة

**التاريخ:** 2026-05-01
**الحالة:** مُقرَّر ✅

### الحقول بدون FK صريح (موثّقة في DISCOVERY.md)
- `orders.invoice_id` → sales(id): غير مُعرَّف
- `purchase_items.variant_id` → product_variants(id): غير مُعرَّف
- `accounts.parent_id` → accounts(id): غير مُعرَّف

### القرار
- توثيق في ISSUES.md كـ MEDIUM severity
- لا تعديل على البنية في هذه الجلسة — يحتاج migration منفصل
- إضافة CHECK queries في Phase 1 للتحقق من وجود orphan records

---

## ADR-005: Currency Precision

**التاريخ:** 2026-05-01
**الحالة:** مُقرَّر ✅

### المعيار المُعتمد
- المبالغ: DECIMAL(10,3) للعمليات العادية، DECIMAL(12,3) للمجاميع
- العملة: ريال عُماني (OMR) — 3 خانات عشرية
- Tolerance للمقارنات: 0.001 OMR (أي من 1 بيسة)

---

## ADR-006: Severity Levels للمشاكل

**التاريخ:** 2026-05-01
**الحالة:** مُقرَّر ✅

| Level | التعريف | الإجراء |
|-------|---------|---------|
| CRITICAL | خسارة مالية حقيقية أو فساد بيانات | إصلاح فوري مع backup |
| HIGH | انحراف > 1 OMR أو مخزون سالب | إصلاح في نفس الجلسة |
| MEDIUM | بيانات يتيمة، NULL في حقول غير حرجة | إصلاح في نفس الجلسة |
| LOW | تحسينات، indexes مفقودة | تسجيل في DEFERRED.md |

---

_آخر تحديث: 2026-05-01_
