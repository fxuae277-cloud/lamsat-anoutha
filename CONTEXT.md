# 🧠 CONTEXT — لمسة أنوثة POS/ERP
_آخر تحديث: 2026-04-07 (جلسة 4)_

---

## 🔗 روابط المشروع
- **Production:** https://lamsa-pos-production.up.railway.app
- **GitHub:** https://github.com/fxuae277-cloud/lamsat-anoutha
- **Stack:** React + Express + Drizzle ORM + PostgreSQL
- **Deployment cycle:** Claude Code → GitHub → Railway

---

## ✅ مكتمل

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

### المخزون (Inventory) — محدّث جلسة 4
- [x] BalancesTab: dropdown يعرض الفروع بدلاً من المواقع الفردية (`/api/branches`)
- [x] LedgerTab: نفس إصلاح الفروع + فلتر نوع الحركة (بيع/شراء/تحويل/تسوية/مرتجع) + بحث
- [x] TransfersTab: شريط بحث في القائمة + سهم اتجاهي `→` بين عمودي "من" و"إلى"
- [x] نموذج إنشاء تحويل: تخطيط `grid-cols-[1fr_auto_1fr]` مع سهم اتجاهي وسط الحقلين
- [x] إصلاح اتجاه السهم في RTL: `ArrowLeft rotate-180` + `dir="ltr"` في شريط التأكيد والنافذة
- [x] KPI: "منتج تحت الحد الأدنى" بدلاً من "منتج يحتاج تعبئة"

### المنتجات (Products) — محدّث جلسة 4
- [x] بطاقات إحصائية: إجمالي / نفاد المخزون / منخفض / غير نشط
- [x] فلاتر: الحالة، المخزون، الفئة (من URL `?categoryId=X`)
- [x] ترتيب الأعمدة قابل للنقر (اسم / سعر / مخزون)
- [x] تصدير CSV + نسخ الباركود
- [x] معاينة الصورة في modal + تأكيد الحذف
- [x] إصلاح blank screen: `SortIcon` → دالة `sortIcon()` عادية
- [x] إصلاح blank screen: `deleteConfirmProduct` نُقل بعد تعريف `products`

### المشتريات (Purchases) — محدّث جلسة 4
- [x] بطاقات إحصائية: إجمالي الفواتير / المعلقة / المكتملة / إجمالي المبلغ
- [x] شريط فلاتر: بحث + مورد + الحالة

### الفئات (Categories) — محدّث جلسة 3
- [x] إعادة تصميم كاملة لصفحة الفئات
- [x] هرمية: فئات رئيسية + فئات فرعية مع expand/collapse
- [x] رفع صورة لكل فئة (canvas compression)
- [x] حقل وصف لكل فئة
- [x] تبديل نشط/غير نشط (Switch) مباشرة من الجدول
- [x] بحث + فلاتر (الحالة / الفئة الأب)
- [x] عدد المنتجات قابل للنقر → يفتح صفحة المنتجات مفلترة
- [x] تأكيد الحذف مع تحذير عدد المنتجات والفئات الفرعية
- [x] DB migration: description, image, is_active columns
- [x] createCategorySchema / updateCategorySchema (Zod + Arabic)
- [x] storage: getCategories مع فلاتر، toggleCategoryActive
- [x] routes: PATCH /toggle قبل /:id لتجنب تعارض Express

### لوحة التحكم (Dashboard)
- [x] فلاتر: تاريخ من/إلى، الفرع، طريقة الدفع
- [x] إجمالي حي يتحدث بالفلاتر

### واجهة المستخدم
- [x] Sidebar: تكبير خطوط القائمة
- [x] ترجمات عربية مكتملة (branch_address, branch_phone, branches_desc)
- [x] SessionStart hook لقراءة CONTEXT.md تلقائياً
- [x] العملة الريال العماني `fmtOMR()` في formatters.ts — تُستخدم عبر النظام

### نقطة البيع (POS)
- [x] ضريبة 5% تلقائية
- [x] طرق الدفع: نقد / بطاقة / تحويل
- [x] إيصال حراري 80mm
- [x] رسالة WhatsApp
- [x] إيقاف / استرجاع الفواتير
- [x] إدارة الشيفت (فتح/غلق)
- [x] قيود يومية تلقائية
- [x] منع البيع إذا المخزون 0

### الباكند والقاعدة
- [x] Database schema كامل
- [x] Full backend APIs
- [x] Winston logging + audit trails
- [x] 203 اختبار Vitest
- [x] موديول الرواتب الكامل

---

## ⚠️ مشاكل مفتوحة
- أسماء منتجات غير منظمة في DB
- Inventory anomalies في بعض الفروع
- سجل الحركات: لا يعرض "الكمية قبل/بعد" (يحتاج عمود في DB + API)

---

## ⏳ القادم
- [ ] ربط WhatsApp automation
- [ ] تنظيف بيانات المنتجات (أسماء مكررة وغير منظمة)
- [ ] فلاتر Dashboard إضافية
- [ ] صفحة تقارير مفصلة
- [ ] تشغيل migration على Railway (0007_categories_enhancement.sql)
- [ ] إضافة عمود `qty_before` / `qty_after` في جدول inventory_ledger + API
- [ ] مراجعة صفحة التحويلات (Transfers) بشكل مستقل عن صفحة المخزون

---

## 📋 قرارات تقنية
- Auth: Sessions → JWT
- Hosting: Railway
- Tool: Claude Code
- Images: base64 في PostgreSQL (مضغوطة client-side)
- Category Hierarchy: parentId self-reference
- Inventory filters: branches via `/api/branches` (وليس locations) للـ BalancesTab و LedgerTab
- Transfers: `/api/transfer-locations` لا يزال يُستخدم (locations وليس branches) لأن التحويل بين مواقع محددة
- RTL arrows: دائماً `ArrowLeft rotate-180` مع `dir="ltr"` في الـ wrapper لضمان اتجاه صحيح

---

## 📌 تعليمات
في نهاية كل جلسة حدّث هذا الملف بما تم ✅ وما تبقى ⏳
