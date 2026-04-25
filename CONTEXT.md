# 🧠 CONTEXT — لمسة أنوثة POS/ERP
_آخر تحديث: 2026-04-25 (جلسة 36 — منع البيع بدون فتح وردية + Backfill شفت اليوم)_

---

## 🔗 روابط المشروع
- **Production:** https://lamsa-pos-production.up.railway.app
- **GitHub:** https://github.com/fxuae277-cloud/lamsat-anoutha
- **Stack:** React + Express + Drizzle ORM + PostgreSQL
- **Deployment cycle:** Claude Code → GitHub → Railway

---

## ✅ مكتمل

### جلسة 36 — منع البيع/الصرف بدون وردية + Backfill شفت اليوم

#### Backend Guard — server/routes.ts
- [x] `POST /api/sales` — يرفض بـ `403 NO_OPEN_SHIFT` إذا كان دور المستخدم `cashier` أو `employee` ولا يوجد شفت مفتوح لجهازه/فرعه
- [x] `POST /api/expenses` — نفس الحماية على المصروفات
- [x] المالك/الإدمن/المدير غير مقيَّدين (يمكنهم إصدار فواتير إدارية بدون شفت)
- [x] الرسالة بالعربية: "لا يمكن إصدار فاتورة بدون فتح وردية..."

#### Backfill Endpoint — POST /api/admin/backfill-shift-today
- [x] (requireOwnerOrAdmin) — يصحّح بيانات اليوم لكل فرع عليه فواتير `shift_id IS NULL`:
  - يختار الكاشير الأكثر فواتير اليوم في الفرع
  - يفتح شفت بداية اليوم 09:00 بتوقيت `Asia/Muscat` (أو يستخدم شفت مفتوح موجود)
  - يحدّث `shift_id` في: `sales`, `sale_returns`, `expenses`, `cash_ledger`, `bank_ledger`
- [x] استخدام: `fetch('/api/admin/backfill-shift-today',{method:'POST'}).then(r=>r.json()).then(console.log)`
- [x] يستخدم تحويل دقيق `(created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Muscat'` لتجنّب أخطاء حدود اليوم

#### السبب الجذري
- الـ frontend (POS.tsx + MobilePOS.tsx) يطبّق `StartPOS` كـ guard، لكن الـ backend لم يكن يفرض شيئاً → أي طلب مباشر لـ `/api/sales` بدون شفت كان يمر ويُخزَّن `shift_id NULL`
- الإصلاح يضع الحماية في الـ backend (مصدر الحقيقة)

---

### جلسة 35 — شاشة الكاشير ملء الشاشة + PWA fullscreen

**الهدف:** فتح شاشة POS بشكل احترافي على كامل الشاشة بدون هوامش فارغة، مع دعم PWA fullscreen للجهاز الكاشير.

#### `client/src/index.css` — تنسيقات عامة لملء الشاشة
- [x] `html, body, #root { width:100%; height:100%; min-height:100% }` (margin/padding = 0)
- [x] `body { overflow: hidden }` — لا تمرير على الصفحة الكاملة (التمرير داخل الأقسام فقط)
- [x] `* { box-sizing: border-box }`
- [x] `.no-scrollbar` helper للشريط الأفقي للفئات

#### `client/src/components/layout/AppLayout.tsx` — وضع full-bleed لمسارات الكاشير
- [x] `FULL_BLEED_ROUTES = ["/pos", "/shift"]` — مع كشف عبر `useLocation` من wouter
- [x] على هذه المسارات: السايدبار يبقى ظاهراً (256px للتنقل) لكن يُحذف:
  - شريط الـ header العلوي (البحث / تبديل اللغة / التاريخ)
  - الـ wrapper بـ `p-6 overflow-y-auto`
- [x] صفحات الإدارة الأخرى (Dashboard, Inventory, إلخ) **غير متأثرة**

#### `client/src/pages/POS.tsx` — تخطيط ملء الشاشة + زر fullscreen
- [x] الـ root: `h-screen` → `w-full h-full min-h-0 flex` — يملأ خانة AppLayout بدون overflow
- [x] السلة: عرض responsive — `w-[360px] xl:w-[400px] 2xl:w-[440px]` + `min-h-0`
- [x] عمود المنتجات: أُضيف `min-w-0 min-h-0` لضمان عمل التمرير الداخلي صحيحاً
- [x] **زر "ملء الشاشة / تصغير"** جديد في الـ header الوردي:
  - `document.documentElement.requestFullscreen()` / `document.exitFullscreen()`
  - try/catch — لا يكسر إذا فشل
  - يُخفى إذا كان الـ API غير مدعوم
  - يتزامن مع `fullscreenchange` event عبر useEffect
- [x] أيقونات `Maximize2 / Minimize2` من lucide-react

#### `client/public/manifest.json` — PWA fullscreen kiosk-style
- [x] `display: "fullscreen"` + `display_override: ["fullscreen","standalone","minimal-ui"]`
- [x] `orientation: "landscape"` (أنسب لشاشات الكاشير)
- [x] `start_url: "/pos"` — التطبيق المثبَّت يفتح مباشرة على شاشة الكاشير
- [x] `theme_color: "#E91E63"` (وردي لمسة أنوثة) — كان `#111111`
- [x] `name: "لمسة أنوثة"` (كان `short_name: "لمسة"`)
- [x] `lang: "ar"` + `dir: "rtl"` — محفوظة

#### `client/index.html`
- [x] `meta theme-color` → `#E91E63` ليطابق الـ manifest

#### Verification
- [x] `npx tsc --noEmit` — لا أخطاء جديدة في الملفات المُعدَّلة
- [x] `npx vite build` — `✓ built in 46.79s`

#### كيفية إعادة تثبيت PWA على سطح المكتب
1. Chrome/Edge → `⋮` → **Apps** → **Manage apps** → uninstall "لمسة أنوثة"
2. Hard reload (`Ctrl+Shift+R`)
3. (اختياري) DevTools → Application → Service Workers → Unregister + Clear site data
4. أيقونة التثبيت في شريط العنوان → إعادة التثبيت

#### توصيات لـ Kiosk Mode (اختياري)
- لقفل الجهاز على شاشة الكاشير: `chrome.exe --kiosk --app=https://lamsa-pos-production.up.railway.app/pos --noerrdialogs --disable-pinch`
- زر "ملء الشاشة" داخل التطبيق يكفي للاستخدام اليومي بدون إعدادات OS

---

### جلسة 32 — المركز المالي للمالك + ربط حركات الفروع

#### DB — جدول owner_transactions (جديد)
- [x] إضافة `ownerTransactions` لـ `shared/schema.ts` (OWNER_TXN_TYPES، FK → branches + users)
- [x] إنشاء الجدول مباشرة على Railway بـ SQL (drizzle-kit push timeout)
- [x] حقول: date, type, branch_id, amount, payment_method, from_account, to_account, reference_no, note, created_by

