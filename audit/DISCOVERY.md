# 🔍 DISCOVERY — لمسة أنوثة POS/ERP
_تاريخ التدقيق: 2026-05-01 | جلسة التدقيق: Phase 0_

---

## 📦 معلومات المشروع

| الحقل | القيمة |
|-------|--------|
| الاسم | لمسة أنوثة POS/ERP |
| الإطار | React 19 + Express 5 + PostgreSQL |
| ORM | Drizzle ORM 0.39 |
| قاعدة البيانات | Railway PostgreSQL |
| آخر commit | d28cdf6 (جلسة 53) |
| عدد الـ migrations | 19 migration |

---

## 🗄️ قائمة الجداول (55 جدول)

### A. الفروع والمستخدمون (Infrastructure)

| الجدول | الأعمدة الرئيسية | الغرض |
|--------|-----------------|--------|
| `branches` | id, name, address, phone, is_main | الفروع الجغرافية |
| `cities` | id, name, branch_id | المدن المرتبطة بالفروع |
| `users` | id, username, password, role, branch_id, is_active, pin | المستخدمون (owner/admin/cashier) |

### B. المنتجات والتسعير (Products)

| الجدول | الأعمدة الرئيسية | الغرض |
|--------|-----------------|--------|
| `categories` | id, name, parent_id, is_active | التصنيفات الهرمية |
| `products` | id, barcode, name, price, cost_default, avg_cost, stock_qty | المنتجات الرئيسية |
| `product_variants` | id, product_id, sku, barcode, color, size, price | متغيرات المنتجات |
| `product_composite_items` | id, parent_id, component_id, qty | المنتجات المركّبة |
| `price_lists` | id, name, active | قوائم الأسعار |
| `price_list_items` | id, price_list_id, product_id, override_price | أسعار مخصصة |
| `discount_rules` | id, name, type, value, applies_to, active | قواعد الخصومات |

### C. المخزون (Inventory)

| الجدول | الأعمدة الرئيسية | الغرض |
|--------|-----------------|--------|
| `warehouses` | id, name, branch_id, is_main | المستودعات (نظام قديم) |
| `inventory` | id, product_id, warehouse_id, quantity | رصيد المخزون (نظام قديم) |
| `inventory_transfers` | id, product_id, from_warehouse_id, to_warehouse_id | تحويلات المخزون (قديم) |
| `locations` | id, branch_id, code, name, type, is_main | المواقع الجديدة |
| `location_inventory` | id, location_id, product_id, qty_on_hand | رصيد الموقع |
| `inventory_balances` | id, location_id, variant_id, qty_on_hand | رصيد بالـ variant |
| `inventory_transactions` | id, product_id, type, qty, ref_table, ref_id | سجل الحركات |
| `inventory_ledger` | id, variant_id, location_id, qty_change, reason | دفتر المخزون |
| `location_transfers` | id, from_location_id, to_location_id | تحويلات بين المواقع |
| `location_transfer_items` | id, transfer_id, product_id, qty | بنود التحويل |
| `stock_transfers` | id, from_location_id, to_location_id, status | تحويلات الفروع |
| `stock_transfer_lines` | id, transfer_id, variant_id, qty | بنود تحويل الفروع |
| `inventory_adjustments` | id, product_id, type, qty_before, qty_change, qty_after, reason | تسويات المخزون |
| `stocktakes` | id, branch_id, location_id, status | جلسات الجرد |
| `stocktake_items` | id, stocktake_id, product_id, system_qty, counted_qty | بنود الجرد |

### D. المبيعات (Sales)

| الجدول | الأعمدة الرئيسية | الغرض |
|--------|-----------------|--------|
| `shifts` | id, branch_id, cashier_id, opening_cash, total_sales, status | وردية الكاشير |
| `sales` | id, invoice_number, branch_id, cashier_id, subtotal, discount, vat, total, cogs_total | فواتير البيع |
| `sale_items` | id, sale_id, product_id, quantity, unit_price, total, unit_cost_at_sale, line_cogs | بنود البيع |
| `sale_returns` | id, return_number, sale_id, refund_amount, refund_method, cogs_returned | مرتجعات البيع |
| `sale_return_items` | id, return_id, sale_item_id, product_id, quantity, unit_price | بنود المرتجع |
| `held_invoices` | id, hold_number, items, customer_id | الفواتير المعلّقة |

