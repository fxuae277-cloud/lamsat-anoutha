# 🧠 CONTEXT — لمسة أنوثة POS/ERP
_آخر تحديث: 2026-04-07 (جلسة 2)_

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
- بيانات مكررة في جدول products
- أسماء منتجات غير منظمة في DB
- Inventory anomalies في بعض الفروع

---

## ⏳ القادم
- [ ] ربط WhatsApp automation
- [ ] تنظيم بيانات المنتجات (أسماء مكررة وغير منظمة)
- [ ] فلاتر Dashboard إضافية
- [ ] ضغط الصور قبل رفعها (client-side) لتقليل حجم base64

---

## 📋 قرارات تقنية
- Auth: Sessions → JWT
- Hosting: Railway
- Tool: Claude Code

---

## 📌 تعليمات
في نهاية كل جلسة حدّث هذا الملف بما تم ✅ وما تبقى ⏳
