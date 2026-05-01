# 🧠 CONTEXT — لمسة أنوثة POS/ERP
_آخر تحديث: 2026-05-01 (جلسة 54 — Phase 7: تسوية بيانات الإنتاج + v3.1.0-data-reconciled)_

---

## 🆕 Recent changes
- **2026-05-01** — جلسة 54: Phase 7 — تسوية بيانات الإنتاج على Railway PostgreSQL. 6 إصلاحات (stock_qty، customer metrics، dual inventory docs، avg_cost، supplier totals). 241/241 اختبار. tagged v3.1.0-data-reconciled.
- **2026-05-01** — جلسة 53: 403 fix على Invoices، إبقاء زر اللغة في Login فقط، tsc safe fixes
- **2026-05-01** — جلسة 52: حذف زر ⛶ (Maximize/Minimize) من POS toolbar
- **2026-04-28** — Updated barcode label size "كبير 2" to 58×39mm landscape (mm_w:58, mm_h:39) — single label per page, content area 50×33mm, no heart separators
- **2026-04-28** — Cashier can now access `/barcode-labels` (read-only access via existing `products.view` permission; settings remain owner-only)

---

## 🛠️ Recent Fixes

### fix(api): معالجة 403 على /api/users + global rejection handler — جلسة 53
- **التاريخ:** 2026-05-01
- **السبب الجذري:** `Invoices.tsx` استدعى `GET /api/users` (محمي بـ `requireOwnerOrAdmin`) للكاشير — يُرفض بـ 403
- **الحل (الحالة أ):**
  - `client/src/pages/Invoices.tsx`: أُضيف `enabled: isOwnerOrAdmin` على query `/api/users` + لُفّ employee filter بنفس الشرط
  - `client/src/main.tsx`: أُضيف `window.addEventListener("unhandledrejection", ...)` كـ safety net
- **ملاحظة:** الـ endpoint GET `/api/users/:id` (المنفرد) لا يوجد أصلاً — التشخيص الأصلي كان قريباً من الحقيقة لكن الـ URL الفعلي `/api/users` بدون id

### feat(transfers): التحقق من /api/cashier/incoming-transfers/:id/scan — جلسة 53
- **النتيجة:** **لا تتطلب تنفيذاً** — الـ endpoint موجود ومسجَّل بالفعل
- **الموقع:** `server/cashier-receive-routes.ts:200` (132 سطر، production-grade)
- **التسجيل:** `server/routes.ts:7191` → `registerCashierReceiveRoutes(app)`
- **الـ schema الفعلي:** `stock_transfers` / `stock_transfer_lines` / `received_qty` (وليس `incoming_transfers` / `scanned_qty`)
- **أسباب 404 المحتملة:** transfer ID غير موجود، أو barcode غير في التحويل، أو owner بدون `?branchId=X`

### refactor(i18n): إبقاء زر تبديل اللغة في صفحة Login فقط — جلسة 53
- **التاريخ:** 2026-05-01
- **الدافع:** تبسيط فترة التدريب — الكاشير لا يحتاج تبديل لغة بعد تسجيل الدخول
- **الملفات:**
  - `client/src/components/layout/AppLayout.tsx`: حذف زر التبديل من header + import `Languages` و`Button` و`setLang` (unused)
  - `client/src/pages/Settings.tsx`: حذف Card "Preferences (Language)" + import `Globe` (unused)
  - `client/src/pages/Login.tsx`: إضافة زر toggle (top-end، Languages icon)
- **localStorage:** `lamsa_lang` (موجود في `i18n.tsx`) يحفظ الاختيار تلقائياً

### chore(types): إصلاحات tsc الآمنة — جلسة 53
- **النتيجة:** 237 → 233 (4 إصلاحات، 1.7%)
- **المعالَج:**
  - `Orders.tsx`: `[...new Set(...)]` → `Array.from(new Set(...))` (×2 — TS2802)
  - `Purchases.tsx`: `title` prop على `<FileText>` → wrap في `<span>` (TS2322)
  - `storage.ts`: إضافة `type SQL` لـ drizzle-orm imports (TS2304)
- **المتروك (يحتاج مهمة منفصلة):**
  - 56 خطأ في `shared/schema.ts` (drizzle-zod `.omit()` type inference)
  - 173 خطأ cascade في `server/storage.ts` (الجداول تُستنتج كـ `never`)
  - يتطلّب upgrade drizzle-orm/drizzle-zod أو refactor schema

### إصلاح: حذف زر ⛶ المعطّل من POS toolbar
- **التاريخ:** 2026-05-01
- **الملف الرئيسي:** `client/src/pages/POS.tsx`
- **المحذوف:**
  - استيراد `Maximize2, Minimize2` من `lucide-react`
  - state: `isFullscreen`
  - computed: `fullscreenSupported`
  - `useEffect` لـ `fullscreenchange` listener
  - `useCallback`: `toggleFullscreen` (`requestFullscreen` / `exitFullscreen`)
  - زر `<Button>` في الـ toolbar
- **مفاتيح الترجمة المحذوفة:** `pos:header.fullscreen`, `exitFullscreen`, `maximize`, `minimize` (ar + en)
- **الـ toolbar النهائي:** إرجاع → معلّق → الطباعة → إغلاق
- **ملاحظة:** زر ملء الشاشة الفعلي (الذي يعمل) منفصل ولم يُمَس

---

## 🖨️ مسار طباعة الإيصال (الحالي بعد جلسة 50)

```
Cashier clicks طباعة (ReceiptModal)  أو  Sale completes (auto-print)
            │
            ▼
   printInvoiceLocal(saleData)
   client/src/lib/localPrintClient.ts
            │
            ▼ POST http://127.0.0.1:3030/print/invoice
            │
   local-print-service (node, hidden — لا CMD window)
   local-print-service/dist/index.js
            │
            ▼
   buildInvoiceBytes()  →  ESC/POS bytes (تصميم جلسة 47)
   local-print-service/src/printInvoice.ts
            │
            ▼ winspool RAW write (P/Invoke)
            │
   EPSON TM-T100 — طباعة فورية بنقرة واحدة، بدون حوار
```

**صامت تماماً:**
- لا نافذة CMD (الخدمة تشتغل عبر `start-print-service-hidden.vbs`)
- لا حوار طباعة في المتصفح (الـ POS يكلّم 127.0.0.1:3030 مباشرة، بدون `window.print()`)
- لا preview ولا popups

**أين Invoice.tsx الآن؟** → يبقى مرجع التصميم البصري على الشاشة (في `ReceiptModal` preview)، لكن الطباعة الفعلية الآن من `printInvoice.ts` (ESC/POS).

---

## ✅ مكتمل

### جلسة 50 — طباعة صامتة كاملة (لا CMD، لا حوار طباعة)

**العَرَض:**
1. عند تشغيل الجهاز، تظهر نافذة CMD سوداء `[Lamsa Local Print] listening on http://127.0.0.1:3030` — غير مقبول في بيئة كاشير إنتاج.
2. عند الطباعة، يفتح Chrome حوار الطباعة (preview + زر اطبع) — غير مقبول، الكاشير يحتاج طباعة فورية بنقرة واحدة.

#### الإصلاح A — إخفاء نافذة CMD

**ملف جديد — `local-print-service/start-print-service-hidden.vbs`:**
- يستخدم `WScript.Shell.Run` بـ `intWindowStyle=0` (مخفي تماماً، لا taskbar entry)
- يفحص قبل التشغيل: لو في `node.exe` يشغّل نفس `dist/index.js` مسبقاً → خروج صامت (singleton guard)
- يكتب stdout/stderr إلى `logs/print-service.log` بدلاً من نافذة CMD

**ملف جديد — `local-print-service/install-startup-shortcut.bat`:**
- ينشئ shortcut في `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Lamsa Local Print.lnk`
- الـ shortcut يستهدف `wscript.exe "...start-print-service-hidden.vbs"` مع `WindowStyle=7` (Minimized)
- بعد تشغيله مرة واحدة، الخدمة تشتغل صامتة في كل تسجيل دخول

**تعديل — `local-print-service/update-print.bat`:**
- استبدال `start "Lamsa Local Print" /MIN cmd /c "node ...index.js"` بـ
- `wscript.exe "C:\Users\HP\lamsat-anoutha\local-print-service\start-print-service-hidden.vbs"`
- النتيجة: حتى التحديث اليدوي ما يفتح نافذة CMD للخدمة

#### الإصلاح B — إلغاء حوار طباعة المتصفح

**تعديل — `client/src/pages/POS.tsx`:**
- استبدال `import { printInvoiceInBrowser } from "@/lib/browserPrintInvoice"` بـ `import { printInvoiceLocal } from "@/lib/localPrintClient"`
- `ReceiptModal.handlePrint`: يستدعي `printInvoiceLocal(...)` بدل `printInvoiceInBrowser(...)`
- Auto-print بعد البيع: نفس الاستبدال
- نفس contract: `{ ok, error?, ignoredDuplicate? }`

