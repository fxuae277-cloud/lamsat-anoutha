# 📋 DEFERRED — مهام مؤجلة
_لمسة أنوثة POS/ERP_

## المهام المؤجلة (LOW priority)

| # | الوصف | السبب | المرحلة المقترحة |
|---|-------|-------|-----------------|
| DEF-001 | إضافة FK صريح لـ orders.invoice_id | يحتاج migration منفصل | post-audit |
| DEF-002 | إضافة FK صريح لـ purchase_items.variant_id | يحتاج migration منفصل | post-audit |
| DEF-003 | توحيد نظامي المخزون (warehouses → locations) | migration كبير مع خطر | post-audit |
| DEF-004 | ترقية DECIMAL(10,3) → DECIMAL(14,3) للمجاميع | تغيير schema | post-audit |
| DEF-005 | تنظيف browserPrintInvoice.ts (لا مستهلك) | جلسة 53 reminder | next-session |
| DEF-006 | إصلاح 233 خطأ tsc (drizzle-zod incompatibility) | upgrade drizzle | next-session |

_يُحدَّث بنتائج كل مرحلة_
