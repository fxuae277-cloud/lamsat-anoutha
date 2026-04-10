# 🧠 CONTEXT — لمسة أنوثة POS/ERP
_آخر تحديث: 2026-04-10 (جلسة 10)_

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

### المخزون (Inventory) — محدّث جلسة 5
- [x] BalancesTab: dropdown يعرض الفروع بدلاً من المواقع الفردية (`/api/branches`)
- [x] LedgerTab: نفس إصلاح الفروع + فلتر نوع الحركة (بيع/شراء/تحويل/تسوية/مرتجع) + بحث
- [x] TransfersTab: شريط بحث في القائمة + سهم اتجاهي `→` بين عمودي "من" و"إلى"
- [x] نموذج إنشاء تحويل: تخطيط `grid-cols-[1fr_auto_1fr]` مع سهم اتجاهي وسط الحقلين
- [x] إصلاح اتجاه السهم في RTL: `ArrowLeft rotate-180` + `dir="ltr"` في شريط التأكيد والنافذة
- [x] KPI: "منتج تحت الحد الأدنى" بدلاً من "منتج يحتاج تعبئة"

### المنتجات (Products) — محدّث جلسة 5
- [x] بطاقات إحصائية: إجمالي / نفاد المخزون / منخفض / غير نشط
- [x] فلاتر: الحالة، المخزون، الفئة (من URL `?categoryId=X`)
- [x] ترتيب الأعمدة قابل للنقر (اسم / سعر / مخزون)
- [x] تصدير CSV + نسخ الباركود
- [x] معاينة الصورة في modal + تأكيد الحذف
- [x] إصلاح blank screen: `SortIcon` → دالة `sortIcon()` عادية
- [x] إصلاح blank screen: `deleteConfirmProduct` نُقل بعد تعريف `products`

### المشتريات (Purchases) — محدّث جلسة 5
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

### شاشة نقطة البيع POS ونظام الطلبات — جديد جلسة 10
- [x] Migration 0012: أعمدة جديدة في sales (amount_paid, change_amount, payment_reference, status, order_id) + sale_items (color, size, line_discount) + orders (source, delivery_method, delivery_fee, subtotal, discount, payment_status, invoice_id...) + جدول held_invoices
- [x] schema.ts: تحديث sales / saleItems / orders / orderItems + إضافة heldInvoices
- [x] API جديدة: GET /api/pos/products, GET /api/pos/top, GET/POST/DELETE /api/pos/held, POST /api/pos/held/:id/resume
- [x] API جديدة: GET /api/orders/stats, GET /api/orders/full, PUT /api/orders/:id, DELETE /api/orders/:id, POST /api/orders/:id/convert-to-invoice, GET /api/customers/search
- [x] POS.tsx: إعادة كتابة كاملة — تخطيط split (سلة يمين + منتجات يسار)، بطاقات منتجات مع شارات المخزون (متوفر/منخفض/نافد)، فلاتر الفئات، شريط Top 5، عميل اختياري، خصم للمالك فقط، 3 طرق دفع (نقدي/بطاقة/تحويل)، تعليق/استئناف (HoldListModal)، إيصال طباعة + واتساب، إرجاع للمالك
- [x] Orders.tsx: إعادة كتابة كاملة — 5 بطاقات إحصائية، فلاتر (بحث/حالة/مصدر/تاريخ)، جدول الطلبات مع شارات، نموذج إنشاء/تعديل، تغيير الحالة، تحويل طلب لفاتورة مع قيد محاسبي تلقائي

### نظام الأدوار والصلاحيات — جديد جلسة 9
- [x] Migration 0011: جداول roles + permissions + role_permissions + password_history
- [x] دوران فقط: المالك (39 صلاحية كاملة) والبيع (10 صلاحيات محدودة)
- [x] أعمدة جديدة في users: role_id + failed_login_count + locked_until + last_login
- [x] `requirePermission(code)` middleware مع backward compat للدور النصي القديم
- [x] API: GET /api/roles, GET /api/permissions, GET/PUT /api/roles/:id/permissions
- [x] API: PATCH /api/users/:id/toggle, DELETE /api/users/:id (إلغاء تفعيل فقط)
- [x] API: GET /api/my-permissions, POST /api/run-migration-0011
- [x] UsersManagement.tsx: صفحة مستقلة — بحث + فلاتر + إضافة/تعديل/حذف + reset password
- [x] RolesManagement.tsx: عرض كل الصلاحيات (39) مقسمة بفئات مع toggle للبيع
- [x] التحقق من قوة كلمة المرور: 8 أحرف + كبير + صغير + رقم + رمز خاص
- [x] Sidebar: رابطان جديدان "إدارة المستخدمين" و"الأدوار والصلاحيات"
- [x] إصلاح l.map is not a function في Reports.tsx (Array.isArray بدلاً من = [])
- [x] إصلاح اختفاء الصفحات: Error Boundary شامل في App.tsx يعرض رسالة الخطأ
- [x] إصلاح RequireOwner: لا redirect أثناء isLoading (AuthenticatedRouter يتولى التحميل)