**ما تم الحفاظ عليه:**
- نفس `printingRef` re-entrancy guard
- نفس `disabled={printing}` على زر "طباعة"
- نفس toast `"تمت الطباعة بنجاح"` عند النجاح
- نفس صمت `ignoredDuplicate` (لا toast)
- نفس رسائل الخطأ بالعربي (موجودة أصلاً في `localPrintClient.ts:170-183` — `arabicError()`)
- زر واتساب لم يتأثر إطلاقاً
- تصميم ESC/POS (جلسة 47) محفوظ في `dist/printInvoice.js`

**ما لم يُلمس (مقصود):**
- `client/src/lib/browserPrintInvoice.ts`: يبقى الملف بدون consumers — تنظيفه بجلسة لاحقة
- باقي مسارات `window.print()` (HR payroll، Inventory reports، Invoices A4 reprint، Purchases، BarcodeLabels): admin-only، تتطلّب تحويلاً منفصلاً (التقارير A4 لا يمكن نقلها لـ ESC/POS بشكل مباشر). تبقى على المسار الحالي في هذه الجلسة.

#### كيف يختبر الكاشير

**مرة واحدة فقط للإعداد:**
1. اقفل أي عملية node.exe قديمة (`taskkill /F /IM node.exe`)
2. شغّل `local-print-service/install-startup-shortcut.bat` (double-click)
3. شغّل `local-print-service/start-print-service-hidden.vbs` يدوياً مرة واحدة لبدء الخدمة بدون reboot
4. تحقّق: `curl http://127.0.0.1:3030/health` → يرجع `{ ok: true, ... }` ولا في نافذة CMD مفتوحة

**اختبار يومي:**
1. أعد تشغيل الجهاز → لا تظهر أي نافذة CMD
2. افتح POS من Chrome → سجّل بيع تجريبي
3. اضغط "طباعة" أو انتظر الـ auto-print → الإيصال يطلع فوراً، لا حوار، لا preview
4. لو الخدمة المحلية موقفة → toast بالعربي: `"خدمة الطباعة المحلية غير مفعّلة على جهاز الكاشير. شغّل الخدمة ثم أعد المحاولة."`

#### التحقق

- `grep printInvoiceInBrowser client/src/pages/POS.tsx` → **0 نتائج**
- `grep printInvoiceLocal client/src/pages/POS.tsx` → 3 نتائج (import + handlePrint + auto-print)
- `npx tsc --noEmit` على `POS.tsx` و `localPrintClient.ts` → **0 أخطاء** (الأخطاء الموجودة في `server/storage.ts` و `Orders.tsx` …إلخ pre-existing)
- VBS launcher اختُبر منطقياً: WMI singleton guard + `shell.Run cmd, 0, False` (مخفي + non-blocking)

---

## ✅ مكتمل

### جلسة 49 — ربط زر طباعة الكاشير مباشرة بـ `Invoice.tsx`

**الإشكال:** بعد الجلسات 46–48 الكاشير لا يزال يرى التصميم القديم على الورق رغم أن `Invoice.tsx` و `printInvoice.ts` (ESC/POS) كلاهما يحتوي التصميم الجديد على GitHub. السبب الحقيقي محتمل أن dist محلية على PC الكاشير stale — لكن الحل الأكثر ضماناً: **نلغي الاعتماد على local-print-service لمسار الإيصال كلياً ونستخدم Invoice.tsx مباشرة**.

#### الحل — مسار جديد: Browser Print لـ `<Invoice />`

**ملف جديد — `client/src/lib/browserPrintInvoice.ts`:**
- يستورد `Invoice` و `InvoiceItem` من `@/components/Invoice`
- `printInvoiceInBrowser(data)` يعمل:
  1. يبني `InvoiceProps` من بيانات البيع (mapping للحقول، حساب `vatRate = vat / subtotal`)
  2. `renderToStaticMarkup(<Invoice .../>)` ← يحوّل React component لـ HTML ثابت
  3. `window.open("", "_blank", "width=420,height=800")` — popup صغير
  4. يكتب الـ HTML مع:
     - Tailwind CSS عبر CDN (`https://cdn.tailwindcss.com`)
     - خطوط Google: Tajawal / Aref Ruqaa / Cairo / Playfair Display
     - `@page { size: 80mm auto; margin: 0; }` — حجم الورق الحراري
  5. JavaScript داخل النافذة ينتظر `document.fonts.ready` ثم `window.print()` ثم `window.close()` بعد 800ms
- يحتفظ بنفس **حارس التكرار** (in-flight Set + 3s recent Map) كما في `localPrintClient.ts` السابق
- يعطي `{ ok, error?, ignoredDuplicate? }` متوافق مع نفس contract الأقدم

**تعديل `client/src/pages/POS.tsx`:**
- استبدال `import { printInvoiceLocal } from "@/lib/localPrintClient"` بـ `import { printInvoiceInBrowser } from "@/lib/browserPrintInvoice"`
- `ReceiptModal.handlePrint` (السطر ~175): يستدعي `printInvoiceInBrowser(...)` بدل `printInvoiceLocal(...)`
- Auto-print بعد البيع (السطر ~1049): نفس الاستبدال
- لم يتبقَّ أي استدعاء لـ `printInvoiceLocal` في POS.tsx (تم التحقق بـ grep → 0 نتائج)
- نفس `printingRef` re-entrancy guard، نفس `disabled={printing}`، نفس toast `"تمت الطباعة بنجاح"`، نفس صمت `ignoredDuplicate`

#### كيف يصل التصميم للورق الآن؟

1. Chrome (سحابي على Railway HTTPS) يفتح popup → يكتب HTML الذي يحتوي JSX من `Invoice.tsx` بعد renderToStaticMarkup
2. CSS من Tailwind CDN يُنزَّل، خطوط Google تُحمَّل
3. JavaScript داخل النافذة يستدعي `window.print()` → Chrome يفتح طباعة بحجم 80mm
4. Driver Windows لـ EPSON TM-T100 يرسم الـ HTML rasterized → الورق

**الميزة:** `Invoice.tsx` = source of truth واحد. أي تعديل على التصميم في `Invoice.tsx` يصل تلقائياً لـ:
- العرض على الشاشة في POS (لو احتجنا preview)
- الطباعة الفعلية (نفس الـ component يُرندَر للطباعة)

#### ما لم يُلمس (مقصود)

- **`local-print-service/`**: الخدمة المحلية تبقى شغالة كما هي. Task Scheduler لم يُمَس. لم تُحذف `printInvoice.ts` ولا `dist/` — تبقى للاستخدامات الأخرى (testing، label printing مستقبلاً، أو عودة لـ ESC/POS path إذا قرّرنا)
- **`Invoice.tsx`**: لم يتغيّر — يبقى كما هو في commit 7109cd3
- **حارس التكرار في الخدمة المحلية**: يبقى نشطاً للمسارات الأخرى التي قد تستدعي `/print/invoice`
- **`localPrintClient.ts`**: يبقى الملف لكن لا مستهلك له الآن من POS

#### التحقق

- `grep printInvoiceLocal client/src/pages/POS.tsx` → **0 نتائج**
- `grep printInvoiceInBrowser client/src/pages/POS.tsx` → سطرين (handlePrint + auto-print)
- `grep "renderToStaticMarkup\|<Invoice\|from \"@/components/Invoice\"" client/src/lib/browserPrintInvoice.ts` → ✓
- `npx tsc --noEmit` على ملفات الجلسة (browserPrintInvoice.ts و POS.tsx و localPrintClient.ts) → 0 أخطاء (الأخطاء القديمة في ملفات أخرى pre-existing وغير مرتبطة)

#### كيف تختبر من الكاشير

1. على PC الكاشير: `git pull` (يصلك التغيير من Railway تلقائياً بعد deploy، أو من git مباشرة)
2. **لا حاجة لإعادة بناء أي شيء على PC الكاشير** — التصميم الآن في frontend، Railway يخدم بناء جديد بعد كل push
3. أكمل بيع تجريبي → popup صغير يفتح، ينتظر ثانية للخطوط، ثم Chrome يفتح حوار الطباعة → اطبع → الإيصال الجديد على الورق

#### ملاحظات تشغيلية مهمة

- **Pop-ups:** لازم Chrome يسمح بالـ popups على نطاق `lamsa-pos-production.up.railway.app`. إذا حُجبت، الكاشير يرى toast "متصفّحك يحجب النوافذ المنبثقة"
- **طباعة صامتة:** افتراضياً Chrome يعرض حوار الطباعة. لطباعة بدون حوار: شغّل Chrome بـ `--kiosk-printing` flag مع EPSON TM-T100 = Default Printer
- **الإنترنت:** Tailwind CDN + Google Fonts تتطلّب اتصال (الكاشير أصلاً يحتاج اتصال للـ POS السحابي)

#### ما هو الملف الذي كان "يطبع القديم"؟

