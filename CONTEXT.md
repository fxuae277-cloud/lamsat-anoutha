# 🧠 CONTEXT — لمسة أنوثة POS/ERP
_آخر تحديث: 2026-04-07 (جلسة 3)_

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

---

## ⏳ القادم
- [ ] ربط WhatsApp automation
- [ ] تنظيف بيانات المنتجات (أسماء مكررة وغير منظمة)
- [ ] فلاتر Dashboard إضافية
- [ ] صفحة تقارير مفصلة
- [ ] تشغيل migration على Railway (0007_categories_enhancement.sql)

---

## 📋 قرارات تقنية
- Auth: Sessions → JWT
- Hosting: Railway
- Tool: Claude Code
- Images: base64 في PostgreSQL (مضغوطة client-side)
- Category Hierarchy: parentId self-reference

---

## 📌 تعليمات
في نهاية كل جلسة حدّث هذا الملف بما تم ✅ وما تبقى ⏳
