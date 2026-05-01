# صيانة نظام النسخ الاحتياطي

---

## تغيير مفتاح التشفير

```powershell
# 1. أنشئ مفتاحاً جديداً
$chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$newKey = ""; $buf = [byte[]]::new(1)
while ($newKey.Length -lt 32) { $rng.GetBytes($buf); $newKey += $chars[$buf[0] % $chars.Length] }

# 2. احفظه
$newKey | Out-File "C:\lamsa-backups\.encryption-key" -Encoding utf8 -NoNewline

# 3. النسخة التالية ستستخدم المفتاح الجديد تلقائياً
```

---

## تغيير حساب Google Drive

```powershell
$rclone = (Get-ChildItem "C:\Users\HP\AppData\Local\Microsoft\WinGet\Packages\Rclone.Rclone*" -Recurse -Filter "rclone.exe" | Select-Object -First 1).FullName

# احذف الإعداد القديم
& $rclone config delete lamsa-gdrive

# أعد الإعداد
& "C:\lamsa-backups\scripts\setup-rclone.ps1"
```

---

## إيقاف نظام النسخ مؤقتاً

```powershell
# إيقاف
Disable-ScheduledTask -TaskName "Lamsa-DailyBackup"  -TaskPath "\LamsaAnoutha\"
Disable-ScheduledTask -TaskName "Lamsa-BackupMonitor" -TaskPath "\LamsaAnoutha\"

# إعادة التشغيل
Enable-ScheduledTask -TaskName "Lamsa-DailyBackup"   -TaskPath "\LamsaAnoutha\"
Enable-ScheduledTask -TaskName "Lamsa-BackupMonitor"  -TaskPath "\LamsaAnoutha\"
```

---

## تحديث رابط قاعدة البيانات

عدّل `C:\Users\HP\lamsat-anoutha\.env.audit` — السكربت يقرأ منه تلقائياً.

---

## فحص صحة النظام

```powershell
# اعرض حالة آخر نسخة
Get-Content "C:\lamsa-backups\last-backup-status.json" | ConvertFrom-Json

# اعرض المهام المجدولة
Get-ScheduledTask -TaskPath "\LamsaAnoutha\" | Get-ScheduledTaskInfo |
    Select-Object TaskName, LastRunTime, LastTaskResult, NextRunTime

# اعرض النسخ المحلية
Get-ChildItem "C:\lamsa-backups\current" | Sort-Object LastWriteTime -Descending

# اعرض نسخة Drive
$rclone = (Get-ChildItem "C:\Users\HP\AppData\Local\Microsoft\WinGet\Packages\Rclone.Rclone*" -Recurse -Filter "rclone.exe" | Select-Object -First 1).FullName
& $rclone ls "lamsa-gdrive:lamsa-backups"
```

---

_آخر تحديث: 2026-05-01_