→ **لا شيء على GitHub كان يطبع القديم.** التصميم الجديد كان موجوداً في:
- `client/src/components/Invoice.tsx` (jsx) ✓
- `local-print-service/src/printInvoice.ts` (ESC/POS) ✓ (جلسة 47)
- `local-print-service/dist/printInvoice.js` (مُجمَّع) ✓ (جلسة 48)

السبب الفعلي للإشكال على PC الكاشير محتملاً: **dist محلية stale**، أو node process قديم في الذاكرة، أو git pull ما تم.

→ **الملف الذي تم ربطه الآن:** `client/src/pages/POS.tsx` صار يستدعي `printInvoiceInBrowser` من `client/src/lib/browserPrintInvoice.ts`، الذي يستخدم `client/src/components/Invoice.tsx` مباشرة عبر `renderToStaticMarkup`. هذا المسار الجديد **لا يعتمد على PC الكاشير المحلي إطلاقاً** — يكفي Railway deploy.

---

### جلسة 48 — تبسيط تحديث الخدمة المحلية: dist في git + سكربت نقرة واحدة

---

## ⚡ تحديث الخدمة المحلية على PC الكاشير (الطريقة الجديدة — جلسة 48)

**نقرة واحدة فقط — بدون terminal، بدون npm:**

1. افتح المجلد `C:\Users\HP\lamsat-anoutha\local-print-service`
2. **double-click** على `update-print.bat`
3. السكربت يعمل تلقائياً: `git pull` → kill node → restart node بالكود الجديد

السكربت لا يلمس Task Scheduler. عند reboot الجهاز، Task Scheduler يبدأ الخدمة طبيعياً بآخر كود مرفوع.

**لماذا تغيّر؟** سابقاً `dist/` كان في `.gitignore` وأي تحديث على تصميم الإيصال يتطلّب `npm run build` يدوياً على كل PC. الآن `local-print-service/dist/` مرفوع داخل git → التحديث يصير `git pull` فقط.

---

## ✅ مكتمل

### جلسة 48 — تبسيط تحديث الخدمة المحلية

**العَرَض:** بعد جلسة 47 طلب الكاشير "هل في طريقة أسهل من npm install + npm run build على كل تحديث؟"

**الحل — طبقتان:**

1. **`local-print-service/dist/` صار مرفوعاً في git:** عُدّل `.gitignore` لإلغاء استثناء هذا المجلد فقط (مع إبقاء استثناء `dist/` العام للـ root build):
   ```
   node_modules
   dist
   !/local-print-service/dist
   !/local-print-service/dist/**
   ```
   — التحديث على PC الكاشير يصير `git pull` فقط، بدون `npm install` ولا `npm run build`.

2. **`local-print-service/update-print.bat` (جديد):** سكربت Windows واحد ينفّذ:
   - `cd` لمجلد المشروع
   - `git pull --ff-only` (يفشل بوضوح لو فيه local divergence)
   - `taskkill /F /IM node.exe` لإيقاف الخدمة الحالية
   - `start /MIN node dist\index.js` لتشغيلها فوراً بالكود الجديد
   
   الكاشير double-click عليه → انتهى. لا terminal. لا أوامر.

**ما لم يُلمس (مقصود):**
- Task Scheduler — السكربت لا يعدّله. عند reboot، Task Scheduler يبدأ الخدمة كالمعتاد بأحدث كود (لأن git pull وضع الكود الجديد على القرص).
- مسار التطوير (`npm run dev`/`npm run build`) — يبقى متوفّراً للمطوّر، لكن غير ضروري للكاشير.
- صفحة Railway / frontend — لا تأثير.

#### كيف تختبر بعد هذه الجلسة

على PC الكاشير، مرة واحدة فقط:
1. double-click على `C:\Users\HP\lamsat-anoutha\local-print-service\update-print.bat`
2. انتظر السطر `Done. The new receipt design is active.`
3. أكمل بيع تجريبي → الإيصال يطلع بالتصميم الجديد (LAMST ANOTHA + tagline + جدول العناصر مع `=` bars + شريط TOTAL)

#### التحديثات المستقبلية

أي تعديل من Claude على ESC/POS أو على frontend → بعد `git push` على main:
- Frontend ينزل تلقائياً من Railway
- خدمة الطباعة المحلية: الكاشير double-click على `update-print.bat` → انتهى

---

### جلسة 47 — إخفاء toast التكرار + تحديث تصميم الإيصال الحراري (ESC/POS)

---

## 🔗 روابط المشروع
- **Production:** https://lamsa-pos-production.up.railway.app
- **GitHub:** https://github.com/fxuae277-cloud/lamsat-anoutha
- **Stack:** React + Express + Drizzle ORM + PostgreSQL
- **Deployment cycle:** Claude Code → GitHub → Railway

---

## ✅ مكتمل

### جلسة 47 — إخفاء toast التكرار + تحديث تصميم الإيصال الحراري (ESC/POS)

**العَرَض بعد جلسة 46:**
1. عند تكرار الطلب يظهر toast `"تم تجاهل طباعة مكررة"` للكاشير — غير مرغوب
2. إيصال EPSON TM-T100 لا يزال بالتصميم القديم البسيط، الكاشير يريد التصميم الجديد المطابق لـ `Invoice.tsx` (commit 7109cd3)

#### الإصلاح A — إخفاء toast التكرار (`client/src/pages/POS.tsx`)

في `ReceiptModal.handlePrint`:
- نجاح + `ignoredDuplicate=true` → **لا toast** (ضوضاء UI صامت). الديباج عبر console (`[Print] duplicate ignored …`) واللوج على الخدمة المحلية كافيان
- نجاح عادي → toast `"تمت الطباعة بنجاح"`
- خطأ حقيقي → toast destructive

#### الإصلاح B — رسم الإيصال يطابق `Invoice.tsx` (`local-print-service/src/printInvoice.ts`)

**القرار المعماري:** الإيصال يبقى ESC/POS عبر الخدمة المحلية ("local printing works 100%"، لا تكسره). أعدت كتابة `buildInvoiceBytes()` لتعكس هيكل التصميم الجديد ضمن قيود ESC/POS النصّي 48 عمود.

**أقسام الإيصال الجديد (مطابقة لـ Invoice.tsx بقدر ما يسمح text-mode):**

1. **Header** — `LAMST ANOTHA` بحجم 2× وbold في المنتصف
2. **Tagline** — `TOUCH OF FEMININITY` بين شَرطَتين على الجانبين
3. **شريط 3 معلومات** — `CR: 1260008` يساراً + `IG: lamst_anotha` وسطاً + `TEL: 94891122` يميناً
4. **Dashed divider** (`-` × 48)
5. **Date+Time + Invoice No.** — bold، كل واحد على سطر بـ `pad()`
6. **Branch + Cashier** — صف واحد إن سعَ، وإلا سطرين منفصلين، يليهم Customer لو موجود
7. **جدول العناصر** بأعمدة 2/26/4/7/9 = 48 عمود:
   - حدود `=` × 48 فوق وتحت الترويسة (محاكاة الـ black-bg row)
   - رأس bold: `# Item ... Qty Unit Total`
   - بين كل عنصر `- - - - …` (dashed) كما في React
8. **Summary** — `Subtotal / Discount / VAT (5%)` بـ `pad()`
9. **TOTAL bar** — حدود `=` × 48 + سطر bold بـ 2× `TOTAL ……… X.XXX OMR`
10. **Payment**
11. **Thank-you box** — إطار `+----+` مع `<3 THANK YOU FOR YOUR TRUST <3` و `We are happy to serve you`
12. **Footer سطر واحد:** `QUALITY & ELEGANCE | SHOP NOW WITH US`
13. **Partial cut** (3 dots feed)

**Helpers جديدة في الملف:** `repeat`, `clip`, `leftAlign`, `rightAlign`, `center`, `pad`, ثوابت `SOLID`/`DASH`، ثابتات `BRAND.cr/ig/tel`. كلها بدون أي primitive ESC/POS جديد — استخدمت فقط ما هو موجود في `escpos.ts` (init/codepage/align/bold/size/cutPartial). صفر تغيير على `escpos.ts` أو `rawPrint.ts` أو نقطة `/print/invoice`.

#### Encoding — لم يُلمس (مقصود)

- لا يزال CP1252 (Latin-1) عبر `ESC t 16` كما كان
- النصوص العربية (اسم الفرع/الكاشير/المنتج) تبقى تطبع كـ `?` كما في README — هذا سلوك Phase 2 الحالي
- Labels على الإيصال **بالإنجليزية** (Invoice/Date/Branch/Cashier/Subtotal/VAT/TOTAL/Payment/Thank You) لأن CP1252 لا يدعم العربي. تحويل CP864/CP1256 + bidi shaping = شغل Phase 3 منفصل ومخاطرة كسر الطباعة الحالية
- Brand text (`LAMST ANOTHA` / `TOUCH OF FEMININITY`) تطابق التصميم 1:1 لأنه أصلاً English في Invoice.tsx

