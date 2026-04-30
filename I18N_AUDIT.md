# I18N AUDIT — لمسة أنوثة (Phase 1)

> **التاريخ:** 2026-04-29
> **النطاق:** `client/src/**`, `server/**`, `shared/**`
> **الهدف:** تحديد كل النصوص العربية الـ hardcoded التي يجب استبدالها بـ `t()` keys، وتقدير نسبة اكتمال الترجمة الحالية.
> **الحالة:** **تقرير فقط — لم يُعدَّل أي كود.**

---

## 1) البنية التحتية الحالية للـ i18n

| العنصر | الحالة |
|---|---|
| ملف الإعداد | `client/src/lib/i18n.tsx` — موجود ويعمل |
| ملفات الترجمة | `client/src/locales/ar.json` و `en.json` — كلاهما 3070 سطراً، حوالي **~1500 مفتاح** متطابقاً في كلا اللغتين |
| Provider | `I18nProvider` ملفوف حول التطبيق، يضبط `<html dir>` و `<html lang>` ديناميكياً ✅ |
| دالة `t()` | تدعم dot-path (مثل `nav.dashboard`)، لكن لا تدعم namespace/fallback default |
| Hook | `useI18n()` فقط — **لا يوجد `useTranslation()`** كما تطلب المواصفات |
| تخزين التفضيل | `localStorage.getItem('ui_language')` — **❗ المواصفات تطلب `lamsa_lang`** (مفتاح مختلف) |
| دعم `dir="rtl"` ديناميكي | يعمل ✅ — `useEffect` يحدّث `documentElement.dir` و `body.style.direction` |

### نقاط ضعف يجب معالجتها في المرحلة 2:
1. **مفتاح `localStorage` مختلف** عن المطلوب (`ui_language` بدلاً من `lamsa_lang`) — يحتاج migration للمستخدمين الحاليين أو قبول التغيير.
2. **لا يوجد namespace splitting** — كل المفاتيح في ملف JSON واحد كبير. المواصفات تطلب `t('namespace:key')` (مثل `t('pos:button.checkout')`). يحتاج إعادة هيكلة.
3. **لا يوجد fallback** للنصوص المفقودة — `t('missing.key')` يُرجع المفتاح نفسه (سلوك جيد لكن غير موثَّق).
4. **`document.body.style.textAlign`** يُضبط على `right` أو `left` بدلاً من الاعتماد على `dir` فقط — قد يتعارض مع Tailwind classes في الإنجليزية.

---

## 2) ملفات الـ Frontend — تصنيف وتقدير

### مفتاح القراءة
- **AR-occ:** عدد ظهورات حرف عربي (من grep) — يشمل التعليقات والكود
- **t()-calls:** عدد استدعاءات `t('...')` في الملف
- **استخدام `useI18n`:** هل يستورد الـ hook
- **Status:** تقدير نسبة الاكتمال

### Tier 0 — ملفات مترجَمة بالكامل (≥95%)
هذه الملفات تستورد `useI18n` ولا تحتوي نصوصاً عربية مهمة:

