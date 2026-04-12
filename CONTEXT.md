# 🧠 CONTEXT — لمسة أنوثة POS/ERP
_آخر تحديث: 2026-04-12 (جلسة 13 — Orders enhancements + Variant picker + Barcode scan)_

---

## 🔗 روابط المشروع
- **Production:** https://lamsa-pos-production.up.railway.app
- **GitHub:** https://github.com/fxuae277-cloud/lamsat-anoutha
- **Stack:** React + Express + Drizzle ORM + PostgreSQL
- **Deployment cycle:** Claude Code → GitHub → Railway

---

## ✅ مكتمل

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
```

## ⚠️ مشاكل مفتوحة
- أسماء منتجات غير منظمة في DB
- إضافة `variantId` للـ order_items في DB schema (حالياً يُحفظ color+size فقط)

---

## ⏳ القادم
- [ ] تنظيم أسماء المنتجات (مكررة وغير منظمة)
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