#### ما لم يُلمس (مقصود)

- إعداد Task Scheduler — لم يُمس
- بدء تشغيل الخدمة المحلية — لم يُمس
- `escpos.ts`/`rawPrint.ts`/`printers.ts`/`index.ts` — صفر تغيير
- `client/src/components/Invoice.tsx` (الذي أُضيف في commit 7109cd3) يبقى كما هو، مرشَّح لـ "browser print path" مستقبلي بدون استبدال ESC/POS الذي يعمل الآن
- `/print/test` و label printing — لا تأثير

#### التحقق

- TypeScript: `npm run build` على الخدمة المحلية بدون أخطاء
- `dist/printInvoice.js` يحتوي `LAMST ANOTHA`, `TOUCH OF FEMININITY`, `THANK YOU FOR YOUR TRUST`, `TOTAL` ✓
- لوجات الحارس من جلسة 46 لا تزال شغالة كما هي

#### كيف تختبر من الكاشير

1. سحب الكود الجديد على PC الكاشير: `git pull`
2. إعادة بناء الخدمة المحلية: `cd local-print-service && npm run build`
3. إعادة تشغيل الخدمة (إنهاء العملية الحالية، Task Scheduler يلتقطها بعد reboot — أو شغّلها يدوياً `node dist/index.js` للاختبار)
4. أكمل بيع تجريبي على POS → الإيصال الجديد يطلع
5. اضغط "طباعة" مرتين سريعاً → طبعة واحدة فقط، **بدون toast** للتكرار (صامت)

#### هل يحتاج Railway deploy؟

- **نعم Frontend (Railway)** — لتعديل الـ toast في `POS.tsx`. يصل تلقائياً بعد push
- **نعم Local print service** — لتصميم الإيصال الجديد في `printInvoice.ts`. لكن `dist/` خارج git → يُعاد بناؤه يدوياً على كل PC كاشير: `npm run build` ثم إعادة تشغيل الخدمة

---

### جلسة 46 — إصلاح ازدواج الطباعة (طبعتان لكل فاتورة)

**العَرَض:** بعد تشغيل الخدمة المحلية بنجاح من Task Scheduler، كل بيع يُخرج **طبعتين متطابقتين** على EPSON TM-T100. لا تغيير في إعداد Task Scheduler ولا startup الخدمة — فقط ازدواج في الطباعة.

**السبب الجذري:** في `client/src/pages/POS.tsx`، `onSuccess` للبيع يُنفّذ شيئين معاً:
1. `printInvoiceLocal(...)` تلقائياً (auto-print بعد البيع) — السطر ~1038
2. `setCompletedSale(sale)` يفتح `ReceiptModal` التي يحتوي زر "طباعة" — يستدعي `printInvoiceLocal` لنفس الفاتورة — السطر ~175

نقرة ثانية على المودال (أو re-trigger من effect/double-click) ترسل نفس الفاتورة مرة ثانية. لا توجد استدعاءات QZ Tray ولا `window.print()` في runtime path الجديد — فقط ازدواج auto-print + manual-print على API المحلي.

#### الإصلاح — ثلاث طبقات حماية

**1. قفل واجهة في `client/src/lib/localPrintClient.ts`:**
- `inFlightPrints: Set<invoiceNo>` يُسقط أي طلب ثانٍ لنفس الفاتورة أثناء طلب جارٍ
- `recentPrints: Map<invoiceNo, ts>` بنافذة 3000ms — يُسقط أي طلب ثانٍ بعد طباعة ناجحة
- إضافة `ignoredDuplicate?: boolean` على `PrintResult`
- لوجات console: `[Print] invoice request sending`، `[Print] duplicate ignored (in-flight|recent|by service)`، `[Print] invoice sent to printer`

**2. حارس re-entrancy في `ReceiptModal.handlePrint` (POS.tsx):**
- `printingRef` ref synchronous — يحمي من double-click قبل ما `setPrinting` يتفلش
- toast عربي `"تم تجاهل طباعة مكررة"` عند `result.ignoredDuplicate`
- الزر يبقى `disabled={printing}` كما كان

**3. حارس مزدوج على الخدمة المحلية في `local-print-service/src/index.ts`:**
- مفتاح `${invoiceNo}__${printerName}`، نافذة 3000ms
- لو وصل نفس المفتاح → `{ ok: true, ignoredDuplicate: true }` بدون استدعاء `printRawBytes`
- يحجز slot **قبل** الطباعة async (ليصطاد المكرّر أثناء الطباعة)، ويمسحه عند الفشل ليسمح بإعادة المحاولة فوراً
- sweep دوري كل 10s مع `.unref()` لمنع تضخّم Map
- لوجات: `[Print] invoice request received`، `[Print] duplicate ignored`، `[Print] invoice sent to printer`

#### ما لم يُلمس (مقصود)

- إعداد Task Scheduler — لم يُمَس
- `local-print-service/dist/` — موجود في `.gitignore` (لا يُرفع لـ git)، لكن أُعيد بناؤه محلياً بـ `npm run build` على PC الكاشير قبل إعادة تشغيل الخدمة
- طباعة الـ labels و `/print/test` — لم يُمَس، الحارس فقط على `/print/invoice`
- ملفات QZ القديمة (`qzPrinter.ts`, `qz-print-service.ts`, `qz-certificate.ts`, `printer.ts`) — orphan dead code، تبقى محفوظة

#### التحقق

- TypeScript: `tsc` على الخدمة المحلية بدون أخطاء، `dist/index.js` يحتوي `recentPrintsByKey` و `[Print] duplicate ignored`
- لوجات متوقعة عند بيع واحد:
  - متصفح: `[Print] invoice request sending` ثم `[Print] invoice sent to printer` (مرة واحدة فقط)
  - خدمة محلية: `[Print] invoice request received` ثم `[Print] invoice sent to printer` (مرة واحدة فقط)
  - الضغط الثاني خلال 3s: toast `"تم تجاهل طباعة مكررة"` + لوج `[Print] duplicate ignored`، **لا طبعة ثانية**
  - بعد 3s: الضغط مرة ثانية يطبع طبيعياً (إعادة الطباعة المتعمّدة تبقى ممكنة)

#### خطوات بعد النشر على PC الكاشير

1. سحب آخر كود من Railway (Frontend) — يصل تلقائياً بعد push
2. على PC الكاشير: `cd local-print-service && npm run build` ثم إعادة تشغيل الخدمة (Task Scheduler يلتقطها بعد reboot، أو `node dist/index.js` يدوياً للاختبار الفوري)
3. اختبار: بيع واحد → طبعة واحدة. الضغط على "طباعة" مرتين سريعاً → طبعة واحدة + toast تجاهل

---

### جلسة 45 — مكوّن `Invoice.tsx` بتصميم مطابق للموكاب (طباعة من المتصفّح)

**الهدف:** بناء مكوّن React يطابق صورة فاتورة مرجعية بدقّة pixel-perfect، يصلح للعرض على الشاشة وللطباعة المباشرة من المتصفّح على ورق حراري 80mm — كبديل أو موازي لمسار ESC/POS الخام عبر `local-print-service`.

**الملف الجديد — `client/src/components/Invoice.tsx`** (~270 سطر، standalone):
- RTL كامل + Tailwind فقط (صفر CSS خارجي)
- عرض ثابت `max-w-[420px]` على الشاشة و `print:w-[80mm]` + `print:p-2` للطباعة
- بيانات افتراضية مطابقة للصورة (INV-00017، 25/04/2026 - 09:12 AM، 3 منتجات، subtotal 8.000، VAT 5% = 0.400، إجمالي 8.400 ر.ع)
- Props اختيارية لكل الحقول: `invoiceNumber/date/time/cashier/branch/commercialRegister/instagram/phone/items/subtotal/discount/vatRate/qrValue/logoSrc`
- أيقونات `lucide-react` (Clipboard/Instagram/Phone/Heart) — صفر deps إضافية
- QR بـ SVG داخلي pseudo-random pattern (placeholder بصري — للحصول على QR حقيقي يمسح: تثبيت `qrcode.react` واستبدال `<QRPattern>`)
- شعار الكاليجرافي placeholder بخط `Aref Ruqaa`؛ يُستبدل بصورة حقيقية بتمرير `logoSrc="/lamsat-logo.png"`

**الأقسام (مطابقة حرفياً للصورة):**
1. Header — شعار + `LAMST ANOTHA` + `TOUCH OF FEMININITY` بين خطّين + قلب filled
2. شبكة 3 أعمدة معلومات (السجل التجاري 1260008 / `lamst_anotha` / 94891122) بفواصل رأسية رفيعة
3. Dashed divider
4. شريط الفاتورة: التاريخ يميناً + tag أسود "رقم الفاتورة" يساراً يجاوره INV-00017
5. صف الكاشير/الفرع (الفرع الرئيسي / ahmed)
6. جدول رأس أسود بـ 5 أعمدة (م/الصنف/الكمية/سعر الوحدة/الإجمالي) + dashed بين الصفوف
7. ملخص (المجموع الفرعي/الخصم/VAT 5%) + شريط `الإجمالي` أسود full-width
8. Box dashed لـ "شكرا لثقتكم بنا / نسعد بخدمتكم دائما" مع قلوب على الجانبين
9. Footer: 3 أعمدة (جودة وأناقة / QR وسط / تسوقي الآن)