| الملف | الحالة |
|---|---|
| `pages/Login.tsx` | ✅ كامل — 11 t() call، 0 Arabic occ |
| `pages/Dashboard.tsx` | ✅ 36 t()، 0 Arabic |
| `pages/Executive.tsx` | ✅ 65 t()، 0 Arabic |
| `pages/ExecutivePlus.tsx` | ✅ 45 t()، 0 Arabic |
| `pages/HR.tsx` | ✅ 67 t()، 0 Arabic (الواجهة فقط — الـ tabs لها ملفات منفصلة) |
| `pages/JournalEntries.tsx` | ✅ 66 t()، 0 Arabic |
| `pages/GeneralLedger.tsx` | ✅ 26 t()، 0 Arabic |
| `pages/Returns.tsx` | ✅ 71 t()، 0 Arabic |
| `pages/Operations.tsx` | ✅ 34 t()، 0 Arabic |
| `pages/AuditLog.tsx` | ✅ 36 t()، 0 Arabic |
| `pages/RolesManagement.tsx` | ✅ 17 t()، 0 Arabic |
| `pages/FinanceSummary.tsx` | 🟡 38 t()، 3 Arabic (تعليقات + سلسلة عملة `ر.ع`) |
| `pages/StockControl.tsx` | 🟡 89 t()، 1 Arabic (تعليق فقط) |
| `pages/Suppliers.tsx` | 🟡 46 t()، 1 Arabic |
| `pages/PurchaseReturns.tsx` | 🟡 3 t()، 2 Arabic — **عدد قليل من t()، يحتاج تحقق** |
| `pages/InventoryAlerts.tsx` | 🟡 7 t()، 9 Arabic |
| `pages/hr/RemainingTab.tsx` | ✅ 6 t()، 0 Arabic |
| `pages/hr/ReportsTab.tsx` | ✅ 10 t()، 0 Arabic |
| `pages/hr/EmployeesTab.tsx` | ✅ 21 t()، 0 Arabic |
| `pages/hr/FinancialProfileDialog.tsx` | ✅ 33 t()، 0 Arabic |
| `pages/hr/helpers.tsx` | ✅ 5 t()، 0 Arabic |
| `pages/mobile/MobileShift.tsx` | ✅ 18 t()، 0 Arabic |
| `pages/mobile/MobileEmployeeHome.tsx` | ✅ 9 t()، 0 Arabic |
| `pages/mobile/MobileOwnerHome.tsx` | ✅ 25 t()، 0 Arabic |
| `pages/mobile/MobileMore.tsx` | ✅ 19 t()، 0 Arabic |
| `pages/mobile/MobilePOS.tsx` | ✅ 21 t()، 0 Arabic |
| `pages/mobile/MobileInvoices.tsx` | ✅ 5 t()، 0 Arabic |
| `pages/mobile/MobileTransfers.tsx` | ✅ 15 t()، 0 Arabic |
| `pages/mobile/MobileInventory.tsx` | ✅ 12 t()، 0 Arabic |
| `pages/mobile/MobileStocktake.tsx` | ✅ 15 t()، 0 Arabic |
| `pages/mobile/MobileCustomers.tsx` | ✅ 51 t()، 0 Arabic |
| `pages/mobile/MobilePurchases.tsx` | ✅ 19 t()، 0 Arabic |
| `pages/Customers.tsx` | ✅ 128 t()، 3 Arabic (تعليقات) |
| `pages/UsersManagement.tsx` | 🟡 79 t()، 8 Arabic (3-4 رسائل toast غير مغطّاة) |
| `pages/Branches.tsx` | 🟡 4 t()، 29 Arabic — **يحتاج عمل كبير** |

**عدد الملفات في Tier 0:** ~30 ملف (≥95% مكتمل)

---

### Tier 1 — ملفات عالية الحجم تحتاج عملاً (50-100% الباقي)

| الملف | السطور | AR-occ | t()-calls | المتبقي تقريباً | ملاحظات |
|---|---|---|---|---|---|
| `pages/Purchases.tsx` | 2738 | 249 | 150 | ~70-90 سلسلة | t() مستخدم بكثافة لكن toasts ورسائل تأكيد عربية متبقية |
| `pages/POS.tsx` | 1564 | 185 | 185 | ~80-100 سلسلة | **خاص:** يحتوي خريطة `CATEGORY_ICONS` (سطر 72-73) بمفاتيح عربية + status labels (سطور 78-80) + WhatsApp template (سطور 247-256) — كله عربي hardcoded |
| `pages/Reports.tsx` | 1087 | 213 | 213 | ~80-100 سلسلة | معدّل t/AR متساوٍ — يحتاج فحص دقيق لكل JSX text |
| `pages/Purchases.tsx` (تكرار) | — | — | — | — | (مدمج أعلاه) |
| `pages/OwnerFinancialSummary.tsx` | ? | 119 | ~40 | ~70 سلسلة | **بلوكر:** كائن بسطور 45-49 يحتوي 5 transaction labels عربية مع icon refs (`BRANCH_CASH_TRANSFER_TO_OWNER`, `OWNER_DEPOSIT_TO_BANK`, ...) — يحتاج نقل القيم لـ locale + إبقاء الـ icon |
| `pages/Expenses.tsx` | 737 | 114 | ~50 | ~50-60 سلسلة | toasts، error messages، status labels |
| `pages/InventoryOverview.tsx` | ? | 115 | 39 | ~60-70 سلسلة | t() مستخدم لكن فقط للعناوين الرئيسية |
| `pages/Finance.tsx` | 590 | 109 | ~25 | ~60-70 سلسلة | **بلوكر:** ثابت `TYPE_LABELS_AR` (سطر 41-49) يربط 8 أنواع بنصوص عربية. يُستخدم في PDF export (سطر 161) و Badge (سطر 320). يجب نقله لـ locale أو استبداله بـ `t('finance.types.sale')` |
| `pages/Products.tsx` | ? | 106 | 95 | ~30-40 سلسلة | تغطية جيدة لكن status + validation messages متبقية |
| `pages/BranchSummary.tsx` | ? | 90 | 36 | ~50 سلسلة | |
| `pages/BranchPerformance.tsx` | ? | 69 | 0 | ~60 سلسلة | **❗ لا يستخدم useI18n إطلاقاً** — يحتاج تحويلاً كاملاً |
| `pages/Inventory.tsx` | ? | 54 | 78 | ~30 سلسلة | تغطية جيدة، يحتاج تنظيفاً |
| `pages/BranchStock.tsx` | ? | 30 | 16 | ~20 سلسلة | |

