# 🧠 CONTEXT — لمسة أنوثة POS/ERP
_آخر تحديث: 2026-04-13 (جلسة 16 — تحسينات Purchases/Suppliers + إصلاح 502 + بحث حي)_

---

## 🔗 روابط المشروع
- **Production:** https://lamsa-pos-production.up.railway.app
- **GitHub:** https://github.com/fxuae277-cloud/lamsat-anoutha
- **Stack:** React + Express + Drizzle ORM + PostgreSQL
- **Deployment cycle:** Claude Code → GitHub → Railway

---

## ✅ مكتمل

### جلسة 16 — تحسينات المشتريات والموردين + إصلاح بحث المنتجات

#### Purchases.tsx — ميزات جديدة من المواصفة
- [x] **إحصائيات موسّعة (6 بطاقات)**: إجمالي الفواتير / إجمالي المشتريات / المبالغ المعلقة (عدد+مبلغ) / إجمالي المدفوع / فواتير اليوم / عدد الموردين
- [x] **أعمدة جديدة في قائمة الفواتير**: طريقة الدفع (badge ملون) + تاريخ الاستحقاق (برتقالي لآجل)
- [x] **سعر البيع** كعمود منفصل في جدول بنود نافذة الإنشاء — يُجلب تلقائياً من priceDefault عند مسح الباركود

#### Purchases.tsx — إضافة يدوية في نافذة الإنشاء (Tabs)
- [x] نافذة "فاتورة شراء جديدة" الآن بها تبويبان: **مسح باركود** + **إضافة يدوية**
- [x] الإضافة اليدوية: بحث حي بالاسم → dropdown → أزرار المتغيرات (لون/مقاس) → كمية/سعر شراء/سعر بيع → إضافة

#### Purchases.tsx — إصلاح منع تكرار المنتجات
- [x] **بحث حي في قسم "إضافة صنف"** داخل الفاتورة التفصيلية:
  - حقل بحث واحد يبحث بالاسم + الباركود + SKU (بدلاً من Select منفصل + input)
  - Dropdown نتائج فورية — المنتجات الموجودة أولاً
  - "إضافة جديد" تظهر **فقط** إذا لم توجد أي نتيجة مطابقة
  - أزرار المتغيرات تحل محل Select للاختيار السريع
  - المنتج المختار يظهر مؤكداً مع زر ✕
- [x] **`addItemMutation`**: حُذف مسار إنشاء منتج جديد تلقائي — `productId` مطلوب
- [x] **`handleModalBarcode`**: الباركود غير الموجود يفتح نافذة "منتج جديد" بدل إضافة عنصر مجهول

#### إصلاح 502 Bad Gateway على Railway
- [x] **سبب المشكلة**: Drizzle يحاول SELECT على عمودَي `address` و `phone` في جدول `branches` وهما غير موجودَين في DB الإنتاج → crash عند startup
- [x] **الحل**: إضافة migration 0019 تلقائياً في `server/index.ts` عند الـ startup:
  ```sql
  ALTER TABLE branches ADD COLUMN IF NOT EXISTS address TEXT;
  ALTER TABLE branches ADD COLUMN IF NOT EXISTS phone   TEXT;
  ```

#### صفحة الفروع (Branches.tsx) — جلسة 15 (مكتملة)
- [x] Migration 0019: إضافة `address TEXT` + `phone TEXT` إلى جدول branches
- [x] `shared/schema.ts`: تحديث نوع Branch ليشمل address + phone
- [x] واجهة محسّنة: عمود العنوان + عمود الهاتف + شارة رئيسي/فرع

#### إصلاح رسائل الخطأ — جلسة 15 (مكتملة)
- [x] `parseServerError()` في `queryClient.ts` — يستخرج `json.message` من API errors
- [x] تحديث 6 صفحات: Accounts / Dashboard / InventoryAlerts / InventoryOverview / Products / Purchases

#### صفحة المنتجات — جلسة 15 (مكتملة)
- [x] باركود تلقائي (إصلاح ترتيب routes: `next-barcode` قبل `/:id`)
- [x] باركود في وضع التعديل مفعّل
- [x] SKU تلقائي: `GET /api/products/:id/next-sku` → `{catId:03}-{productId:04}-{seq:02}`
- [x] إصلاح "Tabs is not defined" في modal تفاصيل المنتج