#### Backend — server/storage.ts
- [x] `getOwnerFinancialSummary()`: يحسب من DB مباشرة:
  - رصيد كاش كل فرع: opening + cash_sales − cash_expenses − transferred_to_owner (من cash_ledger)
  - نقد المالك: received − deposited − withdrawn − cashSentToBranches + adj
  - بنك المالك: card_sales + bank_transfers + deposits − bankSentToBranches
  - قيمة المخزون: cost / selling / profit مع تفصيل حسب الفرع
- [x] `getOwnerTransactions(limit, branchId, from, to)`: سجل المعاملات مع فلاتر
- [x] `createOwnerTransaction(data)`: إنشاء معاملة جديدة

#### Backend — server/routes.ts
- [x] `GET /api/owner/financial-summary` (requireOwnerOrAdmin)
- [x] `GET /api/owner/transactions` (requireOwnerOrAdmin) — يقبل limit, branchId, from, to
- [x] `POST /api/owner/transactions` (requireOwnerOrAdmin) — تحقق من النوع
- [x] **ربط تلقائي في `POST /api/cash-movements`** — كل حركة فرع تُحدّث owner_transactions:
  - `owner_handover` → `BRANCH_CASH_TRANSFER_TO_OWNER` (نقد المالك ↑)
  - `bank_deposit` → `OWNER_DEPOSIT_TO_BANK` (بنك المالك ↑)
  - `owner_cash_in` → `MANUAL_ADJUSTMENT_OUT` from_account=owner_cash (نقد المالك ↓)
  - `owner_transfer_in` → `MANUAL_ADJUSTMENT_OUT` from_account=owner_bank (بنك المالك ↓)

#### Frontend — client/src/pages/OwnerFinancialSummary.tsx (جديدة)
- [x] Route: `/owner-financial` (RequireOwner)
- [x] Sidebar: "المركز المالي للمالك" أيقونة DollarSign تحت قسم المالية
- [x] **4 تبويبات**:
  - **نظرة عامة**: نقد الفروع + نقد المالك + بنك المالك (مع breakdown: بطاقة + تحويل + إيداعات − محوَّل للفروع) + الرصيد الكلي + بطاقة حساب المالك التفصيلية
  - **أرصدة الفروع**: بطاقة لكل فرع (افتتاح / مبيعات نقدية / مصروفات / محوَّل للمالك / الرصيد الحالي + بطاقة + تحويل)
  - **قيمة المخزون**: 4 KPIs (كمية / تكلفة / بيع / ربح متوقع) + جدول حسب الفرع مع الهامش
  - **سجل المعاملات**: جدول مع فلتر فرع + من/إلى تاريخ + 200 سجل
- [x] Dialog "تسجيل معاملة مالية": يدعم كل أنواع owner_transactions مع preview لما سيحدث
- [x] الرصيد البنكي = card_sales + bank_transfers + deposits (ليس الإيداعات اليدوية فقط)

#### Frontend — client/src/pages/BranchSummary.tsx
- [x] زر أزرق **"تسليم نقدي للمالك"** بارز في header بجانب "تسجيل حركة نقدية"
- [x] Dialog مخصص: يعرض الرصيد الحالي + إجمالي التسليمات اليوم + preview تأثير المعاملة
- [x] عند الحفظ: يُنشئ cash_ledger + owner_transactions تلقائياً (بدون تسجيل مزدوج)

#### منطق لا تكرار
- الفرع يسجّل مرة واحدة → يظهر عند المالك تلقائياً
- المالك لا يحتاج تسجيل ما سجّله الفرع
- المالك يسجّل فقط: السحوبات الشخصية + التعديلات اليدوية

#### تصحيح بيانات تاريخية
- [x] إدخال يدوي لـ owner_transactions لـ record موجود في cash_ledger id=3 (100 ر.ع، فرع لمسة أنوثة، 20 أبريل 2026)

#### إصلاحات سابقة في نفس الجلسة (مستمرة من جلسة 31)
- [x] Reports.tsx: إصلاح payments tab — `pmtMethod()` helper لقراءة `payments.methods[]` (كان يقرأ حقول مسطّحة غير موجودة)
- [x] Reports.tsx: جدول آخر 200 معاملة في تبويب المدفوعات
- [x] InventoryAlerts.tsx: فلتر الفرع مع عرض "لمسة أنوثة - لوى" من address
- [x] StockControl.tsx: حذف حقل الموقع من dialogs الجرد والتسويات — يُحلّ تلقائياً من backend
- [x] routes.ts: auto-resolve default location عند POST /api/stocktakes و /api/inventory-adjustments

---

### جلسة 21 — صفحة الملخص المالي

#### FinanceSummary.tsx — صفحة ملخص مالي شاملة للمالك
- [x] صفحة جديدة `client/src/pages/FinanceSummary.tsx` على route `/finance-summary`
- [x] فلاتر الفترة: اليوم / هذا الشهر / الشهر الماضي / هذا العام / مخصص (DateInput)
- [x] **4 بطاقات KPI**: صافي الربح (مع هامش%) · إجمالي المبيعات (مع عدد الفواتير) · إجمالي المصروفات · رصيد الصندوق (اليوم)
- [x] **قائمة الدخل** كاملة: إجمالي المبيعات → مرتجعات → COGS → ربح إجمالي → مصروفات → صافي الربح
- [x] **فطيرة (Donut Chart)** توزيع المصروفات حسب الفئة بالألوان
- [x] **طرق الدفع**: نقدي / بطاقة / تحويل بنكي مع نسبة كل طريقة وشريط تقدم
- [x] أُضيفت أول عنصر في قسم "المالية" في الشريط الجانبي (`sidebar.tsx`)
- [x] مفاتيح الترجمة `nav.financeSummary` في `ar.json` + `en.json`
- [x] تقرر إخفاء دليل الحسابات (`Accounts.tsx`) من الـ navigation — تبقى الصفحة على route `/accounts` للوصول المباشر عند الحاجة
- [x] PR: fxuae277-cloud/lamsat-anoutha#1

---

### جلسة 20 — حل نهائي لأرقام التاريخ العربية

#### DateInput — استبدال native picker بـ Popover + Calendar
- [x] **المشكلة:** `input[type="date"]` النيتف يعرض أرقاماً عربية في Chrome/Edge على الأجهزة العربية — قيد من المتصفح لا يمكن تجاوزه بـ `lang` أو `dir`
- [x] **الحل:** استبدال الـ hidden native picker بـ `Popover + Calendar` (react-day-picker) الموجودَين في المشروع
  - `Calendar` يستخدم `formatters` بأرقام إنجليزية صريحة (`formatDay`, `formatMonthDropdown`, `formatYearDropdown`)
  - `captionLayout="dropdown"` لاختيار الشهر/السنة بسرعة
  - `fromYear={2020} toYear={2035}` نطاق منطقي للمشروع
  - الـ Popover يُغلق تلقائياً بعد اختيار اليوم