**عدد الملفات في Tier 1:** 12 ملف
**إجمالي السلاسل المتبقية المقدّر:** ~700-900 سلسلة

---

### Tier 2 — ملفات متوسطة (20-50 سلسلة عربية)

| الملف | AR-occ | t() | الحالة |
|---|---|---|---|
| `components/payroll/salary-payments/SalaryPaymentsPage.tsx` | 60 | 0 | ❗ بلا useI18n — تحويل كامل |
| `components/payroll/financial-movements/FinancialMovementsPage.tsx` | 58 | 0 | ❗ بلا useI18n — تحويل كامل |
| `components/DevicePrintSettingsDialog.tsx` | 51 | 0 | ❗ بلا useI18n — toasts + JSX |
| `components/payroll/employees/EmployeesPage.tsx` | 37 | 0 | ❗ بلا useI18n |
| `components/payroll/payroll-sheet/PayrollSheetPage.tsx` | 35 | 0 | ❗ بلا useI18n |
| `components/payroll/payroll-summary/PayrollSummaryPage.tsx` | 25 | 0 | ❗ بلا useI18n |
| `pages/Categories.tsx` | 23 | 63 | 🟡 t() جيد، baeqfa toasts عربية |
| `components/Invoice80.tsx` | 29 | 0 | **خاص — قالب طباعة:** يحتاج logic لتبديل اللغة عند الطباعة (لا تكسر print-service v2.3.0 في local-print-service/) |
| `components/Invoice58.tsx` | 23 | 0 | **خاص — قالب طباعة:** نفس Invoice80 |
| `pages/Invoices.tsx` | 26 | 78 | 🟡 t() جيد، ~10 سلاسل متبقية |
| `pages/Orders.tsx` | 26 | 157 | 🟡 t() جيد، ~10 سلاسل متبقية |
| `pages/OpeningStock.tsx` | 25 | 47 | 🟡 ~15 سلسلة متبقية |
| `pages/Settings.tsx` | 13 | 99 | 🟡 ~5-8 سلاسل متبقية |
| `pages/hr/PayrollSheetTab.tsx` | 0 | 69 | ✅ كامل |
| `pages/hr/SalaryPaymentsTab.tsx` | 0 | 70 | ✅ كامل |
| `pages/hr/MonthlyMovementsTab.tsx` | 0 | 86 | ✅ كامل |

**عدد الملفات في Tier 2:** 16 ملف
**إجمالي المتبقي:** ~280-350 سلسلة

---

### Tier 3 — ملفات صغيرة/مساعدة