### E. الطلبات (Orders)

| الجدول | الأعمدة الرئيسية | الغرض |
|--------|-----------------|--------|
| `orders` | id, order_number, customer_id, branch_id, status, total | الطلبات (delivery/pickup) |
| `order_items` | id, order_id, product_id, variant_id, quantity, unit_price | بنود الطلبات |

### F. المشتريات (Purchases)

| الجدول | الأعمدة الرئيسية | الغرض |
|--------|-----------------|--------|
| `purchase_invoices` | id, invoice_number, supplier_id, grand_total, status | فواتير الشراء |
| `purchase_items` | id, purchase_id, product_id, qty, unit_cost_base, unit_cost_final | بنود الشراء |
| `purchase_extra_costs` | id, purchase_invoice_id, type, amount | التكاليف الإضافية |
| `supplier_ocr_templates` | id, supplier_id, invoice_no_pattern | قوالب OCR |

### G. العملاء والموردون (Stakeholders)

| الجدول | الأعمدة الرئيسية | الغرض |
|--------|-----------------|--------|
| `customers` | id, name, phone, total_spent, visits, invoice_count | العملاء |
| `suppliers` | id, name, phone, total_purchases, balance | الموردون |

### H. المالية (Finance)

| الجدول | الأعمدة الرئيسية | الغرض |
|--------|-----------------|--------|
| `cash_ledger` | id, date, branch_id, shift_id, type, amount_in, amount_out | دفتر النقد |
| `bank_ledger` | id, date, branch_id, method, amount_in, amount_out | دفتر البنك |
| `expenses` | id, branch_id, category, amount, source, date | المصروفات |
| `accounts` | id, code, name, type, parent_id | دليل الحسابات |
| `journal_entries` | id, entry_number, date, total_debit, total_credit, status | القيود المحاسبية |
| `journal_entry_lines` | id, entry_id, account_id, debit, credit | سطور القيود |

### I. الرواتب (Payroll)

| الجدول | الأعمدة الرئيسية | الغرض |
|--------|-----------------|--------|
| `employees` | id, name, branch_id, salary, role | موظفون (نظام قديم) |
| `payroll_runs` | id, month, year, status, total_net | مسيرات الرواتب |
| `payroll_details` | id, payroll_id, employee_id, basic_salary, net_salary | تفاصيل الرواتب |
| `salary_payments` | id, payroll_id, employee_id, amount, payment_date | مدفوعات الرواتب |
| `employee_advances` | id, employee_id, amount, settled, total_repaid | السلف |
| `employee_deductions` | id, employee_id, amount, reason, deduction_type | الاستقطاعات |
| `employee_commissions` | id, employee_id, amount, month, year, status | العمولات |
| `employee_entitlements` | id, employee_id, type, amount, month, year | المستحقات |
| `employee_financial_ledger` | id, employee_id, movement_type, amount, balance_after | دفتر المالية الوظيفية |

### J. النظام (System)

| الجدول | الأعمدة الرئيسية | الغرض |
|--------|-----------------|--------|
| `audit_log` | id, action, entity_type, entity_id, user_id, old_value, new_value | سجل التدقيق |

---

## 🔑 الـ Indexes الموجودة (من migrations)

من migration `0004_performance_indexes.sql`:
```sql
-- بناءً على أنماط الاستعلام الشائعة
CREATE INDEX idx_sales_branch_created ON sales(branch_id, created_at);
CREATE INDEX idx_sales_cashier ON sales(cashier_id);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_barcode ON products(barcode);
```