---

### جلسة 15 — تحسينات المنتجات / الفواتير / الطلبات

#### صفحة المنتجات (Products.tsx) — إعادة تصميم النموذج + ميزات جديدة
- [x] **إعادة تصميم النموذج**: حذف Tabs، صفحة واحدة مسرودة بعناوين أقسام (المعلومات الأساسية / التسعير / الصورة والوصف / الحالة / المتغيرات)
- [x] **حقول جديدة**: وصف المنتج، التكلفة الافتراضية، حد التنبيه للمخزون (minQty)
- [x] **Migration 0018**: `description TEXT`, `cost_default DECIMAL(10,3)`, `min_qty INTEGER`
- [x] **منع تكرار الاسم**: POST وPATCH يتحققان من تكرار الاسم (case-insensitive) → 409 إذا موجود
- [x] **باركود تلقائي**: `GET /api/products/next-barcode?categoryId=X` يولّد `628` + categoryId (3) + seq (4)
  - Frontend: عند اختيار الفئة في وضع الإضافة يُجلب الباركود تلقائياً (read-only + زر تحديث)
  - في وضع التعديل: حقل حر + زر مسح كاميرا
- [x] **سعر تلقائي +20%**: عند إدخال التكلفة يُحسب السعر = التكلفة × 1.20
  - زر "تلقائي +20%" / "يدوي" للتبديل
  - وضع الإضافة: مفعّل افتراضياً | وضع التعديل: يدوي افتراضياً
- [x] **Drag & Drop الصورة**: منطقة إسقاط + ضغط تلقائي client-side (Canvas 600px JPEG 0.7)

#### صفحة الفواتير (Invoices.tsx)
- [x] شريط بحث (رقم الفاتورة / اسم العميل / هاتف) مع زر مسح (X)
- [x] Applied state pattern: فلاتر (تاريخ/دفع/فرع/موظف) تُطبَّق بزر "تطبيق" (وردي عند تغيير معلق)
- [x] عمود "العميل" في الجدول (أخضر للمسجل، رمادي "زائر" للمجهول)
- [x] عداد النتائج `N فاتورة`

#### صفحة الطلبات (Orders.tsx) — جلسة 15
- [x] أسماء الفروع: `اسم - المدينة` (name + address مفصولان بـ ` - `)
- [x] Applied state pattern: فلاتر البحث لا تُحدّث الـ API إلا عند الضغط على "تطبيق"
- [x] زر "تطبيق" يتحول لوردي عند وجود تغيير معلق
- [x] Enter في حقل البحث يُشغّل applyFilters

---

### جلسة 14 — variant_id في order_items
- [x] Migration 0017: إضافة `variant_id` (FK → product_variants) + فهرس على `order_items`
- [x] `shared/schema.ts`: إضافة حقل `variantId` للجدول
- [x] `server/storage.ts`: حفظ `variantId` في INSERT عند إنشاء الطلب الجديد
- [x] `server/routes.ts`: حفظ `variantId` في INSERT عند تعديل بنود الطلب
- [x] `POST /api/run-migration-0017` endpoint لتشغيل المايجريشن على Railway

---

### جلسة 13 — Orders / POS / BarcodeScan

#### BarcodeScanButton — إضافة للصفحات
- [x] `BarcodeScanButton` component في `client/src/components/BarcodeScanButton.tsx`
- [x] أُضيف في: POS (بحث منتجات) / InventoryOverview (تبويب الأرصدة والحركات) / Products / Orders (نموذج إضافة الطلب) / Inventory BalancesTab

#### تنظيف بيانات الاختبار
- [x] `POST /api/admin/reset-demo-data` — TRUNCATE CASCADE لكل الجداول التشغيلية بالترتيب الصحيح
- [x] تم تشغيله وتنظيف بيانات الاختبار بنجاح قبل الإطلاق

