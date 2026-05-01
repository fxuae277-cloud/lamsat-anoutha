# 📅 MAINTENANCE CALENDAR — جدول الصيانة
_لمسة أنوثة POS/ERP_

## 🗓️ يومي (5-10 دقائق)

| المهمة | الأمر | المسؤول |
|--------|-------|---------|
| فحص مخزون سالب | `psql $DB -c "SELECT COUNT(*) FROM location_inventory WHERE qty_on_hand < 0"` | أي مستخدم |
| فحص ورديات مفتوحة | `psql $DB -c "SELECT COUNT(*) FROM shifts WHERE status='open' AND started_at < NOW() - INTERVAL '12h'"` | أي مستخدم |
| إحصاء مبيعات اليوم | Dashboard → التقرير اليومي | الكاشير |

---

## 🗓️ أسبوعي (30 دقيقة) — كل أحد

| المهمة | الأمر/الإجراء |
|--------|---------------|
| فحص سلامة البيانات | `npm run audit:integrity` |
| مطابقة المحاسبة | `npm run audit:accounting` |
| مراجعة audit_log للعمليات الحساسة | Dashboard → Audit Log |
| مراجعة منتجات تحت الحد الأدنى | Dashboard → المخزون |

---

## 🗓️ شهري (2-3 ساعات) — أول كل شهر

| المهمة | الإجراء |
|--------|---------|
| تدقيق المخزون الكامل | `npm run audit:inventory` |
| **جرد فعلي** | 1. شغّل `audit:inventory` → ملف CSV. 2. الفريق يجرد فعلياً. 3. أدخل التسويات. |
| مراجعة رواتب الشهر | Dashboard → الرواتب |
| مراجعة أرصدة الموردين | `npm run audit:accounting` → EQ5 |
| مراجعة أرصدة العملاء | `npm run audit:accounting` → EQ3 |
| تصدير التقارير للمالك | Dashboard → التقرير الشهري |

---

## 🗓️ ربعي (يوم كامل) — كل 3 أشهر

| المهمة | الإجراء |
|--------|---------|
| `npm run audit:all` — التدقيق الشامل | كل المراحل |
| فحص bcrypt rounds | `psql $DB -c "SELECT username, LENGTH(password) FROM users WHERE is_active=true"` |
| مراجعة Rate Limiting | فحص logs لـ 429 responses |
| مراجعة الـ indexes | `EXPLAIN ANALYZE` على أبطأ 10 استعلامات |
| ترقية dependencies | `npm outdated` |
| مراجعة الصلاحيات | كل endpoint → auth middleware |

---

## 🔴 حالات الطوارئ (استجب فوراً)

| الحالة | الإجراء |
|--------|---------|
| مخزون سالب > 10 منتج | `npm run audit:inventory` → إصلاح تلقائي |
| فرق محاسبي > 10 OMR | `npm run audit:accounting` → Root Cause Analysis |
| وردية مفتوحة > 24 ساعة | إغلاق يدوي من Dashboard |
| مستخدم غير مصرح بنشاط | فحص audit_log + تعطيل الحساب |

---

_آخر تحديث: 2026-05-01_
