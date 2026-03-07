import type { Express, Request, Response, NextFunction } from "express";
import { pool } from "./db";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import archiver from "archiver";
import AdmZip from "adm-zip";

const BACKUP_DIR = path.join(process.cwd(), "backups");

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function requireOwnerOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "غير مصرح" });
  }
  pool.query("SELECT role FROM users WHERE id = $1", [req.session.userId])
    .then((result: any) => {
      const user = result.rows[0];
      if (!user || (user.role !== "owner" && user.role !== "admin")) {
        return res.status(403).json({ message: "غير مصرح - صلاحيات غير كافية" });
      }
      next();
    })
    .catch(() => res.status(500).json({ message: "خطأ في التحقق" }));
}

function sanitizeFilename(name: string): string | null {
  const clean = path.basename(name);
  if (clean !== name || clean.includes("..") || !clean.endsWith(".zip")) {
    return null;
  }
  return clean;
}

function generateRestoreReadme(): string {
  return `==============================================
  دليل استعادة النسخة الاحتياطية - لمسة أنوثة ERP
  Backup Restore Guide - Lamsat Onoutha ERP
==============================================

المحتويات:
  /database/dump.sql       - نسخة قاعدة البيانات PostgreSQL
  /database/data.json      - نسخة البيانات بصيغة JSON (احتياطي)
  /uploads/                - الصور والملفات المرفوعة
  /config/                 - إعدادات النظام
  metadata.json            - معلومات النسخة الاحتياطية
  README-RESTORE.txt       - هذا الملف

=============================================
  خطوات الاستعادة على خادم Hetzner
=============================================

1) نقل الملف إلى الخادم:
   scp lamsat-backup-YYYY-MM-DD-HH-mm.zip user@your-server:/tmp/

2) فك الضغط:
   cd /tmp
   unzip lamsat-backup-YYYY-MM-DD-HH-mm.zip -d lamsat-restore

3) استعادة قاعدة البيانات:
   # إنشاء قاعدة بيانات جديدة (اختياري)
   sudo -u postgres createdb lamsat_erp

   # استعادة من dump.sql
   sudo -u postgres psql lamsat_erp < /tmp/lamsat-restore/database/dump.sql

   # أو باستخدام DATABASE_URL
   psql $DATABASE_URL < /tmp/lamsat-restore/database/dump.sql

4) استعادة الملفات المرفوعة:
   cp -r /tmp/lamsat-restore/uploads/* /path/to/your/app/uploads/

5) متغيرات البيئة المطلوبة:
   DATABASE_URL=postgresql://user:password@localhost:5432/lamsat_erp
   SESSION_SECRET=your-secret-key
   PORT=5000
   NODE_ENV=production

6) تشغيل التطبيق:
   npm install
   npm run build
   npm start

=============================================
  ملاحظات مهمة
=============================================
- تأكد من أن PostgreSQL مثبت (الإصدار 14 أو أحدث)
- النسخة تشمل جميع الجداول والبيانات
- كلمات المرور مشفرة ولا تحتاج إعادة تعيين
- في حال فشل dump.sql، استخدم data.json للاستعادة اليدوية
`;
}