**حدود مقصودة:**
- المكوّن standalone — لم يُستدعَ بعد من أي صفحة. التكامل (مودال طباعة في POS، أو `/print/invoice/:id` route، أو زر طباعة في `Invoices.tsx`) **مهمة لاحقة**
- لا تأثير على `local-print-service/` ولا مسار ESC/POS الخام — هذا مسار طباعة بديل عبر المتصفّح (window.print)
- النصوص بدون تنوين كما في الصورة (`شكرا`، `دائما` بدل `شكراً`، `دائماً`)

#### الخطوات القادمة

- ربط المكوّن بزر طباعة في POS أو route مخصّص (`/invoice/:id/print`) يعرض المكوّن ويستدعي `window.print()` تلقائياً
- تثبيت `qrcode.react` واستبدال `QRPattern` بـ QR حقيقي يحمل رابط الفاتورة أو ZATCA-style payload
- توفير الشعار الفعلي وتمريره عبر `logoSrc`
- مقارنة جودة المخرج الحراري بين هذا المسار (browser → 80mm) وبين ESC/POS raw عبر الخدمة المحلية

---

### جلسة 44 — Phase 4: تكامل POS مع الخدمة المحلية + إزالة استدعاءات QZ من runtime path

**الهدف:** بعد إنجاز Phase 1+2 من الخدمة المحلية في الجلسة السابقة، الـ POS كان لا يزال يستدعي QZ Tray (وكان يُظهر "Connection blocked by client"). هذه الجلسة توصِل القنوات: زر الطباعة + auto-print + Settings test print كلها الآن تذهب لـ `http://127.0.0.1:3030/print/invoice` بدلاً من QZ.

#### Helper جديد — `client/src/lib/localPrintClient.ts`

~200 سطر، يغلِّف كل التواصل مع الخدمة المحلية:
- `printInvoiceLocal(receipt, printerName?)` — `POST /print/invoice` مع `x-lamsa-print-key: 123456`
- `printTestInvoiceLocal(printerName?)` — sample invoice ثابتة لاختبار Settings
- `checkLocalPrintHealth()` — pre-flight اختياري على `/health`
- `toLocalInvoice()` — يحوّل شكل POS الغني (`color/size/vat/amountPaid/changeAmount`) إلى schema الخدمة المسطّح (`name/qty/price/total + subtotal/discount/tax/grandTotal`)
- `fetchWithTimeout` (15s + AbortController) — لا hang إن الخدمة لم ترد
- رسائل عربية مخصّصة لكل حالة:
  - 401 → "مفتاح x-lamsa-print-key خاطئ"
  - 400 → "بيانات الفاتورة ناقصة"
  - 403 → "خدمة الطباعة رفضت الطلب (CORS)"
  - 5xx → "فشل الطباعة في الطابعة. تحقق من حالتها"
  - network/abort → "خدمة الطباعة المحلية غير مفعّلة على جهاز الكاشير"
- ثوابت hardcoded في هذه المرحلة (Phase 4 الكامل سيُخرجها لـ Settings UI):
  - `LOCAL_PRINT_URL = "http://127.0.0.1:3030"`
  - `LOCAL_PRINT_API_KEY = "123456"`
  - `DEFAULT_PRINTER = "EPSON TM-T100 Receipt"`

**ملاحظة المتصفّح/HTTPS:** Chrome/Firefox يعفيان `127.0.0.1` و `localhost` من mixed-content blocking حتى لو الصفحة الأم HTTPS من Railway — لذا الـ fetch من Railway → localhost يعمل.

#### تعديلات POS.tsx

- السطر 19: `import { printInvoiceLocal } from "@/lib/localPrintClient"` بدل `printReceiptAsImage, openCashDrawer` من `@/lib/printer`
- `handlePrint` (السطر ~175): لا try/catch ميزّع — `printInvoiceLocal` لا يرمي أبداً، يرجع `{ ok, error?, detail? }`. toast نجاح: `"تمت الطباعة"`. toast فشل: يعرض `result.error` العربي
- Auto-print بعد البيع (السطر ~1038): نفس النمط مع toast تحذيري "لم تتم الطباعة التلقائية" عند الفشل
- **استدعاء `openCashDrawer` محذوف** — endpoint `POST /drawer/open` لم يُكتب بعد (Phase 3). البيع النقدي يكتمل لكن الدرج لا يفتح تلقائياً حتى Phase 3

#### تعديل Settings.tsx

- استبدال `printTestReceiptAsImage` بـ `printTestInvoiceLocal` (sample invoice ثابتة)
- نفس نمط `{ ok, error }` مع toast عربي

#### ما لم يُلمس (مقصود — سياسة "لا تحذف QZ")

- `client/src/lib/printer.ts` — لا مستهلك له الآن (orphan dead code)، يبقى محفوظ
- `client/src/lib/qz-print-service.ts` و `qz-certificate.ts` — محفوظة بدون تعديل
- `client/src/lib/qzPrinter.ts` — untracked محلياً من جلسة 43، لم يُرفع
- `client/index.html:29` — `<script src="qz-tray.js" async>` يبقى يُحمَّل، لكن لا يُستدعى من runtime
- `local-print-service/` — لا تغيير في هذه الجلسة (Phase 1+2 من جلسة 43 كافيان لـ POS الآن)

#### التحقق

- TypeScript: 0 أخطاء في `localPrintClient.ts` و `POS.tsx` و `Settings.tsx` و `printer.ts`
- بحث على `qz.print|qz.websocket|qz.connect|qz.printers|sendData` في runtime path الجديد → **لا نتائج**
- Vite HMR التقط التعديلات أثناء dev server شغّال على port 5000

#### أثر النشر على Railway

⚠️ **تغيير سلوك للمستخدمين:** بعد الـ deploy، أي PC كاشير لا يشغّل `local-print-service` ستفشل عنده الطباعة بـ toast `"خدمة الطباعة المحلية غير مفعّلة"`. **البيع نفسه ينجح** (الـ catch لا يرمي خطأ يوقف flow البيع) — فقط الطباعة لا تتم. هذا تطلّب:

1. تثبيت `local-print-service/` على كل PC كاشير قبل أن يستفيد من POS الجديد
2. ضبط `LOCAL_PRINT_API_KEY=123456` في `.env` على كل PC (يطابق المفتاح في `localPrintClient.ts`)
3. تأكيد أن متصفّح POS وخدمة الطباعة على **نفس الجهاز** (127.0.0.1 لا يصل عبر LAN)

#### الخطوات القادمة

**Phase 3 (مرحلة الخدمة المحلية):**
- `POST /drawer/open` — ESC p pulse — لإعادة فتح الدرج تلقائياً مع الدفع النقدي
- `POST /print/label` — TSPL لـ TSC TTP-244M Pro
- اختبار Arabic code page على firmware TM-T100 الفعلي + RTL host-side composition

**Phase 4 الكامل (إعدادات UI):**
- إخراج `LOCAL_PRINT_URL` و `LOCAL_PRINT_API_KEY` و `DEFAULT_PRINTER` إلى Settings UI (localStorage لكل PC كاشير)
- زر "اختبار الاتصال" يستدعي `checkLocalPrintHealth()`
- زر "تحميل قائمة الطابعات" من `/printers` لاختيار طابعة من dropdown بدل الكتابة اليدوية

**Phase 5 (نشر):** تغليف الخدمة كـ Windows service مع NSSM/Task Scheduler + auto-startup عند تشغيل PC الكاشير.

---

### جلسة 43 — Local Print Service: قرار استبدال QZ Tray + بناء جسر طباعة محلي (Phase 1 + 2)

**القرار المعماري:** إزالة QZ Tray من سير عمل الطباعة بالكامل واستبداله بخدمة محلية على PC الكاشير. POS السحابي يستدعيها عبر HTTP على `127.0.0.1:3030`.

**الدوافع:** prompts متكرّرة من QZ على شهادة self-signed، مشكلة `Cannot read properties of null (reading 'sendData')` بعد فشل OS-level (الـ `_socket = null` بينما `isActive()` لا يزال true)، اعتماد على websocket لا يطلق close callbacks دائماً، تضييق licensing مستقبلاً.

**النطاق في هذه الجلسة:** Phase 1 + Phase 2 فقط (داخل مجلد جديد منعزل). **لم يُلمس** POS.tsx ولا Settings.tsx ولا أي ملف QZ — Railway production يبقى يعمل بمسار QZ كما كان حتى يكتمل الجسر المحلي ويُختبر فيزيائياً على EPSON TM-T100.