### النظام المالي الكامل — جديد جلسة 8
- [x] Migration 0010: دليل حسابات موسع (7 مجموعات، 60+ حساب) + account_balances + expense_categories
- [x] storage.ts: `getIncomeStatement` / `getBalanceSheet` / `getDailyCashStatement` / `checkCashBalance` / `getExpensesByCategory` / `getCashFlowStatement`
- [x] API جديدة: `/api/reports/income-statement` / `/api/reports/balance-sheet` / `/api/reports/cash-flow` / `/api/reports/expenses-by-category` / `/api/finance/check-balance` / `/api/finance/daily-statement` / `/api/expense-categories` / `/api/finance/run-migration`
- [x] Reports.tsx: كتابة كاملة — 9 تبويبات (نظرة عامة / قائمة الدخل / مبيعات / مدفوعات / منتجات / فئات / ورديات / مقارنة الفروع / التدفقات النقدية) + Recharts charts
- [x] Finance.tsx: عمود الرصيد الجاري + زر طباعة HTML + 6 KPI cards + تحسين التصميم
- [x] Expenses.tsx: تحقق من رصيد الصندوق قبل الصرف (قاعدة "لا صرف بدون رصيد") + تحذير ذكي + منع الحفظ
- [x] قائمة الدخل: إجمالي المبيعات − COGS = إجمالي الربح − مصروفات = صافي الربح + هامش%
- [x] مقارنة الفروع: شناص / لوى مع BarChart + كروت تفصيلية + تصدير CSV
- [x] التدفقات النقدية: تشغيلية + تمويلية + بنكية + صافي التغير
- [x] نظام القيود المزدوجة: autoJournal.ts موجود + حسابات صحيحة (مدين = دائن)

### واجهة المستخدم — محدّث جلسة 7
- [x] Sidebar: تكبير خطوط القائمة
- [x] ترجمات عربية مكتملة (branch_address, branch_phone, branches_desc)
- [x] SessionStart hook لقراءة CONTEXT.md تلقائياً
- [x] Stop hook: تذكير تلقائي بتحديث CONTEXT.md ورفعه على GitHub نهاية كل جلسة
- [x] العملة الريال العماني `fmtOMR()` — تنسيق `9,800 ر.ع` (بدون خانات عشرية)
- [x] توحيد عرض الفروع: اسم الفرع + الموقع في كل القوائم المنسدلة (20 ملف)
- [x] Sidebar: نقل "الجرد والتسويات" → قسم المخزون، حذف عنصر المخزون المكرر
- [x] بطاقة المستخدم: عرض (اسم - صلاحية - فرع - POS)
- [x] auth/me: يُرجع branchName
- [x] الفئات الهرمية: عرض أم+فرعية في كل القوائم + فلترة تشمل الفرعية (BranchStock/Products/Purchases/POS/MobileProducts)
- [x] Finance.tsx: إصلاح عرض اسم الفرع في الجداول الثلاثة (دفتر النقد / دفتر البنك / فرق الصندوق) → اسم + موقع
- [x] `fmtDate()` / `fmtDateTime()` / `fmtTime()` موحدة في كل الصفحات — لا `toLocaleDateString`
- [x] مكوّن `DateInput` — يحل مشكلة أرقام عربية في Chrome؛ حقل نص DD/MM/YYYY + picker مخفي
- [x] توحيد تنسيق الجداول: `bg-muted/50` للرؤوس، `hover:bg-muted/30` للصفوف، `h-8 w-8` لأزرار الإجراءات
- [x] أيقونة التقويم في DateInput: `bg-primary/10 text-primary border-primary/30` — مميزة بلون رئيسي في كل مكان
- [x] عرض اسم الفرع مع العنوان في كل مكان "اسم - عنوان" (جلسة 7): server (storage/routes/exports/mobile-routes) + frontend (Settings/Orders/Expenses)

### نظرة عامة على المخزون (InventoryOverview) — جديد جلسة 5
- [x] إعادة تصميم كاملة: 4 KPI cards بتدرجات لونية
- [x] جدول محسّن: # + أيقونة فئة + اسم+باركود + فئة Badge ملونة + لون + مقاس + موقع + كمية ملونة + حد أدنى + سعر + حالة
- [x] فلاتر: فرع + نوع + حالة (متوفر/منخفض/نفاد) + بحث + مسح
- [x] ترتيب بالأعمدة (اسم/كمية/سعر) + تلوين الصفوف
- [x] migration 0008: seed تلقائي لـ inventory_balances

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

## ⚠️ خطوات مطلوبة بعد الرفع على Railway
- تشغيل migration 0012: `fetch('/api/run-migration-0012',{method:'POST'})` أو SQL مباشر في Railway DB
- تشغيل migration 0011 إذا لم يُنفَّذ بعد

## ⚠️ مشاكل مفتوحة
- أسماء منتجات غير منظمة في DB
- Inventory anomalies في بعض الفروع
- سجل الحركات: لا يعرض "الكمية قبل/بعد" (يحتاج عمود في DB + API)
- Migration 0011 يحتاج تشغيل على Railway: `fetch('/api/run-migration-0011',{method:'POST'}).then(r=>r.json()).then(console.log)`

---

## ⏳ القادم
- [ ] تشغيل migration 0012 على Railway (POS + Orders)
- [ ] تشغيل migration 0011 على Railway (الأدوار والصلاحيات)
- [ ] تطبيق requirePermission على API endpoints الموجودة (المبيعات، المنتجات، المخزون...)
- [ ] نظام الإشعارات: طلب إرجاع فاتورة → إشعار للمالك
- [ ] قفل الحساب بعد 5 محاولات فاشلة (failed_login_count + locked_until موجودان في DB)
- [ ] ربط WhatsApp automation
- [ ] تنظيف بيانات المنتجات (أسماء مكررة وغير منظمة)
- [ ] إضافة عمود `qty_before` / `qty_after` في جدول inventory_ledger + API
- [ ] الميزانية العمومية في Reports.tsx (تبويب جديد)
- [ ] صفحة دليل الحسابات (Accounts.tsx) ربطها بالنظام الجديد

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
