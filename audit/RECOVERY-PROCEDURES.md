# إجراءات الاسترجاع الطارئ
## لمسة أنوثة POS/ERP

---

## ⚡ استرجاع طارئ في 5 دقائق (من محلي)

```powershell
# 1. حدد آخر ملف dump محلي
$dump = Get-ChildItem "C:\lamsa-backups\current" -Filter "*.dump" | 
        Sort-Object LastWriteTime -Descending | 
        Select-Object -First 1

# 2. استرجع مباشرة إلى Railway
$dbUrl = (Get-Content "C:\Users\HP\lamsat-anoutha\.env.audit" | 
          Where-Object { $_ -match "DATABASE_URL=" }) -replace "DATABASE_URL=",""

& "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" `
    $dbUrl --no-owner --no-privileges --single-transaction `
    --clean --if-exists $dump.FullName

Write-Output "✅ اكتمل الاسترجاع من: $($dump.Name)"
```

---

## 🔄 استرجاع كامل في 30 دقيقة (من Google Drive)

### الخطوة 1 — تنزيل من Drive (5 دق)
```powershell
$rclone = (Get-ChildItem "C:\Users\HP\AppData\Local\Microsoft\WinGet\Packages\Rclone.Rclone*" -Recurse -Filter "rclone.exe" | Select-Object -First 1).FullName
& $rclone copy "lamsa-gdrive:lamsa-backups" "C:\lamsa-backups\recovery" --include "lamsa-*.7z"
```

### الخطوة 2 — فك التشفير (2 دق)
```powershell
$key = (Get-Content "C:\lamsa-backups\.encryption-key" -Raw).Trim()
$archive = Get-ChildItem "C:\lamsa-backups\recovery" -Filter "*.7z" | 
           Sort-Object LastWriteTime -Descending | Select-Object -First 1
& "C:\Program Files\7-Zip\7z.exe" e "-p$key" -o"C:\lamsa-backups\recovery" $archive.FullName "*.dump" -y
```

### الخطوة 3 — استرجاع (15 دق)
```powershell
$dump = Get-ChildItem "C:\lamsa-backups\recovery" -Filter "*.dump" | Select-Object -First 1
$dbUrl = (Get-Content "C:\Users\HP\lamsat-anoutha\.env.audit" | Where-Object { $_ -match "DATABASE_URL=" }) -replace "DATABASE_URL=",""

& "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" `
    $dbUrl --no-owner --no-privileges --single-transaction `
    --clean --if-exists $dump.FullName
```

### الخطوة 4 — تحقق (5 دق)
```powershell
# شغّل smoke test للتحقق
cd C:\Users\HP\lamsat-anoutha
$env:DATABASE_URL = $dbUrl
npx tsx audit/scripts/phase7-smoke-test.ts post
```

---

## 🔧 أوامر pg_restore الكاملة

```powershell
# متغيرات
$PG   = "C:\Program Files\PostgreSQL\18\bin"
$DUMP = "C:\lamsa-backups\current\lamsa-YYYY-MM-DD-HHmm.dump"  # ← عدّل الاسم
$DB   = "postgresql://postgres:PASSWORD@HOST:PORT/DATABASE"

# الاسترجاع الكامل (يمسح ويُعيد)
& "$PG\pg_restore.exe" $DB --no-owner --no-privileges `
    --clean --if-exists --single-transaction $DUMP

# فحص محتويات الملف (بدون استرجاع)
& "$PG\pg_restore.exe" --list $DUMP | head -50

# استرجاع جدول واحد فقط
& "$PG\pg_restore.exe" $DB --no-owner --table=products $DUMP
```

---

## 🚨 حلول للمشاكل الشائعة

### pg_restore: error: connection refused
```powershell
# تحقق من الاتصال
Test-NetConnection interchange.proxy.rlwy.net -Port 47450
```

### 7-Zip: Wrong password
```powershell
# تحقق من المفتاح
Get-Content "C:\lamsa-backups\.encryption-key" | Measure-Object -Character
```

### rclone: Failed to copy
```powershell
# إعادة المصادقة
$rclone = (Get-ChildItem "C:\Users\HP\AppData\Local\Microsoft\WinGet\Packages\Rclone.Rclone*" -Recurse -Filter "rclone.exe" | Select-Object -First 1).FullName
& $rclone reconnect "lamsa-gdrive:"
```

### Dump file is 0 bytes
```powershell
# تحقق من DATABASE_URL في .env.audit
Get-Content "C:\Users\HP\lamsat-anoutha\.env.audit"
# تحقق من الاتصال يدوياً
cd C:\Users\HP\lamsat-anoutha
npx tsx audit/scripts/phase7-smoke-test.ts
```

---

## 📞 معلومات الاتصال

- **قاعدة البيانات:** Railway PostgreSQL 18.3
- **Host:** interchange.proxy.rlwy.net:47450
- **DATABASE_URL:** موجود في `C:\Users\HP\lamsat-anoutha\.env.audit`
- **Encryption Key:** `C:\lamsa-backups\.encryption-key`
- **Google Drive:** fxuae277@gmail.com → lamsa-backups/

---

_آخر تحديث: 2026-05-01_