#### Phase 1 — جسر HTTP أساسي

مجلد جديد `local-print-service/`:
- `package.json` — Express 5 + cors + dotenv + tsx + TS 5.6 (sub-project مستقل، لا يؤثر على بناء Railway)
- `tsconfig.json` — NodeNext ESM strict
- `.env.example` — `PORT=3030`, `LOCAL_PRINT_API_KEY=change-me`, `LOCAL_PRINT_ALLOW_ALL=false`
- `src/index.ts` — bootstrap + CORS allow-list (Railway URLs + localhost) + auth middleware + bind على `127.0.0.1` فقط
- `src/printers.ts` — `Get-Printer | ConvertTo-Json` عبر `child_process.execFile`
- `src/rawPrint.ts` — Phase 1: `Out-Printer` للنص العادي (للـ /print/test فقط)
- `README.md` — install + run + curl + troubleshooting

**Endpoints:**
- `GET /health` — مفتوح
- `GET /printers` — مفتوح، يرجع `Name/DriverName/PortName/Shared/Default`
- `POST /print/test` — يتطلب `x-lamsa-print-key`

#### Phase 2 — طباعة فاتورة 80mm حقيقية (ESC/POS raw عبر winspool.drv)

- `src/escpos.ts` (جديد) — bytes builders كاملة: init / align / bold / size (1×–8×) / codepage / cut partial+full / drawer pulse + `EscposBuilder` fluent API + `latin1()` encoder
- `src/printInvoice.ts` (جديد) — `Invoice` type + `buildInvoiceBytes()` ينتج فاتورة 80mm @ 48 cols
- `src/rawPrint.ts` (تعديل) — أُضيفت `printRawBytes(printerName, Buffer)`:
  - تكتب bytes إلى temp file
  - تُحمِّل C# inline `RawPrinterHelper` عبر PowerShell `Add-Type`
  - تستدعي `winspool.drv` P/Invoke (`OpenPrinter` → `StartDocPrinter` بـ datatype `RAW` → `WritePrinter`) — تتجاوز spooler GDI rendering كلياً فيصل ESC/POS كما هو
  - تستخدم `-EncodedCommand` (UTF-16LE base64) لتجنّب quoting في PowerShell
- `src/index.ts` (تعديل) — أُضيف `POST /print/invoice` مع validation للحقول المطلوبة

**Body schema المتوقَّع:**
```json
{
  "printerName": "EPSON TM-T100 Receipt",
  "invoice": {
    "invoiceNo", "date", "cashier", "branch", "customerName?",
    "items": [{ "name", "sku?", "qty", "price", "total" }],
    "subtotal", "discount", "tax", "grandTotal", "paymentMethod"
  }
}
```

**اللاوت الناتج (48 عمود):**
- header مركّز: `LAMST ANOTHA` بحجم 2× + bold، ثم `CR: 1260008` + `Instagram: lamst_anotha` + `Admin Contact: 94891122`
- meta داخل `=` separators: invoice/date/branch/cashier/customer
- items: name + (SKU optional) + سطر `qty x price` يميناً والـ total يساراً، فاصل `-` بين البنود
- totals: subtotal/discount/tax + GRAND TOTAL بحجم 2× bold + payment
- footer: "Thank you for shopping with us"
- partial cut مع feed 3 dots (`GS V 66 03`)