| الملف | AR-occ | ملاحظات |
|---|---|---|
| `App.tsx` | 2 | تعليقات فقط |
| `config/sidebar.tsx` | 3 | تحقق من القائمة |
| `lib/formatters.ts` | 2 | عملة `ر.ع` — يحتاج معالجة خاصة (تنسيق العملة) |
| `lib/i18n.tsx` | 0 | (الـ provider نفسه) |
| `lib/queryClient.ts` | 1 | تعليق |
| `lib/utils.ts` | 0 | ✅ |
| `lib/printer.ts` | 51 | **خاص — منطق الطباعة:** يحوي قوالب ESC/POS عربية + ترميز عملة. يحتاج logic مماثل للغة الواجهة |
| `lib/qzPrinter.ts` | 14 | منطق طباعة QZ — رسائل toast عربية |
| `lib/qz-print-service.ts` | 5 | تعليقات في الغالب |
| `lib/localPrintClient.ts` | 13 | client للـ print service — رسائل خطأ عربية |
| `lib/payroll-dummy-data.ts` | 45 | **بيانات اختبار** — أسماء موظفين، فروع، مناصب. **لا حاجة للترجمة** (mock data) |
| `hooks/usePayroll.ts` | 1 | تعليق |
| `components/BarcodeScanner.tsx` | 8 | toasts |
| `components/BarcodeScanButton.tsx` | 0 | ✅ |
| `components/layout/AppLayout.tsx` | 3 | |
| `components/layout/MobileLayout.tsx` | 0 | ✅ |
| `components/layout/Sidebar.tsx` | 0 | ✅ — يستخدم `t('nav.*')` |
| `components/layout/NotificationBell.tsx` | 18 | ❗ بلا useI18n — رسائل التنبيهات عربية |
| `components/payroll/shared/PayrollBadge.tsx` | 12 | status map عربي |
| `components/payroll/shared/EmptyState.tsx` | 1 | |
| `components/payroll/shared/usePayrollToast.ts` | 15 | toast titles عربية |
| `components/payroll/shared/payrollUtils.ts` | 6 | labels داخلية |
| `components/ui/date-input.tsx` | 18 | placeholder/format عربي |
| `pages/BarcodeLabels.tsx` | 11 | 48 t()-calls — يحتاج تنظيفاً صغيراً |
| `pages/mobile/MobileProducts.tsx` | 2 | تعليقات |

---

## 3) ملفات الـ Backend — رسائل الخطأ

> **القاعدة المطلوبة:** السيرفر يُرسل `errorCode` (مثل `INSUFFICIENT_STOCK`)، والـ frontend يترجمه. حالياً السيرفر يُرسل النص العربي مباشرةً.

| الملف | AR-occ | تصنيف | عمل مقدّر |
|---|---|---|---|
| `server/routes.ts` | **639** | معظمها رسائل خطأ user-facing (عبر `res.json({message: "..."})`، `res.status().json(...)`، toasts غير مباشرة) + تعليقات بالعربية لتنظيم الكود | ~250-350 رسالة → error codes |
| `server/exports.ts` | **130** | **خاص — كله user-facing:** عناوين أعمدة CSV/Excel عربية (`"التقرير اليومي"`, `"الفرع"`, `"المبلغ"`, `"المبيعات نقدي"`) | ~80-100 عنوان عمود → نظام bilingual export يأخذ `lang` من الـ request |
| `server/storage.ts` | 118 | معظمها رسائل validation/constraint (مخزون، أرصدة) | ~80-90 رسالة → error codes |
| `server/validation.ts` | 78 | كل رسائل Zod schemas باللغة العربية | ~70 رسالة → error codes (مع params مثل field name) |
| `server/backup.ts` | 56 | رسائل نسخ احتياطي/استعادة (بعضها user-facing عبر admin UI) | ~40 رسالة → codes + بعضها logs يبقى |
| `server/seed.ts` | 38 | **بيانات بذرية** — أسماء فروع/مستخدمين تجريبية | **لا حاجة للترجمة** (mock data) |
| `server/services/openingStockService.ts` | 31 | رسائل خطأ افتتاح المخزون | ~25 رسالة → codes |
| `server/ocr.ts` | 22 | رسائل OCR errors | ~15 رسالة → codes |
| `server/index.ts` | 17 | رسائل startup + بعض logs | ~5 user-facing → codes، الباقي logs |
| `server/middleware/auth.ts` | 16 | **كله user-facing:** "غير مصرح"، "المستخدم غير موجود" | 16 → `ERR_UNAUTHORIZED`، `ERR_USER_NOT_FOUND` |
| `server/autoJournal.ts` | 13 | رسائل auto-journal — معظمها logs | ~5 user-facing → codes |
| `server/mobile-routes.ts` | 8 | رسائل mobile API errors | 8 → codes |
| `server/middleware/rateLimiter.ts` | 4 | كله user-facing — "تم قفل الحساب..." | 4 → `ERR_RATE_LIMITED` |
| `server/middleware/errorHandler.ts` | 1 | generic error message | 1 → `ERR_INTERNAL` |