- [x] الكتابة اليدوية `DD/MM/YYYY` لا تزال تعمل كما كانت
- [x] القيمة المُرسَلة/المُستلمة لا تزال `YYYY-MM-DD` — لا تأثير على 17 صفحة تستخدم `DateInput`
- [x] الملف: `client/src/components/ui/date-input.tsx`
- [x] PR: fxuae277-cloud/lamsat-anoutha#1

---

### جلسة 19 — إصلاح الكميات + الفروع + التحويلات

#### Branches.tsx — switch نوع الفرع
- [x] إضافة Switch "رئيسي / فرع" في نموذج الإضافة/التعديل — يُرسل `isMain` للـ API
- [x] عند التعديل يقرأ القيمة الحالية تلقائياً
- [x] إضافة `DialogDescription` لإصلاح تحذير accessibility

#### Branches.tsx — حذف الفرع
- [x] زر سلة حمراء بجانب كل فرع (للمالك/الأدمن فقط)
- [x] Dialog تأكيد يعرض اسم الفرع قبل الحذف
- [x] `DELETE /api/branches/:id` endpoint — يُرجع 400 إذا الفرع مرتبط ببيانات
- [x] `deleteBranch(id)` في `storage.ts` و `IStorage`

#### server/storage.ts — إصلاح عرض الكميات في صفحة المنتجات
- [x] **المشكلة:** query يجلب الكمية من `inventory_balances` فقط (عبر `product_variants`) — المنتجات بدون variants تعرض 0 دائماً
- [x] **الحل:** UNION query يشمل `location_inventory` للمنتجات التي ليس لها variants:
  - المنتجات WITH variants → `inventory_balances`
  - المنتجات WITHOUT variants → `location_inventory`
- [x] نفس الإصلاح طُبّق على `getProducts()` و `searchProducts()`

#### server/routes.ts — أسماء الفروع في dropdown التحويل
- [x] `GET /api/transfer-locations`: label الفرع أصبح `اسم الفرع - المدينة` بدل الاسم فقط
- [x] يحل مشكلة ظهور "لمسة أنوثة" مرتين بدون تمييز

#### Migrations تم تشغيلها على Railway (جلسة 19)
- [x] Migration 0015 ✅ payment_method/due_date/discount/vat
- [x] Migration 0016 ✅ قيود المخزون والفهارس
- [x] Migration 0017 ✅ variant_id في order_items
- [x] Migration 0018 ✅ description + cost_default + min_qty للمنتجات
- [x] Migrations 0019→0021 ✅ تعمل تلقائياً عند startup

---

### جلسة 18 — طباعة فاتورة الشراء + حذف المستلمة + إصلاحات الأسعار

#### server/index.ts — migration 0018 تلقائية
- [x] إضافة `description + cost_default + min_qty` لجدول `products` عند startup تلقائياً (IF NOT EXISTS)

#### server/routes.ts — إصلاح try/catch
- [x] إصلاح بنية try/catch ملتبسة في `GET /api/purchases/:id` كانت تمنع الـ build

#### Purchases.tsx — طباعة فاتورة الشراء
- [x] زر **"طباعة الفاتورة"** في صفحة تفاصيل الفاتورة
- [x] يفتح نافذة HTML احترافية (A4) تُطبع تلقائياً: رأس المتجر + بيانات المورد + جدول البنود + ملخص التكاليف
- [x] يدعم الفواتير المعلقة والمعتمدة والمستلمة (يعرض التكلفة الفعلية للمستلمة)

#### Purchases.tsx — حذف الفواتير المستلمة
- [x] زر الحذف يظهر لكل الحالات (عدا الملغية)
- [x] حذف الفاتورة المستلمة يعكس المخزون تلقائياً: `inventory_balances` + `location_inventory` + `products.stock_qty` + رصيد المورد (transaction واحد)
- [x] Dialog التأكيد يعرض تحذيراً خاصاً للفواتير المستلمة
- [x] حذف زر "حذف المحددة" الجماعي (كان لا يعمل)

#### Purchases.tsx — عرض المرفقات
- [x] الصورة تظهر مباشرة في الـ dialog بدون أزرار زائدة
- [x] ضغط على الصورة → يفتحها كاملة في تبويب جديد
- [x] المرفقات القديمة (`/uploads/`) تعرض رسالة "الملف لم يعد متاحاً" بدل 404
- [x] أيقونة المرفق في القائمة لا تظهر للـ URLs المفقودة

#### server/routes.ts — إصلاح آخر سعر الشراء
- [x] `GET /api/products/:id`: يجلب `lastPurchasePrice` من `purchase_items` بفلتر `IN ('approved','received')` بدل `= 'approved'` فقط
- [x] كل **variant** يأخذ `lastPurchasePrice` من آخر فاتورة شراء خاصة به (`DISTINCT ON variant_id`) — يحل مشكلة عرض القيمة القديمة

---

### جلسة 17 — wizard المشتريات + مرفقات PostgreSQL + نسبة الربح

#### Purchases.tsx — إصلاح الأرقام العربية في حقول wizard
- [x] حقول الكمية + سعر الوحدة + اللون + المقاسات: تحويل من `type="number"` إلى `type="text" inputMode="numeric/decimal"` مع `direction: "ltr"` لإجبار ظهور الأرقام الإنجليزية

#### Purchases.tsx — حذف نافذة مراجعة OCR
- [x] حُذف الـ Dialog الكامل (250+ سطر) الخاص بمراجعة OCR + زر رفع OCR من شريط الأدوات — لا حاجة له

#### Purchases.tsx — دعم رفع مرفقات متعددة
- [x] زر "رفع مرفق" يقبل الآن `multiple` ملفات
- [x] كل ملف يُرفع على حدة لـ `/api/purchases/:id/attachment`
- [x] أيقونة المرفق في قائمة الفواتير أصبحت رابط `<a>` مباشر يفتح الملف في تبويب جديد
- [x] نافذة المرفقات تعرض الصور من جدول `purchase_attachments` الجديد (مع fallback لـ `attachmentUrls`/`attachmentUrl`)
- [x] زر "فتح" لكل مرفق + `onError` handler للصور المكسورة

#### Purchases.tsx — إصلاح زر حذف الفاتورة
- [x] زر الحذف يظهر للفواتير `pending` و `approved` (كان يقتصر على pending فقط)
- [x] `requirePermission("purchases.manage")` → `requireManager` لأن الصلاحيات لم تُضبط في DB الإنتاج
- [x] إضافة `DELETE FROM purchase_extra_costs WHERE purchase_invoice_id=$1` قبل حذف الفاتورة — كان FK بدون CASCADE يمنع الحذف صامتاً