export function registerBackupRoutes(app: Express) {
  ensureBackupDir();

  app.post("/api/settings/backup/create", requireOwnerOrAdmin, async (req: Request, res: Response) => {
    const startTime = Date.now();
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
    const filename = `lamsat-backup-${timestamp}.zip`;
    const filepath = path.join(BACKUP_DIR, filename);

    console.log(`[Backup] بدء إنشاء النسخة الاحتياطية: ${filename}`);

    try {
      const dumpPath = path.join(BACKUP_DIR, `dump-${timestamp}.sql`);
      let dumpSuccess = false;
      let dumpError = "";

      try {
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) throw new Error("DATABASE_URL not set");
        execSync(`pg_dump "${dbUrl}" --no-owner --no-acl --clean --if-exists > "${dumpPath}"`, {
          timeout: 120000,
          stdio: ["pipe", "pipe", "pipe"],
        });
        const dumpStat = fs.statSync(dumpPath);
        if (dumpStat.size < 100) {
          throw new Error("Dump file is too small, likely empty");
        }
        dumpSuccess = true;
        console.log(`[Backup] تصدير قاعدة البيانات نجح: ${(dumpStat.size / 1024).toFixed(1)} KB`);
      } catch (err: any) {
        dumpError = err.message;
        console.error(`[Backup] فشل تصدير قاعدة البيانات: ${dumpError}`);
      }

      const tables = [
        "settings", "branches", "cities", "categories", "products", "product_variants",
        "users", "employees", "customers", "suppliers",
        "locations", "location_inventory", "inventory_balances", "inventory_transactions",
        "inventory_ledger", "inventory_adjustments",
        "warehouses", "inventory",
        "sales", "sale_items", "sale_returns", "sale_return_items",
        "orders", "order_items",
        "purchase_invoices", "purchase_items", "purchase_extra_costs",
        "stock_transfers", "stock_transfer_lines",
        "stocktakes", "stocktake_items",
        "shifts", "expenses", "cash_ledger", "bank_ledger",
        "payroll_runs", "payroll_details", "employee_advances", "employee_deductions",
        "audit_log",
      ];
      const jsonData: Record<string, any[]> = {};
      for (const table of tables) {
        try {
          const result = await pool.query(`SELECT * FROM "${table}"`);
          jsonData[table] = result.rows;
        } catch {
          jsonData[table] = [];
        }
      }

      const settingsRows = jsonData["settings"] || [];
      const configObj: Record<string, string> = {};
      for (const row of settingsRows) {
        if (row.key && row.value !== undefined) {
          configObj[row.key] = row.value;
        }
      }

      let totalRows = 0;
      const tableCounts: Record<string, number> = {};
      for (const [table, rows] of Object.entries(jsonData)) {
        tableCounts[table] = rows.length;
        totalRows += rows.length;
      }

      const metadata = {
        system: "لمسة أنوثة ERP",
        version: "1.0",
        createdAt: now.toISOString(),
        filename,
        databaseDump: dumpSuccess,
        dumpError: dumpError || null,
        totalTables: Object.keys(jsonData).length,
        totalRows,
        tableCounts,
        postgresVersion: null as string | null,
      };

      try {
        const pgVersion = await pool.query("SELECT version()");
        metadata.postgresVersion = pgVersion.rows[0]?.version || null;
      } catch {}

      await new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(filepath);
        const archive = archiver("zip", { zlib: { level: 6 } });

        output.on("close", resolve);
        archive.on("error", reject);
        archive.pipe(output);

        if (dumpSuccess && fs.existsSync(dumpPath)) {
          archive.file(dumpPath, { name: "database/dump.sql" });
        }
        archive.append(JSON.stringify(jsonData, null, 2), { name: "database/data.json" });

        archive.append(JSON.stringify(configObj, null, 2), { name: "config/settings.json" });

        archive.append(JSON.stringify(metadata, null, 2), { name: "metadata.json" });

        archive.append(generateRestoreReadme(), { name: "README-RESTORE.txt" });

        const uploadsDir = path.join(process.cwd(), "uploads");
        if (fs.existsSync(uploadsDir)) {
          const uploadFiles = fs.readdirSync(uploadsDir);
          for (const file of uploadFiles) {
            const filePath = path.join(uploadsDir, file);
            if (fs.statSync(filePath).isFile()) {
              archive.file(filePath, { name: `uploads/${file}` });
            }
          }
          const subDirs = ["original", "processed", "invoices"];
          for (const sub of subDirs) {
            const subPath = path.join(uploadsDir, sub);
            if (fs.existsSync(subPath) && fs.statSync(subPath).isDirectory()) {
              archive.directory(subPath, `uploads/${sub}`);
            }
          }
        }

        archive.finalize();
      });

      if (fs.existsSync(dumpPath)) {
        fs.unlinkSync(dumpPath);
      }

      const stat = fs.statSync(filepath);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`[Backup] اكتمل إنشاء النسخة: ${filename} (${(stat.size / 1024 / 1024).toFixed(2)} MB) في ${duration} ثانية`);

      res.json({
        success: true,
        filename,
        size: stat.size,
        createdAt: now.toISOString(),
        duration: parseFloat(duration),
        databaseDump: dumpSuccess,
        totalTables: Object.keys(jsonData).length,
        totalRows,
      });
    } catch (err: any) {
      console.error(`[Backup] فشل إنشاء النسخة الاحتياطية:`, err);
      res.status(500).json({ message: err.message || "فشل إنشاء النسخة الاحتياطية" });
    }
  });

  app.get("/api/settings/backups", requireOwnerOrAdmin, async (_req: Request, res: Response) => {
    try {
      ensureBackupDir();
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith(".zip") && f.startsWith("lamsat-backup-"))
        .map(f => {
          const stat = fs.statSync(path.join(BACKUP_DIR, f));
          return {
            filename: f,
            size: stat.size,
            createdAt: stat.mtime.toISOString(),
          };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json(files);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/settings/backup/download/:filename", requireOwnerOrAdmin, (req: Request, res: Response) => {
    const clean = sanitizeFilename(req.params.filename);
    if (!clean) {
      return res.status(400).json({ message: "اسم ملف غير صالح" });
    }
    const filepath = path.join(BACKUP_DIR, clean);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ message: "الملف غير موجود" });
    }
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${clean}"`);
    const stream = fs.createReadStream(filepath);
    stream.pipe(res);
  });

  app.delete("/api/settings/backup/:filename", requireOwnerOrAdmin, (req: Request, res: Response) => {
    const clean = sanitizeFilename(req.params.filename);
    if (!clean) {
      return res.status(400).json({ message: "اسم ملف غير صالح" });
    }
    const filepath = path.join(BACKUP_DIR, clean);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ message: "الملف غير موجود" });
    }
    fs.unlinkSync(filepath);
    console.log(`[Backup] تم حذف النسخة: ${clean}`);
    res.json({ success: true });
  });

  app.post("/api/settings/backup/validate/:filename", requireOwnerOrAdmin, async (req: Request, res: Response) => {
    const clean = sanitizeFilename(req.params.filename);
    if (!clean) {
      return res.status(400).json({ message: "اسم ملف غير صالح" });
    }
    const filepath = path.join(BACKUP_DIR, clean);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ message: "الملف غير موجود" });
    }

    const checks: { name: string; passed: boolean; details: string }[] = [];
    const stat = fs.statSync(filepath);

    checks.push({
      name: "file_exists",
      passed: true,
      details: `الملف موجود: ${clean}`,
    });

    checks.push({
      name: "file_size",
      passed: stat.size > 1000,
      details: `حجم الملف: ${(stat.size / 1024).toFixed(1)} KB`,
    });

    try {
      const zip = new AdmZip(filepath);
      const entries = zip.getEntries().map((e: any) => e.entryName);

      const hasDump = entries.some((e: string) => e === "database/dump.sql");
      checks.push({
        name: "database_dump",
        passed: hasDump,
        details: hasDump ? "يحتوي على dump.sql" : "لا يحتوي على dump.sql (البيانات في data.json)",
      });

      const hasDataJson = entries.some((e: string) => e === "database/data.json");
      checks.push({
        name: "data_json",
        passed: hasDataJson,
        details: hasDataJson ? "يحتوي على data.json" : "لا يحتوي على data.json",
      });

      if (hasDataJson) {
        try {
          const dataEntry = zip.getEntry("database/data.json");
          const jsonContent = JSON.parse(dataEntry.getData().toString("utf8"));
          const tableCount = Object.keys(jsonContent).length;
          let rowCount = 0;
          for (const rows of Object.values(jsonContent)) {
            if (Array.isArray(rows)) rowCount += rows.length;
          }
          checks.push({
            name: "data_content",
            passed: tableCount > 0 && rowCount > 0,
            details: `${tableCount} جدول، ${rowCount} سجل`,
          });
        } catch {
          checks.push({ name: "data_content", passed: false, details: "فشل قراءة data.json" });
        }
      }

      const hasMetadata = entries.some((e: string) => e === "metadata.json");
      checks.push({
        name: "metadata",
        passed: hasMetadata,
        details: hasMetadata ? "يحتوي على metadata.json" : "لا يحتوي على metadata.json",
      });

      const hasReadme = entries.some((e: string) => e === "README-RESTORE.txt");
      checks.push({
        name: "readme",
        passed: hasReadme,
        details: hasReadme ? "يحتوي على README-RESTORE.txt" : "لا يحتوي على README-RESTORE.txt",
      });

      const hasUploads = entries.some((e: string) => e.startsWith("uploads/"));
      checks.push({
        name: "uploads",
        passed: true,
        details: hasUploads
          ? `يحتوي على ملفات مرفوعة (${entries.filter((e: string) => e.startsWith("uploads/")).length} ملف)`
          : "لا توجد ملفات مرفوعة (طبيعي إذا لم تكن موجودة)",
      });
    } catch (err: any) {
      checks.push({
        name: "zip_integrity",
        passed: false,
        details: `فشل فتح ملف ZIP: ${err.message}`,
      });
    }

    const allPassed = checks.every(c => c.passed);
    res.json({ valid: allPassed, checks });
  });
}
