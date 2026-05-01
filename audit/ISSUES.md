# 🐛 ISSUES — مشاكل التدقيق
_لمسة أنوثة POS/ERP_

## ✅ مشاكل تمت معالجتها

| # | الوصف | Phase | Severity | الحالة | الملف |
|---|-------|-------|----------|--------|-------|
| ISS-001 | FK مفقود: orders.invoice_id → sales.id | 0 | MEDIUM | موثّق → مؤجل | DEFERRED.md |
| ISS-002 | FK مفقود: purchase_items.variant_id → product_variants.id | 0 | MEDIUM | موثّق → مؤجل | DEFERRED.md |
| ISS-003 | FK مفقود: accounts.parent_id → accounts.id | 0 | MEDIUM | موثّق → مؤجل | DEFERRED.md |
| ISS-006 | **products.stock_qty لا يُخفَّض عند البيع** — يُزاد فقط عند الشراء | 1 | **CRITICAL** | ✅ مُصلَح | storage.ts:1058 |
| ISS-007 | **customers.total_spent/invoice_count لا يُنقَّص عند المرتجع** | 1 | **HIGH** | ✅ مُصلَح | storage.ts:3529 |
| ISS-008 | **products.stock_qty لا يُحدَّث عند المرتجع** | 1 | **HIGH** | ✅ مُصلَح | storage.ts:3517 |
| ISS-009 | **refundAmount بدون validation ضد sale.total** | 1 | **HIGH** | ✅ مُصلَح | routes.ts:3276 |
| ISS-010 | **إمكانية إرجاع فاتورة ملغاة** | 1 | **HIGH** | ✅ مُصلَح | routes.ts:3257 |

## ⚠️ مشاكل موثّقة (تحتاج بيانات حقيقية للتأكيد)

| # | الوصف | Phase | Severity | الحالة |
|---|-------|-------|----------|--------|
| ISS-004 | نظام مخزون مزدوج (warehouses قديم + locations جديد) | 0 | HIGH | موثّق في DEFERRED |
| ISS-005 | products.stock_qty قد لا يتزامن مع location_inventory (تاريخي) | 0 | HIGH | يتطلب SQL على DB |
| ISS-011 | COGS = 0 لمنتجات avg_cost = 0 | 1 | MEDIUM | موثّق — يتطلب data fix |
| ISS-012 | supplier.total_purchases قد لا يُحدَّث عند إنشاء فاتورة شراء | 1 | MEDIUM | يتطلب كود مراجعة إضافية |

## ✅ إصلاحات Phase 2 (Accounting)

| # | الوصف | Phase | Severity | الحالة | الملف |
|---|-------|-------|----------|--------|-------|
| ISS-013 | **closeShift لا يطرح المرتجعات النقدية من expectedCash** | 2 | **HIGH** | ✅ مُصلَح | storage.ts:1598 |
| ISS-014 | **card/wallet payments تُسجَّل في حساب CASH بدل BANK** | 2 | **HIGH** | ✅ مُصلَح | autoJournal.ts:117,158,218,252 |

## ✅ إصلاحات Phase 3 (Inventory)

| # | الوصف | Phase | Severity | الحالة | الملف |
|---|-------|-------|----------|--------|-------|
| ISS-015 | **inventory adjustment لا يُحدّث products.stock_qty** | 3 | **CRITICAL** | ✅ مُصلَح | routes.ts:4811 |
| ISS-016 | **approveStocktake لا يُحدّث products.stock_qty** | 3 | **CRITICAL** | ✅ مُصلَح | storage.ts:4729 |

## ✅ إصلاحات Phase 5 (Security & Performance)

| # | الوصف | Phase | Severity | الحالة | الملف |
|---|-------|-------|----------|--------|-------|
| ISS-017 | **SQL Injection في mobile-routes.ts** — branchId يُحقن مباشرة في SQL | 5 | **CRITICAL** | ✅ مُصلَح | mobile-routes.ts:67 |
| ISS-018 | **/api/attachments/:id بدون مصادقة** — يسمح بالوصول غير المصرح | 5 | **HIGH** | ✅ مُصلَح | routes.ts:4309 |
| ISS-019 | **test endpoints مكشوفة** — /api/test-search و /api/test-barcode | 5 | **HIGH** | ✅ مُصلَح | routes.ts:1125,1223 |
| ISS-020 | **bcrypt rounds = 10** — أقل من الحد الموصى به (12) | 5 | **MEDIUM** | ✅ مُصلَح | routes.ts:516,537,598 |
| ISS-021 | **N+1 queries في getProfitByBranches** | 5 | **HIGH** | ✅ مُصلَح | storage.ts:2632 |
| ISS-022 | **Connection pool بدون max مُحدد** | 5 | **MEDIUM** | ✅ مُصلَح | db.ts:15 |

## 📋 تفاصيل الإصلاحات

### ISS-006: products.stock_qty لا يُخفَّض عند البيع
**السبب الجذري:** `createSale` في `storage.ts` يُحدّث `location_inventory.qty_on_hand` لكن لا يُحدّث `products.stock_qty`.
**الحل:** بعد كل عملية بيع، أضفنا:
```sql
UPDATE products SET stock_qty = (
  SELECT COALESCE(SUM(qty_on_hand), 0) FROM location_inventory WHERE product_id = $1
) WHERE id = $1
```
للمنتجات المباعة داخل نفس transaction.

### ISS-007: customer metrics لا تُعكس عند المرتجع
**السبب:** `createSaleReturn` يُحدّث المخزون ولكن لا ينقص total_spent.
**الحل:** أضفنا بعد COMMIT:
```sql
UPDATE customers SET
  total_spent   = GREATEST(total_spent - refundAmount, 0),
  invoice_count = GREATEST(invoice_count - 1, 0)
WHERE id = customerId
```

### ISS-008: products.stock_qty لا يُضاف عند المرتجع
**الحل:** أضفنا sync من location_inventory بعد إعادة المخزون.

### ISS-009 + ISS-010: validation المرتجع
**الحل:** أضفنا في routes.ts:
1. فحص أن الفاتورة ليست ملغاة
2. فحص أن refundAmount ≤ sale.total

### ISS-017: SQL Injection في mobile-routes.ts
**السبب:** `branchId` من `req.query` يُحقن مباشرة في SQL عبر template literals في 6 استعلامات.
**الحل:** استخدام parameterized queries مع `$1` وتمرير `bParam = [branchId]`.

### ISS-018 + ISS-019: نقاط نهاية غير محمية
**الحل:** إضافة `requireAuth` لـ `/api/attachments/:id`؛ حذف `/api/test-search` و `/api/test-barcode`.

### ISS-020: bcrypt rounds ضعيفة
**الحل:** رفع من 10 إلى 12 في جميع استدعاءات `bcrypt.hash`.

### ISS-021: N+1 في getProfitByBranches
**الحل:** استبدال حلقة for بـ 4 استعلامات متوازية (Promise.all) مع GROUP BY برanchId، وربط النتائج في الذاكرة.

### ISS-022: Connection pool غير مُهيأ
**الحل:** إضافة `max: 20`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 5000`.

_آخر تحديث: 2026-05-01_