#### Migration 0016 — قيود المخزون والأداء
- [x] `CHECK (qty_on_hand >= 0)` على `inventory_balances` و `location_inventory`
- [x] 6 فهارس أداء: barcode، inventory variant/location، sales date، purchase supplier
- [x] ملف: `migrations/0016_inventory_constraints.sql`

#### POS.tsx — إصلاحات ولاعوت
- [x] إصلاح keyboard handler: يتوقف عند `document.querySelector("[role='dialog']")` أو input/textarea مركز
- [x] تجربة "اختيار العميل": الصفحة لم تختفِ بعد إصلاح ترتيب routes (search قبل :id)
- [x] `CustomerModal`: يحمّل كل العملاء عند الفتح (بدون شرط حرفين) + فلترة محلية
- [x] إعادة تصميم Layout: الشريط الوردي (لمسة أنوثة│🛒 السلة│إرجاع+معلق) فوق شريط البحث، السلة تبدأ باختيار العميل

#### صفحة الطلبات (Orders.tsx) — جلسة 13
- [x] `DateInput` بدلاً من `<Input type="date">` في فلاتر التاريخ (إصلاح placeholder عربي)
- [x] البحث بـ رقم الطلب **أو** رقم الهاتف (backend + frontend)
- [x] ربط العملاء المسجلين: شارة "عميل سابق" الخضراء + حقل `customer_id` FK محفوظ
- [x] أفاتار العميل: دائرة ملونة بالحرف الأول (7 ألوان مختلفة حسب hash الاسم)
- [x] عمود طريقة الدفع (نقدي/بطاقة/تحويل) badge ملون في الجدول
- [x] زر تصدير CSV (BOM UTF-8 للعربية في Excel) بجانب "طلب جديد"
- [x] بطاقات الإحصائيات: نسبة التغيير الشهرية (٪ من الشهر الماضي) + "+N اليوم" للطلبات الجديدة
  - Backend: `this_month_*` / `prev_month_*` / `today_new` في `/api/orders/stats`
  - Frontend: `pctChange()` helper — أخضر ↑ / أحمر ↓ / رمادي ±0
- [x] نموذج إضافة الطلب — جدول المنتجات الجديد:
  - `ProductTableRow` component مع بحث inline per-row (اسم + باركود)
  - جدول: المنتج / الكمية / السعر / الإجمالي / حذف
  - صف فارغ تلقائي عند الفتح + زر "إضافة منتج" بخط منقط
  - السعر مربوط بالمنتج (🔗 أخضر = مربوط / ✎ أصفر = معدل يدوياً) + زر ↩ إعادة السعر
- [x] **Variant Picker** في نموذج إضافة الطلب:
  - بعد اختيار المنتج يجلب تلقائياً variants من `/api/products/:id/variants-with-stock`
  - أزرار الألوان مع عدد المخزون الكلي للون
  - مربعات المقاسات مع المخزون الفردي (نفذ = رمادي معطّل)
  - مقاس واحد → يُختار تلقائياً
  - السعر يتغير حسب variant المحدد
  - `variantId` + `color` + `size` تُحفظ في بنود الطلب
- [x] الفرع يُختار تلقائياً (useEffect يختار branches[0] إذا branchId = 0)
- [x] البحث يعمل من حرف واحد + يعرض الباركود + شارة مخزون ملونة في النتائج

#### Backend — جلسة 13
- [x] `GET /api/customers/search` نُقل **قبل** `GET /api/customers/:id` (إصلاح Express route conflict)
- [x] `GET /api/orders/full`: يبحث في customer_phone + يُرجع `is_registered_customer` بـ JOIN
- [x] `POST /api/orders`: إصلاح INSERT — كان يفتقد `customer_id` و`customer_phone`
- [x] `GET /api/customers/search`: يُرجع 50 عميل عند غياب query (بدلاً من فراغ)
- [x] `GET /api/products/:id/variants-with-stock`: endpoint جديد يُرجع variants مع مخزون الفرع
- [x] `GET /api/orders/stats`: إضافة `this_month_*` / `prev_month_*` / `today_new`

---

### الأمان والمصادقة
- [x] JWT Authentication — مستقر على Railway
- [x] SQL Injection fixes
- [x] Zod validation مع رسائل خطأ بالعربي
- [x] Auth Middleware + Rate Limiting