**إجمالي backend errors تحتاج تحويل لـ error codes:** ~600-750 رسالة (بعد استبعاد التعليقات و logs و seed data)

### عيّنات من الرسائل الفعلية:
```
server/middleware/auth.ts:15  res.status(401).json({ message: "غير مصرح" })
server/routes.ts:98           res.status(401).json({ message: "اسم المستخدم أو كلمة المرور غير صحيحة" })
server/routes.ts:106          message: `الحساب مقفل مؤقتاً. حاول مجدداً بعد ${remaining} دقيقة`
server/routes.ts:124          message: `تم قفل الحساب بعد ${MAX_ATTEMPTS} محاولات فاشلة...`
server/exports.ts:76          ["التقرير اليومي - لمسة أنوثة"]
server/exports.ts:81          ["مبيعات نقدي", report.salesCash.total, report.salesCash.count]
```

---

## 4) `shared/schema.ts`

| الملف | AR-occ | ملاحظات |
|---|---|---|
| `shared/schema.ts` | 14 | تعليقات JSDoc تشرح schema بالعربية. **لا حاجة للترجمة** (developer docs، ليست user-facing). |

---

## 5) ملاحظات خاصة

### A) الإيصالات المطبوعة (Print Templates)
- `client/src/components/Invoice58.tsx` و `Invoice80.tsx`: مكوّنات React تُستخدم لرسم الإيصال داخل المتصفح/الطابعة الحرارية. **داخل النطاق** — يجب ترجمتها لتطبيق المتطلبة #6 ("الإيصال يطبع بنفس لغة الواجهة").
- `client/src/lib/printer.ts`: قوالب نص ESC/POS عربية. **داخل النطاق**.
- ⚠️ **خارج النطاق:** المجلد `local-print-service/` و `local-print-service-package/` و `print-service-v2.3.0.zip` — هذه هي الـ "print-service v2.3.0" التي يجب عدم لمسها.

### B) العملة `ر.ع`
- مرمّزة بشكل ثابت في `lib/formatters.ts` و `lib/printer.ts` و عدة صفحات. يجب الانتقال لـ `t('common.currency_omr')` أو دالة `formatCurrency(value, lang)`.

### C) خريطة الفئات في POS.tsx (سطور 72-73)
- مفاتيح الكائن نفسها بالعربية (`خواتم`، `حلقان`، ...) وتُستخدم للبحث في `product.category`. هذا data، لا UI text. **يجب أن تبقى عربية** لكن توفّر `t()` للعرض.

### D) مفاتيح `localStorage`
- المواصفات تطلب `lamsa_lang`، الكود الحالي يستخدم `ui_language`. اقتراح: تغيير الكود + migration بسيط:
  ```js
  const cached = localStorage.getItem('lamsa_lang') ?? localStorage.getItem('ui_language');
  ```

### E) ملفات بيانات وهمية (لا تترجم)
- `client/src/lib/payroll-dummy-data.ts` (45 سلسلة) — بيانات اختبار
- `server/seed.ts` (38 سلسلة) — بيانات بذرية للقاعدة

---

## 6) ملخص شامل

### إحصاءات
| المقياس | القيمة |
|---|---|
| إجمالي ملفات frontend مع نص عربي | 53 |
| ملفات frontend مكتملة الترجمة (Tier 0) | ~30 |
| ملفات frontend تحتاج عمل كبير (Tier 1) | 12 |
| ملفات frontend تحتاج عمل متوسط (Tier 2) | 16 |
| ملفات frontend صغيرة | ~14 |
| إجمالي مفاتيح `t()` المستدعاة حالياً | ~2318 |
| إجمالي مفاتيح في `ar.json` | ~1500 |
| إجمالي مفاتيح في `en.json` | ~1500 (متطابقة) |
| ملفات لا تستورد `useI18n` ولديها نص عربي | **8 ملفات حرجة:** BranchPerformance, NotificationBell, DevicePrintSettingsDialog, payroll/employees, payroll/financial-movements, payroll/payroll-sheet, payroll/payroll-summary, payroll/salary-payments + Invoice58/80 |
| إجمالي السلاسل المتبقية للـ frontend | **~1100-1400 سلسلة** |
| إجمالي رسائل backend تحتاج error codes | **~600-750 رسالة** |