**حدود مقصودة في Phase 2:**
- code page = 16 (CP1252 / Latin-1) — العربية تطبع `?` placeholders. الدعم الكامل (CP864/CP1256 + RTL line composition من جهة الـ host) مؤجَّل لـ Phase 3 لاختباره على firmware TM-T100 الفعلي بدلاً من التخمين
- لا labels TSPL ولا cash drawer endpoint بعد — Phase 3
- Performance: أول استدعاء بعد start بطيء 1-2s (Roslyn يجمّع C# inline)؛ التالية sub-second

#### التحقق

- `npm run build` → 0 أخطاء، 5 ملفات `.js` مولَّدة في `dist/`
- Smoke test على dev box (لا EPSON متصلة):
  - `POST /print/invoice` بدون مفتاح → 401 ✓
  - payload ناقص → 400 (`invoice is required`) ✓
  - طابعة وهمية → 500 + `OpenPrinter failed: Win32=1801` (ERROR_INVALID_PRINTER_NAME) — يثبت أن C# helper تجمَّع، نُفِّذ، استدعى `winspool.drv` فعلياً، عاد بكود Win32 صحيح. كامل pipeline حتى نقطة driver Windows يعمل
- اختبار فيزيائي على EPSON TM-T100: **معلَّق** — يتطلب تنفيذ من المستخدم على PC الكاشير حيث الطابعة موصولة

#### ما لم يُلمس (مقصود)

- `client/src/pages/POS.tsx` — لا تكامل بعد (Phase 4)
- `client/src/pages/Settings.tsx` — لا UI للخدمة المحلية بعد (Phase 4)
- `client/src/lib/qz-print-service.ts` و `client/src/lib/printer.ts` — مسار QZ القديم محفوظ كما كان على HEAD
- `client/src/lib/qzPrinter.ts` — محاولة جراحية لـ QZ كُتبت محلياً ثم تركَت (untracked) بعد قرار التخلّي عن QZ — لم تُرفع لأنها dead code
- Railway production — لا تأثير: Phase 1+2 مجلد منعزل بـ `package.json` خاص، الـ build السحابي يتجاهله

#### الخطوات القادمة

**Phase 3 (المرحلة التالية):**
1. `POST /print/label` — TSPL لـ TSC TTP-244M Pro (58×40mm، باركود، شعار، سعر)
2. `POST /drawer/open` — ESC p pulse على printer connector pin 2
3. اختبار Arabic code page على firmware TM-T100 الفعلي + RTL line composition من الـ host

**Phase 4 (تكامل سحابي):** `client/src/lib/localPrintClient.ts` + UI في Settings.tsx (printer names + API key + test buttons) + استدعاء من POS.tsx بعد البيع، مع إبقاء مسار QZ كـ fallback خلال فترة الانتقال.

**Phase 5 (نشر):** packaging كـ Windows service (NSSM أو Task Scheduler) + auto-startup script + توثيق نشر على PC الكاشير.

---

### جلسة 42 — Employee Cash Custody: عُهدة الكاشير في الملخص المالي

**المشكلة:** بطاقة "الكاش الفعلي في الصندوق" في `BranchSummary` كانت تعرض حساباً يخلط بين:
- ما هو فعلاً في الدرج اليوم
- وما تراكم بحوزة الكاشير عبر الأيام كعُهدة (cash kept outside the drawer)

النتيجة: الموظف لا يعرف كم ريال إجمالي عليه تسليمه/تبريره للمالك. المثال:
> الموظف عنده عهدة 100 ريال — يفتح وردية بـ 20 — يبيع 30 نقداً → الإجمالي 130 (50 في الدرج + 80 خارجه).

**الحل (Backend):**

#### Migration 0024 (idempotent عند startup) — `server/index.ts`
- إضافة `cashier_id INTEGER REFERENCES users(id)` على `cash_ledger` (بدون جدول جديد)
- Backfill تلقائي: `UPDATE cash_ledger SET cashier_id = shifts.cashier_id WHERE shift_id IS NOT NULL`
- فهارس: `idx_cash_ledger_cashier`, `idx_cash_ledger_branch_cashier`

#### Schema (`shared/schema.ts`)
- `cashLedger.cashierId` (drizzle)
- ثوابت: `CASH_MOVEMENT_INFLOW_TYPES` / `OUTFLOW_TYPES` / `TYPES`
- `cashMovementInputSchema` (Zod) للتحقق
- أنواع جديدة: **`adjustment_in`** / **`adjustment_out`** (تسويات يدوية)

#### POST `/api/cash-movements` — `server/routes.ts:1487`
- Zod validation
- يدعم الأنواع الجديدة (تسويات)
- يُسجّل `cashier_id` تلقائياً (المستخدم إن كان كاشير، أو من الوردية المفتوحة)
- التسويات لا تُربط بـ `owner_transactions` (custody-only)

#### GET `/api/branch-summary` — كائن `custody` جديد
```ts
custody: {
  employeeId, branchId, currentShiftId,
  totalEmployeeCashCustody,   // التراكمي للكاشير + الفرع
  drawerCash,                 // الوردية المفتوحة فقط
  outsideDrawerCash,          // custody − drawer
  todayCashSales, ownerInflows, ownerOutflows, cashExpenses, adjustments,
  cumulativeCashSales, cumulativeOwnerInflows, cumulativeOwnerOutflows,
  cumulativeAdjustments, cumulativeCashExpenses,
  formulaBreakdown,           // شرح المعادلة
}
```

**القواعد المطبَّقة:**
- `opening_cash` **محايد** — لا يُحسب كدخل (نقل من العُهدة إلى الدرج)
- المبيعات النقدية: `sales WHERE payment_method='cash' AND status!='returned'` بفلتر cashier_id+branch_id
- المصروفات النقدية: `expenses WHERE source='cash'` (بفلتر branch — `expenses` بلا `cashier_id`)
- التسويات/التحويلات من `cash_ledger` بفلتر cashier_id+branch_id

**Frontend (`client/src/pages/BranchSummary.tsx`):**
- استبدال البطاقة الرئيسية: **«إجمالي النقد بعهدة الموظف»** + helper text
- بطاقتان مستقلتان: «نقد داخل الدرج الحالي» + «نقد مرحّل / خارج الصندوق»
- شريط معادلة الحساب التراكمية
- 5 بطاقات تفاصيل اليوم (مبيعات/واردات/تسليمات/مصروفات/تسويات)
- إضافة `adjustment_in`/`adjustment_out` لحوار "تسجيل حركة نقدية"

**التحقق:**
- Typecheck: 238 → 238 (لا أخطاء جديدة)
- السيناريو المرجعي يعطي 130/50/80 ✓
- Backward compat: `actualCashInDrawer` و `today.*` تظل في الاستجابة (alias لـ drawerCash)
- POS/shifts/sales لم تُلمس

---

### جلسة 41 — إصلاح أمني سريع: إزالة الأسرار من git tracking

**المشكلة:** كان `.env` و `scripts/qz-keys/private-key.pem` و `scripts/qz-keys/digital-certificate.pem` متعقَّبة في git ومرفوعة على GitHub العام — أي أن الأسرار التالية مكشوفة في تاريخ الـ commits:
- `DATABASE_URL` (Railway PostgreSQL مع كلمة مرور حقيقية)
- `SESSION_SECRET=lamsat-secret-2024`
- `QZ_PRIVATE_KEY` (RSA-2048 كامل)
- نفس الـ private key في `scripts/qz-keys/private-key.pem`

**نطاق الإصلاح (سريع — بدون إعادة كتابة git history):**

#### `.gitignore` — أنماط جديدة
```
.env
.env.*
!.env.example
*.pem
scripts/qz-keys/*.pem
scripts/qz-keys/private.*
scripts/qz-keys/keys.*
```

#### إزالة من tracking (الملفات المحلية محفوظة)
```bash
git rm --cached .env
git rm --cached scripts/qz-keys/private-key.pem
git rm --cached scripts/qz-keys/digital-certificate.pem
```

#### `.env.example` — جديد
ملف placeholder آمن للمطورين الجدد، يوضّح المتغيرات المطلوبة بدون قيم حقيقية.

#### كود التطبيق
- لا تغييرات على logic — `server/index.ts` و `server/routes.ts` و `server/db.ts` و `server/backup.ts` يستخدمون `process.env` أصلاً.
- `client/src/lib/qz-certificate.ts` يحتوي الشهادة العامة فقط (آمن للـ frontend بالتصميم) — لم يُلمس.

**الخطوات الحرجة المطلوبة على Railway (لإبطال الأسرار المكشوفة):**
1. **PostgreSQL → Settings → Reset Database Password** → Railway يحدّث `${{Postgres.DATABASE_URL}}` تلقائياً
2. **Service Variables:**
   - `SESSION_SECRET` ← قيمة جديدة من `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `QZ_PRIVATE_KEY` ← مفتاح جديد (شغّل `scripts/qz-keys/` لتوليد زوج جديد) — وحدِّث `client/src/lib/qz-certificate.ts` بالشهادة الجديدة في **نفس الكوميت**
3. **Redeploy**

**ملاحظة:** الأسرار القديمة لا تزال في commits سابقة على GitHub. تدوير المفاتيح في Railway هو ما يُبطلها فعلياً. إعادة كتابة git history مؤجَّلة كإجراء لاحق إن لزم.

#### تنفيذ التدوير على Railway (تم)
- **`SESSION_SECRET`** ← قيمة جديدة (96 hex chars) عبر Variables
- **`QZ_PRIVATE_KEY`** ← أُضيف لأول مرة (لم يكن مضبوطاً على production أصلاً)، مُطابق للـ cert في commit `229700c`
- **كلمة مرور Postgres** ← دُوِّرت بطريقتين متتابعتين:
  1. ❌ المحاولة الأولى: تغيير `POSTGRES_PASSWORD` كمتغير مباشرةً → كراش `28P01 invalid_password` (صورة `postgres-ssl:18` لا تُزامن المتغير مع المستخدم الداخلي)
  2. ✅ الحل الصحيح: استعادة الكلمة القديمة مؤقتاً → تنفيذ `ALTER USER postgres WITH PASSWORD ...` عبر Postgres → tab Database → Query → ثم تحديث `POSTGRES_PASSWORD` ليطابق
- **`DATABASE_URL`** على lamsa-pos: مرجع ديناميكي `${{Postgres.DATABASE_URL}}` → تحدّث تلقائياً

#### درس مستفاد
- على Railway، **لا تغيّر `POSTGRES_PASSWORD` يدوياً ولا تستخدم Reset Password (إن وجد) قبل تنفيذ `ALTER USER` داخل Postgres نفسه**. الترتيب الصحيح: ALTER داخل DB أولاً، ثم تحديث المتغير ليطابق.
- الـ health endpoint `/api/health` نافع للتحقق السريع من اتصال السيرفر بقاعدة البيانات بعد أي تغيير.

**الحالة النهائية:** الموقع online على https://lamsa-pos.up.railway.app — `/api/health` → `{status:"ok"}`. كل الأسرار المسرَّبة مُبطَلة فعلياً.

---

### جلسة 40 — إصلاح "Signature Missing / Anonymous request" في QZ Tray نهائياً

**سبب المشكلة (سببان متراكبان):**
1. `QZ_CERTIFICATE` كان لا يزال placeholder (`PASTE_DIGITAL_CERTIFICATE_HERE`) → QZ Tray يرفض الـ cert في الـ handshake ولا يستدعي `setSignaturePromise` أبداً → "Signature: Missing" + "Anonymous request"
2. `dotenv` غير مثبَّت ولا `--env-file` في scripts → `.env` كان لا يُقرأ أصلاً → `process.env.QZ_PRIVATE_KEY` كان `undefined`

#### `scripts/qz-keys/` (جديد) — مولِّد cert/key + verifier
- `private-key.pem` + `digital-certificate.pem` — RSA-2048 self-signed صالحة 10 سنوات (CN=Lamsat Anotha POS)
- `verify-pair.mjs` — يوقّع nonce بـ `.env` ويتحقق ضد الـ cert في `qz-certificate.ts` → PASS ✓ مؤكَّد
- `README.md` — شرح كامل + أوامر openssl للتوليد

#### `client/src/lib/qz-certificate.ts`
- استبدال placeholder بشهادة X.509 حقيقية مولَّدة من openssl
- `QZ_CERTIFICATE_CONFIGURED = true` الآن

#### `.env`
- `QZ_PRIVATE_KEY` بقيمة multi-line PEM داخل علامتي تنصيص (حسب صيغة المُحمِّل)
- على Railway: انسخ نفس القيمة إلى Variables → QZ_PRIVATE_KEY

#### `server/index.ts` — مُحمِّل `.env` مدمج
- ~25 سطر باستخدام `node:fs` فقط (بدون اعتماد جديد)
- يدعم: قيم بدون اقتباس / `"double quoted"` (multi-line + `\n` escapes) / `'single quoted'`
- متغيرات الـ shell الحقيقية تتقدم على `.env` (لا نكتب فوقها)

#### `server/routes.ts` — endpoints جديدة للتشخيص
- `GET /api/printing/qz/status` — يرجع metadata فقط: `privateKeyConfigured`, `privateKeyLength`, `privateKeyLooksLikePem`, `algorithm`
- `POST /api/printing/qz/sign-test` — body: `{ certificate }` → يوقّع nonce ويتحقق ضد الـ cert المُمرَّر → `{ ok, details, error? }` — يكشف فوراً إذا الـ pair لا يطابق
- `POST /api/printing/qz/sign` — يطبع `[QZ-Sign] sign request — toSign length=N, key length=K` ثم `signature produced — length=L` على كل طلب

#### اختبار سريع
```
node scripts/qz-keys/verify-pair.mjs  →  verify with cert: PASS ✓
```

#### الخطوة الأخيرة لإنهاء الـ prompt
- على Railway: ضبط `QZ_PRIVATE_KEY` في Variables من قيمة `.env`
- في QZ Tray عند أول طباعة بعد النشر: Allow + ✓ Remember this decision

---

### جلسة 39 — إصلاح حساب الكاش المتوقع + تعديل النقد الافتتاحي

**المشكلة:** dialog إغلاق الوردية كان يعرض "الكاش المتوقع" يساوي مبيعات الكاش فقط (مثلاً 6.529 ر.ع) متجاهلاً النقد الافتتاحي والمصروفات. كذلك أسطر "مبيعات نقداً/بطاقة/تحويل" دائماً صفر.

**السبب الجذري — ثلاث مشاكل متراكبة:**
1. **Bug عرض في `CloseShiftModal`:** الـ frontend كان يقرأ `summary?.totalCashIn / totalCardIn / totalBankIn` لكن الـ API `/api/reports/shift` يُرجع `salesCash.total / salesCard.total / salesBankTransfer.total`. النتيجة: كل الحقول صفر دائماً.
2. **عدم تطابق الحساب:** `getShiftReport` كان يحسب `expectedCash = opening + salesCash − expCash` بينما `closeShift` يضيف `+ depositsIn − withdrawalsOut` → القيمة المعروضة لا تطابق المحفوظة.
3. **النقد الافتتاحي = 0:** الورديات المفتوحة عبر `/api/admin/backfill-shift-today` تُنشأ بـ `opening_cash='0'` بدون طريقة لتعديلها بعد ذلك.

**الإصلاحات — server/routes.ts + storage.ts + POS.tsx:**
- [x] `CloseShiftModal`: قراءة الحقول الصحيحة (`summary.salesCash.total` … إلخ) + إضافة سطر "💸 مصروفات كاش" قبل "الكاش المتوقع"
- [x] `getShiftReport`: تضمين `cash_ledger` بنوع `deposit/withdrawal` في حساب `expectedCash` للتطابق مع `closeShift`
- [x] `PATCH /api/shifts/:id/opening-cash` (requireOwnerOrAdmin): يسمح بتعديل النقد الافتتاحي لوردية مفتوحة فقط (قاصر على المالك/الإدمن لمنع تلاعب الكاشير)
- [x] في dialog الإغلاق: زر "تعديل" بجانب "النقد الافتتاحي" يظهر فقط للمالك/الإدمن — يفتح حقل inline → حفظ → إعادة تحميل ملخص الوردية

**نتيجة:** بعد الإصلاح: `expected = opening + cashSales − cashExpenses + deposits − withdrawals` متطابق بين العرض والحفظ. لو الوردية كانت من backfill، المالك يضغط "تعديل" بجانب النقد الافتتاحي ويُدخل القيمة الصحيحة قبل الإغلاق.

---

### جلسة 38 — تغميق الفاتورة المطبوعة + توسيط الشعار + fallback آمن لتوقيع QZ

**المشكلة على ورقة الطباعة الفعلية:**
1. الشعار ظهر في أعلى يمين الفاتورة بدل الوسط (rule: `text-align:center` على `<div>` غير موثوق داخل RTL parent).
2. النصوص الرمادية (`#888 / #777 / #666 / #555 / #444 / #333 / #bbb`) طُبعت باهتة — الطابعة الحرارية لا ترسم درجات الرمادي بدقة.

#### `client/src/lib/printer.ts` — تغميق كامل + توسيط الشعار
- [x] الشعار: ملفوف في `<table>` cell + `display:block; margin:0 auto; width:140px` (كان `<div text-align:center>` + `max-width:110px`)
- [x] إزالة كل الألوان الرمادية — كل النص الآن `#000` صريح، والحدود `solid 2px #000` بدل `dashed #ccc/#aaa/#bbb/#999/#ddd`
- [x] رفع `font-weight:bold` على: ليبلز الكونتاكت / الفرع / الكاشير / المجموع الفرعي / الخصم / الضريبة / المدفوع / الباقي / طريقة الدفع / تذييل (جودة وأنافة / تسوقي الآن) / سياسة الإرجاع
- [x] رفع حجم الخط في عمود الكمية وسعر الوحدة من `16px → 17px bold` للوضوح في الإيصالات الحرارية
- [x] رفع حجم خط "شكراً لثقتكم بنا" من `20px → 22px` و"نسعد بخدمتكم دائماً" من `16px → 17px bold`
- [x] رفع حجم رقم الفاتورة في الـ dark bar من `21px → 22px`، التاريخ من `16px → 17px`
- [x] الليبلز داخل الـ dark bars كانت `#bbb` (شبه مخفية) → `#ffffff` + `bold` + خط أكبر

#### `client/src/lib/qz-print-service.ts` — fallback عند عدم وجود شهادة
- [x] `configureSecurity()` يتخطّى ضبط الـ certificate/signature promises إذا `QZ_CERTIFICATE_CONFIGURED === false`
- [x] السبب: قبل لصق الشهادة الحقيقية، كان كل طلب طباعة يفشل عند backend signing (لأن `QZ_PRIVATE_KEY` placeholder)
- [x] الآن: قبل لصق الشهادة → QZ Tray يعمل anonymous mode (يظهر prompt مرة واحدة لكن الطباعة تعمل) — بعد لصق الشهادة → التوقيع يفعّل تلقائياً

---

### جلسة 37 — تأمين QZ Tray بشهادة موقعة (إزالة "Untrusted website")

**المشكلة:** QZ Tray كان يعرض في كل طباعة:
> "Action Required — An anonymous request wants to print — Untrusted website"

السبب: لا توجد شهادة (Certificate) ولا توقيع (Signature) على الطلبات → QZ Tray يعتبر الموقع مجهولاً.

**الحل:** قناة طباعة موقعة من طرف الخادم — الشهادة العامة في الـ frontend، المفتاح الخاص في `process.env` فقط.

#### ملفات جديدة

##### `client/src/lib/qz-certificate.ts` (جديد)
- يصدّر `QZ_CERTIFICATE` (placeholder حالياً) للاستخدام في `qz.security.setCertificatePromise()`
- ملاحظات أمنية واضحة: الشهادة العامة آمنة في الـ bundle، المفتاح الخاص ممنوع منعاً باتاً هنا
- `QZ_CERTIFICATE_CONFIGURED` flag للتحقق هل تم لصق الشهادة الحقيقية

##### `client/src/lib/qz-print-service.ts` (جديد) — نقطة الدخول الموحَّدة لـ QZ
- `configureSecurity()` (idempotent) — يضبط مرة واحدة:
  - `qz.security.setCertificatePromise(resolve => resolve(QZ_CERTIFICATE))`
  - `qz.security.setSignatureAlgorithm("SHA512")`
  - `qz.security.setSignaturePromise(toSign => fetch('/api/printing/qz/sign', ...))` — التوقيع يتم في الخادم
- `ensureQzReady()` — يضمن load + security + connection بدون إعادة اتصال متكررة (de-dup عبر `connectPromise`)
- Helpers: `findReceiptPrinter`, `findLabelPrinter`, `signedPrint`, `signedRaw`, `createConfig`
- رسائل خطأ عربية واضحة (QZ Tray غير مشغّل / الطابعة غير موجودة)

#### ملفات معدَّلة

##### `client/src/lib/printer.ts`
- استبدال جميع نداءات `qz.*` المباشرة باستدعاءات الـ service الموقّع
- `ensureQzConnected()` → wrapper حول `ensureQzReady()`
- `cutPaper`, `openCashDrawer`, `printReceiptAsImage` تستخدم `signedPrint` / `signedRaw`
- **تصميم الفاتورة لم يتغير** (نفس buildReceiptHtml بدون أي تعديل)

##### `server/routes.ts` — `POST /api/printing/qz/sign`
- مسار جديد محمي بـ `requireAuth`
- Body: `{ request: string }` → Response: `{ signature: string }`
- التوقيع: `crypto.createSign("RSA-SHA512")` ← يطابق `setSignatureAlgorithm("SHA512")` في الـ frontend
- يقرأ المفتاح من `process.env.QZ_PRIVATE_KEY` فقط
- يدعم المفتاح بصيغتين: multi-line (Railway) أو `\n`-escaped (.env)
- لا يكشف المفتاح في أي error message

##### `.env`
- إضافة `QZ_PRIVATE_KEY` placeholder مع تعليقات أمنية

#### الخطوات اليدوية المتبقية لتفعيل التغيير
1. توليد زوج cert/key حسب https://qz.io/wiki/2.0-signing-messages
2. لصق محتوى `digital-certificate.txt` في `client/src/lib/qz-certificate.ts` (استبدال `PASTE_DIGITAL_CERTIFICATE_HERE`)
3. لصق محتوى `private-key.pem` في:
   - `.env` محلياً
   - Railway Variables → `QZ_PRIVATE_KEY` (multi-line مدعوم)
4. أول طباعة بعد النشر: QZ Tray يطلب الموافقة مرة واحدة → "Remember this decision" → ينتهي الـ prompt للأبد

#### الطابعات المستخدمة
- إيصال: `EPSON TM-T100 Receipt`
- ليبل: `TSC TTP-244M Pro`

#### ملاحظة فنية
- خوارزمية التوقيع SHA-512 (وليس SHA-256) — لأن `setSignatureAlgorithm` و `createSign` يجب أن يتطابقا تماماً وإلا QZ Tray يرفض التوقيع

---

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