### المنتجات
- [x] رفع صورة المنتج (base64) من نموذج الإضافة/التعديل
- [x] عرض صورة المنتج في جدول المنتجات
- [x] رفع حد JSON body إلى 10mb لدعم الصور
- [x] ضغط الصور client-side (Canvas, 600px, JPEG 0.7)
- [x] كاشف المنتجات المكررة (badge + modal تحذير)

### المخزون (Inventory) — محدّث جلسة 5
- [x] BalancesTab: dropdown يعرض الفروع بدلاً من المواقع الفردية (`/api/branches`)
- [x] LedgerTab: نفس إصلاح الفروع + فلتر نوع الحركة (بيع/شراء/تحويل/تسوية/مرتجع) + بحث
- [x] TransfersTab: شريط بحث في القائمة + سهم اتجاهي `→` بين عمودي "من" و"إلى"
- [x] نموذج إنشاء تحويل: تخطيط `grid-cols-[1fr_auto_1fr]` مع سهم اتجاهي وسط الحقلين
- [x] KPI: "منتج تحت الحد الأدنى" بدلاً من "منتج يحتاج تعبئة"

### المنتجات (Products) — محدّث جلسة 5
- [x] بطاقات إحصائية: إجمالي / نفاد المخزون / منخفض / غير نشط
- [x] فلاتر: الحالة، المخزون، الفئة (من URL `?categoryId=X`)
- [x] ترتيب الأعمدة قابل للنقر (اسم / سعر / مخزون)
- [x] تصدير CSV + نسخ الباركود
- [x] معاينة الصورة في modal + تأكيد الحذف

### المشتريات (Purchases) — محدّث جلسة 12
- [x] بطاقات إحصائية: إجمالي الفواتير / المعلقة / المكتملة / إجمالي المبلغ
- [x] شريط فلاتر: بحث + مورد + الحالة
- [x] Migration 0015: حقول جديدة في purchase_invoices (payment_method/due_date/discount/discount_type/vat_rate/vat_amount)
- [x] نموذج إنشاء موسّع: مسح باركود مباشر داخل النافذة → إضافة تلقائية للبنود
- [x] جدول بنود داخل نافذة الإنشاء: كمية + سعر قابلان للتعديل، ملخص إجمالي حي
- [x] حقول: طريقة الدفع (نقد/تحويل/شيك/آجل) + تاريخ الاستحقاق + خصم (قيمة/نسبة) + ضريبة %
- [x] أعمدة قابلة للترتيب + تحديد جماعي + حذف جماعي (للمعلقة فقط)

### الفئات (Categories) — محدّث جلسة 3
- [x] إعادة تصميم كاملة + هرمية + رفع صورة + بحث + فلاتر
- [x] عدد المنتجات قابل للنقر → يفتح صفحة المنتجات مفلترة

### لوحة التحكم (Dashboard)
- [x] فلاتر: تاريخ من/إلى، الفرع، طريقة الدفع + إجمالي حي

### واتساب والفواتير — جديد جلسة 12
- [x] POS ReceiptModal: إرسال واتساب مباشر لرقم العميل
- [x] Invoices.tsx: زر واتساب + كارت العميل في تفاصيل الفاتورة

### الأمان والإشعارات والتدقيق — جديد جلسة 11
- [x] `requirePermission(code)` على جميع الـ 94 API endpoint
- [x] نظام الإشعارات: Migration 0013 — جدول notifications + API
- [x] قفل الحساب بعد 5 محاولات فاشلة (15 دقيقة)
- [x] Migration 0014: qty_before/qty_after في inventory_ledger + trigger تلقائي
- [x] تبويب الميزانية العمومية في Reports.tsx

### نظام الأدوار والصلاحيات — جديد جلسة 9
- [x] Migration 0011: جداول roles + permissions + role_permissions
- [x] UsersManagement.tsx + RolesManagement.tsx
- [x] التحقق من قوة كلمة المرور + Error Boundary شامل

### النظام المالي الكامل — جديد جلسة 8
- [x] Migration 0010: دليل حسابات موسع (60+ حساب)
- [x] Reports.tsx: 9 تبويبات مع Recharts
- [x] Finance.tsx: رصيد جاري + طباعة HTML
- [x] قيود مزدوجة تلقائية: autoJournal.ts