### نسبة الاكتمال الكلية المقدّرة
- **Frontend UI:** ~55-65% مكتمل (افتراضاً أن إجمالي السلاسل user-facing ≈ 3000)
- **Backend errors → codes:** ~5% فقط (لا يوجد نظام error codes حالياً)
- **القوالب المطبوعة:** 0% (Invoice58/80, printer.ts كلها عربية ثابتة)
- **بنية i18n التحتية:** 80% (يحتاج إضافة namespaces + تغيير localStorage key)

### الملفات الأولوية في المرحلة 3 (بترتيب الجهد المطلوب)
1. **POS.tsx** — أعلى أولوية (شاشة المبيعات اليومية) — ~80-100 سلسلة
2. **Purchases.tsx** — ~70-90 سلسلة
3. **Reports.tsx** — ~80-100 سلسلة
4. **OwnerFinancialSummary.tsx** + **Finance.tsx** — يجب التعامل مع `TYPE_LABELS_AR` map
5. **payroll/** components (5 ملفات بدون useI18n) — تحويل كامل
6. **Invoice58/80 + printer.ts** — منطق "اطبع بلغة الواجهة"
7. **server/exports.ts** — تصدير bilingual headers
8. **server/middleware/auth.ts + rateLimiter.ts + errorHandler.ts** — أبسط بداية لنظام error codes

### مخاطر مرحلة 3
- **خريطة `CATEGORY_ICONS` في POS.tsx:** المفاتيح عربية ومرتبطة ببيانات قاعدة البيانات (category names). تغيير المفاتيح قد يكسر منطق المطابقة. **الحل:** ترجمة value فقط، إبقاء key.
- **WhatsApp message template في POS.tsx (سطر 247-256):** نص يُرسل لزبائن — هل يجب أن يكون بنفس لغة الواجهة، أم بلغة الزبون المخزّنة؟ يحتاج قراراً من المستخدم.
- **PDF/Excel exports:** القرار: لغة export = لغة الواجهة، أم خيار منفصل؟ المواصفات تطلب الأول لكن يستحق التأكيد.
- **رسائل validation من Zod:** يحتاج إعادة كتابة كل schemas لاستخدام `.refine(v => ..., { message: 'ERR_CODE' })` مع enum للـ codes.

---

## 7) قبل الانتقال للمرحلة 2 — قرارات مطلوبة من المستخدم

1. **مفتاح localStorage:** هل نستبدل `ui_language` بـ `lamsa_lang` (مع migration)، أم نُبقي `ui_language`؟
2. **بنية namespaces:** المواصفات تطلب `t('namespace:key')`. هل نُعيد هيكلة `ar.json/en.json` لملفات منفصلة (`pos.json`, `inventory.json`, ...) أم نُبقي ملفاً واحداً مع namespaces ضمنية (`{ pos: {...}, inventory: {...} }`)؟
3. **WhatsApp/SMS templates:** تتبع لغة الواجهة الحالية، أم لغة الزبون (إن وُجدت)، أم تبقى عربية؟
4. **PDF/Excel exports من السيرفر:** تتبع لغة الواجهة (header `Accept-Language` أو query param)، أم خيار صريح في الـ UI؟
5. **رسائل console.log و logs:** تبقى بالعربية كما هي، أم نحوّلها للإنجليزية لتسهيل debugging؟ (التوصية: تحويلها للإنجليزية).
6. **سياسة العملة `ر.ع`:** تبقى دائماً (حتى في English UI)، أم تُترجم لـ `OMR`؟ (التوصية: استخدام رمز ISO `OMR` أو `ر.ع` حسب اللغة).

---

**🔚 نهاية تقرير المرحلة 1.**
**في انتظار موافقتك للانتقال إلى المرحلة 2 (البنية التحتية) — لن أكتب أي كود قبل ذلك.**
