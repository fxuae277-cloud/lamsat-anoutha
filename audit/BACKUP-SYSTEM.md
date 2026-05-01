# نظام النسخ الاحتياطي اليومي
## لمسة أنوثة POS/ERP — Backup System v4.1.0

---

## الاستراتيجية (3-2-1 Rule)

| | التفاصيل |
|--|---------|
| **3** نسخ إجمالية | محلي + Drive + الأصل على Railway |
| **2** وسيط مختلف | القرص الصلب + Google Drive |
| **1** خارج الموقع | Google Drive (fxuae277@gmail.com) |

---

## الجدول الزمني

| المهمة | الوقت | التكرار |
|--------|-------|---------|
| النسخ الاحتياطي | 5:00 AM | يومياً |
| المراقبة | كل ساعة | مستمر |
| اختبار الاسترجاع | الأحد 6:00 AM | أسبوعياً |

---

## أين توجد النسخ

### محلياً — آخر 7 نسخ
```
C:\lamsa-backups\current\
└── lamsa-YYYY-MM-DD-HHmm.dump    ← pg_dump custom format
```

### Google Drive — نسخة واحدة (تُستبدل يومياً)
```
Google Drive (fxuae277@gmail.com)
└── lamsa-backups/
    └── lamsa-YYYY-MM-DD-HHmm.7z  ← مشفّر AES-256
```

### مؤقت (مشفّر للرفع)
```
C:\lamsa-backups\encrypted\
└── lamsa-latest.7z
```

---

## الأدوات المستخدمة

| الأداة | الإصدار | الاستخدام |
|--------|---------|---------|
| pg_dump | PostgreSQL 18.3 | تصدير قاعدة البيانات |
| 7-Zip | 26.01 | ضغط + تشفير AES-256 |
| rclone | 1.73.5 | رفع/تنزيل Google Drive |
| Windows Task Scheduler | — | الجدولة التلقائية |

---

## السكربتات

| الملف | الوظيفة |
|-------|---------|
| `C:\lamsa-backups\scripts\daily-backup.ps1` | النسخ اليومي |
| `C:\lamsa-backups\scripts\monitor-backup.ps1` | المراقبة الساعية |
| `C:\lamsa-backups\scripts\test-recovery.ps1` | اختبار الاسترجاع |
| `C:\lamsa-backups\scripts\setup-scheduled-tasks.ps1` | إعداد المهام |
| `C:\lamsa-backups\scripts\setup-rclone.ps1` | إعداد Google Drive |

---

## مفتاح التشفير

- **الموقع:** `C:\lamsa-backups\.encryption-key`
- **النوع:** AES-256 (32 حرف عشوائي)
- **الأذونات:** قراءة للمستخدم الحالي فقط
- ⚠️ **احتفظ بنسخة من هذا المفتاح في مكان آمن منفصل**
- ⚠️ بدون هذا المفتاح لا يمكن فك تشفير النسخ من Drive

---

## ملف الحالة

```
C:\lamsa-backups\last-backup-status.json
```
يُحدَّث بعد كل نسخة احتياطية ويحتوي:
- LastBackup: تاريخ ووقت آخر نسخة
- Status: SUCCESS / FAILED
- DumpSizeMB: حجم قاعدة البيانات
- CloudFile: اسم الملف على Drive

---

## كيفية تشغيل نسخة يدوية

```powershell
PowerShell -ExecutionPolicy Bypass -File "C:\lamsa-backups\scripts\daily-backup.ps1" -Manual
```

---

## السجلات (Logs)

```
C:\lamsa-backups\logs\
├── backup-YYYY-MM-DD.log    ← سجل يومي
└── alerts.log               ← تنبيهات المراقبة
```

---

## إعادة الإعداد الكامل

لو احتجت إعادة الإعداد من الصفر:
1. `C:\lamsa-backups\scripts\setup-rclone.ps1` — إعادة ربط Drive
2. `C:\lamsa-backups\scripts\setup-scheduled-tasks.ps1` — إعادة المهام (بصلاحية Admin)

---

_تاريخ الإعداد: 2026-05-01 | الإصدار: v4.1.0-backup-active_