#### نظام المرفقات الدائمة (PostgreSQL-backed)
- [x] **Migration 0021**: جدول `purchase_attachments` (id, purchase_id FK, filename, content_type, data TEXT base64, created_at)
- [x] **Migration تلقائي في startup**: يُشغَّل عند بدء الخادم (`IF NOT EXISTS`) — لا حاجة لتشغيل يدوي
- [x] **حل Railway ephemeral FS**: الملفات لا تُحفظ في الـ filesystem بل كـ base64 في PostgreSQL → تبقى بعد كل redeploy
- [x] **API endpoints جديدة**:
  - `POST /api/purchases/:id/attachment` → يخزن الملف في `purchase_attachments`
  - `GET /api/attachments/:id` → يُرجع الملف من DB
  - `DELETE /api/attachments/:id` → يحذف من DB
  - `GET /api/purchases/:id/attachments` → قائمة مرفقات الفاتورة

#### Products.tsx — نسبة الربح
- [x] **حقل "هامش الربح %"** في نموذج الإضافة/التعديل: قابل للتعديل — تغييره يُعيد حساب السعر تلقائياً، وتغيير السعر يُحدّث النسبة
- [x] **عمود "هامش الربح"** في جدول المنتجات: ملون (أخضر ≥30% / أصفر ≥10% / أحمر <10%)
- [x] **أداة "تحديث الأسعار"** (batch pricing dialog): اختيار الفئة + تحديد نسبة ربح → تحديث أسعار جميع المنتجات التي لها تكلفة مسجلة دفعة واحدة

#### Migrations
- [x] **0020**: إضافة `attachment_urls JSONB DEFAULT '[]'` إلى `purchase_invoices` + نقل `attachment_url` القديم
- [x] **0021**: جدول `purchase_attachments` — يُشغَّل تلقائياً عند startup

---

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

