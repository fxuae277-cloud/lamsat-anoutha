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

_آخر تحديث: 2026-05-01_
