# 🐛 ISSUES — مشاكل التدقيق
_لمسة أنوثة POS/ERP_

## الحالة: قيد التحديث

| # | الوصف | Phase | Severity | الحالة |
|---|-------|-------|----------|--------|
| ISS-001 | FK مفقود: orders.invoice_id → sales.id | 0 | MEDIUM | موثّق |
| ISS-002 | FK مفقود: purchase_items.variant_id → product_variants.id | 0 | MEDIUM | موثّق |
| ISS-003 | FK مفقود: accounts.parent_id → accounts.id | 0 | MEDIUM | موثّق |
| ISS-004 | نظام مخزون مزدوج (warehouses قديم + locations جديد) | 0 | HIGH | قيد التقييم |
| ISS-005 | products.stock_qty قد لا يتزامن مع location_inventory | 0 | HIGH | قيد الفحص |

_يُحدَّث بنتائج كل مرحلة_