// Migrations 0019, 0020, 0021:
// ✅ تُشغَّل تلقائياً عند startup — لا حاجة لتشغيلها يدوياً
```

---

### جلسة 22 — تطوير صفحة أرصدة المخزون (InventoryOverview)

#### InventoryOverview.tsx — مؤشرات وتصميم شامل للمالك
- [x] **7 بطاقات KPI**: قيمة المخزون · إجمالي الأصناف · إجمالي الكمية · منخفض المخزون · نفاد المخزون · عدد الفروع · متوسط سعر البيع
- [x] **شارة صحة المخزون (0-100)** في الـ header تجمع كل عوامل المخزون دفعة واحدة
- [x] **تنبيهات المخزون**: قائمة alert cards للمنتجات تحت الحد الأدنى أو النافدة مع اللون والمقاس والموقع
- [x] **لوحة توزيع المخزون حسب الموقع**: أشرطة تقدم ملونة لكل موقع مع نسبة الكمية والقيمة
- [x] **رسم بياني دائري (recharts PieChart)**: توزيع قيمة المخزون حسب المنتج (أعلى 7 منتجات) مع Tooltip تفصيلي
- [x] **لوحة هامش الربح الإجمالي**: يحسب تلقائياً من `last_purchase_price` × الكميات مع نسبة الربح المتوقعة
- [x] **لوحة اكتمال أسعار الشراء**: نسبة الأصناف التي لها تكلفة مسجلة مع تحذير واضح
- [x] **لوحة الملخص السريع**: توزيع الأصناف (طبيعي/منخفض/نافد/عدد المواقع)
- [x] **جدول المخزون**: أُضيف عمود "آخر تكلفة" + هامش الربح لكل صنف (أخضر ≥30% / أصفر ≥10% / أحمر <10%)
- [x] **Footer للجدول**: إجماليات الكمية والقيمة مع عدد الأصناف في كل حالة
- [x] المحافظة على نظام التصميم الحالي (shadcn/ui + Tailwind) + كل الوظائف الأصلية

---

---

### جلسة 23 — تقرير الطلبات الشهري

#### Reports.tsx + routes.ts — تقرير الطلبات
- [x] **endpoint جديد** `GET /api/reports/orders-monthly?year=YYYY&branchId=X` — يرجع:
  - `monthly`: ملخص شهري (عدد الطلبات، الكمية، المبيعات، التكلفة، الربح)
  - `by_category`: أعلى 8 فئات مع تفصيل شهري
  - `by_product`: أعلى 15 منتجاً مع تفصيل شهري
  - `statuses`: توزيع حالات الطلبات (عدد + إجمالي) للسنة
- [x] **تبويب "تقرير الطلبات"** جديد في Reports.tsx:
  - بطاقات ملونة لحالات الطلبات (جديد/مؤكد/قيد التجهيز/جاهز/مُسلَّم/ملغي)
  - مخطط شريطي للمبيعات الشهرية + الربح
  - جدول الملخص الشهري مع الهامش%
  - Toggle "حسب الفئة / حسب المنتج":
    - الفئة: فطيرة (Pie) لتوزيع الفئات + جدول تفصيل شهري
    - المنتج: شريطي لأعلى 10 منتجات + جدول تفصيل شهري
  - فلتر السنة (السنة الحالية والسابقتين) + فلتر الفرع مشترك

---

#### ربط دليل الحسابات بالنظام المالي (جلسة 23 — إضافة)
- [x] **endpoint** `GET /api/accounts/with-balances?from&to` — أرصدة كل حساب من القيود المرحّلة (مدين/دائن/رصيد صافي حسب نوع الحساب)
- [x] **endpoint** `GET /api/accounts/:id/ledger?from&to` — كشف حساب واحد مع رصيد جاري (running balance)
- [x] **إعادة تصميم Accounts.tsx** بتبويبين:
  - **دليل الحسابات**: شجرة بأعمدة (مدين / دائن / رصيد) مع فلتر فترة + KPI cards بإجماليات حسب النوع + زر كشف الحساب بنقرة
  - **القيود اليومية**: قائمة كاملة مع فلتر التاريخ والحالة + زر ترحيل المسودات + dialog تفاصيل سطور القيد
- [x] **إضافة "دليل الحسابات"** في sidebar تحت قسم المالية

---

---

### جلسة 24 — ترجمة شاملة للصفحات (i18n)

#### ar.json + en.json — مفاتيح ترجمة جديدة
- [x] إضافة **497 سطر** من مفاتيح الترجمة (ar + en) للصفحات التالية:
  - `branch_summary` · `opening_stock` · `roles_mgmt` · `users_mgmt`
  - `finance_summary` · `categories_page` · `barcode_labels` · `orders_page`
  - `dashboard` (day_names, month_names, filter_date, payment methods...)

#### AppLayout.tsx — ترجمة أسماء الأيام والأشهر
- [x] استبدال hardcoded العربية (`WEEKDAY_AR` / `MONTH_AR`) بمفاتيح `t('day_names.xxx')` و `t('month_names.xxx')`

#### الصفحات المُترجمة
- [x] `Dashboard.tsx` — مفاتيح i18n لكل العناصر
- [x] `BranchSummary.tsx` — ترجمة كاملة
- [x] `OpeningStock.tsx` — ترجمة كاملة
- [x] `RolesManagement.tsx` — ترجمة كاملة
- [x] `UsersManagement.tsx` — ترجمة كاملة
- [x] `FinanceSummary.tsx` — ترجمة كاملة
- [x] `Categories.tsx` — ترجمة كاملة
- [x] `BarcodeLabels.tsx` — ترجمة كاملة
- [x] `Orders.tsx` — ترجمة كاملة

---

---

### جلسة 25 — إصلاحات الملخص المالي + إعادة تصميم POS

#### BranchSummary.tsx — إصلاح بطاقة نقد الافتتاح
- [x] بطاقة "نقد الافتتاح" تعرض الآن `currentShift.openingCash` (الوردية الحالية) بدل الوردية الأولى من اليوم
- [x] تتحدث تلقائياً عند فتح وردية جديدة بمبلغ مختلف

#### إصلاح معادلة الصندوق — الأساس دائماً openingCash
- [x] **Bug**: النظام كان يستخدم `carryForward` (رصيد أمس) كأساس بدل `openingCash` → نتيجة خاطئة (1 + 5.529 = 6.529 بدل 1)
- [x] **Fix** في `server/routes.ts`: `baseBalance = openingCash` دائماً — `carryForward` معلوماتي فقط
- [x] حُذف نص "الافتتاح المُدخل (غير مُستخدم)" من واجهة البطاقة
- [x] `carryForward` يظهر فقط كملاحظة أسفل المعادلة "للمعلومية"

#### BranchSummary.tsx — حركة الصندوق per-shift
- [x] صف كل وردية (مطوي) أُضيف عمود "بداية ← نهاية الصندوق" يعرض افتتاح الصندوق وإغلاقه مباشرة
- [x] صف كل وردية (موسّع) — مربع مرئي "بداية الصندوق → نهاية الصندوق → الفرق" بدل الشبكة المبعثرة

#### POS.tsx — إعادة تصميم قائمة المنتجات
- [x] استبدال الكروت بشبكة (cards grid) بقائمة نصية (text list)
- [x] كل صف: اسم المنتج + فئة + شارة مخزون (نافد/منخفض/متوفر مع العدد) + السعر + زر +
- [x] المنتجات النافدة تظهر شفافة وغير قابلة للنقر

---

### جلسة 26 — الرقم المرجعي للمدفوعات + مؤشرات أداء الفرع + إصلاح حساب الصندوق

#### إصلاح حساب الصندوق (carryForward)
- [x] **Bug**: الصندوق كان يظهر -88.471 بسبب استعلام `expenses` يجلب بيانات خاطئة (~90 ر.ع)
- [x] **Fix** في `server/routes.ts`: حُذف استعلام جدول `expenses` من حساب الصندوق نهائياً
- [x] استعادة `baseBalance = carryForward > 0 ? carryForward : openingCash` — الرصيد المرحّل هو الأساس الصحيح
- [x] `MANUAL_TYPES = ["owner_handover","bank_deposit","owner_cash_in","owner_transfer_in"]` بدون expense

#### الرقم المرجعي للمدفوعات (paymentReference)
- [x] **`storage.ts`**: أُضيف `paymentReference` في `getSalesFiltered` و `getSaleWithDetails` و `getSalesListReport`
- [x] **`Invoices.tsx`**: عمود مستقل "الرقم المرجعي" في جدول الفواتير (أزرق واضح للبطاقة/التحويل)
- [x] **`Invoices.tsx`**: تعديل الرقم المرجعي من modal التفاصيل (زر قلم ✏️ + حفظ/إلغاء)
- [x] **`Invoices.tsx`**: يظهر في الطباعة الحرارية 80mm وA4 إذا كان موجوداً
- [x] **`Invoices.tsx`**: البحث يشمل الرقم المرجعي
- [x] **`server/routes.ts`**: `PATCH /api/sales/:id/reference` لتعديل الرقم من الواجهة
- [x] **`exports.ts`**: عمود "الرقم المرجعي" في تصدير Excel بين طريقة الدفع والمجموع

#### إصلاح سجل المبيعات في Reports.tsx
- [x] **Bug مزدوج**: `getSalesListReport` كانت تعيد `{ rows, summary }` بدل مصفوفة → الجدول كان فارغاً دائماً
- [x] **Bug**: أسماء الحقول كانت snake_case في الواجهة لكن الـ storage يعيد camelCase → خلايا فارغة
- [x] **Fix**: `getSalesListReport` تعيد الآن مصفوفة مباشرة + `paymentReference` مضاف
- [x] **Fix**: `Reports.tsx` يستخدم `s.invoiceNumber` / `s.paymentMethod` / `s.createdAt` (camelCase صحيح)
- [x] عمود "الرقم المرجعي" في سجل المبيعات + تصدير CSV

#### BranchPerformance.tsx — صفحة مؤشرات أداء الفرع (جديدة)
- [x] صفحة جديدة `client/src/pages/BranchPerformance.tsx` على route `/branch-performance`
- [x] **متاحة للموظفين** — أُضيفت في `EMPLOYEE_ALLOWED_PATHS` و `EMPLOYEE_SIDEBAR`
- [x] **فلتر الفترة**: اليوم / هذا الأسبوع / هذا الشهر / مخصص (DateInput)
- [x] **6 بطاقات KPI**: إجمالي المبيعات · نقدي · بطاقة · تحويل · عدد الفواتير · متوسط الفاتورة
- [x] **مخطط عمودي مكدّس يومي** (recharts BarChart): أخضر نقدي / أزرق بطاقة / بنفسجي تحويل
- [x] **مخطط دائري** (recharts PieChart): توزيع طرق الدفع بنسب مئوية + ملخص أرقام
- [x] **جدول آخر 30 فاتورة**: رقم الفاتورة · طريقة الدفع · الرقم المرجعي · الإجمالي · التاريخ · الوقت
- [x] مفاتيح i18n: `nav.branchPerformance` في `ar.json` + `en.json`
- [x] الأيقونة: `BarChart2` من lucide-react في sidebar

---

---

### جلسة 27 — إصلاحات مخزن الفرع + POS

#### إصلاح الرقم المرجعي في createSale
- [x] **Bug**: `storage.ts` → `createSale` INSERT كان لا يتضمن `payment_reference` → يُحفظ NULL دائماً
- [x] **Fix**: أُضيف `payment_reference` ($11) في INSERT + `data.paymentReference || null` في القيم
- [x] الرقم المرجعي يظهر الآن في `Invoices.tsx` و `BranchPerformance.tsx` للفواتير الجديدة

#### BranchStock.tsx — إعادة تصميم كاملة (تبويبان)
- [x] **تبويب 1 — المخزون الحالي**:
  - 4 بطاقات KPI: عدد الأصناف · إجمالي الكميات · إجمالي المنتجات · عدد الفئات
  - عمود جديد "الفئة" في الجدول
  - كميات ملونة: أخضر (طبيعي) / أصفر (≤5) / أحمر (0)
  - سطر إجماليات أسفل الجدول
- [x] **تبويب 2 — سجل التحويلات**:
  - 3 بطاقات KPI: عدد التحويلات · إجمالي القطع المستلمة · تاريخ آخر تحويل
  - صفوف قابلة للتوسيع: رقم TRF-XXXXX · التاريخ · المصدر · الكمية · عدد الأصناف
  - تفاصيل: المنتج / الفئة / اللون / المقاس / الباركود / الكمية

#### إصلاح دقة كميات مخزن الفرع
- [x] **Bug**: نفس الـ variant تظهر أكثر من مرة إذا كان الفرع يملك أكثر من موقع
- [x] **Fix**: `GROUP BY variant_id + SUM(qty_on_hand)` عبر كل مواقع الفرع → كمية واحدة صحيحة
- [x] `last_transfer_date` و `transferred_qty` يستعلمان الآن بـ `branch_id` بدل `location_id`

#### endpoint جديد: `GET /api/branch-stock/:branchId/transfers`
- [x] يُرجع كل التحويلات الواردة للفرع (status = 'approved') مع تفاصيل كاملة:
  - رقم التحويل (TRF-XXXXX) · التاريخ · من أين · إجمالي الكمية · عدد الأصناف
  - `lines`: مصفوفة JSON بكل صنف (اسم المنتج / الفئة / اللون / المقاس / الباركود / الكمية)
- [x] `category_name` أُضيف لاستعلام المخزون الحالي أيضاً

#### إصلاح POS — مصدر الكميات للمنتجات ذات variants
- [x] **Bug**: `GET /api/pos/products` و `GET /api/pos/top` كانا يجلبان `stockQty` من `location_inventory` فقط
- [x] **نتيجة الخطأ**: POS يعرض 16 قطعة بينما البيع يرفض بـ "المخزون 0" (التحقق من `inventory_balances`)
- [x] **Fix**: استخدام `CASE WHEN EXISTS variants THEN inventory_balances ELSE location_inventory END`
  - منتجات بـ variants → `inventory_balances` (صحيح ← نفس مصدر فحص البيع)
  - منتجات بدون variants → `location_inventory` (كما كان)

---

### جلسة 28 — إصلاح TypeScript Build + صفحة مؤشرات الأداء

#### إصلاح TypeScript errors كانت تمنع Railway من البناء
- [x] **storage.ts**: إصلاح `return rows` (قوس زائد `};`) في `getSalesListReport` → خطأ syntax منع كل الـ build
- [x] **en.json**: إضافة مفاتيح ناقصة كانت تسبب type mismatch مع ar.json:
  - `nav.usersManagement` + `nav.rolesManagement`
  - `settings.branch_address` + `settings.branch_phone` + `settings.branches_desc`
  - `dashboard.total_products`

#### BranchPerformance.tsx — صفحة مؤشرات أداء الفرع (جلسة 26-28)
- [x] صفحة جديدة `client/src/pages/BranchPerformance.tsx` على route `/branch-performance`
- [x] متاحة للموظفين — `EMPLOYEE_ALLOWED_PATHS` + `EMPLOYEE_SIDEBAR`
- [x] فلتر الفترة: اليوم / هذا الأسبوع / هذا الشهر / مخصص
- [x] 6 بطاقات KPI: إجمالي · نقدي · بطاقة · تحويل · عدد الفواتير · متوسط الفاتورة
- [x] مخطط عمودي مكدَّس يومي (نقدي/بطاقة/تحويل) + مخطط دائري للتوزيع
- [x] جدول آخر 30 فاتورة مع الرقم المرجعي + التاريخ والوقت

---

---

### جلسة 29 — إصلاح تنبيهات المخزون (InventoryAlerts)

#### المشكلة الجذرية (3 أخطاء متداخلة)
- [x] **Bug 1 — مصدر البيانات**: `InventoryAlerts.tsx` كان يقرأ `dashboard?.lowStock` لكن الـ API يُرجع `lowStockItems` → مصفوفة فارغة دائماً
- [x] **Bug 2 — جدول خاطئ**: `getLowStockAlerts()` كانت تستعلم من جدول `inventory` القديم (مرتبط بـ `warehouses`) بدل `location_inventory` → لا نتائج
- [x] **Bug 3 — حقول خاطئة**: الفرونت يتوقع `name/totalQty/reorderLevel` لكن القديمة تُرجع `productName/quantity/minQuantity`

#### الإصلاح
- [x] **`server/storage.ts`** — `getLowStockAlerts()` مُعاد كتابتها: تستعلم من `location_inventory` JOIN `products`، تجمّع الكميات بـ SUM، تقارن مع `products.min_qty` (الحد الذي يضبطه المستخدم في صفحة المنتجات)
- [x] **`client/src/pages/InventoryAlerts.tsx`** — تستخدم الآن `/api/inventory/low-stock` المخصص (بدل تحميل dashboard كاملاً)
- [x] **UI محسّن**: بطاقتا KPI (نافد / منخفض) + تمييز بصري بين الحالتين + loading state

---

#### BranchPerformance.tsx — فلتر الفرع + بحث الفواتير (جلسة 29)
- [x] **Dropdown "الفرع"** في شريط الفلاتر: "الكل — جميع الفروع" + قائمة الفروع الفعلية (من `/api/branches`)
- [x] اختيار فرع محدد → كل البيانات (KPI + مخططات + جدول الفواتير) تتحدث لهذا الفرع فقط
- [x] **Badge الفرع النشط**: يظهر أسفل الفلاتر عند اختيار فرع محدد
- [x] **`server/routes.ts`**: `/api/sales` يقبل الآن `?branchId` من المالك/الأدمن (scope.mode === "all")
- [x] **شريط بحث + فلاتر جدول الفواتير**:
  - بحث نصي: رقم الفاتورة / اسم العميل / الجوال / الرقم المرجعي
  - فلتر طريقة الدفع (نقدي / بطاقة / تحويل)
  - فلتر الموظف (الكاشير) — يُستخرج تلقائياً من بيانات الفواتير المحمّلة
  - زر "مسح الفلاتر" يظهر عند وجود فلتر نشط + عداد "X من Y فاتورة"
- [x] **أعمدة جديدة في الجدول**: العميل (مع الجوال) + الكاشير + عمود الفرع عند "الكل"

#### sidebar.tsx — تحديث قائمة المالك (جلسة 29)
- [x] حُذف "الفواتير" (Invoices) من قسم "العمليات" في sidebar المالك

---

### جلسة 30 — إصلاح مخزون المشتريات + عرض الأرصدة

#### المشكلة الجذرية: المخزون لم يُضاف عند استلام الفاتورة
- [x] **`server/storage.ts`** — `receivePurchaseInvoice()` مُعاد كتابتها بالكامل:
  - **Guard**: يتحقق من `inventory_transactions WHERE ref_table='purchase_invoices' AND to_location_id=centralId` لمنع التكرار
  - **المنتجات مع variantId**: `inventory_balances` + `inventory_ledger` + `location_inventory` + `products` + `inventory_transactions`
  - **المنتجات بدون variantId** (بسيطة): `location_inventory` + `products` + `inventory_transactions` فقط (بدون إنشاء variant)
  - **المخزن المركزي**: يُجلب من `locations WHERE is_central=true AND branch_id IS NULL`

#### إصلاح عرض الأرصدة في صفحة التحويلات
- [x] **`server/storage.ts`** — `getInventoryBalances()` بنمط UNION:
  - **Part 1**: `inventory_balances JOIN product_variants` حيث `(color IS NOT NULL OR size IS NOT NULL OR sku IS NOT NULL)` — منتجات ذات variants حقيقية
  - **Part 2**: `location_inventory` حيث `NOT EXISTS (product_variants WHERE color/size/sku IS NOT NULL)` — منتجات بسيطة
  - سبب الإصلاح: البيانات القديمة في `location_inventory` كانت مُستثناة من العرض بسبب شرط NOT EXISTS الخاطئ
- [x] **`server/routes.ts`** — `transfer-source-stock` endpoint بنفس نمط UNION:
  - Part 1: variants حقيقية من `inventory_balances`
  - Part 2: منتجات بسيطة من `location_inventory` مع default variant_id إذا وُجد
- [x] **Interface**: تحديث `IStorage.getInventoryBalances(locationId?, branchId?)` لإضافة المعامل الثاني

#### مبدأ "source of truth" للمخزون
- `inventory_balances` → مصدر الحقيقة لمنتجات ذات variants حقيقية (color/size/sku غير NULL)
- `location_inventory` → مصدر الحقيقة لمنتجات بسيطة (كل variants بـ NULL أو بدون variants)
- "auto-created default variant" (color/size/sku = NULL, is_default=true) لا يُعدّ variant حقيقي

#### sidebar.tsx + BranchPerformance.tsx (جلسة 30)
- [x] **sidebar.tsx**: حُذف "الفواتير (Invoices)" من قسم العمليات في OWNER_SIDEBAR
- [x] **BranchPerformance.tsx**: شريط بحث + فلاتر كاملة في جدول الفواتير:
  - بحث نصي (رقم فاتورة / عميل / جوال / مرجع) — client-side
  - فلتر طريقة الدفع + فلتر الكاشير (مشتق من البيانات المحمّلة)
  - زر "مسح الفلاتر" + عداد "X من Y فاتورة"
  - إزالة حد الـ 30 فاتورة — يعرض الكل
  - أعمدة جديدة: العميل (الاسم + الجوال) + الكاشير

---

### جلسة 31 — نظام طابعتين (Receipt + Label)

#### `server/routes.ts` — endpoint جديد
- [x] **`GET /api/printers`**: يُرجع قائمة الطابعات المثبتة على النظام
  - Windows: `powershell Get-Printer | Select-Object -ExpandProperty Name`
  - Linux/Mac: `lpstat -a | awk '{print $1}'`
  - يُرجع `{ printers: string[] }` — مصفوفة فارغة عند الخطأ أو عدم الاكتشاف

#### `client/src/pages/Settings.tsx` — قسم تعيين الطابعات
- [x] **إعدادات جديدة** في `DEFAULT_SETTINGS`: `receiptPrinter: ""` + `labelPrinter: ""`
- [x] **useQuery** لجلب `GET /api/printers` وتخزين القائمة في `systemPrinters`
- [x] **UI** في قسم "إعدادات الطباعة": بلوك أزرق بعنوان "تعيين الطابعات" يحتوي:
  - Dropdown "طابعة الإيصالات" مع قائمة الطابعات + "بدون تحديد"
  - Dropdown "طابعة الملصقات" مع نفس القائمة
  - زر "طباعة إيصال تجريبي" — يفتح نافذة 80mm ويطبع
  - زر "طباعة ملصق تجريبي" — يفتح نافذة 58×40mm ويطبع
  - تحذير إذا لم تُكتشف طابعات
- [x] **الحفظ** يمر عبر نفس `PATCH /api/settings` الموجود (key-value store)

#### `client/src/pages/POS.tsx` — ReceiptModal
- [x] `useQuery` لجلب `/api/settings` واستخراج `receiptPrinter`
- [x] `receiptPrinter` prop مُمرَّر من الكومبوننت الرئيسي إلى `ReceiptModal`
- [x] **Validation**: toast destructive إذا لم تُحدَّد طابعة الإيصال
- [x] **Printer hint**: شريط أصفر في نافذة الطباعة يعرض اسم الطابعة (يختفي عند الطباعة)
- [x] `@page { size: 80mm auto; margin: 0; }` في CSS نافذة الطباعة

#### `client/src/pages/BarcodeLabels.tsx` — handlePrint
- [x] `useQuery` لجلب `/api/settings` واستخراج `labelPrinter`
- [x] **Validation**: toast destructive إذا لم تُحدَّد طابعة الملصقات
- [x] **Printer hint**: شريط أصفر في نافذة الطباعة يعرض اسم الطابعة
- [x] `@page { size: ${mm_w}mm ${mm_h}mm; margin: 0; }` مخصص لحجم الملصق

#### ترجمة (ar.json + en.json)
- [x] `settings.printer_assignment` · `receipt_printer` · `label_printer`
- [x] `settings.select_printer` · `no_printer_selected`
- [x] `settings.test_receipt_print` · `test_label_print`
- [x] `settings.printers_not_detected`
- [x] `barcode_labels.no_label_printer` · `no_label_printer_desc`

### جلسة 34 — فاتورة احترافية بهوية العلامة + إعدادات الطابعات الافتراضية

#### `client/src/lib/printer.ts` — إعادة تصميم كاملة للفاتورة الحرارية

**تصميم الفاتورة (مطابق لهوية لمسة أنوثة):**
- [x] **شعار المتجر**: يُحمَّل `/logo.png` كـ base64 data URL (آمن لـ html2canvas — نفس الـ origin)
- [x] **اسم العلامة**: `LAMST ANOTHA` بحروف كبيرة + سطر `── TOUCH OF FEMININITY ── ♥`
- [x] **شريط التواصل** (3 أعمدة): رقم السجل التجاري 1260008 | @lamst_anotha | 94891122
- [x] **شريط الفاتورة** (خلفية سوداء): رقم الفاتورة (يمين) | التاريخ والوقت (يسار)
- [x] **الفرع / الكاشير / العميل** في صف منفصل
- [x] **رأس جدول الأصناف** (خلفية سوداء): م | الصنف | الكمية | سعر الوحدة | الإجمالي
- [x] **صفوف الأصناف** مع فواصل متقطعة بين كل صنف
- [x] **قسم الإجماليات**: المجموع الفرعي + الخصم + ضريبة القيمة المضافة (إذا > 0)
- [x] **شريط الإجمالي الكلي** (خلفية سوداء): الإجمالي | XX.XXX ر.ع
- [x] **تفاصيل الدفع**: المدفوع + الباقي + طريقة الدفع
- [x] **صندوق الشكر** (حدود متقطعة): ♥ شكراً لثقتكم بنا ♥ / نسعد بخدمتكم دائماً
- [x] **تذييل 3 أعمدة**: جودة وأنافة تليق بكِ | [QR اختياري] | تسوقي الآن مع لمسة أنوثة
- [x] **سياسة الاسترجاع**: بالعربي والإنجليزي

**تقنيات:**
- [x] `scale: 3` (بدلاً من 2) → دقة أعلى: 1728px canvas → 576 dots طابعة
- [x] `useCORS: true` لتحميل الشعار من نفس الـ origin
- [x] جميع التخطيطات بـ `<table>` (بدون flexbox) — html2canvas متوافق 100%
- [x] جميع الأنماط inline — لا اعتماد على CSS خارجي
- [x] `qrCodeDataUrl?: string` في `ReceiptData` — QR اختياري إذا مُمرَّر

**الطباعة التلقائية في POS:**
- [x] `saleMutation.onSuccess` أصبح `async` — يطبع الفاتورة فوراً بعد حفظ البيع في DB
- [x] فشل الطباعة = toast تحذيري فقط، لا يمنع إتمام البيع
- [x] `openCashDrawer()` تُستدعى تلقائياً عند الدفع النقدي (`paymentMethod === 'cash'`)
- [x] `ReceiptModal.handlePrint` يمرر الآن `subtotal` و`vat` للفاتورة

**الدوال المُصدَّرة:**
- `ensureQzConnected()` · `getReceiptPrinter()` · `buildReceiptHtml(data, logoDataUrl)`
- `printReceiptAsImage(data, printerName?, rotate180?)` · `cutPaper()` · `openCashDrawer()`
- `printTestReceiptAsImage()` · `printReceipt` (alias للتوافق العكسي)

---

#### `client/src/pages/Settings.tsx` — إعدادات الطابعات الافتراضية

- [x] **`DEFAULT_SETTINGS`**: `receiptPrinter: 'EPSON TM-T100 Receipt'` · `labelPrinter: 'TSC TTP-244M Pro'`
- [x] **`FIXED_PRINTERS`**: ثابت يحتوي الطابعتين — يظهر دائماً في القوائم بغض النظر عن اكتشاف Windows
- [x] **`allPrinters`**: `Array.from(new Set([...FIXED_PRINTERS, ...systemPrinters]))` — بدون تكرار
- [x] **`useEffect`** محمّي: إذا كانت القيمة المحفوظة فارغة أو `"بدون تحديد"` يُستعاد الافتراضي
- [x] **`testReceiptPrint`**: أصبح يستدعي `printTestReceiptAsImage(printer)` عبر QZ Tray (بدل `window.open`) مع spinner
- [x] **`testLabelPrint`**: يستخدم القيمة الافتراضية إذا لم تُحدَّد طابعة
- [x] الـ dropdown يستخدم `allPrinters` بدلاً من `systemPrinters`
- [x] رسالة التحذير تحوّلت من تحذير إلى إشعار أزرق معلوماتي

**النتيجة:** فتح إعدادات الطباعة يعرض فوراً:
- طابعة الإيصالات: `EPSON TM-T100 Receipt` ✅
- طابعة الملصقات: `TSC TTP-244M Pro` ✅

---

### جلسة 33 — QZ Tray: طباعة إيصالات مباشرة (ESC/POS)

#### `client/index.html`
- [x] إضافة سكريبت QZ Tray من CDN قبل `main.tsx`:
  `<script src="https://cdn.jsdelivr.net/npm/qz-tray/qz-tray.js"></script>`

#### `client/src/lib/printer.ts` (ملف جديد)
- [x] `connectQZ()` — يتصل بـ QZ Tray WebSocket، يُعيد الاستخدام إذا كان الاتصال نشطاً (تجنّب إعادة الاتصال)
- [x] `disconnectQZ()` — قطع الاتصال عند الحاجة
- [x] `buildReceipt(data)` — يبني سلسلة ESC/POS كاملة:
  - `ESC @` تهيئة + `ESC t 0x1C` اختيار CP864 (عربي)
  - عنوان "لمسة أنوثة" مزدوج الحجم + بيانات الفاتورة بعمودين
  - أصناف مع الكمية × السعر والإجمالي
  - الخصم + الإجمالي (غامق) + المدفوع + الباقي + طريقة الدفع
  - `GS V 0x41 0x00` قطع الورق (partial cut)
- [x] `printReceipt(data, printerName?)` — الدالة المُصدَّرة:
  1. Guard: `typeof qz !== 'undefined'`
  2. `connectQZ()` — اتصال آمن
  3. `qz.printers.find(name)` — البحث عن الطابعة بالاسم (افتراضي: `EPSON TM-T100 Receipt`)
  4. `qz.print(config, [{type:'raw', format:'plain', options:{encoding:'CP864'}}])`
- [x] أخطاء عربية وصفية: QZ غير مشغّل / الطابعة غير موجودة

#### `client/src/pages/POS.tsx` — ReceiptModal
- [x] استبدال `handlePrint` (window.open + window.print) بنسخة async تستدعي `printReceipt()`
- [x] حذف `printRef` و `ref={printRef}` (لم تعد مطلوبة)
- [x] حالة `printing` (boolean): زر الطباعة يُعطَّل ويظهر spinner أثناء الطباعة
- [x] Toast: "تمت الطباعة بنجاح ✅" أو رسالة الخطأ المُفصَّلة
- [x] `receiptPrinter` من الإعدادات يُمرَّر كـ `printerName` اختياري — يتيح تخصيص اسم الطابعة من Settings

#### ملاحظات التشغيل
- يتطلب تشغيل تطبيق QZ Tray على جهاز الكاشير
- اسم الطابعة يطابق اسمها في قائمة طابعات Windows
- CP864 يدعم الطباعة العربية على طابعات EPSON ذات الفريموير العربي
- عرض الورق: 80mm = 42 حرفاً في السطر الواحد

---

## ⏳ القادم
- [ ] لا يوجد مهام محددة حالياً

## ⚠️ ملاحظة
- "المخزن المركزي" في dropdown التحويل هو موقع `is_central=true` من جدول `locations` — منفصل عن الفروع — يظهر مع 4 فروع = 5 خيارات إجمالاً

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
- Attachments: base64 في جدول `purchase_attachments` (Railway ephemeral FS لا يحفظ الملفات)
- Category Hierarchy: parentId self-reference
- Inventory filters: branches via `/api/branches` للـ BalancesTab و LedgerTab
- Transfers: `/api/transfer-locations` يستخدم locations (وليس branches) لأن التحويل بين مواقع محددة
- RTL arrows: دائماً `ArrowLeft rotate-180` مع `dir="ltr"` في الـ wrapper

---

## 📌 تعليمات
في نهاية كل جلسة حدّث هذا الملف بما تم ✅ وما تبقى ⏳