### واجهة المستخدم — محدّث جلسة 7
- [x] مكوّن `DateInput` — DD/MM/YYYY + picker مخفي (حل أرقام عربية في Chrome)
- [x] `fmtDate()` / `fmtDateTime()` / `fmtTime()` موحدة
- [x] RTL arrows: `ArrowLeft rotate-180` مع `dir="ltr"`

### نظرة عامة على المخزون (InventoryOverview) — جديد جلسة 5
- [x] إعادة تصميم كاملة: 4 KPI cards + جدول محسّن + فلاتر + ترتيب

### نقطة البيع (POS)
- [x] ضريبة 5% تلقائية + 3 طرق دفع + إيصال حراري + واتساب
- [x] إيقاف/استرجاع الفواتير + إدارة الشيفت + قيود يومية تلقائية
- [x] منع البيع إذا المخزون 0

### الباكند والقاعدة
- [x] Database schema كامل + Full backend APIs
- [x] Winston logging + audit trails + 203 اختبار Vitest
- [x] موديول الرواتب الكامل

---

## ⚠️ Migrations المطلوب تشغيلها على Railway
```
// Migration 0015 (إذا لم تُشغَّل بعد):
fetch('/api/run-migration-0015',{method:'POST'}).then(r=>r.json()).then(console.log)

// Migration 0016 (قيود المخزون + فهارس الأداء):
fetch('/api/run-migration-0016',{method:'POST'}).then(r=>r.json()).then(console.log)

// Migration 0017 (variant_id في order_items):
fetch('/api/run-migration-0017',{method:'POST'}).then(r=>r.json()).then(console.log)

// Migration 0018 (description + cost_default + min_qty في products):
fetch('/api/run-migration-0018',{method:'POST'}).then(r=>r.json()).then(console.log)

// Migration 0019 (address + phone في branches):
// ✅ تُشغَّل تلقائياً عند startup — لا حاجة لتشغيلها يدوياً
```

## ⏳ القادم
- [ ] تشغيل migration 0018 على Railway (إضافة حقول products) — إذا لم تُشغَّل بعد
- [ ] صفحة دليل الحسابات (Accounts.tsx) ربطها بالنظام الجديد
- [ ] طباعة فاتورة الشراء (PDF/حراري من صفحة التفاصيل)
- [ ] تقرير الطلبات: مبيعات شهرية بالفئات والمنتجات

---

## 🔑 قواعد تقنية ثابتة (لا تتغير)
- **useAuth()** يُرجع `{ data: { user: {...} } }` — الصحيح: `const { data: authData } = useAuth(); const user = authData?.user;`
- **Express route ordering**: المسارات الثابتة (`/stats`, `/full`, `/search`) يجب تسجيلها **قبل** `/:id` وإلا يلتهمها Express
- **React Query default**: `= []` لا يحمي من API يُرجع كائن — استخدم `Array.isArray()` guard دائماً
- **React Hooks بعد conditional return**: كل hooks يجب في أعلى الكومبوننت قبل أي return شرطي (Error #300)
- **DateInput**: دائماً `onChange={e => setState(e.target.value)}` وليس `onChange={setState}` مباشرة
- **Variants**: المخزون يُتتبع في `inventory_balances` (variant_id + location_id)، وليس `location_inventory` (product_id)

---

## 📋 قرارات تقنية
- Auth: Sessions → JWT
- Hosting: Railway
- Tool: Claude Code
- Images: base64 في PostgreSQL (مضغوطة client-side)
- Category Hierarchy: parentId self-reference
- Inventory filters: branches via `/api/branches` للـ BalancesTab و LedgerTab
- Transfers: `/api/transfer-locations` يستخدم locations (وليس branches) لأن التحويل بين مواقع محددة
- RTL arrows: دائماً `ArrowLeft rotate-180` مع `dir="ltr"` في الـ wrapper

---

## 📌 تعليمات
في نهاية كل جلسة حدّث هذا الملف بما تم ✅ وما تبقى ⏳