Unique Indexes:
- `uq_location_product` على `location_inventory(location_id, product_id)`
- `uq_inv_bal_loc_variant` على `inventory_balances(location_id, variant_id)`
- `products.barcode` — UNIQUE
- `product_variants.sku` — UNIQUE
- `product_variants.barcode` — UNIQUE
- `users.username` — UNIQUE
- `suppliers.name` — UNIQUE
- `accounts.code` — UNIQUE

---

## ⚠️ نقاط الضعف المحتملة (من تحليل الـ Schema)

### 1. ازدواجية أنظمة المخزون
- نظام قديم: `warehouses` + `inventory` + `inventory_transfers`
- نظام جديد: `locations` + `location_inventory` + `inventory_balances` + `inventory_ledger`
- **الخطر:** تعارض البيانات بين النظامين

### 2. حقول مجمّعة قد تنحرف
- `products.stock_qty` — يجب أن يساوي SUM(location_inventory.qty_on_hand)
- `products.avg_cost` — يجب احتساب Weighted Average
- `customers.total_spent` — يجب أن يساوي SUM(sales.total) للعميل
- `customers.invoice_count` — يجب أن يساوي COUNT(sales) للعميل
- `suppliers.total_purchases` — يجب أن يساوي SUM(purchase_invoices.grand_total)
- `suppliers.balance` — قد يكون stale

### 3. COGS غير مضمون
- `sale_items.unit_cost_at_sale` — هل يُحسب دائماً عند البيع؟
- `sale_items.line_cogs` — هل يساوي qty × unit_cost_at_sale دائماً؟
- `sales.cogs_total` — هل يساوي SUM(sale_items.line_cogs)؟

### 4. قيود FK مفقودة
- `orders.invoice_id` — لا FK مُعرَّف للـ sales
- `purchase_items.variant_id` — لا FK مُعرَّف
- `accounts.parent_id` — لا FK مُعرَّف

### 5. Decimal Precision
- بعض الحقول تستخدم (10,3) وبعضها (12,3) — قد يسبب overflow في المجاميع الكبيرة

---

## 📊 Migrations Timeline

| رقم | الملف | المحتوى |
|-----|-------|---------|
| 0004 | performance_indexes | Indexes للأداء |
| 0005 | professional_pos_schema | الـ Schema الكامل |
| 0006 | suppliers_whatsapp | إضافة whatsapp للموردين |
| 0007 | categories_enhancement | تحسين التصنيفات |
| 0008 | seed_inventory_balances | بيانات ابتدائية |
| 0009 | fix_product_costs | إصلاح التكاليف |
| 0010 | financial_system | النظام المالي |
| 0011 | roles_permissions | الأدوار والصلاحيات |
| 0012 | pos_orders_system | نظام الطلبات |
| 0013 | notifications | الإشعارات |
| 0014 | ledger_qty_snapshot_and_lock | قفل الكميات |
| 0015 | purchase_payment_and_delete | مدفوعات الشراء |
| 0016 | inventory_constraints | قيود المخزون |
| 0017 | order_items_variant_id | variant_id في الطلبات |
| 0018 | products_description_mincost | وصف المنتج والحد الأدنى للسعر |
| 0019 | branches_address_phone | عنوان وهاتف الفرع |
| 0020 | purchase_multi_attachments | مرفقات متعددة للشراء |
| 0021 | purchase_attachments_table | جدول مرفقات الشراء |
| 0022 | products_model_number | رقم موديل المنتج |

---

## 🔧 الـ Scripts الموجودة

```json
"dev": "tsx server/index.ts",
"build": "tsx script/build.ts",
"db:push": "drizzle-kit push",
"lint:i18n": "node scripts/check-arabic-jsx.mjs",
"test": "vitest",
"test:run": "vitest run"
```

---

## 📋 ملاحظات للمراحل التالية

1. **DATABASE_URL** — غير متوفر في البيئة المحلية. مطلوب من Railway Variables لتشغيل SQL checks.
2. **أنظمة المخزون المزدوجة** — أولوية في Phase 3
3. **الـ COGS accuracy** — أولوية في Phase 2
4. **الـ FK المفقودة** — توثيق في Phase 1

_آخر تحديث: 2026-05-01_
