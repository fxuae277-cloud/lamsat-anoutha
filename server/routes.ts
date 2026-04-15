// cache-bust: 2026-04-05
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { logger } from "./logger";
import { storage } from "./storage";
import { db, pool } from "./db";
import { and, eq, desc, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { 
  insertBranchSchema, insertCategorySchema, insertProductSchema,
  insertCustomerSchema, insertSupplierSchema, insertExpenseSchema,
  insertEmployeeSchema, insertOrderSchema, insertSaleSchema,
  insertInventoryTransferSchema, insertCitySchema, insertUserSchema,
  insertWarehouseSchema, insertShiftSchema, insertPurchaseInvoiceSchema,
  shifts,
  PAYMENT_METHODS, type PaymentMethod,
  insertPayrollRunSchema, insertEmployeeAdvanceSchema, insertEmployeeDeductionSchema,
} from "@shared/schema";
import {
  formatZodError,
  loginSchema,
  createUserSchema, updateUserSchema,
  createProductSchema, updateProductSchema,
  createProductVariantSchema, updateProductVariantSchema, quickCreateVariantSchema,
  addPurchaseItemSchema, patchPurchaseStatusSchema,
  updateCustomerSchema,
  orderItemSchema, orderStatusSchema,
  createCategorySchema, updateCategorySchema,
} from "./validation";
import { registerExportRoutes } from "./exports";
import { journalForSale, journalForExpense, journalForPurchase, journalForSaleReturn, journalForSupplierPayment, journalForSalaryPayment } from "./autoJournal";
import { registerBackupRoutes } from "./backup";
import { registerMobileRoutes } from "./mobile-routes";
import { saveUploadedFile, parseInvoiceFile } from "./ocr";
import { authLimiter, passwordLimiter, uploadLimiter } from "./middleware/rateLimiter";
import { requireAuth, requireOwnerOrAdmin, requireRole, requireManager, enforceBranchScope, requirePermission } from "./middleware/auth";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".pdf"];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

declare global {
  namespace Express {
    interface Request {
      branchScope?: { mode: "company" | "branch"; branchId: number | null };
    }
  }
}


export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/auth/login", authLimiter, async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: formatZodError(parsed.error) });
    const { username, password } = parsed.data;

    // Bypass Drizzle ORM — use raw pool query with .trim() on username
    // Aliases map DB snake_case columns to the camelCase shape the rest of the
    // code and the frontend expect (same shape Drizzle would return).
    const rawResult = await pool.query(
      `SELECT id, username, password, name, role, pin, phone, salary,
              salary_type             AS "salaryType",
              commission_rate         AS "commissionRate",
              branch_id               AS "branchId",
              terminal_name           AS "terminalName",
              is_active               AS "isActive",
              ui_language             AS "uiLanguage",
              employment_status       AS "employmentStatus",
              opening_advance_balance AS "openingAdvanceBalance",
              opening_payable_balance AS "openingPayableBalance",
              failed_login_count      AS "failedLoginCount",
              locked_until            AS "lockedUntil"
       FROM users WHERE username = $1`,
      [username.trim()]
    );
    const user = rawResult.rows[0];

    if (!user) {
      logger.warn("failed_login", { username, reason: "user_not_found", ip: req.ip });
      return res.status(401).json({ message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    }

    // ── فحص قفل الحساب ──────────────────────────────────────────────────────
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const remaining = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
      logger.warn("failed_login", { username, reason: "account_locked", ip: req.ip });
      return res.status(403).json({
        message: `الحساب مقفل مؤقتاً. حاول مجدداً بعد ${remaining} دقيقة`,
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      // ── زيادة عداد المحاولات الفاشلة ──────────────────────────────────────
      const newCount = (user.failedLoginCount || 0) + 1;
      const MAX_ATTEMPTS = 5;
      const LOCK_MINUTES = 15;
      if (newCount >= MAX_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
        await pool.query(
          `UPDATE users SET failed_login_count = $1, locked_until = $2 WHERE id = $3`,
          [newCount, lockUntil, user.id]
        );
        logger.warn("account_locked", { username, attempts: newCount, ip: req.ip });
        return res.status(403).json({
          message: `تم قفل الحساب بعد ${MAX_ATTEMPTS} محاولات فاشلة. حاول مجدداً بعد ${LOCK_MINUTES} دقيقة`,
        });
      } else {
        await pool.query(
          `UPDATE users SET failed_login_count = $1 WHERE id = $2`,
          [newCount, user.id]
        );
        logger.warn("failed_login", { username, reason: "wrong_password", attempts: newCount, ip: req.ip });
        return res.status(401).json({
          message: `اسم المستخدم أو كلمة المرور غير صحيحة (${newCount}/${MAX_ATTEMPTS} محاولات)`,
        });
      }
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "الحساب معطّل" });
    }

    // ── تسجيل دخول ناجح: إعادة تعيين العداد ─────────────────────────────────
    await pool.query(
      `UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login = NOW() WHERE id = $1`,
      [user.id]
    );

    req.session.userId = user.id;
    const { password: _, failedLoginCount: __, lockedUntil: ___, ...safeUser } = user;
    req.session.save((err) => {
      if (err) {
        console.error("[login] session.save() FAILED:", err?.message, err?.stack);
        logger.error("session_save_error", { message: err?.message, stack: err?.stack });
        return res.status(500).json({ message: "خطأ في حفظ الجلسة", detail: err?.message });
      }
      res.json({ user: safeUser });
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ message: "تم تسجيل الخروج" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    // Debug: helps trace session issues on Railway
    if (!req.session.userId) {
      console.log("[/api/auth/me] 401 — sessionID:", req.sessionID,
        "| cookie header:", req.headers.cookie ? "PRESENT" : "MISSING",
        "| session keys:", Object.keys(req.session));
      return res.status(401).json({ message: "غير مصرح" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !user.isActive) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "غير مصرح" });
    }
    const branch = user.branchId ? await storage.getBranch(user.branchId) : null;
    const { password: _, ...safeUser } = user;
    res.json({ user: { ...safeUser, branchName: branch ? (branch.address ? `${branch.name} - ${branch.address}` : branch.name) : "" } });
  });

  app.patch("/api/me/settings", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { uiLanguage } = req.body;
      if (uiLanguage && (uiLanguage === "ar" || uiLanguage === "en")) {
        await pool.query("UPDATE users SET ui_language = $1 WHERE id = $2", [uiLanguage, userId]);
      }
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "المستخدم غير موجود" });
      const { password: _, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/settings", requireAuth, async (_req, res) => {
    try {
      const result = await pool.query("SELECT key, value FROM settings");
      const settings: Record<string, string> = {};
      for (const row of result.rows) settings[row.key] = row.value;
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/settings", requireOwnerOrAdmin, async (req, res) => {
    try {
      const entries = req.body as Record<string, string>;
      for (const [key, value] of Object.entries(entries)) {
        await pool.query(
          "INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()",
          [key, String(value)]
        );
      }
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      await pool.query(
        `INSERT INTO audit_log (action, entity_type, entity_id, user_id, user_name, details, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        ["update", "settings", 0, userId, user?.name || "", JSON.stringify(entries)]
      );
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/dashboard", requireAuth, async (_req, res) => {
    const stats = await storage.getDashboardStats();
    res.json(stats);
  });

  app.get("/api/branches", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "المستخدم غير موجود" });
    if (user.role === "owner" || user.role === "admin") {
      res.json(await storage.getBranches());
    } else {
      if (user.branchId) {
        const branch = await storage.getBranch(user.branchId);
        res.json(branch ? [branch] : []);
      } else {
        res.json([]);
      }
    }
  });
  app.post("/api/branches", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    const parsed = insertBranchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createBranch(parsed.data));
  });
  app.patch("/api/branches/:id", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    const row = await storage.updateBranch(Number(req.params.id), req.body);
    if (!row) return res.status(404).json({ message: "لم يتم العثور على الفرع" });
    res.json(row);
  });
  app.delete("/api/branches/:id", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    const branchId = Number(req.params.id);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // فكّ الروابط قبل الحذف
      await client.query(`UPDATE locations       SET branch_id = NULL WHERE branch_id = $1`, [branchId]);
      await client.query(`UPDATE users           SET branch_id = NULL WHERE branch_id = $1`, [branchId]);
      await client.query(`UPDATE employees       SET branch_id = NULL WHERE branch_id = $1`, [branchId]);
      await client.query(`UPDATE shifts          SET branch_id = NULL WHERE branch_id = $1`, [branchId]);
      await client.query(`UPDATE sales           SET branch_id = NULL WHERE branch_id = $1`, [branchId]);
      await client.query(`UPDATE expenses        SET branch_id = NULL WHERE branch_id = $1`, [branchId]);
      await client.query(`UPDATE orders            SET branch_id = NULL WHERE branch_id = $1`, [branchId]).catch(() => {});
      await client.query(`UPDATE purchase_invoices SET branch_id = NULL WHERE branch_id = $1`, [branchId]).catch(() => {});
      await client.query(`UPDATE inventory_transactions SET branch_id = NULL WHERE branch_id = $1`, [branchId]).catch(() => {});
      await client.query(`UPDATE cash_ledger       SET branch_id = NULL WHERE branch_id = $1`, [branchId]).catch(() => {});
      await client.query(`UPDATE bank_ledger       SET branch_id = NULL WHERE branch_id = $1`, [branchId]).catch(() => {});
      await client.query(`UPDATE journal_entries   SET branch_id = NULL WHERE branch_id = $1`, [branchId]).catch(() => {});
      await client.query(`DELETE FROM branches WHERE id = $1`, [branchId]);
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (e: any) {
      await client.query("ROLLBACK");
      res.status(400).json({ message: e?.message ?? "لا يمكن حذف الفرع" });
    } finally {
      client.release();
    }
  });

  app.get("/api/cities", requireAuth, async (_req, res) => {
    res.json(await storage.getCities());
  });
  app.post("/api/cities", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    const parsed = insertCitySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createCity(parsed.data));
  });

  app.post("/api/auth/change-password", requireAuth, passwordLimiter, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "كلمة المرور القديمة والجديدة مطلوبتان" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل" });
    }
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(404).json({ message: "المستخدم غير موجود" });
    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) return res.status(401).json({ message: "كلمة المرور القديمة غير صحيحة" });
    const hashed = await bcrypt.hash(newPassword, 10);
    await storage.updateUser(user.id, { password: hashed });
    res.json({ message: "تم تغيير كلمة المرور بنجاح" });
  });

  app.get("/api/users", requireOwnerOrAdmin, async (_req, res) => {
    const allUsers = await storage.getUsers();
    res.json(allUsers.map(({ password: _, ...u }) => u));
  });
  app.post("/api/users", requireOwnerOrAdmin, async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: formatZodError(parsed.error) });
    const { name, username, password, role, branchId, terminalName, isActive, pin, phone, salary } = parsed.data;
    const existing = await storage.getUserByUsername(username);
    if (existing) {
      return res.status(409).json({ message: "اسم المستخدم مستخدم بالفعل" });
    }
    if (pin) {
      const pinUser = await storage.getUserByPin(pin);
      if (pinUser) return res.status(409).json({ message: "رقم PIN مستخدم بالفعل من موظف آخر" });
    }
    const hashed = await bcrypt.hash(password, 10);
    const { password: _, ...safeUser } = await storage.createUser({
      name,
      username,
      password: hashed,
      role: role || "employee",
      branchId: branchId ? Number(branchId) : 1,
      terminalName: terminalName || "T1",
      isActive: isActive !== undefined ? isActive : true,
      pin: pin || null,
      phone: phone || null,
      salary: salary ? String(salary) : "0",
    });
    res.status(201).json(safeUser);
  });
  app.patch("/api/users/:id", requireOwnerOrAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: formatZodError(parsed.error) });
    const { name, role, branchId, terminalName, isActive, pin, phone, salary, salaryType, commissionRate, employmentStatus, openingAdvanceBalance, openingPayableBalance } = req.body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = parsed.data.name;
    if (role !== undefined) updateData.role = parsed.data.role;
    if (branchId !== undefined) updateData.branchId = Number(branchId);
    if (terminalName !== undefined) updateData.terminalName = terminalName;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (pin !== undefined) {
      if (pin) {
        const pinUser = await storage.getUserByPin(pin);
        if (pinUser && pinUser.id !== id) return res.status(409).json({ message: "رقم PIN مستخدم بالفعل" });
      }
      updateData.pin = pin || null;
    }
    if (phone !== undefined) updateData.phone = phone || null;
    if (salary !== undefined) updateData.salary = String(salary);
    if (salaryType !== undefined) updateData.salaryType = salaryType;
    if (commissionRate !== undefined) updateData.commissionRate = String(commissionRate);
    if (employmentStatus !== undefined) updateData.employmentStatus = employmentStatus;
    if (openingAdvanceBalance !== undefined) updateData.openingAdvanceBalance = String(openingAdvanceBalance);
    if (openingPayableBalance !== undefined) updateData.openingPayableBalance = String(openingPayableBalance);
    const updated = await storage.updateUser(id, updateData);
    if (!updated) return res.status(404).json({ message: "المستخدم غير موجود" });
    const { password: _, ...safeUser } = updated;
    res.json(safeUser);
  });
  app.post("/api/users/verify-pin", requireAuth, async (req, res) => {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ message: "رقم PIN مطلوب" });
    const user = await storage.getUserByPin(pin);
    if (!user) return res.status(404).json({ message: "رقم PIN غير صحيح" });
    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  });
  app.patch("/api/users/:id/reset-password", requireOwnerOrAdmin, passwordLimiter, async (req, res) => {
    const id = Number(req.params.id);
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
    }
    const targetUser = await storage.getUser(id);
    if (!targetUser) return res.status(404).json({ message: "المستخدم غير موجود" });
    const hashed = await bcrypt.hash(newPassword, 10);
    await storage.updateUser(id, { password: hashed });
    const actor = req.session?.user;
    await storage.addAuditLog({
      action: "password_reset",
      entityType: "user",
      entityId: id,
      branchId: targetUser.branchId,
      userId: actor?.id ?? null,
      userName: actor?.name ?? null,
      details: `إعادة تعيين كلمة مرور الموظف "${targetUser.name}" بواسطة ${actor?.name || "غير معروف"}`,
      oldValue: null,
      newValue: null,
    });
    res.json({ message: "تم إعادة تعيين كلمة المرور بنجاح" });
  });

  app.get("/api/dashboard/executive", requireOwnerOrAdmin, async (req, res) => {
    try {
      const branchId = req.query.branch_id ? Number(req.query.branch_id) : null;
      const from = (req.query.from as string) || new Date().toISOString().slice(0, 10);
      const to = (req.query.to as string) || new Date().toISOString().slice(0, 10);
      // $1=from, $2=to, $3=branchId (null = all branches)
      const p3 = [from, to, branchId];

      const kpiQ = await pool.query(`
        SELECT
          COALESCE(SUM(total),0) AS revenue,
          COALESCE(SUM(cogs_total),0) AS cogs,
          COALESCE(SUM(total - cogs_total),0) AS gross_profit,
          ROUND(CASE WHEN COALESCE(SUM(total),0)=0 THEN 0
               ELSE (COALESCE(SUM(total - cogs_total),0)/SUM(total))*100 END, 2) AS margin_percent,
          ROUND(COALESCE(AVG(total),0),3) AS avg_invoice,
          COUNT(*)::int AS invoice_count
        FROM sales
        WHERE DATE(created_at) >= $1::date AND DATE(created_at) <= $2::date
          AND ($3::int IS NULL OR branch_id = $3::int)
      `, p3);

      const expQ = await pool.query(`
        SELECT
          COALESCE(SUM(amount::numeric),0) AS total_expenses,
          COALESCE(SUM(CASE WHEN source='cash' THEN amount::numeric ELSE 0 END),0) AS cash_expenses
        FROM expenses e
        WHERE e.date >= $1::date AND e.date <= $2::date
          AND ($3::int IS NULL OR e.branch_id = $3::int)
      `, p3);

      const cashSalesQ = await pool.query(`
        SELECT COALESCE(SUM(total),0) AS cash_sales
        FROM sales
        WHERE payment_method='cash'
          AND DATE(created_at) >= $1::date AND DATE(created_at) <= $2::date
          AND ($3::int IS NULL OR branch_id = $3::int)
      `, p3);

      const paymentQ = await pool.query(`
        SELECT payment_method, COALESCE(SUM(total),0) AS amount, COUNT(*)::int AS cnt
        FROM sales
        WHERE DATE(created_at) >= $1::date AND DATE(created_at) <= $2::date
          AND ($3::int IS NULL OR branch_id = $3::int)
        GROUP BY payment_method ORDER BY amount DESC
      `, p3);

      // Calculate previous period (same duration, immediately before `from`)
      const periodDays = Math.round((new Date(to).getTime() - new Date(from + "T00:00:00").getTime()) / 86400000) + 1;
      const prevToDate = new Date(from + "T00:00:00"); prevToDate.setDate(prevToDate.getDate() - 1);
      const prevFromDate = new Date(prevToDate); prevFromDate.setDate(prevFromDate.getDate() - periodDays + 1);
      const prevFromStr = prevFromDate.toISOString().slice(0, 10);
      const prevToStr = prevToDate.toISOString().slice(0, 10);
      const pPrev = [prevFromStr, prevToStr, branchId];

      const prevSalesQ = await pool.query(`
        SELECT
          COALESCE(SUM(total),0) AS sales,
          COALESCE(SUM(total - cogs_total),0) AS gross_profit
        FROM sales
        WHERE DATE(created_at) >= $1::date AND DATE(created_at) <= $2::date
          AND ($3::int IS NULL OR branch_id = $3::int)
      `, pPrev);

      const prevExpPeriodQ = await pool.query(`
        SELECT COALESCE(SUM(amount::numeric),0) AS expenses
        FROM expenses e
        WHERE e.date >= $1::date AND e.date <= $2::date
          AND ($3::int IS NULL OR e.branch_id = $3::int)
      `, pPrev);

      const timeseriesQ = await pool.query(`
        WITH dates AS (
          SELECT generate_series($1::date, $2::date, '1 day'::interval)::date AS d
        ),
        daily_sales AS (
          SELECT DATE(created_at) AS d, COALESCE(SUM(total),0) AS sales, COALESCE(SUM(cogs_total),0) AS cogs
          FROM sales
          WHERE DATE(created_at) >= $1::date AND DATE(created_at) <= $2::date
            AND ($3::int IS NULL OR branch_id = $3::int)
          GROUP BY DATE(created_at)
        ),
        daily_exp AS (
          SELECT e.date::date AS d, COALESCE(SUM(amount::numeric),0) AS expenses
          FROM expenses e
          WHERE e.date >= $1::date AND e.date <= $2::date
            AND ($3::int IS NULL OR e.branch_id = $3::int)
          GROUP BY e.date
        )
        SELECT dates.d::text AS date,
          COALESCE(ds.sales,0) AS sales,
          COALESCE(ds.cogs,0) AS cogs,
          COALESCE(de.expenses,0) AS expenses,
          COALESCE(ds.sales,0) - COALESCE(ds.cogs,0) - COALESCE(de.expenses,0) AS net
        FROM dates
        LEFT JOIN daily_sales ds ON ds.d=dates.d
        LEFT JOIN daily_exp de ON de.d=dates.d
        ORDER BY dates.d
      `, p3);

      const topProductsQ = await pool.query(`
        SELECT si.product_id, p.name,
          COALESCE(SUM(si.quantity),0)::int AS qty_sold,
          COALESCE(SUM(si.total),0) AS revenue,
          COALESCE(SUM(si.line_cogs),0) AS cogs,
          COALESCE(SUM(si.total - si.line_cogs),0) AS profit
        FROM sale_items si
        JOIN sales s ON s.id=si.sale_id
        JOIN products p ON p.id=si.product_id
        WHERE DATE(s.created_at) >= $1::date AND DATE(s.created_at) <= $2::date
          AND ($3::int IS NULL OR s.branch_id = $3::int)
        GROUP BY si.product_id, p.name
        ORDER BY revenue DESC LIMIT 10
      `, p3);

      const branchPerfQ = await pool.query(`
        SELECT s.branch_id, (b.name || CASE WHEN b.address IS NOT NULL AND b.address <> '' THEN ' - ' || b.address ELSE '' END) AS branch_name,
          COALESCE(SUM(s.total),0) AS revenue,
          COALESCE(SUM(s.cogs_total),0) AS cogs,
          COALESCE(SUM(s.total - s.cogs_total),0) AS gross_profit,
          COUNT(s.id)::int AS invoice_count,
          ROUND(COALESCE(AVG(s.total),0),3) AS avg_invoice
        FROM sales s
        JOIN branches b ON b.id=s.branch_id
        WHERE DATE(s.created_at) >= $1::date AND DATE(s.created_at) <= $2::date
          AND ($3::int IS NULL OR s.branch_id = $3::int)
        GROUP BY s.branch_id, b.name, b.address ORDER BY revenue DESC
      `, p3);

      const branchExpQ = await pool.query(`
        SELECT e.branch_id, COALESCE(SUM(e.amount::numeric),0) AS expenses
        FROM expenses e
        WHERE e.date >= $1::date AND e.date <= $2::date
          AND ($3::int IS NULL OR e.branch_id = $3::int)
        GROUP BY e.branch_id
      `, p3);
      const branchExpMap: Record<number, number> = {};
      branchExpQ.rows.forEach((r: any) => { branchExpMap[r.branch_id] = parseFloat(r.expenses); });

      const recentExpQ = await pool.query(`
        SELECT e.id, e.branch_id, (b.name || CASE WHEN b.address IS NOT NULL AND b.address <> '' THEN ' - ' || b.address ELSE '' END) AS branch_name, e.category, e.amount, e.source, e.notes, e.date,
          e.created_at, u.name AS created_by_name
        FROM expenses e
        LEFT JOIN branches b ON b.id=e.branch_id
        LEFT JOIN users u ON u.id=e.created_by
        WHERE e.date >= $1::date AND e.date <= $2::date
          AND ($3::int IS NULL OR e.branch_id = $3::int)
        ORDER BY e.created_at DESC LIMIT 20
      `, p3);

      const lowStockQ = await pool.query(`
        SELECT li.product_id, p.name,
          SUM(li.qty_on_hand)::int AS total_qty,
          MAX(li.reorder_level)::int AS reorder_level
        FROM location_inventory li
        JOIN products p ON p.id=li.product_id
        JOIN locations l ON l.id=li.location_id
        WHERE ($1::int IS NULL OR l.branch_id = $1::int)
        GROUP BY li.product_id, p.name
        HAVING SUM(li.qty_on_hand) <= MAX(li.reorder_level)
        ORDER BY total_qty ASC LIMIT 50
      `, [branchId]);

      const invValueQ = await pool.query(`
        WITH last_cost AS (
          SELECT DISTINCT ON (pi.product_id)
            pi.product_id,
            COALESCE(NULLIF(pi.unit_cost_final::numeric, 0), pi.unit_cost_base::numeric, 0) AS unit_cost
          FROM purchase_items pi
          JOIN purchase_invoices pv ON pv.id = pi.purchase_id
          WHERE pv.status = 'approved'
            AND (pi.unit_cost_final IS NOT NULL OR pi.unit_cost_base IS NOT NULL)
          ORDER BY pi.product_id, pv.invoice_date DESC, pv.id DESC, pi.id DESC
        ),
        qty AS (
          SELECT li.product_id, SUM(li.qty_on_hand) AS qty_on_hand
          FROM location_inventory li
          JOIN locations l ON l.id = li.location_id
          WHERE li.qty_on_hand > 0
            AND ($1::int IS NULL OR l.branch_id = $1::int)
          GROUP BY li.product_id
        )
        SELECT COALESCE(SUM(qty.qty_on_hand * COALESCE(last_cost.unit_cost, 0)), 0) AS value,
               COUNT(DISTINCT qty.product_id) AS product_count
        FROM qty
        LEFT JOIN last_cost ON last_cost.product_id = qty.product_id
      `, [branchId]);

      const k = kpiQ.rows[0];
      const ex = expQ.rows[0];
      const grossProfit = parseFloat(k.gross_profit);
      const totalExpenses = parseFloat(ex.total_expenses);
      const netProfit = grossProfit - totalExpenses;
      const cashSales = parseFloat(cashSalesQ.rows[0].cash_sales);
      const cashExp = parseFloat(ex.cash_expenses);
      const netCash = cashSales - cashExp;

      const prevSales = parseFloat(prevSalesQ.rows[0].sales);
      const prevExpenses = parseFloat(prevExpPeriodQ.rows[0].expenses);
      const prevNet = parseFloat(prevSalesQ.rows[0].gross_profit) - prevExpenses;

      res.json({
        kpi: {
          revenue: parseFloat(k.revenue),
          cogs: parseFloat(k.cogs),
          grossProfit,
          marginPercent: parseFloat(k.margin_percent),
          avgInvoice: parseFloat(k.avg_invoice),
          invoiceCount: k.invoice_count,
          totalExpenses,
          netProfit,
          netCash,
          inventoryValue: parseFloat(invValueQ.rows[0].value),
          lowStockCount: lowStockQ.rows.length,
        },
        todayVsYesterday: {
          today: { sales: parseFloat(k.revenue), expenses: totalExpenses, net: netProfit },
          yesterday: { sales: prevSales, expenses: prevExpenses, net: prevNet },
          prevFrom: prevFromStr,
          prevTo: prevToStr,
        },
        paymentSplit: paymentQ.rows.map(r => ({ method: r.payment_method, amount: parseFloat(r.amount), count: r.cnt })),
        timeseries: timeseriesQ.rows.map(r => ({
          date: r.date, sales: parseFloat(r.sales), expenses: parseFloat(r.expenses), net: parseFloat(r.net),
        })),
        topProducts: topProductsQ.rows.map(r => ({
          productId: r.product_id, name: r.name, qtySold: r.qty_sold,
          revenue: parseFloat(r.revenue), cogs: parseFloat(r.cogs), profit: parseFloat(r.profit),
        })),
        branchPerformance: branchPerfQ.rows.map(r => {
          const bExp = branchExpMap[r.branch_id] || 0;
          return {
            branchId: r.branch_id, branchName: r.branch_name,
            revenue: parseFloat(r.revenue), cogs: parseFloat(r.cogs),
            grossProfit: parseFloat(r.gross_profit), expenses: bExp,
            netProfit: parseFloat(r.gross_profit) - bExp,
            invoiceCount: r.invoice_count, avgInvoice: parseFloat(r.avg_invoice),
          };
        }),
        recentExpenses: recentExpQ.rows.map(r => ({
          id: r.id, branchName: r.branch_name, category: r.category,
          amount: parseFloat(r.amount), source: r.source, notes: r.notes,
          date: r.date, createdAt: r.created_at, createdByName: r.created_by_name,
        })),
        lowStock: lowStockQ.rows.map(r => ({
          productId: r.product_id, name: r.name, totalQty: r.total_qty, reorderLevel: r.reorder_level,
        })),
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "خطأ في جلب البيانات" });
    }
  });

  app.get("/api/dashboard/executive-plus", requireOwnerOrAdmin, async (req, res) => {
    try {
      const branchId = req.query.branch_id ? Number(req.query.branch_id) : null;
      // $1=branchId (null = all branches)
      const pb = [branchId];

      const todayKpi = await pool.query(`
        SELECT
          COALESCE(SUM(total),0) AS revenue,
          COALESCE(SUM(cogs_total),0) AS cogs,
          COALESCE(SUM(total - cogs_total),0) AS profit,
          ROUND(CASE WHEN COALESCE(SUM(total),0)=0 THEN 0
               ELSE (COALESCE(SUM(total - cogs_total),0)/SUM(total))*100 END, 2) AS margin_percent,
          ROUND(COALESCE(AVG(total),0),3) AS avg_invoice,
          COUNT(*)::int AS invoice_count
        FROM sales
        WHERE DATE(created_at)=CURRENT_DATE
          AND ($1::int IS NULL OR branch_id = $1::int)
      `, pb);

      const vsYesterday = await pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN DATE(created_at)=CURRENT_DATE THEN total ELSE 0 END),0) AS today_sales,
          COALESCE(SUM(CASE WHEN DATE(created_at)=CURRENT_DATE-1 THEN total ELSE 0 END),0) AS yesterday_sales
        FROM sales
        WHERE DATE(created_at) >= CURRENT_DATE-1
          AND ($1::int IS NULL OR branch_id = $1::int)
      `, pb);

      const monthRes = await pool.query(`
        SELECT COALESCE(SUM(total),0) AS revenue, COALESCE(SUM(total - cogs_total),0) AS profit
        FROM sales
        WHERE DATE_TRUNC('month', created_at)=DATE_TRUNC('month', CURRENT_DATE)
          AND ($1::int IS NULL OR branch_id = $1::int)
      `, pb);

      const paymentRes = await pool.query(`
        SELECT payment_method, COALESCE(SUM(total),0) AS amount
        FROM sales
        WHERE DATE(created_at)=CURRENT_DATE
          AND ($1::int IS NULL OR branch_id = $1::int)
        GROUP BY payment_method ORDER BY amount DESC
      `, pb);

      const trend7d = await pool.query(`
        SELECT d::date AS day,
          COALESCE(SUM(s.total),0) AS revenue,
          COALESCE(SUM(s.total - s.cogs_total),0) AS profit,
          ROUND(CASE WHEN COALESCE(SUM(s.total),0)=0 THEN 0
               ELSE (COALESCE(SUM(s.total - s.cogs_total),0)/SUM(s.total))*100 END,2) AS margin
        FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day') d
        LEFT JOIN sales s ON DATE(s.created_at) = d
          AND ($1::int IS NULL OR s.branch_id = $1::int)
        GROUP BY d ORDER BY d
      `, pb);

      const invValue = await pool.query(`
        WITH last_cost AS (
          SELECT DISTINCT ON (pi.product_id) pi.product_id, pi.unit_cost_final AS unit_cost
          FROM purchase_items pi JOIN purchase_invoices pv ON pv.id=pi.purchase_id
          WHERE pv.status='approved'
          ORDER BY pi.product_id, pv.invoice_date DESC, pv.id DESC, pi.id DESC
        ),
        qty AS (
          SELECT li.product_id, SUM(li.qty_on_hand) AS qty_on_hand
          FROM location_inventory li JOIN locations l ON l.id=li.location_id
          WHERE ($1::int IS NULL OR l.branch_id = $1::int)
          GROUP BY li.product_id
        )
        SELECT COALESCE(SUM(qty.qty_on_hand * COALESCE(last_cost.unit_cost,0)),0) AS value
        FROM qty LEFT JOIN last_cost ON last_cost.product_id=qty.product_id
      `, pb);

      const turnover30 = await pool.query(`
        WITH cogs30 AS (
          SELECT COALESCE(SUM(si.line_cogs),0) AS total_cogs
          FROM sale_items si JOIN sales s ON s.id=si.sale_id
          WHERE s.created_at >= CURRENT_DATE - 30
            AND ($1::int IS NULL OR s.branch_id = $1::int)
        ),
        avg_inv AS (
          WITH last_cost AS (
            SELECT DISTINCT ON (pi.product_id) pi.product_id, pi.unit_cost_final AS unit_cost
            FROM purchase_items pi JOIN purchase_invoices pv ON pv.id=pi.purchase_id
            WHERE pv.status='approved'
            ORDER BY pi.product_id, pv.invoice_date DESC, pv.id DESC, pi.id DESC
          ),
          qty AS (
            SELECT li.product_id, SUM(li.qty_on_hand) AS qty_on_hand
            FROM location_inventory li JOIN locations l ON l.id=li.location_id
            WHERE ($1::int IS NULL OR l.branch_id = $1::int)
            GROUP BY li.product_id
          )
          SELECT COALESCE(SUM(qty.qty_on_hand * COALESCE(last_cost.unit_cost,0)),0) AS avg_value
          FROM qty LEFT JOIN last_cost ON last_cost.product_id=qty.product_id
        )
        SELECT CASE WHEN avg_inv.avg_value = 0 THEN 0
             ELSE ROUND((cogs30.total_cogs / avg_inv.avg_value)::numeric, 2) END AS turnover
        FROM cogs30, avg_inv
      `, pb);

      const topProfit7d = await pool.query(`
        SELECT si.product_id, p.name,
          COALESCE(SUM(si.quantity),0)::int AS qty_sold,
          COALESCE(SUM(si.total),0) AS revenue,
          COALESCE(SUM(si.line_cogs),0) AS cogs,
          COALESCE(SUM(si.total - si.line_cogs),0) AS profit
        FROM sale_items si
        JOIN sales s ON s.id=si.sale_id
        JOIN products p ON p.id=si.product_id
        WHERE s.created_at >= CURRENT_DATE - 7
          AND ($1::int IS NULL OR s.branch_id = $1::int)
        GROUP BY si.product_id, p.name
        ORDER BY profit DESC LIMIT 3
      `, pb);

      const cashiers = await pool.query(`
        SELECT s.cashier_id, u.name AS cashier_name,
          COUNT(DISTINCT s.id)::int AS invoices_count,
          COALESCE(SUM(s.total),0) AS revenue,
          COALESCE(SUM(s.cogs_total),0) AS cogs,
          COALESCE(SUM(s.total - s.cogs_total),0) AS profit
        FROM sales s LEFT JOIN users u ON u.id=s.cashier_id
        WHERE DATE(s.created_at)=CURRENT_DATE
          AND ($1::int IS NULL OR s.branch_id = $1::int)
        GROUP BY s.cashier_id, u.name ORDER BY revenue DESC
      `, pb);

      const lowStock = await pool.query(`
        SELECT li.product_id, p.name,
          SUM(li.qty_on_hand)::int AS total_qty,
          MAX(li.reorder_level)::int AS reorder_level
        FROM location_inventory li
        JOIN products p ON p.id=li.product_id
        JOIN locations l ON l.id=li.location_id
        WHERE ($1::int IS NULL OR l.branch_id = $1::int)
        GROUP BY li.product_id, p.name
        HAVING SUM(li.qty_on_hand) <= MAX(li.reorder_level)
        ORDER BY total_qty ASC LIMIT 50
      `, pb);

      const missingCogsToday = await pool.query(`
        SELECT
          COUNT(DISTINCT si.id) FILTER (WHERE COALESCE(si.unit_cost_at_sale,0) = 0) AS missing_count,
          COUNT(DISTINCT si.id) AS total_count
        FROM sale_items si JOIN sales s ON s.id=si.sale_id
        WHERE DATE(s.created_at)=CURRENT_DATE
          AND ($1::int IS NULL OR s.branch_id = $1::int)
      `, pb);

      const missingCostProducts = await pool.query(`
        WITH last_cost AS (
          SELECT DISTINCT ON (pi.product_id) pi.product_id
          FROM purchase_items pi JOIN purchase_invoices pv ON pv.id=pi.purchase_id
          WHERE pv.status='approved'
          ORDER BY pi.product_id, pv.invoice_date DESC
        )
        SELECT
          COUNT(*) FILTER (WHERE lc.product_id IS NULL) AS missing_count,
          COUNT(*) AS total_count
        FROM products p LEFT JOIN last_cost lc ON lc.product_id=p.id
      `);

      const t = todayKpi.rows[0];
      const vs = vsYesterday.rows[0];
      const todaySales = parseFloat(vs.today_sales);
      const yesterdaySales = parseFloat(vs.yesterday_sales);
      const changePercent = yesterdaySales === 0 ? null : ((todaySales - yesterdaySales) / yesterdaySales) * 100;

      const mc = missingCogsToday.rows[0];
      const mp = missingCostProducts.rows[0];
      const missingCogsPct = parseInt(mc.total_count) === 0 ? 0 : Math.round((parseInt(mc.missing_count) / parseInt(mc.total_count)) * 10000) / 100;
      const missingCostPct = parseInt(mp.total_count) === 0 ? 0 : Math.round((parseInt(mp.missing_count) / parseInt(mp.total_count)) * 10000) / 100;

      res.json({
        today: {
          revenue: parseFloat(t.revenue), cogs: parseFloat(t.cogs), profit: parseFloat(t.profit),
          margin_percent: parseFloat(t.margin_percent), avg_invoice: parseFloat(t.avg_invoice),
          invoice_count: t.invoice_count,
        },
        todayVsYesterday: {
          today_sales: todaySales, yesterday_sales: yesterdaySales,
          change_percent: changePercent !== null ? Math.round(changePercent * 100) / 100 : null,
        },
        month: { revenue: parseFloat(monthRes.rows[0].revenue), profit: parseFloat(monthRes.rows[0].profit) },
        paymentSplit: paymentRes.rows.map(r => ({ payment_method: r.payment_method, amount: parseFloat(r.amount) })),
        trend7d: trend7d.rows.map(r => ({
          day: r.day, revenue: parseFloat(r.revenue), profit: parseFloat(r.profit), margin: parseFloat(r.margin),
        })),
        inventoryValue: { value: parseFloat(invValue.rows[0].value) },
        turnover_30d: parseFloat(turnover30.rows[0].turnover),
        topProfitProducts7d: topProfit7d.rows.map(r => ({
          product_id: r.product_id, name: r.name, qty_sold: r.qty_sold,
          revenue: parseFloat(r.revenue), cogs: parseFloat(r.cogs), profit: parseFloat(r.profit),
        })),
        cashiersToday: cashiers.rows.map(r => ({
          cashier_id: r.cashier_id, cashier_name: r.cashier_name, invoices_count: r.invoices_count,
          revenue: parseFloat(r.revenue), cogs: parseFloat(r.cogs), profit: parseFloat(r.profit),
        })),
        lowStock: lowStock.rows.map(r => ({
          product_id: r.product_id, name: r.name, total_qty: r.total_qty, reorder_level: r.reorder_level,
        })),
        risk: {
          missing_cogs_today_pct: missingCogsPct,
          missing_cogs_today_count: parseInt(mc.missing_count),
          missing_cogs_today_total: parseInt(mc.total_count),
          missing_cost_pct: missingCostPct,
          missing_cost_count: parseInt(mp.missing_count),
          missing_cost_total: parseInt(mp.total_count),
        },
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "خطأ في جلب البيانات" });
    }
  });

  app.get("/api/categories", requireAuth, requirePermission("products.view"), async (req, res) => {
    const { search, parentId, isActive } = req.query;
    const filters: { search?: string; parentId?: number | null; isActive?: boolean } = {};
    if (search) filters.search = String(search);
    if (parentId !== undefined) filters.parentId = parentId === "null" ? null : Number(parentId);
    if (isActive !== undefined) filters.isActive = isActive === "true";
    res.json(await storage.getCategories(filters));
  });
  app.post("/api/categories", requireAuth, requirePermission("categories.manage"), async (req, res) => {
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: formatZodError(parsed.error) });
    res.status(201).json(await storage.createCategory(parsed.data as any));
  });
  // toggle قبل patch العام — مهم للترتيب في Express
  app.patch("/api/categories/:id/toggle", requireAuth, requirePermission("categories.manage"), async (req, res) => {
    const row = await storage.toggleCategoryActive(Number(req.params.id));
    if (!row) return res.status(404).json({ message: "الفئة غير موجودة" });
    res.json(row);
  });
  app.patch("/api/categories/:id", requireAuth, requirePermission("categories.manage"), async (req, res) => {
    const parsed = updateCategorySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: formatZodError(parsed.error) });
    const row = await storage.updateCategory(Number(req.params.id), parsed.data as any);
    if (!row) return res.status(404).json({ message: "الفئة غير موجودة" });
    res.json(row);
  });
  app.delete("/api/categories/:id", requireAuth, requirePermission("categories.manage"), async (req, res) => {
    await storage.deleteCategory(Number(req.params.id));
    res.json({ ok: true });
  });

  app.get("/api/products", requireAuth, requirePermission("products.view"), async (req, res) => {
    const { q, barcode, categoryId, productType } = req.query;
    res.json(await storage.getProducts({
      q:           q           ? String(q)           : undefined,
      barcode:     barcode     ? String(barcode)     : undefined,
      categoryId:  categoryId  ? Number(categoryId)  : undefined,
      productType: productType ? String(productType) : undefined,
    }));
  });

  app.get("/api/test-search", async (req, res) => {
    try {
      const q = req.query.q as string;
      const result = await storage.searchProducts({ q, page: 1, limit: 10 });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/products/search", requireAuth, requirePermission("products.view"), async (req, res) => {
    try {
      const q = req.query.q as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const branchId = req.user?.role === "owner" || req.user?.role === "admin" 
        ? (req.query.branchId ? parseInt(req.query.branchId as string) : undefined)
        : req.user?.branchId;

      const result = await storage.searchProducts({ q, page, limit, branchId });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── توليد باركود تلقائي حسب الفئة ──────────────────────────────────────────
  app.get("/api/products/next-barcode", requireAuth, async (req, res) => {
    try {
      const categoryId = Number(req.query.categoryId) || 0;
      const countRes = await pool.query(
        `SELECT COUNT(*) as cnt FROM products WHERE category_id = $1`,
        [categoryId || null]
      );
      const seq = (Number(countRes.rows[0]?.cnt || 0) + 1).toString().padStart(4, "0");
      const catPart = categoryId.toString().padStart(3, "0");
      const barcode = `628${catPart}${seq}`;
      // تأكد أنه غير مستخدم
      const existing = await pool.query(`SELECT id FROM products WHERE barcode = $1`, [barcode]);
      if (existing.rows.length > 0) {
        const ts = Date.now().toString().slice(-4);
        res.json({ barcode: `628${catPart}${ts}` });
      } else {
        res.json({ barcode });
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/products/:id", requireAuth, requirePermission("products.view"), async (req, res) => {
    const product = await storage.getProduct(Number(req.params.id));
    if (!product) return res.status(404).json({ message: "المنتج غير موجود" });
    const [variants, locationInventory, lastPurchaseResult, variantPricesResult] = await Promise.all([
      storage.getVariantsByProduct(product.id),
      storage.getLocationInventoryByProduct(product.id),
      // آخر سعر شراء للمنتج (من purchase_items)
      db.execute(sql`
        SELECT pi.unit_cost_final AS last_purchase_price, s.name AS last_supplier
        FROM purchase_items pi
        JOIN purchase_invoices inv ON inv.id = pi.purchase_id
        LEFT JOIN suppliers s ON s.id = inv.supplier_id
        WHERE pi.product_id = ${product.id} AND inv.status IN ('approved', 'received')
        ORDER BY inv.invoice_date DESC, inv.id DESC
        LIMIT 1
      `),
      // آخر سعر شراء لكل variant على حدة (من purchase_items بالـ variant_id)
      pool.query(`
        SELECT DISTINCT ON (pi.variant_id)
               pi.variant_id,
               pi.unit_cost_final AS last_purchase_price
        FROM purchase_items pi
        JOIN purchase_invoices inv ON inv.id = pi.purchase_id
        WHERE pi.product_id = $1
          AND pi.variant_id IS NOT NULL
          AND inv.status IN ('approved', 'received')
        ORDER BY pi.variant_id, inv.invoice_date DESC, inv.id DESC
      `, [product.id]),
    ]);
    const lp = (lastPurchaseResult.rows[0] as any) || null;
    // map: variantId → last_purchase_price من الفواتير الحقيقية
    const variantPriceMap: Record<number, string> = {};
    for (const row of variantPricesResult.rows) {
      variantPriceMap[row.variant_id] = row.last_purchase_price;
    }
    // تحديث lastPurchasePrice في كل variant بالقيمة الحقيقية من الفواتير
    const enrichedVariants = variants.map((v: any) => ({
      ...v,
      lastPurchasePrice: variantPriceMap[v.id] ?? v.lastPurchasePrice,
    }));
    res.json({
      ...product,
      variants: enrichedVariants,
      locationInventory,
      lastPurchasePrice: lp?.last_purchase_price ?? null,
      lastSupplier: lp?.last_supplier ?? null,
    });
  });
  app.get("/api/test-barcode/:code", async (req, res) => {
    try {
      const code = req.params.code;
      const product = await storage.getProductByBarcode(code);
      if (!product) return res.status(404).json({ message: "Product not found" });
      res.json({
        id: product.id,
        name: product.name,
        price: product.price,
        stock: product.totalStock,
        image: product.image
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/products/barcode/:code", requireAuth, requirePermission("products.view"), async (req, res) => {
    try {
      const code = req.params.code;
      const product = await storage.getProductByBarcode(code);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Return requested fields: id, name, price, stock, image
      res.json({
        id: product.id,
        name: product.name,
        price: product.price,
        stock: product.totalStock,
        image: product.image
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/products", requireAuth, requirePermission("products.create"), async (req, res) => {
    try {
      const parsed = createProductSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: formatZodError(parsed.error) });
      const { variants, ...productData } = parsed.data;
      // فحص تكرار الاسم
      const dupName = await pool.query(`SELECT id FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))`, [productData.name]);
      if (dupName.rows.length > 0) return res.status(409).json({ message: `يوجد منتج بنفس الاسم "${productData.name}" بالفعل` });
      // فحص تكرار الباركود
      if (productData.barcode) {
        const dupBarcode = await pool.query(`SELECT id FROM products WHERE barcode = $1`, [productData.barcode]);
        if (dupBarcode.rows.length > 0) return res.status(409).json({ message: `الباركود "${productData.barcode}" مستخدم لمنتج آخر` });
      }
      const result = await storage.createProductWithVariants(productData as any, variants ?? []);
      res.status(201).json(result);
    } catch (err: any) {
      if (err.code === "23505") return res.status(409).json({ message: "الباركود مستخدم بالفعل" });
      res.status(500).json({ message: err?.message ?? "خطأ في إنشاء المنتج" });
    }
  });
  app.patch("/api/products/:id", requireAuth, requirePermission("products.edit"), async (req, res) => {
    try {
      const parsed = updateProductSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: formatZodError(parsed.error) });
      const productId = Number(req.params.id);
      // فحص تكرار الاسم
      if (parsed.data.name) {
        const dupName = await pool.query(
          `SELECT id FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND id <> $2`,
          [parsed.data.name, productId]
        );
        if (dupName.rows.length > 0) return res.status(409).json({ message: `يوجد منتج بنفس الاسم "${parsed.data.name}" بالفعل` });
      }
      // فحص تكرار الباركود
      if (parsed.data.barcode) {
        const dupBarcode = await pool.query(
          `SELECT id FROM products WHERE barcode = $1 AND id <> $2`,
          [parsed.data.barcode, productId]
        );
        if (dupBarcode.rows.length > 0) return res.status(409).json({ message: `الباركود "${parsed.data.barcode}" مستخدم لمنتج آخر` });
      }
      const oldProduct = await storage.getProduct(productId);
      const row = await storage.updateProduct(productId, parsed.data);
      if (!row) return res.status(404).json({ message: "المنتج غير موجود" });
      if (oldProduct && parsed.data.price !== undefined && (oldProduct.price as any) !== parsed.data.price) {
        storage.addAuditLog({
          action: "product_price_change",
          entityType: "product",
          entityId: productId,
          branchId: null,
          userId: req.session.userId ?? null,
          userName: null,
          details: `تغيير سعر المنتج "${row.name}"`,
          oldValue: JSON.stringify({ price: oldProduct.price }),
          newValue: JSON.stringify({ price: row.price }),
        }).catch(() => {});
      }
      res.json(row);
    } catch (err: any) {
      if (err.code === "23505") return res.status(409).json({ message: "الباركود مستخدم بالفعل" });
      res.status(500).json({ message: err?.message ?? "خطأ في تحديث المنتج" });
    }
  });
  app.delete("/api/products/:id", requireAuth, requirePermission("products.delete"), async (req, res) => {
    try {
      await storage.deleteProduct(Number(req.params.id));
      res.json({ message: "تم حذف المنتج" });
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "فشل حذف المنتج" });
    }
  });

  // ── Product Variants ──
  app.get("/api/products/:id/variants", requireAuth, requirePermission("products.view"), async (req, res) => {
    res.json(await storage.getVariantsByProduct(Number(req.params.id)));
  });

  /** GET /api/products/:id/next-sku — توليد SKU تلقائي للمتغير */
  app.get("/api/products/:id/next-sku", requireAuth, async (req, res) => {
    try {
      const productId = Number(req.params.id);
      const productRes = await pool.query(`SELECT category_id FROM products WHERE id = $1`, [productId]);
      if (!productRes.rows.length) return res.status(404).json({ message: "المنتج غير موجود" });
      const categoryId = productRes.rows[0].category_id || 0;
      const countRes = await pool.query(`SELECT COUNT(*) AS cnt FROM product_variants WHERE product_id = $1`, [productId]);
      const seq = (Number(countRes.rows[0].cnt) + 1).toString().padStart(2, "0");
      const catPart = categoryId.toString().padStart(3, "0");
      const prodPart = productId.toString().padStart(4, "0");
      const sku = `${catPart}-${prodPart}-${seq}`;
      // تأكد من عدم التكرار
      const existing = await pool.query(`SELECT id FROM product_variants WHERE sku = $1`, [sku]);
      if (existing.rows.length > 0) {
        const ts = Date.now().toString().slice(-2);
        res.json({ sku: `${catPart}-${prodPart}-${ts}` });
      } else {
        res.json({ sku });
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** GET /api/products/:id/variants-with-stock — variants مع المخزون حسب الفرع */
  app.get("/api/products/:id/variants-with-stock", requireAuth, async (req, res) => {
    try {
      const productId = Number(req.params.id);
      const user = await storage.getUser(req.session.userId!);
      const branchId = user?.branchId;
      const result = await pool.query(`
        SELECT
          pv.id, pv.color, pv.size, pv.price, pv.sku, pv.barcode,
          pv.is_default as "isDefault", pv.active,
          COALESCE((
            SELECT SUM(ib.qty_on_hand)
            FROM inventory_balances ib
            JOIN locations l ON l.id = ib.location_id
            WHERE ib.variant_id = pv.id AND l.branch_id = $2
          ), 0)::int AS "stockQty"
        FROM product_variants pv
        WHERE pv.product_id = $1 AND pv.active = true
        ORDER BY pv.color NULLS LAST, pv.size NULLS LAST
      `, [productId, branchId]);
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
  app.post("/api/products/:id/variants", requireAuth, requirePermission("products.create"), async (req, res) => {
    try {
      const productId = Number(req.params.id);
      const parsed = createProductVariantSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: formatZodError(parsed.error) });
      const product = await storage.getProduct(productId);
      if (!product) return res.status(404).json({ message: "المنتج غير موجود" });
      if (parsed.data.barcode) {
        const existing = await storage.getVariantByBarcode(parsed.data.barcode);
        if (existing) return res.status(400).json({ message: "الباركود مستخدم بالفعل" });
      }
      if (parsed.data.sku) {
        const existing = await storage.getVariantBySku(parsed.data.sku);
        if (existing) return res.status(400).json({ message: "رمز SKU مستخدم بالفعل" });
      }
      const variant = await storage.createVariant({ ...parsed.data, productId });
      res.status(201).json(variant);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ" });
    }
  });
  app.get("/api/variants", requireAuth, requirePermission("products.view"), async (_req, res) => {
    res.json(await storage.getAllVariants());
  });
  app.get("/api/variants/barcode/:barcode", requireAuth, requirePermission("products.view"), async (req, res) => {
    const variant = await storage.getVariantByBarcode(req.params.barcode as string);
    if (!variant) return res.status(404).json({ message: "الباركود غير موجود" });
    res.json(variant);
  });
  app.patch("/api/variants/:id", requireAuth, requirePermission("products.edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const parsed = updateProductVariantSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: formatZodError(parsed.error) });
      if (parsed.data.barcode) {
        const existing = await storage.getVariantByBarcode(parsed.data.barcode);
        if (existing && existing.id !== id) return res.status(400).json({ message: "الباركود مستخدم بالفعل" });
      }
      if (parsed.data.sku) {
        const existing = await storage.getVariantBySku(parsed.data.sku);
        if (existing && existing.id !== id) return res.status(400).json({ message: "رمز SKU مستخدم بالفعل" });
      }
      const variant = await storage.updateVariant(id, parsed.data);
      if (!variant) return res.status(404).json({ message: "المتغير غير موجود" });
      res.json(variant);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ" });
    }
  });
  app.delete("/api/variants/:id", requireAuth, requirePermission("products.delete"), async (req, res) => {
    try {
      await storage.deleteVariant(Number(req.params.id));
      res.json({ message: "تم حذف المتغير" });
    } catch (err: any) {
      if (err.code === "23503") return res.status(400).json({ message: "لا يمكن حذف المتغير لأنه مستخدم في طلبات أو مخزون" });
      res.status(500).json({ message: err?.message ?? "خطأ في حذف المتغير" });
    }
  });
  app.post("/api/variants/quick-create", requireAuth, requirePermission("products.create"), async (req, res) => {
    try {
      const parsed = quickCreateVariantSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: formatZodError(parsed.error) });
      const { productName, categoryId, barcode, sku, color, size, price, costDefault } = parsed.data;
      if (barcode) {
        const existing = await storage.getVariantByBarcode(barcode);
        if (existing) return res.status(400).json({ message: "الباركود مستخدم بالفعل" });
      }
      const product = await storage.createProduct({
        name: productName,
        categoryId: categoryId || null,
        price: price || 0,
        active: true,
        barcode: null,
        branchId: null,
        image: null,
      });
      const variant = await storage.createVariant({
        productId: product.id,
        barcode: barcode || null,
        sku: null,
        color: color || null,
        size: size || null,
        price: price || 0,
        costDefault: costDefault || null,
        active: true,
      });
      res.status(201).json({ product, variant });
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ" });
    }
  });

  // ── Inventory Balances ──
  app.get("/api/inventory-balances", requireAuth, requirePermission("inventory.view"), async (req, res) => {
    const locationId = req.query.locationId ? Number(req.query.locationId) : undefined;
    const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
    res.json(await storage.getInventoryBalances(locationId, branchId));
  });

  // ── Branch Stock (only items transferred from central warehouse) ──
  app.get("/api/branch-stock/:branchId", requireAuth, requirePermission("inventory.view"), async (req, res) => {
    const branchId = Number(req.params.branchId);
    const result = await pool.query(`
      SELECT ib.variant_id,
             ib.qty_on_hand as current_qty,
             pv.barcode, pv.sku, pv.color, pv.size, pv.price,
             p.name as product_name, p.id as product_id, p.category_id,
             (SELECT SUM(stl2.qty) FROM stock_transfer_lines stl2
              JOIN stock_transfers st2 ON st2.id = stl2.transfer_id
              JOIN locations fl2 ON fl2.id = st2.from_location_id
              WHERE fl2.is_central = true AND st2.to_location_id = ib.location_id
                AND st2.status = 'approved' AND stl2.variant_id = ib.variant_id
             ) as transferred_qty,
             l.name as location_name
      FROM inventory_balances ib
      JOIN locations l ON l.id = ib.location_id
      JOIN product_variants pv ON pv.id = ib.variant_id
      JOIN products p ON p.id = pv.product_id
      WHERE l.branch_id = $1 AND ib.qty_on_hand > 0
      ORDER BY p.name, pv.color, pv.size
    `, [branchId]);
    res.json(result.rows);
  });

  // ── Stock Transfers ──
  app.get("/api/transfer-locations", requireAuth, requirePermission("inventory.view"), async (_req, res) => {
    const result = await pool.query(`
      SELECT 'central' as type, l.id as location_id, l.name as label, NULL::int as branch_id
      FROM locations l WHERE l.is_central = true AND l.active = true
      UNION ALL
      SELECT 'branch' as type, l.id as location_id,
        b.name || CASE WHEN b.address IS NOT NULL AND b.address <> '' THEN ' - ' || b.address ELSE '' END AS label,
        b.id as branch_id
      FROM branches b
      JOIN locations l ON l.branch_id = b.id AND l.is_branch_default = true AND l.active = true
      ORDER BY type DESC, label
    `);
    res.json(result.rows);
  });

  app.get("/api/transfer-source-stock/:locationId", requireAuth, requirePermission("inventory.view"), async (req, res) => {
    const locationId = Number(req.params.locationId);
    const locRes = await pool.query(`SELECT id, is_central, branch_id FROM locations WHERE id = $1`, [locationId]);
    const loc = locRes.rows[0];
    if (!loc) return res.status(404).json({ message: "الموقع غير موجود" });

    let locationIds: number[] = [];
    if (loc.is_central) {
      locationIds = [loc.id];
    } else if (loc.branch_id) {
      const branchLocs = await pool.query(`SELECT id FROM locations WHERE branch_id = $1 AND active = true`, [loc.branch_id]);
      locationIds = branchLocs.rows.map((r: any) => r.id);
    } else {
      locationIds = [loc.id];
    }

    const result = await pool.query(`
      SELECT ib.variant_id, SUM(ib.qty_on_hand) as qty_on_hand,
             pv.barcode, pv.sku, pv.color, pv.size, pv.price,
             p.name as product_name, p.id as product_id
      FROM inventory_balances ib
      JOIN product_variants pv ON pv.id = ib.variant_id
      JOIN products p ON p.id = pv.product_id
      WHERE ib.location_id = ANY($1) AND ib.qty_on_hand > 0
      GROUP BY ib.variant_id, pv.barcode, pv.sku, pv.color, pv.size, pv.price, p.name, p.id
      HAVING SUM(ib.qty_on_hand) > 0
      ORDER BY p.name, pv.color, pv.size
    `, [locationIds]);
    res.json(result.rows);
  });

  app.get("/api/stock-transfers", requireAuth, requirePermission("inventory.view"), async (_req, res) => {
    res.json(await storage.getStockTransfers());
  });
  app.get("/api/stock-transfers/:id", requireAuth, requirePermission("inventory.view"), async (req, res) => {
    const transfer = await storage.getStockTransfer(Number(req.params.id));
    if (!transfer) return res.status(404).json({ message: "التحويل غير موجود" });
    const lines = await storage.getStockTransferLines(transfer.id);

    const fromLocRes = await pool.query(`
      SELECT l.is_central, CASE WHEN l.is_central THEN l.name ELSE COALESCE(b.name, l.name) END as label
      FROM locations l LEFT JOIN branches b ON b.id = l.branch_id WHERE l.id = $1
    `, [transfer.fromLocationId]);
    const toLocRes = await pool.query(`
      SELECT l.is_central, CASE WHEN l.is_central THEN l.name ELSE COALESCE(b.name, l.name) END as label
      FROM locations l LEFT JOIN branches b ON b.id = l.branch_id WHERE l.id = $1
    `, [transfer.toLocationId]);

    const detFromLocRes = await pool.query(`SELECT id, is_central, branch_id FROM locations WHERE id = $1`, [transfer.fromLocationId]);
    const detFromLoc = detFromLocRes.rows[0];
    let detSourceLocIds: number[] = [transfer.fromLocationId];
    if (detFromLoc && !detFromLoc.is_central && detFromLoc.branch_id) {
      const branchLocs = await pool.query(`SELECT id FROM locations WHERE branch_id = $1 AND active = true`, [detFromLoc.branch_id]);
      detSourceLocIds = branchLocs.rows.map((r: any) => r.id);
    }

    for (const line of lines) {
      const balRes = await pool.query(
        `SELECT COALESCE(SUM(qty_on_hand), 0) as available FROM inventory_balances WHERE variant_id = $1 AND location_id = ANY($2)`,
        [line.variant_id, detSourceLocIds]
      );
      line.available_qty = Number(balRes.rows[0]?.available || 0);
    }

    res.json({
      ...transfer,
      from_location_name: fromLocRes.rows[0]?.label || "",
      to_location_name: toLocRes.rows[0]?.label || "",
      lines,
    });
  });
  app.post("/api/stock-transfers", requireAuth, requirePermission("inventory.transfer"), async (req, res) => {
    try {
      const transfer = await storage.createStockTransfer({
        fromLocationId: req.body.fromLocationId,
        toLocationId: req.body.toLocationId,
        status: "draft",
        notes: req.body.notes || null,
        createdBy: req.session.userId!,
      });
      res.status(201).json(transfer);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ" });
    }
  });
  app.post("/api/stock-transfers/:id/lines", requireAuth, requirePermission("inventory.transfer"), async (req, res) => {
    try {
      const transfer = await storage.getStockTransfer(Number(req.params.id));
      if (!transfer || transfer.status !== "draft") return res.status(400).json({ message: "لا يمكن التعديل" });

      const variantId = req.body.variantId;
      const qty = req.body.qty || 1;

      const fromLocRes = await pool.query(`SELECT id, is_central, branch_id FROM locations WHERE id = $1`, [transfer.fromLocationId]);
      const fromLoc = fromLocRes.rows[0];
      let sourceLocIds: number[] = [transfer.fromLocationId];
      if (fromLoc && !fromLoc.is_central && fromLoc.branch_id) {
        const branchLocs = await pool.query(`SELECT id FROM locations WHERE branch_id = $1 AND active = true`, [fromLoc.branch_id]);
        sourceLocIds = branchLocs.rows.map((r: any) => r.id);
      }

      const balRes = await pool.query(
        `SELECT COALESCE(SUM(qty_on_hand), 0) as available FROM inventory_balances WHERE variant_id = $1 AND location_id = ANY($2)`,
        [variantId, sourceLocIds]
      );
      const available = Number(balRes.rows[0]?.available || 0);

      const existingRes = await pool.query(
        `SELECT COALESCE(SUM(qty), 0) as already FROM stock_transfer_lines WHERE transfer_id = $1 AND variant_id = $2`,
        [transfer.id, variantId]
      );
      const already = Number(existingRes.rows[0]?.already || 0);

      if (already + qty > available) {
        return res.status(400).json({ message: `الكمية غير كافية. المتوفر: ${available}, المطلوب سابقاً: ${already}` });
      }

      const line = await storage.addStockTransferLine({
        transferId: transfer.id,
        variantId,
        qty,
      });
      res.status(201).json(line);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ" });
    }
  });
  app.delete("/api/stock-transfer-lines/:id", requireAuth, requirePermission("inventory.transfer"), async (req, res) => {
    await storage.deleteStockTransferLine(Number(req.params.id));
    res.json({ message: "تم الحذف" });
  });
  app.post("/api/stock-transfers/execute", requireAuth, requirePermission("inventory.transfer"), async (req, res) => {
    const { fromLocationId, toLocationId, lines } = req.body;
    if (!fromLocationId || !toLocationId || !lines?.length) {
      return res.status(400).json({ message: "بيانات ناقصة" });
    }
    const filteredLines = lines.filter((l: any) => l.qty > 0);
    if (filteredLines.length === 0) {
      return res.status(400).json({ message: "لم يتم تحديد أصناف للتحويل" });
    }

    try {
      const transfer = await storage.createStockTransfer({
        fromLocationId,
        toLocationId,
        status: "draft",
        notes: req.body.notes || null,
        createdBy: req.session.userId!,
      });

      for (const line of filteredLines) {
        await storage.addStockTransferLine({
          transferId: transfer.id,
          variantId: line.variantId,
          qty: line.qty,
        });
      }

      const result = await storage.approveStockTransfer(transfer.id, req.session.userId!);
      if (!result) {
        return res.status(400).json({ message: "فشل اعتماد التحويل" });
      }

      const fromLocRes = await pool.query(`
        SELECT l.is_central, CASE WHEN l.is_central THEN l.name ELSE COALESCE(b.name, l.name) END as label
        FROM locations l LEFT JOIN branches b ON b.id = l.branch_id WHERE l.id = $1
      `, [fromLocationId]);
      const toLocRes = await pool.query(`
        SELECT l.is_central, CASE WHEN l.is_central THEN l.name ELSE COALESCE(b.name, l.name) END as label
        FROM locations l LEFT JOIN branches b ON b.id = l.branch_id WHERE l.id = $1
      `, [toLocationId]);

      res.status(201).json({
        ...result,
        from_location_name: fromLocRes.rows[0]?.label || "",
        to_location_name: toLocRes.rows[0]?.label || "",
        lines_count: filteredLines.length,
      });
    } catch (err: any) {
      res.status(400).json({ message: err?.message ?? "خطأ في تنفيذ التحويل" });
    }
  });

  app.post("/api/stock-transfers/:id/approve", requireAuth, requirePermission("inventory.transfer"), async (req, res) => {
    try {
      const result = await storage.approveStockTransfer(Number(req.params.id), req.session.userId!);
      if (!result) return res.status(400).json({ message: "لا يمكن اعتماد التحويل" });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err?.message ?? "خطأ في اعتماد التحويل" });
    }
  });

  // ── Inventory Ledger ──
  app.get("/api/inventory-ledger", requireAuth, requirePermission("inventory.view"), async (req, res) => {
    const filters: any = {};
    if (req.query.variantId) filters.variantId = Number(req.query.variantId);
    if (req.query.locationId) filters.locationId = Number(req.query.locationId);
    if (req.query.limit) filters.limit = Number(req.query.limit);
    res.json(await storage.getInventoryLedgerEntries(filters));
  });

  app.get("/api/warehouses", requireAuth, async (_req, res) => {
    res.json(await storage.getWarehouses());
  });
  app.post("/api/warehouses", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    const parsed = insertWarehouseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createWarehouse(parsed.data));
  });

  app.get("/api/inventory", requireAuth, requirePermission("inventory.view"), async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "غير مصرح" });
    const branchId = req.query.branchId
      ? Number(req.query.branchId)
      : (user.role === "owner" || user.role === "admin" ? undefined : user.branchId ?? undefined);
    res.json(await storage.getBranchInventory(branchId));
  });
  app.get("/api/inventory/low-stock", requireAuth, async (_req, res) => {
    res.json(await storage.getLowStockAlerts());
  });
  app.get("/api/inventory/transactions", requireAuth, requirePermission("inventory.view"), async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "غير مصرح" });
    const branchId = req.query.branchId
      ? Number(req.query.branchId)
      : (user.role === "owner" || user.role === "admin" ? undefined : user.branchId ?? undefined);
    res.json(await storage.getInventoryTransactions({
      branchId,
      productId: req.query.productId ? Number(req.query.productId) : undefined,
      type:      req.query.type      ? String(req.query.type)      : undefined,
      from:      req.query.from      ? String(req.query.from)      : undefined,
      to:        req.query.to        ? String(req.query.to)        : undefined,
      limit:     req.query.limit     ? Number(req.query.limit)     : undefined,
    }));
  });
  app.post("/api/inventory/receive", requireAuth, requirePermission("inventory.edit"), async (req, res) => {
    const { productId, warehouseId, quantity } = req.body;
    if (!productId || !warehouseId || !quantity) {
      return res.status(400).json({ message: "البيانات ناقصة" });
    }
    res.json(await storage.adjustInventory(productId, warehouseId, quantity));
  });
  app.post("/api/inventory/transfer", requireAuth, requirePermission("inventory.transfer"), async (req, res) => {
    const parsed = insertInventoryTransferSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    try {
      res.status(201).json(await storage.createTransfer(parsed.data));
    } catch (e: any) {
      res.status(400).json({ message: e.message || "فشل التحويل" });
    }
  });

  app.get("/api/locations", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "غير مصرح" });
    const branchId = req.query.branchId
      ? Number(req.query.branchId)
      : (user.role === "owner" || user.role === "admin" ? undefined : user.branchId);
    res.json(await storage.getLocations(branchId));
  });

  app.get("/api/branch-inventory", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "غير مصرح" });
    const branchId = req.query.branchId
      ? Number(req.query.branchId)
      : (user.role === "owner" || user.role === "admin" ? undefined : user.branchId);
    res.json(await storage.getBranchInventory(branchId));
  });

  app.get("/api/location-inventory", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "غير مصرح" });
    const branchId = req.query.branchId
      ? Number(req.query.branchId)
      : (user.role === "owner" || user.role === "admin" ? undefined : user.branchId);
    const locationCode = req.query.locationCode as string | undefined;
    res.json(await storage.getLocationInventoryList(branchId, locationCode));
  });

  app.get("/api/location-inventory/transactions", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "غير مصرح" });
    const branchId = req.query.branchId
      ? Number(req.query.branchId)
      : (user.role === "owner" || user.role === "admin" ? undefined : user.branchId);
    const type = req.query.type as string | undefined;
    res.json(await storage.getLocationTransactions(branchId, type));
  });

  app.get("/api/location-inventory/low-stock", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "غير مصرح" });
    const branchId = req.query.branchId
      ? Number(req.query.branchId)
      : (user.role === "owner" || user.role === "admin" ? undefined : user.branchId);
    const locationCode = req.query.locationCode as string | undefined;
    res.json(await storage.getLocationLowStock(branchId, locationCode));
  });

  app.post("/api/location-inventory/transfer", requireAuth, requirePermission("inventory.transfer"), async (req, res) => {
    try {
      const { fromLocationId, toLocationId, productId, quantity, note } = req.body;
      if (!fromLocationId || !toLocationId || !productId || !quantity || quantity <= 0) {
        return res.status(400).json({ message: "البيانات ناقصة أو غير صحيحة" });
      }
      await storage.transferStock(fromLocationId, toLocationId, productId, quantity, note, req.session.userId);
      res.json({ message: "تم النقل بنجاح" });
    } catch (e: any) {
      res.status(400).json({ message: e.message || "فشل النقل" });
    }
  });

  app.post("/api/inventory-transfers", requireAuth, requirePermission("inventory.transfer"), async (req, res) => {
    try {
      const { branchId, items } = req.body;
      if (!branchId || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "البيانات ناقصة أو غير صحيحة" });
      }
      const result = await storage.createLocationTransfer(branchId, items, req.session.userId!);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "فشل التحويل" });
    }
  });

  app.post("/api/admin/inventory-transfers", requireOwnerOrAdmin, async (req, res) => {
    try {
      const { branch_id, items } = req.body;
      if (!branch_id || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "البيانات ناقصة أو غير صحيحة" });
      }
      for (const it of items) {
        if (!it.product_id || !it.qty || it.qty <= 0) {
          return res.status(400).json({ message: "كل صنف يجب أن يحتوي على product_id و qty > 0" });
        }
      }
      const mapped = items.map((it: any) => ({ productId: Number(it.product_id), qty: Number(it.qty) }));
      const result = await storage.createLocationTransfer(Number(branch_id), mapped, req.session.userId!);
      res.json({ success: true, transfer_id: result.transferId, item_count: result.itemCount });
    } catch (e: any) {
      res.status(400).json({ message: e.message || "فشل التحويل" });
    }
  });

  app.get("/api/central-inventory", requireManager, async (req, res) => {
    res.json(await storage.getCentralInventory());
  });

  app.get("/api/inventory-transfers", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "غير مصرح" });
    const branchId = req.query.branchId
      ? Number(req.query.branchId)
      : (user.role === "owner" || user.role === "admin" ? undefined : user.branchId);
    res.json(await storage.getLocationTransfersList(branchId));
  });

  app.post("/api/location-inventory/add-stock", requireAuth, requirePermission("inventory.edit"), async (req, res) => {
    try {
      const { branchId, productId, quantity, note } = req.body;
      if (!branchId || !productId || !quantity || quantity <= 0) {
        return res.status(400).json({ message: "البيانات ناقصة أو غير صحيحة" });
      }
      await storage.addStock(branchId, productId, quantity, "manual_receipt", undefined, undefined, note || "استلام يدوي", req.session.userId);
      res.json({ message: "تم إضافة البضاعة" });
    } catch (e: any) {
      res.status(400).json({ message: e.message || "فشل الإضافة" });
    }
  });

  app.get("/api/customers/kpis", requireAuth, requirePermission("customers.view"), async (_req, res) => {
    try { res.json(await storage.getCustomerKpis()); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.get("/api/customers", requireAuth, requirePermission("customers.view"), async (_req, res) => {
    res.json(await storage.getCustomers());
  });
  /** GET /api/customers/search — يجب أن يكون قبل /:id */
  app.get("/api/customers/search", requireAuth, requirePermission("customers.view"), async (req, res) => {
    try {
      const { q } = req.query;
      if (!q) {
        const all = await pool.query(
          `SELECT id, name, phone, city FROM customers WHERE active = true ORDER BY name LIMIT 50`
        );
        return res.json(all.rows);
      }
      const result = await pool.query(
        `SELECT id, name, phone, city FROM customers
         WHERE active = true AND (name ILIKE $1 OR phone ILIKE $1)
         ORDER BY name LIMIT 20`,
        [`%${q}%`]
      );
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/customers/:id", requireAuth, requirePermission("customers.view"), async (req, res) => {
    const id = parseInt(req.params.id as string);
    const result = await storage.getCustomerWithInvoices(id);
    if (!result) return res.status(404).json({ message: "Customer not found" });
    res.json(result);
  });
  app.get("/api/customers/:id/statement", requireAuth, requirePermission("customers.view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;
      const result = await storage.getCustomerStatement(id, from, to);
      if (!result) return res.status(404).json({ message: "Customer not found" });
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.post("/api/customers", requireAuth, requirePermission("customers.create"), async (req, res) => {
    try {
      const parsed = insertCustomerSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: formatZodError(parsed.error) });
      if ((parsed.data as any).phone) {
        const existing = await storage.getCustomerByPhone((parsed.data as any).phone);
        if (existing) return res.status(409).json({ message: "phone_exists" });
      }
      res.status(201).json(await storage.createCustomer(parsed.data));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.post("/api/customers/find-or-create", requireAuth, requirePermission("customers.create"), async (req, res) => {
    const { phone, name } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone is required" });
    const customer = await storage.findOrCreateCustomerByPhone(phone, name);
    res.json(customer);
  });
  app.put("/api/customers/:id", requireAuth, requirePermission("customers.edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      const parsed = updateCustomerSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: formatZodError(parsed.error) });
      const { name, phone, notes, active, branchId } = parsed.data;
      if (phone) {
        const existing = await storage.getCustomerByPhone(phone);
        if (existing && existing.id !== id) return res.status(409).json({ message: "رقم الهاتف مستخدم بالفعل" });
      }
      const updated = await storage.updateCustomer(id, { name, phone, notes, active, branchId });
      if (!updated) return res.status(404).json({ message: "العميل غير موجود" });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.delete("/api/customers/:id", requireAuth, requirePermission("customers.delete"), async (req, res) => {
    try {
      await storage.deleteCustomer(parseInt(req.params.id as string));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/suppliers", requireAuth, requirePermission("suppliers.manage"), async (req, res) => {
    const activeOnly = req.query.activeOnly === "true";
    res.json(await storage.getSuppliers(activeOnly));
  });
  app.get("/api/suppliers/:id", requireAuth, requirePermission("suppliers.manage"), async (req, res) => {
    const row = await storage.getSupplier(Number(req.params.id));
    if (!row) return res.status(404).json({ message: "المورد غير موجود" });
    res.json(row);
  });
  app.post("/api/suppliers", requireAuth, requirePermission("suppliers.manage"), async (req, res) => {
    const parsed = insertSupplierSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: formatZodError(parsed.error) });
    if (!(parsed.data as any).name || !(parsed.data as any).name.trim()) {
      return res.status(400).json({ message: "اسم المورد مطلوب" });
    }
    const existing = await storage.getSupplierByName((parsed.data as any).name.trim());
    if (existing) {
      return res.status(409).json({ message: "يوجد مورد بنفس الاسم" });
    }
    res.status(201).json(await storage.createSupplier(parsed.data));
  });
  app.patch("/api/suppliers/:id", requireAuth, requirePermission("suppliers.manage"), async (req, res) => {
    if (req.body.name) {
      const existing = await storage.getSupplierByName(req.body.name.trim());
      if (existing && existing.id !== Number(req.params.id)) {
        return res.status(409).json({ message: "يوجد مورد بنفس الاسم" });
      }
    }
    const row = await storage.updateSupplier(Number(req.params.id), req.body);
    if (!row) return res.status(404).json({ message: "المورد غير موجود" });
    res.json(row);
  });

  app.post("/api/suppliers/:id/payment", requireAuth, requirePermission("suppliers.manage"), async (req, res) => {
    try {
      const supplierId = Number(req.params.id);
      const { amount, method, note, branchId } = req.body;
      const createdBy = req.session.userId!;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "المبلغ يجب أن يكون أكبر من صفر" });
      }
      if (!method || !PAYMENT_METHODS.includes(method)) {
        return res.status(400).json({ message: "طريقة دفع غير صحيحة" });
      }

      await storage.createSupplierPayment(supplierId, {
        amount: Number(amount),
        method,
        note,
        branchId: Number(branchId),
        createdBy
      });

      journalForSupplierPayment({
        supplierId,
        amount: Number(amount),
        method,
        branchId: Number(branchId),
        createdBy,
        note,
      }).catch(err => console.error("[AutoJournal] Supplier payment error:", err.message));

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/suppliers/:id/statement", requireAuth, requirePermission("suppliers.manage"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const from = req.query.from as string;
      const to = req.query.to as string;
      const statement = await storage.getSupplierStatement(id, from, to);
      if (!statement) return res.status(404).json({ message: "المورد غير موجود" });
      res.json(statement);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/sales", requireAuth, enforceBranchScope, async (req, res) => {
    const scope = req.branchScope!;
    const filters: any = {};
    if (req.query.from) filters.from = req.query.from as string;
    if (req.query.to) filters.to = req.query.to as string;
    if (req.query.paymentMethod) filters.paymentMethod = req.query.paymentMethod as string;
    if (req.query.employeeId) filters.employeeId = Number(req.query.employeeId);
    if (req.query.invoiceNumber) filters.invoiceNumber = req.query.invoiceNumber as string;
    if (scope.mode === "branch") {
      filters.branchId = scope.branchId;
    }
    res.json(await storage.getSalesFiltered(filters));
  });
  app.get("/api/sales/:id", requireAuth, enforceBranchScope, async (req, res) => {
    const detail = await storage.getSaleWithDetails(Number(req.params.id));
    if (!detail) return res.status(404).json({ message: "الفاتورة غير موجودة" });
    const user = await storage.getUser(req.session.userId!);
    const isBranchOnly = user?.role === "cashier" || user?.role === "employee" || user?.role === "manager";
    if (isBranchOnly && detail.branchId !== user!.branchId) {
      return res.status(403).json({ message: "غير مصرح" });
    }
    res.json(detail);
  });
  app.post("/api/sales", requireAuth, requirePermission("invoice.create"), async (req, res) => {
    const { items, branchId: _b, cashierId: _c, employeeId: _e, terminalName: _t, shiftId: _s, ...saleData } = req.body;
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "المستخدم غير موجود" });
    let shiftId: number | null = null;
    if (user.branchId && user.terminalName) {
      const shift = await storage.getCurrentShift(user.branchId, user.terminalName);
      if (shift) shiftId = shift.id;
    }
    const parsed = insertSaleSchema.safeParse({
      ...saleData,
      branchId: user.branchId,
      cashierId: user.id,
      shiftId,
    });
    if (!parsed.success) return res.status(400).json({ message: formatZodError(parsed.error) });
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "لا توجد منتجات في الفاتورة" });
    }
    for (let i = 0; i < (items as any[]).length; i++) {
      const itemParsed = orderItemSchema.safeParse((items as any[])[i]);
      if (!itemParsed.success) {
        return res.status(400).json({ message: `بند ${i + 1}: ${formatZodError(itemParsed.error)}` });
      }
    }
    try {
      const sale = await storage.createSale(parsed.data, items);
      if ((parsed.data as any).customerId) {
        storage.updateCustomerAfterSale((parsed.data as any).customerId, String((parsed.data as any).total || "0")).catch(() => {});
      }
      journalForSale({
        id: sale.id,
        invoiceNumber: sale.invoiceNumber || "",
        total: sale.total || "0",
        vat: sale.vat || "0",
        paymentMethod: sale.paymentMethod || "cash",
        branchId: sale.branchId,
        cashierId: sale.cashierId,
        cogsTotal: sale.cogsTotal || "0",
        createdAt: sale.createdAt ?? undefined,
      }).catch(err => console.error("[AutoJournal] Sale error:", err.message));
      res.status(201).json(sale);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "فشل إنشاء الفاتورة" });
    }
  });
  app.get("/api/sales/daily/summary", requireAuth, enforceBranchScope, async (req, res) => {
    res.json(await storage.getDailySalesTotal());
  });

  app.get("/api/orders", requireAuth, enforceBranchScope, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "غير مصرح" });
    const isManager = ["owner", "admin", "manager"].includes(user.role);
    const branchFilter = req.query.branchId ? parseInt(req.query.branchId as string) : undefined;
    const allOrders = await storage.getOrders();
    let filtered = allOrders;
    if (!isManager) {
      filtered = filtered.filter(o => o.branchId === user.branchId);
    } else if (branchFilter) {
      filtered = filtered.filter(o => o.branchId === branchFilter);
    }
    res.json(filtered);
  });
  /** GET /api/orders/stats — إحصائيات الطلبات مع مقارنة شهرية */
  app.get("/api/orders/stats", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "غير مصرح" });
      const isManager = ["owner", "admin", "manager"].includes(user.role);
      const branchClause = isManager ? "" : `AND branch_id = ${user.branchId}`;
      const result = await pool.query(`
        SELECT
          -- إجمالي كل الوقت (للبادجات الجانبية)
          COUNT(*) FILTER (WHERE status='new')       as new_count,
          COUNT(*) FILTER (WHERE status='preparing') as preparing_count,
          COUNT(*) FILTER (WHERE status='ready')     as ready_count,
          COUNT(*) FILTER (WHERE status='delivered') as delivered_count,
          COUNT(*) FILTER (WHERE status='cancelled') as cancelled_count,
          COUNT(*)                                   as total_count,

          -- هذا الشهر
          COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW()))                                          as this_month_total,
          COUNT(*) FILTER (WHERE status='new'       AND created_at >= date_trunc('month', NOW()))                   as this_month_new,
          COUNT(*) FILTER (WHERE status='preparing' AND created_at >= date_trunc('month', NOW()))                   as this_month_preparing,
          COUNT(*) FILTER (WHERE status='ready'     AND created_at >= date_trunc('month', NOW()))                   as this_month_ready,
          COUNT(*) FILTER (WHERE status='delivered' AND created_at >= date_trunc('month', NOW()))                   as this_month_delivered,
          COUNT(*) FILTER (WHERE status='cancelled' AND created_at >= date_trunc('month', NOW()))                   as this_month_cancelled,

          -- الشهر الماضي
          COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW() - INTERVAL '1 month') AND created_at < date_trunc('month', NOW()))                                          as prev_month_total,
          COUNT(*) FILTER (WHERE status='new'       AND created_at >= date_trunc('month', NOW() - INTERVAL '1 month') AND created_at < date_trunc('month', NOW()))                   as prev_month_new,
          COUNT(*) FILTER (WHERE status='preparing' AND created_at >= date_trunc('month', NOW() - INTERVAL '1 month') AND created_at < date_trunc('month', NOW()))                   as prev_month_preparing,
          COUNT(*) FILTER (WHERE status='ready'     AND created_at >= date_trunc('month', NOW() - INTERVAL '1 month') AND created_at < date_trunc('month', NOW()))                   as prev_month_ready,
          COUNT(*) FILTER (WHERE status='delivered' AND created_at >= date_trunc('month', NOW() - INTERVAL '1 month') AND created_at < date_trunc('month', NOW()))                   as prev_month_delivered,
          COUNT(*) FILTER (WHERE status='cancelled' AND created_at >= date_trunc('month', NOW() - INTERVAL '1 month') AND created_at < date_trunc('month', NOW()))                   as prev_month_cancelled,

          -- اليوم
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_count,
          COUNT(*) FILTER (WHERE status='new' AND created_at >= CURRENT_DATE) as today_new
        FROM orders WHERE 1=1 ${branchClause}
      `);
      res.json(result.rows[0]);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** GET /api/orders/full — قائمة الطلبات مع الفلاتر الكاملة (يجب أن يكون قبل /:id) */
  app.get("/api/orders/full", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "غير مصرح" });
      const isManager = ["owner", "admin", "manager"].includes(user.role);
      const { search, status, source, from, to, branchId: bId } = req.query;

      let where = "WHERE 1=1";
      const params: any[] = [];
      if (!isManager) {
        params.push(user.branchId);
        where += ` AND o.branch_id = $${params.length}`;
      } else if (bId) {
        params.push(Number(bId));
        where += ` AND o.branch_id = $${params.length}`;
      }
      if (search) {
        params.push(`%${search}%`);
        where += ` AND (
          o.order_number ILIKE $${params.length}
          OR o.customer_phone ILIKE $${params.length}
          OR o.customer_id IN (SELECT id FROM customers WHERE phone ILIKE $${params.length})
        )`;
      }
      if (status && status !== "all") {
        params.push(status);
        where += ` AND o.status = $${params.length}`;
      }
      if (source && source !== "all") {
        params.push(source);
        where += ` AND o.source = $${params.length}`;
      }
      if (from) { params.push(from); where += ` AND o.created_at >= $${params.length}`; }
      if (to)   { params.push(to);   where += ` AND o.created_at <  $${params.length}::date + 1`; }

      const result = await pool.query(`
        SELECT o.*,
               b.name as branch_name,
               u.name as employee_name,
               c.id   as registered_customer_id,
               c.name as registered_customer_name,
               (o.customer_id IS NOT NULL
                OR (o.customer_phone IS NOT NULL AND EXISTS (
                  SELECT 1 FROM customers cx WHERE cx.phone = o.customer_phone AND cx.active = true
                ))) as is_registered_customer,
               (SELECT json_agg(json_build_object(
                  'id', oi.id, 'productId', oi.product_id, 'productName', p.name,
                  'quantity', oi.quantity, 'unitPrice', oi.unit_price, 'total', oi.total,
                  'color', oi.color, 'size', oi.size
               )) FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) as items
        FROM orders o
        LEFT JOIN branches b ON b.id = o.branch_id
        LEFT JOIN users u ON u.id = o.employee_id
        LEFT JOIN customers c ON c.id = o.customer_id OR (o.customer_id IS NULL AND c.phone = o.customer_phone AND c.active = true)
        ${where}
        ORDER BY o.created_at DESC
        LIMIT 500
      `, params);
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/orders/:id", requireAuth, enforceBranchScope, async (req, res) => {
    const order = await storage.getOrder(Number(req.params.id));
    if (!order) return res.status(404).json({ message: "الطلب غير موجود" });
    const items = await storage.getOrderItems(order.id);
    res.json({ ...order, items });
  });
  app.post("/api/orders", requireAuth, async (req, res) => {
    try {
      const { items, ...orderData } = req.body;
      const parsed = insertOrderSchema.safeParse(orderData);
      if (!parsed.success) return res.status(400).json({ message: formatZodError(parsed.error) });
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "لا توجد منتجات في الطلب" });
      }
      for (let i = 0; i < (items as any[]).length; i++) {
        const itemParsed = orderItemSchema.safeParse((items as any[])[i]);
        if (!itemParsed.success) {
          return res.status(400).json({ message: `بند ${i + 1}: ${formatZodError(itemParsed.error)}` });
        }
      }
      const branchId = (parsed.data as any).branchId;
      let shiftId = (parsed.data as any).shiftId ?? null;
      if (!shiftId && branchId) {
        const [openShift] = await db
          .select({ id: shifts.id })
          .from(shifts)
          .where(and(eq(shifts.status, "open"), eq(shifts.branchId, branchId)))
          .orderBy(desc(shifts.id))
          .limit(1);
        if (openShift) shiftId = openShift.id;
      }
      const order = await storage.createOrder({ ...parsed.data, shiftId, employeeId: req.session.userId }, items);
      if ((parsed.data as any).customerPhone) {
        storage.findOrCreateCustomerByPhone((parsed.data as any).customerPhone, (parsed.data as any).customerName || undefined).catch(() => {});
      }
      res.status(201).json(order);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });
  app.patch("/api/orders/:id/status", requireAuth, requireManager, async (req, res) => {
    try {
      const statusParsed = orderStatusSchema.safeParse(req.body);
      if (!statusParsed.success) return res.status(400).json({ message: formatZodError(statusParsed.error) });
      const { status } = statusParsed.data;
      const existing = await storage.getOrder(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "الطلب غير موجود" });
      const oldStatus = existing.status;
      const row = await storage.updateOrderStatus(Number(req.params.id), status);
      if (!row) return res.status(404).json({ message: "الطلب غير موجود" });

      // Deduct inventory when order is completed for the first time
      if (status === "completed" && oldStatus !== "completed") {
        await storage.deductOrderInventory(row.id, req.session.userId ?? null);
      }

      // Restore inventory if a completed order is cancelled via status change
      if (status === "cancelled" && oldStatus === "completed") {
        await storage.restoreOrderInventory(row.id, req.session.userId ?? null);
      }

      if (status === "cancelled" || oldStatus !== status) {
        await storage.addAuditLog({
          action: status === "cancelled" ? "order_cancel" : "order_status_change",
          entityType: "order",
          entityId: row.id,
          branchId: row.branchId ?? null,
          userId: req.session.userId ?? null,
          userName: null,
          details: `تغيير حالة الطلب ${row.orderNumber} من ${oldStatus} إلى ${status}`,
          oldValue: JSON.stringify({ status: oldStatus }),
          newValue: JSON.stringify({ status }),
        });
      }
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });
  app.post("/api/orders/:id/pay", requireAuth, async (req, res) => {
    const { paymentMethod, bankTxnId } = req.body;
    if (!paymentMethod || !PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ message: "طريقة الدفع غير صالحة. الخيارات: cash, card, bank_transfer" });
    }
    const row = await storage.payOrder(Number(req.params.id), paymentMethod as PaymentMethod, bankTxnId);
    if (!row) return res.status(404).json({ message: "الطلب غير موجود" });
    res.json(row);
  });

  app.post("/api/orders/:id/cancel", requireAuth, requireManager, async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const { reason } = req.body;
      if (!reason) return res.status(400).json({ message: "سبب الإلغاء مطلوب" });
      const user = req.session?.user;
      if (!user) return res.status(401).json({ message: "غير مسجل دخول" });
      if (!["owner", "admin", "manager"].includes(user.role)) {
        return res.status(403).json({ message: "ليس لديك صلاحية إلغاء الطلبات" });
      }
      const result = await storage.cancelOrderFull(orderId, user.id, user.name, reason);
      if (!result) return res.status(404).json({ message: "الطلب غير موجود" });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ" });
    }
  });

  app.post("/api/sales/:id/return", requireAuth, requirePermission("invoice.return"), enforceBranchScope, async (req, res) => {
    try {
      const saleId = Number(req.params.id);
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "غير مسجل دخول" });

      const { items, reason, refundMethod, shiftId } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "يجب تحديد عناصر المرتجع" });
      }

      const sale = await storage.getSale(saleId);
      if (!sale) return res.status(404).json({ message: "الفاتورة غير موجودة" });

      let refundAmount = 0;
      const returnItems = items.map((item: any) => {
        const lineTotal = parseFloat(item.unitPrice) * item.quantity;
        refundAmount += lineTotal;
        return {
          returnId: 0,
          saleItemId: item.saleItemId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitCost: "0",
          lineTotal: lineTotal.toFixed(3),
          lineCogs: "0",
        };
      });

      const retNumRes = await pool.query(`SELECT coalesce(max(id), 0) + 1 as next FROM sale_returns`);
      const returnNumber = `RET-${String(retNumRes.rows[0].next).padStart(5, "0")}`;

      const result = await storage.createSaleReturn({
        returnNumber,
        saleId,
        branchId: sale.branchId,
        shiftId: shiftId || null,
        refundAmount: refundAmount.toFixed(3),
        refundMethod: refundMethod || sale.paymentMethod || "cash",
        cogsReturned: "0",
        reason: reason || null,
        createdBy: user.id,
      }, returnItems);

      journalForSaleReturn({
        id: result.id,
        returnNumber,
        refundAmount: refundAmount.toFixed(3),
        refundMethod: refundMethod || sale.paymentMethod || "cash",
        cogsReturned: result.cogsReturned || "0",
        branchId: sale.branchId,
        createdBy: user.id,
        saleInvoiceNumber: sale.invoiceNumber || "",
        createdAt: result.createdAt ?? undefined,
      }).catch(err => console.error("[AutoJournal] Return error:", err.message));

      // ── إشعار للمالك ────────────────────────────────────────────────
      pool.query(
        `INSERT INTO notifications (type, title, body, data, target_role, created_by)
         VALUES ('invoice_return', $1, $2, $3, 'owner', $4)`,
        [
          `مرتجع فاتورة — ${returnNumber}`,
          `أجرى ${user.name || user.username} إرجاعاً على الفاتورة ${sale.invoiceNumber || saleId} بمبلغ ${refundAmount.toFixed(3)} ر.ع`,
          JSON.stringify({ returnId: result.id, saleId, returnNumber, refundAmount: refundAmount.toFixed(3) }),
          user.id,
        ]
      ).catch(err => console.error("[Notification] Return notify error:", err.message));

      res.status(201).json(result);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في إنشاء المرتجع" });
    }
  });

  app.get("/api/sale-returns", requireAuth, enforceBranchScope, async (req, res) => {
    try {
      const scope = req.branchScope!;
      const branchId = scope.mode === "branch" ? scope.branchId! : (req.query.branchId ? Number(req.query.branchId) : undefined);
      const rows = await storage.getSaleReturns(branchId);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ" });
    }
  });

  app.get("/api/sale-returns/:id", requireAuth, enforceBranchScope, async (req, res) => {
    const ret = await storage.getSaleReturn(Number(req.params.id));
    if (!ret) return res.status(404).json({ message: "المرتجع غير موجود" });
    const items = await storage.getSaleReturnItems(ret.id);
    res.json({ ...ret, items });
  });

  app.get("/api/audit-log", requireOwnerOrAdmin, async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.entityType) filters.entityType = req.query.entityType;
      if (req.query.branchId) filters.branchId = Number(req.query.branchId);
      if (req.query.from) filters.from = req.query.from;
      if (req.query.to) filters.to = req.query.to;
      const rows = await storage.getAuditLogs(filters);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ" });
    }
  });

  app.get("/api/expenses", requireAuth, enforceBranchScope, async (req, res) => {
    try {
      const scope = req.branchScope!;
      const branchId = scope.mode === "branch" ? scope.branchId! : (req.query.branchId ? Number(req.query.branchId) : undefined);
      const dateStr = req.query.date as string | undefined;
      const fromDate = req.query.from as string | undefined;
      const toDate = req.query.to as string | undefined;
      const rows = await storage.getExpensesEnriched(branchId, dateStr, fromDate, toDate);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });
  app.get("/api/expenses/summary", requireAuth, enforceBranchScope, async (req, res) => {
    try {
      const scope = req.branchScope!;
      const branchId = scope.mode === "branch" ? scope.branchId! : (req.query.branchId ? Number(req.query.branchId) : undefined);
      const dateStr = req.query.date as string | undefined;
      const fromDate = req.query.from as string | undefined;
      const toDate = req.query.to as string | undefined;
      const summary = await storage.getExpensesSummary(branchId, dateStr, fromDate, toDate);
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });
  app.post("/api/expenses", requireAuth, requirePermission("expenses.create"), enforceBranchScope, async (req, res) => {
    try {
      const { amount, notes, source, category, date: expenseDate } = req.body;
      if (!amount) {
        return res.status(400).json({ message: "المبلغ مطلوب" });
      }
      const expenseSource = source || "cash";
      if (!["cash", "card", "bank_transfer"].includes(expenseSource)) {
        return res.status(400).json({ message: "مصدر غير صالح. الخيارات: cash, card, bank_transfer" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user || !user.branchId) {
        return res.status(400).json({ message: "بيانات المستخدم ناقصة (الفرع)" });
      }
      const branchId = user.branchId;

      let shiftId: number | null = null;
      if (user.terminalName) {
        const shift = await storage.getCurrentShift(branchId, user.terminalName);
        if (shift) shiftId = shift.id;
      }

      const todayStr = expenseDate && /^\d{4}-\d{2}-\d{2}$/.test(expenseDate) ? expenseDate : new Date().toISOString().slice(0, 10);
      const catLabel = category || "عام";
      const expense = await storage.createExpense({
        branchId,
        shiftId,
        category: catLabel,
        amount: String(amount),
        source: expenseSource,
        date: todayStr,
        notes: notes || null,
        createdBy: user.id,
      });

      journalForExpense({
        id: expense.id,
        category: catLabel,
        amount: String(amount),
        source: expenseSource,
        date: todayStr,
        branchId,
        createdBy: user.id,
        notes: notes || null,
      }).catch(err => console.error("[AutoJournal] Expense error:", err.message));

      if (expenseSource === "cash") {
        await storage.addCashLedgerEntry({
          date: todayStr,
          branchId,
          shiftId,
          type: "expense",
          amountIn: "0",
          amountOut: String(amount),
          category: catLabel,
          note: notes || `مصروف: ${catLabel}`,
          createdBy: user.id,
        });
      } else {
        await storage.addBankLedgerEntry({
          date: todayStr,
          branchId,
          shiftId,
          method: expenseSource,
          amountIn: "0",
          amountOut: String(amount),
          category: catLabel,
          note: notes || `مصروف: ${catLabel}`,
          createdBy: user.id,
        });
      }

      res.status(201).json(expense);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.patch("/api/expenses/:id", requireAuth, requirePermission("expenses.edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { amount, category, source, notes, date } = req.body;
      const updateData: any = {};
      if (amount !== undefined) updateData.amount = String(amount);
      if (category !== undefined) updateData.category = category;
      if (source !== undefined) updateData.source = source;
      if (notes !== undefined) updateData.notes = notes;
      if (date !== undefined) updateData.date = date;
      const updated = await storage.updateExpense(id, updateData);
      if (!updated) return res.status(404).json({ message: "المصروف غير موجود" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.delete("/api/expenses/:id", requireAuth, requirePermission("expenses.delete"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deleteExpense(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/ledger/cash", requireAuth, enforceBranchScope, async (req, res) => {
    const scope = req.branchScope!;
    const branchId = scope.mode === "branch" ? scope.branchId! : undefined;
    res.json(await storage.getCashLedgerEntries(branchId));
  });
  app.get("/api/ledger/bank", requireAuth, enforceBranchScope, async (req, res) => {
    const scope = req.branchScope!;
    const branchId = scope.mode === "branch" ? scope.branchId! : undefined;
    res.json(await storage.getBankLedgerEntries(branchId));
  });

  app.get("/api/employees", requireAuth, requireOwnerOrAdmin, async (_req, res) => {
    res.json(await storage.getEmployees());
  });
  app.post("/api/employees", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    const parsed = insertEmployeeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createEmployee(parsed.data));
  });

  app.get("/api/shifts/current", requireAuth, enforceBranchScope, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user || !user.branchId || !user.terminalName) {
      return res.status(400).json({ message: "بيانات المستخدم ناقصة (الفرع أو الجهاز)" });
    }
    const shift = await storage.getCurrentShift(user.branchId, user.terminalName);
    if (!shift) return res.json({ shift: null });
    res.json({ shift });
  });

  app.get("/api/shifts", requireAuth, enforceBranchScope, async (_req, res) => {
    res.json(await storage.getShifts());
  });
  app.post("/api/shifts", requireAuth, requirePermission("shift.open"), async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user || !user.branchId || !user.terminalName) {
      return res.status(400).json({ message: "بيانات المستخدم ناقصة (الفرع أو الجهاز)" });
    }
    const existing = await storage.getCurrentShift(user.branchId, user.terminalName);
    if (existing) {
      return res.status(409).json({ message: "يوجد شفت مفتوح بالفعل لهذا الجهاز", shift: existing });
    }
    const { openingCash } = req.body;
    const shiftData = {
      branchId: user.branchId,
      cashierId: user.id,
      terminalName: user.terminalName,
      openingCash: openingCash ? String(openingCash) : "0",
    };
    const parsed = insertShiftSchema.safeParse(shiftData);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createShift(parsed.data));
  });
  app.patch("/api/shifts/:id/close", requireAuth, requirePermission("shift.close"), enforceBranchScope, async (req, res) => {
    const shiftId = Number(req.params.id);
    const pendingOrders = await storage.getPendingOrdersByShift(shiftId);
    if (pendingOrders.length > 0) {
      return res.status(400).json({
        message: `لا يمكن إغلاق الشفت - يوجد ${pendingOrders.length} طلب/طلبات معلقة. أكمل أو ألغِ الطلبات أولاً.`,
        pendingOrders: pendingOrders.map(o => ({ id: o.id, orderNumber: o.orderNumber, status: o.status })),
      });
    }
    const { actualCash } = req.body;
    if (actualCash === undefined || actualCash === null) {
      return res.status(400).json({ message: "يجب إدخال المبلغ النقدي الفعلي (actualCash)" });
    }
    const row = await storage.closeShift(shiftId, String(actualCash));
    if (!row) return res.status(404).json({ message: "الوردية غير موجودة" });
    res.json(row);
  });

  app.get("/api/reports/shift", requireAuth, requirePermission("reports.view"), enforceBranchScope, async (req, res) => {
    const shiftId = Number(req.query.shiftId);
    if (!shiftId) return res.status(400).json({ message: "shiftId مطلوب" });
    const report = await storage.getShiftReport(shiftId);
    if (!report) return res.status(404).json({ message: "الشفت غير موجود" });
    res.json(report);
  });

  app.get("/api/reports/daily", requireAuth, requirePermission("reports.view"), enforceBranchScope, async (req, res) => {
    const dateStr = req.query.date as string;
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ message: "التاريخ مطلوب بصيغة YYYY-MM-DD" });
    }
    const scope = req.branchScope!;
    const branchId = scope.mode === "branch" ? scope.branchId! : undefined;
    const report = await storage.getDailyReport(dateStr, branchId);
    res.json(report);
  });

  app.get("/api/reports/shifts-by-date", requireAuth, requirePermission("reports.view"), enforceBranchScope, async (req, res) => {
    const dateStr = req.query.date as string;
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ message: "التاريخ مطلوب بصيغة YYYY-MM-DD" });
    }
    const scope = req.branchScope!;
    const branchId = scope.mode === "branch" ? scope.branchId! : undefined;
    res.json(await storage.getShiftsByDate(dateStr, branchId));
  });

  app.get("/api/reports/branch-comparison", requireOwnerOrAdmin, async (req, res) => {
    const dateStr = req.query.date as string;
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ message: "التاريخ مطلوب بصيغة YYYY-MM-DD" });
    }
    res.json(await storage.getBranchComparisonReport(dateStr));
  });

  app.get("/api/reports/overview", requireAuth, requirePermission("reports.view"), enforceBranchScope, async (req, res) => {
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ message: "from & to required (YYYY-MM-DD)" });
    }
    const scope = req.branchScope!;
    const branchId = req.query.branchId ? Number(req.query.branchId) : (scope.mode === "branch" ? scope.branchId! : undefined);
    res.json(await storage.getOverviewReport(from, to, branchId));
  });

  app.get("/api/reports/sales-list", requireAuth, requirePermission("reports.view"), enforceBranchScope, async (req, res) => {
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ message: "from & to required (YYYY-MM-DD)" });
    }
    const scope = req.branchScope!;
    const branchId = req.query.branchId ? Number(req.query.branchId) : (scope.mode === "branch" ? scope.branchId! : undefined);
    const paymentMethod = req.query.paymentMethod as string | undefined;
    res.json(await storage.getSalesListReport(from, to, branchId, paymentMethod));
  });

  app.get("/api/reports/categories-report", requireAuth, requirePermission("reports.view"), enforceBranchScope, async (req, res) => {
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ message: "from & to required (YYYY-MM-DD)" });
    }
    const scope = req.branchScope!;
    const branchId = req.query.branchId ? Number(req.query.branchId) : (scope.mode === "branch" ? scope.branchId! : undefined);
    res.json(await storage.getCategoriesReport(from, to, branchId));
  });

  app.get("/api/reports/payments-report", requireAuth, requirePermission("reports.view"), enforceBranchScope, async (req, res) => {
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ message: "from & to required (YYYY-MM-DD)" });
    }
    const scope = req.branchScope!;
    const branchId = req.query.branchId ? Number(req.query.branchId) : (scope.mode === "branch" ? scope.branchId! : undefined);
    res.json(await storage.getPaymentsReport(from, to, branchId));
  });

  app.get("/api/reports/shifts-report", requireAuth, requirePermission("reports.view"), enforceBranchScope, async (req, res) => {
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ message: "from & to required (YYYY-MM-DD)" });
    }
    const scope = req.branchScope!;
    const branchId = req.query.branchId ? Number(req.query.branchId) : (scope.mode === "branch" ? scope.branchId! : undefined);
    res.json(await storage.getShiftsReport(from, to, branchId));
  });

  app.get("/api/reports/shift-details/:id", requireAuth, enforceBranchScope, async (req, res) => {
    const shiftId = Number(req.params.id);
    if (!shiftId) return res.status(400).json({ message: "shiftId required" });
    const details = await storage.getShiftDetails(shiftId);
    if (!details) return res.status(404).json({ message: "Shift not found" });
    res.json(details);
  });

  app.get("/api/reports/products-report", requireAuth, enforceBranchScope, async (req, res) => {
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ message: "from & to required (YYYY-MM-DD)" });
    }
    const scope = req.branchScope!;
    const branchId = req.query.branchId ? Number(req.query.branchId) : (scope.mode === "branch" ? scope.branchId! : undefined);
    res.json(await storage.getProfitByProducts(from, to, branchId));
  });

  app.get("/api/reports/branch-comparison-range", requireOwnerOrAdmin, async (req, res) => {
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ message: "from & to required (YYYY-MM-DD)" });
    }
    res.json(await storage.getBranchComparisonRange(from, to));
  });

  app.get("/api/reports/employee-performance/:id", requireOwnerOrAdmin, async (req, res) => {
    const employeeId = Number(req.params.id);
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ message: "التاريخ مطلوب بصيغة YYYY-MM-DD (from & to)" });
    }
    const user = await storage.getUser(employeeId);
    if (!user) return res.status(404).json({ message: "الموظف غير موجود" });
    const perf = await storage.getEmployeePerformance(employeeId, from, to);
    const { password: _, ...safeUser } = user;
    res.json({ employee: safeUser, performance: perf });
  });

  app.get("/api/reports/profit/branches", requireOwnerOrAdmin, async (req, res) => {
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ message: "التاريخ مطلوب بصيغة YYYY-MM-DD (from & to)" });
    }
    res.json(await storage.getProfitByBranches(from, to));
  });

  app.get("/api/reports/profit/employees", requireAuth, enforceBranchScope, async (req, res) => {
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ message: "التاريخ مطلوب بصيغة YYYY-MM-DD (from & to)" });
    }
    const scope = req.branchScope!;
    const branchId = scope.mode === "branch" ? scope.branchId! : undefined;
    res.json(await storage.getProfitByEmployees(from, to, branchId));
  });

  app.get("/api/reports/profit/products", requireAuth, enforceBranchScope, async (req, res) => {
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ message: "التاريخ مطلوب بصيغة YYYY-MM-DD (from & to)" });
    }
    const scope = req.branchScope!;
    const branchId = scope.mode === "branch" ? scope.branchId! : undefined;
    res.json(await storage.getProfitByProducts(from, to, branchId));
  });

  app.get("/api/purchases", requireAuth, requirePermission("purchases.view"), async (_req, res) => {
    const invoices = await storage.getPurchaseInvoices();
    const attRes = await pool.query("SELECT id, attachment_url FROM purchase_invoices");
    const attMap: Record<number, string | null> = {};
    for (const r of attRes.rows) attMap[r.id] = r.attachment_url;
    res.json(invoices.map(inv => ({ ...inv, attachmentUrl: attMap[inv.id] ?? null })));
  });

  app.get("/api/purchases/:id", requireAuth, requirePermission("purchases.view"), async (req, res) => {
    try {
      const invoice = await storage.getPurchaseInvoice(Number(req.params.id));
      if (!invoice) return res.status(404).json({ message: "فاتورة المشتريات غير موجودة" });
      const items = await storage.getPurchaseItems(invoice.id);

      const attRes = await pool.query("SELECT attachment_url FROM purchase_invoices WHERE id=$1", [invoice.id]);
      const attachmentUrl = attRes.rows[0]?.attachment_url ?? null;

      let attachments: any[] = [];
      try {
        const aRows = await pool.query(
          "SELECT id, filename, content_type FROM purchase_attachments WHERE purchase_id=$1 ORDER BY id",
          [invoice.id]
        );
        attachments = aRows.rows.map((r: any) => ({
          id: r.id,
          url: `/api/attachments/${r.id}`,
          filename: r.filename,
          contentType: r.content_type,
        }));
      } catch { /* الجدول غير موجود بعد — migration 0021 لم يُشغَّل */ }

      const attachmentUrls = attachments.length > 0
        ? attachments.map((a: any) => a.url)
        : attachmentUrl ? [attachmentUrl] : [];

      res.json({ ...invoice, items, attachmentUrl, attachmentUrls, attachments });
    } catch (err: any) {
      res.status(500).json({ message: "خطأ في جلب الفاتورة" });
    }
  });

  app.post("/api/purchases", requireAuth, requirePermission("purchases.create"), async (req, res) => {
    try {
      // القاعدة: branchId يُتجاهل دائماً — فواتير الشراء تُسجَّل في المخزن المركزي فقط
      const { supplierId, invoiceDate, shippingCost, customsCost, clearanceCost, otherCost, notes } = req.body;
      if (!invoiceDate) {
        return res.status(400).json({ message: "تاريخ الفاتورة مطلوب" });
      }
      const invoiceNumber = `PUR-${Date.now()}`;
      const data = {
        invoiceNumber,
        supplierId: supplierId || null,
        branchId: null,  // ← دائماً null — المخزن المركزي هو الوجهة الوحيدة
        invoiceDate,
        shippingCost: String(shippingCost || 0),
        customsCost: String(customsCost || 0),
        clearanceCost: String(clearanceCost || 0),
        otherCost: String(otherCost || 0),
        status: "pending" as const,
        notes: notes || null,
        createdBy: req.session.userId!,
      };
      const parsed = insertPurchaseInvoiceSchema.safeParse(data);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      res.status(201).json(await storage.createPurchaseInvoice(parsed.data));
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.patch("/api/purchases/:id", requireAuth, requirePermission("purchases.edit"), async (req, res) => {
    const id = Number(req.params.id);
    const invoice = await storage.getPurchaseInvoice(id);
    if (!invoice) return res.status(404).json({ message: "فاتورة المشتريات غير موجودة" });
    if (invoice.status !== "pending") {
      return res.status(400).json({ message: "لا يمكن تعديل فاتورة معتمدة أو ملغاة" });
    }
    const updateData: any = {};
    const { shippingCost, customsCost, clearanceCost, otherCost, notes, supplierId, paymentMethod, dueDate, discount, discountType, vatRate, vatAmount } = req.body;
    if (shippingCost !== undefined) updateData.shippingCost = String(shippingCost);
    if (customsCost !== undefined) updateData.customsCost = String(customsCost);
    if (clearanceCost !== undefined) updateData.clearanceCost = String(clearanceCost);
    if (otherCost !== undefined) updateData.otherCost = String(otherCost);
    if (notes !== undefined) updateData.notes = notes;
    if (supplierId !== undefined) updateData.supplierId = supplierId;
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (dueDate !== undefined) updateData.dueDate = dueDate;
    if (discount !== undefined) updateData.discount = String(discount);
    if (discountType !== undefined) updateData.discountType = discountType;
    if (vatRate !== undefined) updateData.vatRate = String(vatRate);
    if (vatAmount !== undefined) updateData.vatAmount = String(vatAmount);
    const row = await storage.updatePurchaseInvoice(id, updateData);
    res.json(row);
  });

  app.post("/api/purchases/:id/items", requireAuth, requirePermission("purchases.create"), async (req, res) => {
    try {
      const purchaseId = Number(req.params.id);
      const invoice = await storage.getPurchaseInvoice(purchaseId);
      if (!invoice) return res.status(404).json({ message: "فاتورة المشتريات غير موجودة" });
      if (invoice.status !== "pending")
        return res.status(400).json({ message: "لا يمكن إضافة أصناف لفاتورة معتمدة أو مستلمة" });

      const parsed = addPurchaseItemSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: formatZodError(parsed.error) });

      const { productId, qty, unitCostBase, variantId } = parsed.data;
      const lineSubtotal = qty * unitCostBase;
      const item = await storage.addPurchaseItem({
        purchaseId,
        productId,
        variantId: variantId ?? null,
        qty,
        unitCostBase:      unitCostBase.toFixed(3),
        lineSubtotal:      lineSubtotal.toFixed(3),
        allocatedExtraCost: "0",
        unitCostFinal:      "0",
      });
      res.status(201).json(item);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.patch("/api/purchases/:purchaseId/items/:itemId", requireAuth, requirePermission("purchases.edit"), async (req, res) => {
    const purchaseId = Number(req.params.purchaseId);
    const invoice = await storage.getPurchaseInvoice(purchaseId);
    if (!invoice) return res.status(404).json({ message: "فاتورة المشتريات غير موجودة" });
    if (invoice.status !== "pending") {
      return res.status(400).json({ message: "لا يمكن تعديل أصناف فاتورة معتمدة أو ملغاة" });
    }
    const itemId = Number(req.params.itemId);
    const { qty, unitCostBase, barcode, color, size, productName } = req.body;

    const updated = await storage.updatePurchaseItem(itemId, {
      qty: qty !== undefined ? Number(qty) : undefined,
      unitCostBase: unitCostBase !== undefined ? Number(unitCostBase) : undefined,
    });
    if (!updated) return res.status(404).json({ message: "الصنف غير موجود" });

    if (updated.variantId && (barcode !== undefined || color !== undefined || size !== undefined)) {
      const variantUpdates: any = {};
      if (barcode !== undefined) variantUpdates.barcode = barcode || null;
      if (color !== undefined) variantUpdates.color = color || null;
      if (size !== undefined) variantUpdates.size = size || null;
      await storage.updateVariant(updated.variantId, variantUpdates);
    }

    if (productName !== undefined && updated.productId) {
      await storage.updateProduct(updated.productId, { name: productName });
    }

    res.json(updated);
  });

  app.delete("/api/purchases/:purchaseId/items/:itemId", requireAuth, requirePermission("purchases.delete"), async (req, res) => {
    const purchaseId = Number(req.params.purchaseId);
    const invoice = await storage.getPurchaseInvoice(purchaseId);
    if (!invoice) return res.status(404).json({ message: "فاتورة المشتريات غير موجودة" });
    if (invoice.status !== "pending") {
      return res.status(400).json({ message: "لا يمكن حذف أصناف من فاتورة معتمدة أو ملغاة" });
    }
    await storage.deletePurchaseItem(Number(req.params.itemId));
    res.json({ message: "تم الحذف" });
  });

  app.delete("/api/purchases/:id", requireAuth, requireManager, async (req, res) => {
    const client = await pool.connect();
    try {
      const id = Number(req.params.id);
      const invRes = await client.query(
        "SELECT pi.*, COALESCE(pi.grand_total::numeric, 0) AS grand_total_num FROM purchase_invoices pi WHERE pi.id=$1",
        [id]
      );
      if (!invRes.rows.length) return res.status(404).json({ message: "الفاتورة غير موجودة" });
      const inv = invRes.rows[0];

      await client.query("BEGIN");

      // إذا كانت الفاتورة معتمدة أو مستلمة → عكس تأثيرها على المخزون
      if (inv.status === "approved" || inv.status === "received") {
        const itemsRes = await client.query(
          `SELECT pi.*, pv.id AS resolved_variant_id
           FROM purchase_items pi
           LEFT JOIN product_variants pv ON pv.id = pi.variant_id
           WHERE pi.purchase_id = $1`,
          [id]
        );
        const items = itemsRes.rows;

        for (const item of items) {
          const qty = item.qty;
          const variantId = item.variant_id;

          // عكس inventory_balances
          if (variantId) {
            await client.query(
              `UPDATE inventory_balances
               SET qty_on_hand = GREATEST(0, qty_on_hand - $1)
               WHERE variant_id = $2`,
              [qty, variantId]
            );
            // سجل حركة عكسية في inventory_ledger
            await client.query(
              `INSERT INTO inventory_ledger (variant_id, location_id, qty_change, reason, ref_table, ref_id, created_by, created_at)
               SELECT $1, location_id, $2, 'purchase_reversed', 'purchase_invoices', $3, $4, now()
               FROM inventory_balances WHERE variant_id = $1 LIMIT 1`,
              [variantId, -qty, id, req.session.userId]
            );
          }

          // عكس location_inventory
          await client.query(
            `UPDATE location_inventory
             SET qty_on_hand = GREATEST(0, qty_on_hand - $1), updated_at = now()
             WHERE product_id = $2`,
            [qty, item.product_id]
          );

          // عكس stock_qty في products
          await client.query(
            `UPDATE products SET stock_qty = GREATEST(0, COALESCE(stock_qty,0) - $1) WHERE id = $2`,
            [qty, item.product_id]
          );
        }

        // عكس رصيد المورد
        const grandTotal = parseFloat(inv.grand_total || inv.total_amount || "0");
        if (grandTotal > 0 && inv.supplier_id) {
          await client.query(
            `UPDATE suppliers
             SET total_purchases = GREATEST(0, COALESCE(total_purchases,0) - $1),
                 balance         = GREATEST(0, COALESCE(balance,0) - $1)
             WHERE id = $2`,
            [grandTotal, inv.supplier_id]
          );
        }
      }

      // حذف السجلات المرتبطة ثم الفاتورة
      try { await client.query("DELETE FROM purchase_attachments WHERE purchase_id=$1", [id]); } catch {}
      try { await client.query("DELETE FROM purchase_extra_costs WHERE purchase_invoice_id=$1", [id]); } catch {}
      try { await client.query("DELETE FROM inventory_transactions WHERE ref_table='purchase_invoices' AND ref_id=$1", [id]); } catch {}
      await client.query("DELETE FROM purchase_items WHERE purchase_id=$1", [id]);
      await client.query("DELETE FROM purchase_invoices WHERE id=$1", [id]);

      await client.query("COMMIT");
      res.json({ success: true });
    } catch (err: any) {
      await client.query("ROLLBACK");
      res.status(500).json({ message: err?.message ?? "خطأ في الحذف" });
    } finally {
      client.release();
    }
  });

  app.patch("/api/purchases/:id/status", requireAuth, requirePermission("purchases.edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const parsed = patchPurchaseStatusSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: formatZodError(parsed.error) });

      const invoice = await storage.getPurchaseInvoice(id);
      if (!invoice) return res.status(404).json({ message: "فاتورة المشتريات غير موجودة" });

      if (parsed.data.status === "approved") {
        if (invoice.status !== "pending")
          return res.status(400).json({ message: "يمكن اعتماد الفواتير بحالة (pending) فقط" });
        const result = await storage.approvePurchaseInvoice(id);
        journalForPurchase({
          id: result.id,
          invoiceNumber: result.invoiceNumber || "",
          grandTotal:    result.grandTotal    || "0",
          supplierId:    result.supplierId,
          branchId:      result.branchId,
          createdBy:     result.createdBy,
          invoiceDate:   result.invoiceDate   || new Date().toISOString().slice(0, 10),
        }).catch(err => console.error("[AutoJournal] Purchase error:", err.message));
        return res.json(result);
      }

      if (parsed.data.status === "received") {
        if (invoice.status !== "approved")
          return res.status(400).json({ message: "يجب اعتماد الفاتورة أولاً قبل الاستلام" });
        const result = await storage.receivePurchaseInvoice(id);
        return res.json(result);
      }
    } catch (err: any) {
      res.status(400).json({ message: err?.message ?? "فشل تحديث الحالة" });
    }
  });

  app.post("/api/purchase-invoices/:id/approve", requireAuth, requirePermission("purchases.edit"), async (req, res) => {
    try {
      const result = await storage.approvePurchaseInvoice(Number(req.params.id));

      journalForPurchase({
        id: result.id,
        invoiceNumber: result.invoiceNumber || "",
        grandTotal: result.grandTotal || "0",
        supplierId: result.supplierId,
        branchId: result.branchId,
        createdBy: result.createdBy,
        invoiceDate: result.invoiceDate || new Date().toISOString().slice(0, 10),
      }).catch(err => console.error("[AutoJournal] Purchase error:", err.message));

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err?.message ?? "فشل الترحيل" });
    }
  });

  app.post("/api/purchases/:purchaseId/invoice-image", requireAuth, uploadLimiter, upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.json({ ok: false, stage: "upload", error: "لم يتم رفع صورة" });
      }
      const { fileId } = await saveUploadedFile(req.file.buffer, req.file.originalname);
      res.json({ ok: true, fileId });
    } catch (err: any) {
      console.error("Upload error:", err);
      res.json({ ok: false, stage: "upload", error: err?.message ?? "فشل رفع الملف" });
    }
  });

  // ── رفع مرفق — يُخزَّن في PostgreSQL (دائم، لا يُحذف عند إعادة النشر) ──
  app.post("/api/purchases/:purchaseId/attachment", requireAuth, requirePermission("purchases.edit"), uploadLimiter, upload.single("file"), async (req: any, res) => {
    try {
      const purchaseId = Number(req.params.purchaseId);
      if (!req.file) return res.json({ ok: false, error: "لم يتم رفع صورة" });

      // خزّن في جدول purchase_attachments (بيانات base64 في PostgreSQL)
      const base64Data = req.file.buffer.toString("base64");
      const contentType = req.file.mimetype || "image/jpeg";
      const filename = req.file.originalname || `attachment_${Date.now()}`;

      const ins = await pool.query(
        "INSERT INTO purchase_attachments (purchase_id, filename, content_type, data) VALUES ($1,$2,$3,$4) RETURNING id",
        [purchaseId, filename, contentType, base64Data]
      );
      const attachId = ins.rows[0].id;
      const attachmentUrl = `/api/attachments/${attachId}`;

      // حدّث attachment_url للتوافق مع قائمة الفواتير
      await pool.query("UPDATE purchase_invoices SET attachment_url=$1 WHERE id=$2", [attachmentUrl, purchaseId]);

      res.json({ ok: true, attachmentUrl, attachmentId: attachId });
    } catch (err: any) {
      console.error("Attachment upload error:", err);
      res.json({ ok: false, error: err?.message ?? "فشل رفع المرفق" });
    }
  });

  // ── خدمة المرفق من قاعدة البيانات ──
  app.get("/api/attachments/:id", async (req, res) => {
    try {
      const attachId = Number(req.params.id);
      const row = await pool.query("SELECT filename, content_type, data FROM purchase_attachments WHERE id=$1", [attachId]);
      if (!row.rows[0]) return res.status(404).json({ error: "المرفق غير موجود" });
      const { filename, content_type, data } = row.rows[0];
      const buffer = Buffer.from(data, "base64");
      res.setHeader("Content-Type", content_type);
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(filename)}"`);
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  });

  // ── حذف مرفق بالـ ID ──
  app.delete("/api/attachments/:id", requireAuth, requirePermission("purchases.edit"), async (req, res) => {
    try {
      const attachId = Number(req.params.id);
      // جلب purchase_id لتحديث attachment_url
      const row = await pool.query("SELECT purchase_id FROM purchase_attachments WHERE id=$1", [attachId]);
      if (!row.rows[0]) return res.json({ ok: false, error: "المرفق غير موجود" });
      const purchaseId = row.rows[0].purchase_id;
      await pool.query("DELETE FROM purchase_attachments WHERE id=$1", [attachId]);
      // تحديث attachment_url لآخر مرفق متبقي
      const remaining = await pool.query("SELECT id FROM purchase_attachments WHERE purchase_id=$1 ORDER BY id DESC LIMIT 1", [purchaseId]);
      const newUrl = remaining.rows[0] ? `/api/attachments/${remaining.rows[0].id}` : null;
      await pool.query("UPDATE purchase_invoices SET attachment_url=$1 WHERE id=$2", [newUrl, purchaseId]);
      // إرجاع قائمة المرفقات المتبقية
      const all = await pool.query("SELECT id, filename FROM purchase_attachments WHERE purchase_id=$1 ORDER BY id", [purchaseId]);
      res.json({ ok: true, attachments: all.rows.map((r: any) => ({ id: r.id, url: `/api/attachments/${r.id}`, filename: r.filename })) });
    } catch (err: any) {
      res.json({ ok: false, error: err?.message });
    }
  });

  // ── قائمة مرفقات فاتورة ──
  app.get("/api/purchases/:purchaseId/attachments", requireAuth, requirePermission("purchases.view"), async (req, res) => {
    try {
      const purchaseId = Number(req.params.purchaseId);
      const rows = await pool.query("SELECT id, filename, content_type, created_at FROM purchase_attachments WHERE purchase_id=$1 ORDER BY id", [purchaseId]);
      res.json(rows.rows.map((r: any) => ({ id: r.id, url: `/api/attachments/${r.id}`, filename: r.filename, contentType: r.content_type })));
    } catch (err: any) {
      res.json([]);
    }
  });

  // ── حذف كل المرفقات (للتوافق القديم) ──
  app.delete("/api/purchases/:purchaseId/attachment", requireAuth, requirePermission("purchases.edit"), async (req, res) => {
    try {
      const purchaseId = Number(req.params.purchaseId);
      await pool.query("DELETE FROM purchase_attachments WHERE purchase_id=$1", [purchaseId]);
      await pool.query("UPDATE purchase_invoices SET attachment_url=NULL WHERE id=$1", [purchaseId]);
      res.json({ ok: true });
    } catch (err: any) {
      res.json({ ok: false, error: err?.message });
    }
  });

  app.post("/api/purchases/:purchaseId/parse-invoice", requireAuth, requirePermission("purchases.edit"), async (req, res) => {
    try {
      const { fileId } = req.body;
      if (!fileId) {
        return res.json({ ok: false, stage: "parse", error: "fileId مطلوب" });
      }

      const purchaseId = Number(req.params.purchaseId);
      const invoice = await storage.getPurchaseInvoice(purchaseId);
      let template: { tableStartKeyword?: string | null; columnOrder?: string | null } | undefined;

      if (invoice?.supplierId) {
        const saved = await storage.getSupplierOcrTemplate(invoice.supplierId);
        if (saved) {
          template = {
            tableStartKeyword: saved.tableStartKeyword,
            columnOrder: saved.columnOrder,
          };
        }
      }

      const result = await parseInvoiceFile(fileId, template);

      if (result.ok && result.parsed.detectedTemplate && invoice?.supplierId) {
        const dt = result.parsed.detectedTemplate;
        if (dt.tableStartKeyword || dt.columnOrder) {
          try {
            await storage.upsertSupplierOcrTemplate(invoice.supplierId, {
              tableStartKeyword: dt.tableStartKeyword,
              columnOrder: dt.columnOrder,
            });
          } catch (e) {
            console.error("Failed to save OCR template:", e);
          }
        }
      }

      res.json(result);
    } catch (err: any) {
      console.error("Parse error:", err);
      res.json({ ok: false, stage: "parse", error: err?.message ?? "فشل قراءة الفاتورة" });
    }
  });

  app.post("/api/purchases/:id/receive", requireAuth, requirePermission("purchases.edit"), async (req, res) => {
    try {
      const result = await storage.receivePurchaseInvoice(Number(req.params.id));
      res.json(result);
    } catch (err: any) {
      const status = err?.message?.includes("مستلمة مسبقاً") ? 409 : 400;
      res.status(status).json({ message: err?.message ?? "فشل الاستلام" });
    }
  });

  app.get("/api/cash-ledger", requireAuth, enforceBranchScope, async (req, res) => {
    const { date } = req.query;
    const branchId = req.branchScope!.mode === "branch" ? (req.branchScope!.branchId ?? undefined) : (req.query.branchId ? Number(req.query.branchId) : undefined);
    const filterDate = date ? String(date) : new Date().toISOString().slice(0, 10);
    const entries = await storage.getCashLedgerByDate(branchId, filterDate);
    res.json(entries);
  });

  app.get("/api/bank-ledger", requireAuth, enforceBranchScope, async (req, res) => {
    const { date } = req.query;
    const branchId = req.branchScope!.mode === "branch" ? (req.branchScope!.branchId ?? undefined) : (req.query.branchId ? Number(req.query.branchId) : undefined);
    const filterDate = date ? String(date) : new Date().toISOString().slice(0, 10);
    const entries = await storage.getBankLedgerByDate(branchId, filterDate);
    res.json(entries);
  });

  app.get("/api/cash-ledger/summary", requireAuth, enforceBranchScope, async (req, res) => {
    const { date } = req.query;
    const branchId = req.branchScope!.mode === "branch" ? (req.branchScope!.branchId ?? undefined) : (req.query.branchId ? Number(req.query.branchId) : undefined);
    const filterDate = date ? String(date) : new Date().toISOString().slice(0, 10);
    const summary = await storage.getDailyCashSummary(branchId, filterDate);
    res.json(summary);
  });

  app.post("/api/cash-ledger/deposit", requireAuth, requirePermission("cash.deposit"), async (req, res) => {
    try {
      const { amount, note } = req.body;
      if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ message: "المبلغ مطلوب ويجب أن يكون أكبر من صفر" });
      const user = await storage.getUser(req.session.userId!);
      if (!user || !user.branchId) return res.status(400).json({ message: "بيانات المستخدم ناقصة" });
      let shiftId: number | null = null;
      if (user.terminalName) {
        const shift = await storage.getCurrentShift(user.branchId, user.terminalName);
        if (shift) shiftId = shift.id;
      }
      const entry = await storage.addCashLedgerEntry({
        date: new Date().toISOString().slice(0, 10),
        branchId: user.branchId,
        shiftId,
        type: "deposit",
        amountIn: String(amount),
        amountOut: "0",
        category: "إيداع",
        note: note || "إيداع نقدي للصندوق",
        createdBy: user.id,
      });
      res.status(201).json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/cash-ledger/withdrawal", requireAuth, requirePermission("cash.withdraw"), async (req, res) => {
    try {
      const { amount, note } = req.body;
      if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ message: "المبلغ مطلوب ويجب أن يكون أكبر من صفر" });
      const user = await storage.getUser(req.session.userId!);
      if (!user || !user.branchId) return res.status(400).json({ message: "بيانات المستخدم ناقصة" });
      let shiftId: number | null = null;
      if (user.terminalName) {
        const shift = await storage.getCurrentShift(user.branchId, user.terminalName);
        if (shift) shiftId = shift.id;
      }
      const entry = await storage.addCashLedgerEntry({
        date: new Date().toISOString().slice(0, 10),
        branchId: user.branchId,
        shiftId,
        type: "withdrawal",
        amountIn: "0",
        amountOut: String(amount),
        category: "سحب",
        note: note || "سحب نقدي من الصندوق",
        createdBy: user.id,
      });
      res.status(201).json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/shifts/closed", requireAuth, enforceBranchScope, async (req, res) => {
    const { date } = req.query;
    const branchId = req.branchScope!.mode === "branch" ? (req.branchScope!.branchId ?? undefined) : (req.query.branchId ? Number(req.query.branchId) : undefined);
    const filterDate = date ? String(date) : new Date().toISOString().slice(0, 10);
    const closedShifts = await storage.getClosedShiftsByDate(branchId, filterDate);
    res.json(closedShifts);
  });

  app.get("/api/recent-operations", requireAuth, async (req, res) => {
    try {
      const { from, to, branchId, type, search } = req.query;
      const params: any[] = [];
      let idx = 1;

      let dateFilter = "";
      if (from) {
        dateFilter += ` AND op_time >= $${idx++}::timestamp`;
        params.push(from + " 00:00:00");
      }
      if (to) {
        dateFilter += ` AND op_time <= $${idx++}::timestamp`;
        params.push(to + " 23:59:59.999");
      }
      let branchFilter = "";
      if (branchId) {
        branchFilter = ` AND branch_id = $${idx++}`;
        params.push(Number(branchId));
      }
      let typeFilter = "";
      if (type) {
        typeFilter = ` AND op_type = $${idx++}`;
        params.push(type);
      }
      let searchFilter = "";
      if (search) {
        searchFilter = ` AND (ref_number ILIKE $${idx} OR user_name ILIKE $${idx} OR note ILIKE $${idx})`;
        params.push(`%${search}%`);
        idx++;
      }

      const query = `
        SELECT * FROM (
          SELECT
            s.created_at as op_time,
            s.branch_id,
            (b.name || CASE WHEN b.address IS NOT NULL AND b.address <> '' THEN ' - ' || b.address ELSE '' END) as branch_name,
            s.cashier_id as user_id,
            u.name as user_name,
            'sale' as op_type,
            s.invoice_number as ref_number,
            s.total::text as amount,
            ('بيع - ' || s.payment_method || ' - ' || COALESCE(s.invoice_number,'')) as note
          FROM sales s
          LEFT JOIN branches b ON b.id = s.branch_id
          LEFT JOIN users u ON u.id = s.cashier_id

          UNION ALL

          SELECT
            sh.started_at as op_time,
            sh.branch_id,
            (b.name || CASE WHEN b.address IS NOT NULL AND b.address <> '' THEN ' - ' || b.address ELSE '' END) as branch_name,
            sh.cashier_id as user_id,
            u.name as user_name,
            'shift_open' as op_type,
            ('SH-' || sh.id) as ref_number,
            sh.opening_cash::text as amount,
            ('افتتاح شفت - صندوق: ' || COALESCE(sh.opening_cash::text,'0')) as note
          FROM shifts sh
          LEFT JOIN branches b ON b.id = sh.branch_id
          LEFT JOIN users u ON u.id = sh.cashier_id
          WHERE sh.status = 'open' OR sh.status = 'closed'

          UNION ALL

          SELECT
            sh.ended_at as op_time,
            sh.branch_id,
            (b.name || CASE WHEN b.address IS NOT NULL AND b.address <> '' THEN ' - ' || b.address ELSE '' END) as branch_name,
            sh.cashier_id as user_id,
            u.name as user_name,
            'shift_close' as op_type,
            ('SH-' || sh.id) as ref_number,
            sh.total_sales::text as amount,
            ('إغلاق شفت - مبيعات: ' || COALESCE(sh.total_sales::text,'0') || ' - فرق: ' || COALESCE(sh.difference::text,'0')) as note
          FROM shifts sh
          LEFT JOIN branches b ON b.id = sh.branch_id
          LEFT JOIN users u ON u.id = sh.cashier_id
          WHERE sh.status = 'closed' AND sh.ended_at IS NOT NULL

          UNION ALL

          SELECT
            e.created_at as op_time,
            e.branch_id,
            (b.name || CASE WHEN b.address IS NOT NULL AND b.address <> '' THEN ' - ' || b.address ELSE '' END) as branch_name,
            e.created_by as user_id,
            u.name as user_name,
            'expense' as op_type,
            ('EXP-' || e.id) as ref_number,
            e.amount::text as amount,
            ('مصروف: ' || e.category || ' - ' || COALESCE(e.notes,'')) as note
          FROM expenses e
          LEFT JOIN branches b ON b.id = e.branch_id
          LEFT JOIN users u ON u.id = e.created_by

          UNION ALL

          SELECT
            lt.created_at as op_time,
            lt.branch_id,
            (b.name || CASE WHEN b.address IS NOT NULL AND b.address <> '' THEN ' - ' || b.address ELSE '' END) as branch_name,
            lt.created_by as user_id,
            u.name as user_name,
            'transfer' as op_type,
            ('TR-' || lt.id) as ref_number,
            NULL as amount,
            ('تحويل مخزون: ' || COALESCE(lf.name,'') || ' → ' || COALESCE(lt2.name,'') || COALESCE(' - ' || lt.note,'')) as note
          FROM location_transfers lt
          LEFT JOIN branches b ON b.id = lt.branch_id
          LEFT JOIN users u ON u.id = lt.created_by
          LEFT JOIN locations lf ON lf.id = lt.from_location_id
          LEFT JOIN locations lt2 ON lt2.id = lt.to_location_id

          UNION ALL

          SELECT
            o.created_at as op_time,
            o.branch_id,
            (b.name || CASE WHEN b.address IS NOT NULL AND b.address <> '' THEN ' - ' || b.address ELSE '' END) as branch_name,
            o.employee_id as user_id,
            u.name as user_name,
            'order' as op_type,
            o.order_number as ref_number,
            o.total::text as amount,
            ('طلب - ' || o.customer_name || ' - ' || o.status) as note
          FROM orders o
          LEFT JOIN branches b ON b.id = o.branch_id
          LEFT JOIN users u ON u.id = o.employee_id

          UNION ALL

          SELECT
            sr.created_at as op_time,
            sr.branch_id,
            (b.name || CASE WHEN b.address IS NOT NULL AND b.address <> '' THEN ' - ' || b.address ELSE '' END) as branch_name,
            sr.created_by as user_id,
            u.name as user_name,
            'return' as op_type,
            sr.return_number as ref_number,
            sr.refund_amount::text as amount,
            ('مرتجع - ' || COALESCE(sr.reason,'')) as note
          FROM sale_returns sr
          LEFT JOIN branches b ON b.id = sr.branch_id
          LEFT JOIN users u ON u.id = sr.created_by

          UNION ALL

          SELECT
            pi.created_at as op_time,
            pi.branch_id,
            (b.name || CASE WHEN b.address IS NOT NULL AND b.address <> '' THEN ' - ' || b.address ELSE '' END) as branch_name,
            pi.created_by as user_id,
            u.name as user_name,
            'purchase' as op_type,
            pi.invoice_number as ref_number,
            pi.grand_total::text as amount,
            ('فاتورة مشتريات - ' || COALESCE(sup.name,'') || ' - ' || pi.status) as note
          FROM purchase_invoices pi
          LEFT JOIN branches b ON b.id = pi.branch_id
          LEFT JOIN users u ON u.id = pi.created_by
          LEFT JOIN suppliers sup ON sup.id = pi.supplier_id
        ) ops
        WHERE op_time IS NOT NULL
        ${dateFilter}
        ${branchFilter}
        ${typeFilter}
        ${searchFilter}
        ORDER BY op_time DESC
        LIMIT 500
      `;

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/stocktakes", requireAuth, requirePermission("inventory.count"), async (req, res) => {
    try {
      const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
      const list = await storage.getStocktakes(branchId);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/stocktakes", requireAuth, requirePermission("inventory.count"), async (req, res) => {
    try {
      const { branchId, locationId, note } = req.body;
      if (!branchId || !locationId) return res.status(400).json({ message: "الفرع والموقع مطلوبان" });
      const st = await storage.createStocktake({
        branchId: Number(branchId),
        locationId: Number(locationId),
        status: "draft",
        note: note || null,
        createdBy: req.session.userId!,
      });
      res.status(201).json(st);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/stocktakes/:id/items", requireAuth, requirePermission("inventory.count"), async (req, res) => {
    try {
      const items = await storage.getStocktakeItems(Number(req.params.id));
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.patch("/api/stocktake-items/:id", requireAuth, requirePermission("inventory.count"), async (req, res) => {
    try {
      const { countedQty, note } = req.body;
      if (countedQty === undefined || countedQty === null) return res.status(400).json({ message: "الكمية المعدودة مطلوبة" });
      const updated = await storage.updateStocktakeItem(Number(req.params.id), Number(countedQty), note);
      if (!updated) return res.status(404).json({ message: "العنصر غير موجود" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/stocktakes/:id/approve", requireAuth, requirePermission("inventory.count"), async (req, res) => {
    try {
      const updated = await storage.approveStocktake(Number(req.params.id), req.session.userId!);
      if (!updated) return res.status(400).json({ message: "لا يمكن اعتماد هذا الجرد" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/inventory-adjustments", requireAuth, requirePermission("inventory.count"), async (req, res) => {
    try {
      const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
      const locationId = req.query.locationId ? Number(req.query.locationId) : undefined;
      const list = await storage.getInventoryAdjustments(branchId, locationId);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/inventory-adjustments", requireAuth, requirePermission("inventory.count"), async (req, res) => {
    try {
      const { branchId, locationId, productId, qtyChange, reason } = req.body;
      if (!branchId || !locationId || !productId || qtyChange === undefined || !reason) {
        return res.status(400).json({ message: "جميع الحقول مطلوبة" });
      }
      const invRow = await pool.query(
        `SELECT qty_on_hand FROM location_inventory WHERE location_id = $1 AND product_id = $2`,
        [locationId, productId]
      );
      const qtyBefore = invRow.rows[0]?.qty_on_hand || 0;
      const qtyAfter = qtyBefore + Number(qtyChange);
      if (qtyAfter < 0) return res.status(400).json({ message: "الكمية الناتجة لا يمكن أن تكون سالبة" });

      await pool.query(
        `INSERT INTO location_inventory (location_id, product_id, qty_on_hand)
         VALUES ($1, $2, $3)
         ON CONFLICT (location_id, product_id) DO UPDATE SET qty_on_hand = $3, updated_at = now()`,
        [locationId, productId, qtyAfter]
      );

      const adj = await storage.createInventoryAdjustment({
        branchId: Number(branchId),
        locationId: Number(locationId),
        productId: Number(productId),
        type: Number(qtyChange) > 0 ? "increase" : "decrease",
        qtyBefore,
        qtyChange: Number(qtyChange),
        qtyAfter,
        reason,
        createdBy: req.session.userId!,
      });

      const todayStr = new Date().toISOString().slice(0, 10);
      await pool.query(
        `INSERT INTO inventory_transactions (date, branch_id, ${Number(qtyChange) > 0 ? 'to_location_id' : 'from_location_id'}, product_id, type, qty, note, created_by)
         VALUES ($1, $2, $3, $4, 'manual_adjustment', $5, $6, $7)`,
        [todayStr, branchId, locationId, productId, Math.abs(Number(qtyChange)), reason, req.session.userId]
      );

      storage.addAuditLog({
        action: "inventory_adjustment",
        entityType: "inventory",
        entityId: adj.id,
        branchId: Number(branchId),
        userId: req.session.userId ?? null,
        userName: null,
        details: `تعديل مخزون المنتج ${productId}: ${qtyBefore} → ${qtyAfter} (${reason})`,
        oldValue: JSON.stringify({ qty: qtyBefore }),
        newValue: JSON.stringify({ qty: qtyAfter }),
      }).catch(() => {});

      res.status(201).json(adj);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/payroll/remaining-by-employee", requireAuth, requireManager, async (_req, res) => {
    try {
      res.json(await storage.getPayrollRemainingByEmployee());
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "Internal Server Error" });
    }
  });

  app.get("/api/employee-commissions", requireAuth, requireManager, async (req, res) => {
    try {
      const { employeeId, month, year } = req.query;
      res.json(await storage.getEmployeeCommissions(
        employeeId ? Number(employeeId) : undefined,
        month ? String(month) : undefined,
        year ? Number(year) : undefined
      ));
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "Internal Server Error" });
    }
  });

  app.post("/api/employee-commissions", requireAuth, requireManager, async (req, res) => {
    try {
      const { employeeId, amount, date, month, year, type, note } = req.body;
      const commission = await storage.createEmployeeCommission({
        employeeId: Number(employeeId),
        amount: String(amount),
        date: new Date(date),
        month: String(month),
        year: Number(year),
        type: type || "sales",
        note: note || null,
        status: "pending",
        createdBy: req.session.userId!
      });
      res.status(201).json(commission);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "Internal Server Error" });
    }
  });

  app.get("/api/employee-entitlements", requireAuth, requireManager, async (req, res) => {
    try {
      const { employeeId, month, year } = req.query;
      res.json(await storage.getEmployeeEntitlements(
        employeeId ? Number(employeeId) : undefined,
        month ? String(month) : undefined,
        year ? Number(year) : undefined
      ));
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "Internal Server Error" });
    }
  });

  app.post("/api/employee-entitlements", requireAuth, requireManager, async (req, res) => {
    try {
      const { employeeId, amount, date, month, year, type, note } = req.body;
      const entitlement = await storage.createEmployeeEntitlement({
        employeeId: Number(employeeId),
        amount: String(amount),
        date: new Date(date),
        month: String(month),
        year: Number(year),
        type: type || "other",
        note: note || null,
        status: "pending",
        createdBy: req.session.userId!
      });
      res.status(201).json(entitlement);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "Internal Server Error" });
    }
  });

  app.get("/api/payroll-runs", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.month) filters.month = String(req.query.month);
      if (req.query.year) filters.year = Number(req.query.year);
      if (req.query.status) filters.status = String(req.query.status);
      const runs = await storage.getPayrollRuns(filters);
      res.json(runs);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/payroll-runs", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const { month, year, note, periodStart, periodEnd } = req.body;
      if (!month || !year) return res.status(400).json({ message: "الشهر والسنة مطلوبة" });
      const existing = await pool.query(
        `SELECT id FROM payroll_runs WHERE month = $1 AND year = $2 AND status != 'cancelled'`,
        [String(month), Number(year)]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ message: "يوجد كشف رواتب لهذا الشهر مسبقاً", existingId: existing.rows[0].id });
      }
      const run = await storage.createPayrollRun({
        month: String(month),
        year: Number(year),
        status: "draft",
        periodStart: periodStart || null,
        periodEnd: periodEnd || null,
        note: note || null,
        createdBy: req.session.userId!,
      });
      await storage.generatePayrollRun(run.id, String(month), Number(year));

      await storage.addAuditLog({
        action: "payroll_generate", entityType: "payroll_run", entityId: run.id,
        userId: req.session.userId!, userName: req.session.userName || "",
        details: `توليد كشف راتب ${month}/${year}`,
      });

      const updated = await storage.getPayrollRun(run.id);
      res.status(201).json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/payroll-runs/:id/regenerate", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const run = await storage.getPayrollRun(Number(req.params.id));
      if (!run) return res.status(404).json({ message: "كشف الرواتب غير موجود" });
      if (run.status !== "draft") return res.status(400).json({ message: "لا يمكن إعادة احتساب كشف معتمد" });
      await storage.generatePayrollRun(run.id, run.month, run.year);
      const updated = await storage.getPayrollRun(run.id);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/payroll-runs/:id/approve", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const updated = await storage.approvePayrollRun(Number(req.params.id), req.session.userId!);
      if (!updated) return res.status(400).json({ message: "لا يمكن اعتماد هذا الكشف" });
      await storage.addAuditLog({
        action: "payroll_approve", entityType: "payroll_run", entityId: updated.id,
        userId: req.session.userId!, userName: req.session.userName || "",
        details: `اعتماد كشف راتب ${updated.month}/${updated.year}`,
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/payroll-runs/:id/review", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const updated = await storage.reviewPayrollRun(Number(req.params.id), req.session.userId!);
      if (!updated) return res.status(400).json({ message: "لا يمكن مراجعة هذا الكشف" });
      await storage.addAuditLog({
        action: "payroll_review", entityType: "payroll_run", entityId: updated.id,
        userId: req.session.userId!, userName: req.session.userName || "",
        details: `مراجعة كشف راتب ${updated.month}/${updated.year}`,
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/payroll-runs/:id/reopen", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "owner") return res.status(403).json({ message: "فقط المالك يمكنه إعادة فتح الكشف" });
      const updated = await storage.reopenPayrollRun(Number(req.params.id), req.session.userId!);
      if (!updated) return res.status(400).json({ message: "لا يمكن إعادة فتح هذا الكشف" });
      await storage.addAuditLog({
        action: "payroll_reopen", entityType: "payroll_run", entityId: updated.id,
        userId: req.session.userId!, userName: req.session.userName || "",
        details: `إعادة فتح كشف راتب ${updated.month}/${updated.year}`,
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/payroll-runs/:id/cancel", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "owner") return res.status(403).json({ message: "فقط المالك يمكنه إلغاء الكشف" });
      const updated = await storage.cancelPayrollRun(Number(req.params.id), req.session.userId!);
      if (!updated) return res.status(400).json({ message: "لا يمكن إلغاء هذا الكشف" });
      await storage.addAuditLog({
        action: "payroll_cancel", entityType: "payroll_run", entityId: updated.id,
        userId: req.session.userId!, userName: req.session.userName || "",
        details: `إلغاء كشف راتب ${updated.month}/${updated.year}`,
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/payroll-runs/:id/details", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const details = await storage.getPayrollDetails(Number(req.params.id));
      res.json(details);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/employee-advances", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
      const advances = await storage.getEmployeeAdvances(employeeId);
      res.json(advances);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/employee-advances", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const { employeeId, amount, date, note, deductionMode, installmentAmount } = req.body;
      if (!employeeId || !amount || !date) return res.status(400).json({ message: "بيانات ناقصة" });
      const advance = await storage.createEmployeeAdvance({
        employeeId: Number(employeeId),
        amount: String(amount),
        date,
        note: note || null,
        deductionMode: deductionMode || "full_next_payroll",
        installmentAmount: installmentAmount ? String(installmentAmount) : null,
        createdBy: req.session.userId!,
      });

      await storage.createEmployeeLedgerEntry({
        employeeId: Number(employeeId), movementType: "advance_given",
        referenceType: "employee_advance", referenceId: advance.id,
        amount: String(amount), date,
        note: note || "سلفة جديدة", createdBy: req.session.userId!,
      });

      await storage.addAuditLog({
        action: "advance_create", entityType: "employee_advance", entityId: advance.id,
        userId: req.session.userId!, userName: req.session.userName || "",
        details: `إنشاء سلفة بمبلغ ${amount}`, newValue: JSON.stringify({ amount, deductionMode: deductionMode || "full_next_payroll" }),
      });

      try {
        const { journalForEmployeeAdvance } = await import("./autoJournal");
        await journalForEmployeeAdvance(advance, req.session.userId!);
      } catch (jErr) {}

      const emp = await storage.getUser(Number(employeeId));
      await storage.addBankLedgerEntry({
        date,
        branchId: emp?.branchId || 1,
        method: "bank_transfer",
        amountIn: "0",
        amountOut: String(amount),
        refId: `ADV-${advance.id}`,
        category: "employee_advance",
        note: `سلفة موظف: ${emp?.name || employeeId}`,
        createdBy: req.session.userId!,
      });

      res.status(201).json(advance);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/employee-deductions", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
      const deductions = await storage.getEmployeeDeductions(employeeId);
      res.json(deductions);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/employee-deductions", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const { employeeId, amount, reason, date, deductionType, monthReference } = req.body;
      if (!employeeId || !amount || !reason || !date) return res.status(400).json({ message: "بيانات ناقصة" });

      if (deductionType === "recurring" && monthReference) {
        const existingDup = await pool.query(
          `SELECT id FROM employee_deductions WHERE employee_id = $1 AND deduction_type = 'recurring' AND reason = $2 AND month_reference = $3 AND applied_in_payroll_id IS NULL`,
          [Number(employeeId), reason, monthReference]
        );
        if (existingDup.rows.length > 0) {
          return res.status(400).json({ message: "يوجد خصم متكرر بنفس السبب لنفس الفترة" });
        }
      }

      const deduction = await storage.createEmployeeDeduction({
        employeeId: Number(employeeId),
        amount: String(amount),
        reason,
        date,
        deductionType: deductionType || "one_time",
        monthReference: monthReference || null,
        createdBy: req.session.userId!,
      });

      await storage.addAuditLog({
        action: "deduction_create", entityType: "employee_deduction", entityId: deduction.id,
        userId: req.session.userId!, userName: req.session.userName || "",
        details: `إنشاء خصم بمبلغ ${amount} - ${reason}`,
        newValue: JSON.stringify({ amount, reason, deductionType: deductionType || "one_time" }),
      });

      res.status(201).json(deduction);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/payroll-runs/:id/summary", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const summary = await storage.getPayrollSummary(Number(req.params.id));
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/payroll-runs/:id/details-with-payments", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const details = await storage.getPayrollDetailsWithPayments(Number(req.params.id));
      res.json(details);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/employees/:id/financial-profile", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const profile = await storage.getEmployeeFinancialProfile(Number(req.params.id));
      if (!profile) return res.status(404).json({ message: "الموظف غير موجود" });
      res.json(profile);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/payroll/outstanding", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const report = await storage.getPayrollOutstandingReport();
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/payroll/advances-outstanding", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const report = await storage.getAdvancesOutstandingReport();
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/salary-payments", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const payrollId = req.query.payrollId ? Number(req.query.payrollId) : undefined;
      const payments = await storage.getSalaryPayments(payrollId);
      res.json(payments);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/salary-payments", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const { payrollId, payrollDetailId, employeeId, amount, paymentDate, paymentMethod, referenceNo, branchId, note } = req.body;
      if (!payrollId || !payrollDetailId || !employeeId || !amount || !paymentDate) {
        return res.status(400).json({ message: "بيانات ناقصة" });
      }

      const run = await storage.getPayrollRun(Number(payrollId));
      if (run && !["approved", "partial", "reviewed"].includes(run.status)) {
        return res.status(400).json({ message: "لا يمكن الدفع إلا لكشف معتمد أو تمت مراجعته" });
      }

      const detail = await pool.query(`SELECT * FROM payroll_details WHERE id = $1`, [payrollDetailId]);
      if (!detail.rows[0]) return res.status(404).json({ message: "تفاصيل الراتب غير موجودة" });

      const existingPayments = await pool.query(`SELECT COALESCE(SUM(amount::numeric), 0) as total FROM salary_payments WHERE payroll_detail_id = $1`, [payrollDetailId]);
      const alreadyPaid = parseFloat(existingPayments.rows[0].total || "0");
      const netSalary = parseFloat(detail.rows[0].net_salary || "0");
      const payAmount = parseFloat(amount);
      if (payAmount <= 0) return res.status(400).json({ message: "المبلغ يجب أن يكون أكبر من صفر" });
      if (alreadyPaid + payAmount > netSalary + 0.001) {
        return res.status(400).json({ message: `المبلغ يتجاوز المتبقي. المتبقي: ${(netSalary - alreadyPaid).toFixed(3)}` });
      }

      const allowedMethods = ["cash", "bank_transfer", "cheque", "wallet"];
      const method = paymentMethod || "bank_transfer";
      if (!allowedMethods.includes(method)) {
        return res.status(400).json({ message: "طريقة الدفع غير مسموحة" });
      }

      const payment = await storage.createSalaryPayment({
        payrollId: Number(payrollId),
        payrollDetailId: Number(payrollDetailId),
        employeeId: Number(employeeId),
        amount: payAmount.toFixed(3),
        paymentDate,
        paymentMethod: method,
        referenceNo: referenceNo || null,
        branchId: branchId ? Number(branchId) : null,
        paidBy: req.session.userId!,
        note: note || null,
      });

      const emp = await storage.getUser(Number(employeeId));
      const empBranchId = branchId ? Number(branchId) : (emp?.branchId || 1);

      journalForSalaryPayment({
        id: payment.id,
        employeeId: Number(employeeId),
        employeeName: emp?.name || "",
        amount: payAmount,
        paymentMethod: method,
        branchId: empBranchId,
        paidBy: req.session.userId!,
        month: run?.month || "",
        year: run?.year || 2026,
      });

      await storage.addBankLedgerEntry({
        date: paymentDate,
        branchId: empBranchId,
        method: method,
        amountIn: "0",
        amountOut: payAmount.toFixed(3),
        refId: `SAL-${payment.id}`,
        category: "salary_payment",
        note: `دفع راتب ${emp?.name || ""} - ${run?.month}/${run?.year}${referenceNo ? ` | مرجع: ${referenceNo}` : ""}`,
        createdBy: req.session.userId!,
      });

      await storage.addAuditLog({
        action: "salary_payment", entityType: "salary_payment", entityId: payment.id,
        userId: req.session.userId!, userName: req.session.userName || "",
        details: `دفعة راتب ${payAmount.toFixed(3)} للموظف ${emp?.name || employeeId} عبر ${method}`,
      });

      res.status(201).json(payment);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/payroll-detail/:id/payments", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const payments = await storage.getPayrollDetailPayments(Number(req.params.id));
      res.json(payments);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  // ============ Payroll Preview & Reports ============
  app.get("/api/payroll/preview", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const { month, year } = req.query;
      if (!month || !year) return res.status(400).json({ message: "الشهر والسنة مطلوبة" });
      const preview = await storage.previewPayrollRun(String(month), Number(year));
      res.json(preview);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/employees/:id/ledger", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.from) filters.from = String(req.query.from);
      if (req.query.to) filters.to = String(req.query.to);
      if (req.query.movementType) filters.movementType = String(req.query.movementType);
      const ledger = await storage.getEmployeeLedger(Number(req.params.id), filters);
      res.json(ledger);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/reports/employee-statement/:id", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const from = String(req.query.from || "2020-01-01");
      const to = String(req.query.to || new Date().toISOString().slice(0, 10));
      const statement = await storage.getEmployeeStatement(Number(req.params.id), from, to);
      if (!statement) return res.status(404).json({ message: "الموظف غير موجود" });
      res.json(statement);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/reports/payroll-payments", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.month) filters.month = String(req.query.month);
      if (req.query.year) filters.year = Number(req.query.year);
      if (req.query.branchId) filters.branchId = Number(req.query.branchId);
      const report = await storage.getPayrollPaymentsReport(filters);
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/reports/recurring-deductions", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const report = await storage.getRecurringDeductionsReport();
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/reports/payroll-by-branch", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const { month, year } = req.query;
      if (!month || !year) return res.status(400).json({ message: "الشهر والسنة مطلوبة" });
      const report = await storage.getPayrollByBranch(String(month), Number(year));
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/reports/payroll-comparison", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const year = Number(req.query.year || new Date().getFullYear());
      const report = await storage.getPayrollComparison(year);
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/employees/:id/opening-balances", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "owner") return res.status(403).json({ message: "فقط المالك يمكنه تعديل الأرصدة الافتتاحية" });
      const { openingAdvanceBalance, openingPayableBalance } = req.body;
      const updated = await storage.updateUser(Number(req.params.id), {
        openingAdvanceBalance: openingAdvanceBalance !== undefined ? String(openingAdvanceBalance) : undefined,
        openingPayableBalance: openingPayableBalance !== undefined ? String(openingPayableBalance) : undefined,
      });
      if (!updated) return res.status(404).json({ message: "الموظف غير موجود" });

      await storage.addAuditLog({
        action: "opening_balance_update", entityType: "user", entityId: updated.id,
        userId: req.session.userId!, userName: req.session.userName || "",
        details: `تحديث أرصدة افتتاحية`,
        newValue: JSON.stringify({ openingAdvanceBalance, openingPayableBalance }),
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.patch("/api/employees/:id/status", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const { employmentStatus } = req.body;
      if (!["active", "suspended", "terminated"].includes(employmentStatus)) {
        return res.status(400).json({ message: "حالة غير صالحة" });
      }
      const emp = await storage.getUser(Number(req.params.id));
      if (!emp) return res.status(404).json({ message: "الموظف غير موجود" });

      const updated = await storage.updateUser(Number(req.params.id), { employmentStatus });
      await storage.addAuditLog({
        action: "employment_status_change", entityType: "user", entityId: emp.id,
        userId: req.session.userId!, userName: req.session.userName || "",
        details: `تغيير حالة التوظيف من ${emp.employmentStatus} إلى ${employmentStatus}`,
        oldValue: emp.employmentStatus, newValue: employmentStatus,
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  // ============ Chart of Accounts ============
  app.get("/api/accounts", requireAuth, async (_req, res) => {
    try {
      const accs = await storage.getAccounts();
      res.json(accs);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/accounts", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const { code, name, nameEn, type, parentId, level } = req.body;
      if (!code || !name || !type) return res.status(400).json({ message: "بيانات ناقصة" });
      const acc = await storage.createAccount({ code, name, nameEn, type, parentId: parentId || null, level: level || 1 });
      res.status(201).json(acc);
    } catch (err: any) {
      if (err?.message?.includes("unique")) return res.status(400).json({ message: "رمز الحساب موجود مسبقاً" });
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.patch("/api/accounts/:id", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const acc = await storage.updateAccount(parseInt(req.params.id as string), req.body);
      if (!acc) return res.status(404).json({ message: "الحساب غير موجود" });
      res.json(acc);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/accounts/seed", requireAuth, requireOwnerOrAdmin, async (_req, res) => {
    try {
      await storage.seedDefaultAccounts();
      const accs = await storage.getAccounts();
      res.json(accs);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  // ============ Journal Entries ============
  app.get("/api/journal-entries", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const entries = await storage.getJournalEntries({
        from: req.query.from as string,
        to: req.query.to as string,
        status: req.query.status as string,
        sourceType: req.query.sourceType as string,
      });
      res.json(entries);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/journal-entries/:id", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const entry = await storage.getJournalEntry(parseInt(req.params.id as string));
      if (!entry) return res.status(404).json({ message: "القيد غير موجود" });
      res.json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/journal-entries", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const { date, description, sourceType, sourceId, branchId, lines } = req.body;
      if (!date || !description || !lines || lines.length < 2) {
        return res.status(400).json({ message: "القيد يجب أن يحتوي على تاريخ ووصف وسطرين على الأقل" });
      }
      const totalDebit = lines.reduce((s: number, l: any) => s + parseFloat(l.debit || 0), 0);
      const totalCredit = lines.reduce((s: number, l: any) => s + parseFloat(l.credit || 0), 0);
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return res.status(400).json({ message: "القيد غير متوازن - المدين لا يساوي الدائن" });
      }
      const entryNumber = await storage.getNextEntryNumber();
      const entry = await storage.createJournalEntry({
        entryNumber,
        date,
        description,
        sourceType: sourceType || "manual",
        sourceId: sourceId || null,
        branchId: branchId || null,
        createdBy: req.session.userId!,
        totalDebit: totalDebit.toFixed(3),
        totalCredit: totalCredit.toFixed(3),
        status: "draft",
      }, lines);
      res.status(201).json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/journal-entries/:id/post", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const entry = await storage.postJournalEntry(parseInt(req.params.id as string));
      if (!entry) return res.status(404).json({ message: "القيد غير موجود" });
      res.json(entry);
    } catch (err: any) {
      res.status(400).json({ message: err?.message ?? "خطأ في ترحيل القيد" });
    }
  });

  app.post("/api/journal-entries/generate-retroactive", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      let generated = 0;

      const salesRes = await pool.query(`SELECT * FROM sales ORDER BY id`);
      for (const sale of salesRes.rows) {
        const existing = await pool.query(`SELECT id FROM journal_entries WHERE source_type = 'sale' AND source_id = $1`, [sale.id]);
        if (existing.rows.length === 0) {
          await journalForSale({
            id: sale.id,
            invoiceNumber: sale.invoice_number || "",
            total: sale.total || "0",
            vat: sale.vat || "0",
            paymentMethod: sale.payment_method || "cash",
            branchId: sale.branch_id,
            cashierId: sale.cashier_id,
            cogsTotal: sale.cogs_total || "0",
            createdAt: sale.created_at,
          });
          generated++;
        }
      }

      const expensesRes = await pool.query(`SELECT * FROM expenses ORDER BY id`);
      for (const exp of expensesRes.rows) {
        const existing = await pool.query(`SELECT id FROM journal_entries WHERE source_type = 'expense' AND source_id = $1`, [exp.id]);
        if (existing.rows.length === 0) {
          await journalForExpense({
            id: exp.id,
            category: exp.category,
            amount: exp.amount,
            source: exp.source,
            date: exp.date,
            branchId: exp.branch_id,
            createdBy: exp.created_by,
            notes: exp.notes,
          });
          generated++;
        }
      }

      const purchasesRes = await pool.query(`SELECT * FROM purchase_invoices WHERE status IN ('approved', 'received') ORDER BY id`);
      for (const pur of purchasesRes.rows) {
        const existing = await pool.query(`SELECT id FROM journal_entries WHERE source_type = 'purchase' AND source_id = $1`, [pur.id]);
        if (existing.rows.length === 0) {
          await journalForPurchase({
            id: pur.id,
            invoiceNumber: pur.invoice_number || "",
            grandTotal: pur.grand_total || "0",
            supplierId: pur.supplier_id,
            branchId: pur.branch_id,
            createdBy: pur.created_by,
            invoiceDate: pur.invoice_date || new Date().toISOString().slice(0, 10),
          });
          generated++;
        }
      }

      const returnsRes = await pool.query(`
        SELECT sr.*, s.invoice_number as sale_invoice_number 
        FROM sale_returns sr 
        LEFT JOIN sales s ON s.id = sr.sale_id 
        ORDER BY sr.id
      `);
      for (const ret of returnsRes.rows) {
        const existing = await pool.query(`SELECT id FROM journal_entries WHERE source_type = 'return' AND source_id = $1`, [ret.id]);
        if (existing.rows.length === 0) {
          await journalForSaleReturn({
            id: ret.id,
            returnNumber: ret.return_number || "",
            refundAmount: ret.refund_amount || "0",
            refundMethod: ret.refund_method || "cash",
            cogsReturned: ret.cogs_returned || "0",
            branchId: ret.branch_id,
            createdBy: ret.created_by,
            saleInvoiceNumber: ret.sale_invoice_number || "",
            createdAt: ret.created_at,
          });
          generated++;
        }
      }

      res.json({ success: true, generated, message: `تم توليد ${generated} قيد محاسبي بأثر رجعي` });
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في التوليد" });
    }
  });

  // ============ General Ledger ============
  app.get("/api/general-ledger", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const accountId = parseInt(req.query.accountId as string);
      if (!accountId) return res.status(400).json({ message: "يجب تحديد الحساب" });
      const entries = await storage.getGeneralLedger(accountId, req.query.from as string, req.query.to as string);
      res.json(entries);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/trial-balance", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const data = await storage.getTrialBalance(req.query.from as string, req.query.to as string);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  // ── Payroll UI routes ──────────────────────────────────────────────────────

  app.get("/api/payroll/ui/employees", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
      const data = await storage.getPayrollEmployees(branchId);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/payroll/ui/movements", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const month   = Number(req.query.month);
      const year    = Number(req.query.year);
      const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
      if (!month || !year) return res.status(400).json({ message: "month و year مطلوبان" });
      const data = await storage.getPayrollMovements(month, year, branchId);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/payroll/ui/payments", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const month   = Number(req.query.month);
      const year    = Number(req.query.year);
      const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
      if (!month || !year) return res.status(400).json({ message: "month و year مطلوبان" });
      const data = await storage.getPayrollPayments(month, year, branchId);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/payroll/ui/payments", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const { employeeId, month, year, amount, paymentMethod, paidBy, branchId, note, referenceNo } = req.body;
      if (!employeeId || !month || !year || !amount || !paymentMethod || !paidBy) {
        return res.status(400).json({ message: "بيانات ناقصة" });
      }
      const data = await storage.addPayrollPayment({
        employeeId: Number(employeeId),
        month: Number(month),
        year: Number(year),
        amount,
        paymentMethod,
        paidBy: Number(paidBy),
        branchId: branchId ? Number(branchId) : undefined,
        note,
        referenceNo,
      });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/payroll/ui/bulk-pay", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const { employeeIds, month, year, paymentMethod, paidBy, branchId } = req.body;
      if (!Array.isArray(employeeIds) || !month || !year || !paymentMethod || !paidBy) {
        return res.status(400).json({ message: "بيانات ناقصة" });
      }
      // Get current payroll rows to determine remaining amounts
      const movements = await storage.getPayrollMovements(Number(month), Number(year), branchId ? Number(branchId) : undefined);
      const payments  = await storage.getPayrollPayments(Number(month), Number(year), branchId ? Number(branchId) : undefined);
      const employees = await storage.getPayrollEmployees(branchId ? Number(branchId) : undefined);

      const results = [];
      for (const empId of employeeIds.map(Number)) {
        const emp = employees.find((e: any) => e.id === empId);
        if (!emp) continue;
        const empMovements = movements.filter((m: any) => m.employee_id === empId && m.status === 'active');
        const empPayments  = payments.filter((p: any) => p.employee_id === empId);
        const baseSalary   = parseFloat(emp.salary ?? '0');
        const bonus        = empMovements.filter((m: any) => m.type === 'bonus').reduce((s: number, m: any) => s + parseFloat(m.amount), 0);
        const commission   = empMovements.filter((m: any) => m.type === 'commission').reduce((s: number, m: any) => s + parseFloat(m.amount), 0);
        const deduction    = empMovements.filter((m: any) => m.type === 'deduction').reduce((s: number, m: any) => s + parseFloat(m.amount), 0);
        const advance      = empMovements.filter((m: any) => m.type === 'advance').reduce((s: number, m: any) => s + parseFloat(m.amount), 0);
        const netSalary    = Math.max(0, baseSalary + bonus + commission - deduction - advance);
        const amountPaid   = empPayments.reduce((s: number, p: any) => s + parseFloat(p.amount), 0);
        const remaining    = netSalary - amountPaid;
        if (remaining <= 0) continue;
        const result = await storage.addPayrollPayment({
          employeeId: empId, month: Number(month), year: Number(year),
          amount: remaining, paymentMethod, paidBy: Number(paidBy),
          branchId: branchId ? Number(branchId) : undefined,
        });
        results.push(result);
      }
      res.json({ count: results.length, payments: results });
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/payroll/ui/movements", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const { type, employeeId, amount, date, reason, createdBy } = req.body;
      if (!type || !employeeId || !amount || !date || !createdBy) {
        return res.status(400).json({ message: "بيانات ناقصة" });
      }
      let result: any;
      const dateObj = new Date(date);
      const month   = (dateObj.getMonth() + 1).toString().padStart(2, '0');
      const year    = dateObj.getFullYear();
      if (type === 'advance') {
        result = await storage.createEmployeeAdvance({ employeeId: Number(employeeId), amount: String(amount), date, note: reason, createdBy: Number(createdBy) });
      } else if (type === 'deduction') {
        result = await storage.createEmployeeDeduction({ employeeId: Number(employeeId), amount: String(amount), reason: reason ?? '', date, createdBy: Number(createdBy) });
      } else if (type === 'commission') {
        result = await storage.createEmployeeCommission({ employeeId: Number(employeeId), amount: String(amount), date, note: reason, createdBy: Number(createdBy), month, year });
      } else if (type === 'bonus') {
        result = await storage.createEmployeeEntitlement({ employeeId: Number(employeeId), amount: String(amount), date, note: reason, createdBy: Number(createdBy), month, year });
      } else {
        return res.status(400).json({ message: "نوع غير مدعوم" });
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.patch("/api/payroll/ui/movements/:table/:id/cancel", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const table = req.params.table as string;
      const id    = req.params.id;
      const { cancelledBy } = req.body;
      if (!cancelledBy) return res.status(400).json({ message: "cancelledBy مطلوب" });
      const allowedTables = ['employee_advances', 'employee_deductions', 'employee_commissions', 'employee_entitlements'];
      if (!allowedTables.includes(table)) return res.status(400).json({ message: "جدول غير مدعوم" });
      let result: any;
      if (table === 'employee_advances') {
        result = await storage.settleAdvance(Number(id), 0);
      } else {
        // For deductions/commissions/entitlements, mark cancelled via raw query
        const { pool: dbPool } = await import("./db");
        const r = await dbPool.query(`UPDATE ${table} SET status = 'cancelled' WHERE id = $1 RETURNING *`, [Number(id)]);
        result = r.rows[0];
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  // ══════════════════════════════════════════════════════════════════════
  // النظام المالي الكامل — Financial System APIs
  // ══════════════════════════════════════════════════════════════════════

  /** قائمة الدخل */
  app.get("/api/reports/income-statement", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const from = req.query.from as string;
      const to   = req.query.to   as string;
      if (!from || !to) return res.status(400).json({ message: "from & to مطلوبان (YYYY-MM-DD)" });
      const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
      res.json(await storage.getIncomeStatement(from, to, branchId));
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  /** الميزانية العمومية */
  app.get("/api/reports/balance-sheet", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const asOf = (req.query.asOf as string) || new Date().toISOString().slice(0, 10);
      const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
      res.json(await storage.getBalanceSheet(asOf, branchId));
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  /** كشف الصندوق اليومي مع الرصيد الجاري */
  app.get("/api/finance/daily-statement", requireAuth, async (req, res) => {
    try {
      const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
      const scope = (req as any).branchScope;
      const branchId = req.query.branchId
        ? Number(req.query.branchId)
        : scope?.mode === "branch" ? scope.branchId : undefined;
      res.json(await storage.getDailyCashStatement(date, branchId));
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  /** التحقق من رصيد الصندوق */
  app.get("/api/finance/check-balance", requireAuth, async (req, res) => {
    try {
      const branchId = req.query.branchId
        ? Number(req.query.branchId)
        : (req.session as any).branchId;
      if (!branchId) return res.status(400).json({ message: "branchId مطلوب" });
      res.json(await storage.checkCashBalance(branchId));
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  /** المصروفات حسب التصنيف */
  app.get("/api/reports/expenses-by-category", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const from = req.query.from as string;
      const to   = req.query.to   as string;
      if (!from || !to) return res.status(400).json({ message: "from & to مطلوبان" });
      const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
      res.json(await storage.getExpensesByCategory(from, to, branchId));
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  /** التدفقات النقدية */
  app.get("/api/reports/cash-flow", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const from = req.query.from as string;
      const to   = req.query.to   as string;
      if (!from || !to) return res.status(400).json({ message: "from & to مطلوبان" });
      const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
      res.json(await storage.getCashFlowStatement(from, to, branchId));
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  /** تصنيفات المصروفات */
  app.get("/api/expense-categories", requireAuth, async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT * FROM expense_categories WHERE is_active = TRUE ORDER BY sort_order`
      );
      res.json(result.rows);
    } catch {
      // جدول غير موجود بعد → إرجاع القائمة الثابتة
      res.json([
        { code: "supplies",    name: "مستلزمات" },
        { code: "rent",        name: "إيجار" },
        { code: "salary",      name: "رواتب" },
        { code: "transport",   name: "مواصلات" },
        { code: "maintenance", name: "صيانة" },
        { code: "electricity", name: "كهرباء ومياه" },
        { code: "phone",       name: "اتصالات" },
        { code: "marketing",   name: "تسويق" },
        { code: "shipping",    name: "شحن" },
        { code: "taxes",       name: "ضرائب ورسوم" },
        { code: "other",       name: "أخرى" },
      ]);
    }
  });

  /** تشغيل migration المالي (seed chart of accounts) */
  app.post("/api/finance/run-migration", requireAuth, requireOwnerOrAdmin, async (_req, res) => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const migPath = path.join(process.cwd(), "migrations", "0010_financial_system.sql");
      const sql = fs.readFileSync(migPath, "utf8");
      await pool.query(sql);
      res.json({ success: true, message: "تم تشغيل المايجريشن بنجاح" });
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في تشغيل المايجريشن" });
    }
  });

  // ── Migration 0015 ─────────────────────────────────────────────────────────
  app.post("/api/run-migration-0015", requireAuth, requireOwnerOrAdmin, async (_req, res) => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const migPath = path.join(process.cwd(), "migrations", "0015_purchase_payment_and_delete.sql");
      const sql = fs.readFileSync(migPath, "utf8");
      await pool.query(sql);
      res.json({ success: true, message: "تم تشغيل migration 0015 — payment_method/due_date/discount/vat بنجاح" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message ?? "خطأ في تشغيل المايجريشن" });
    }
  });

  // ── Migration 0014 ─────────────────────────────────────────────────────────
  app.post("/api/run-migration-0014", requireAuth, requireOwnerOrAdmin, async (_req, res) => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const migPath = path.join(process.cwd(), "migrations", "0014_ledger_qty_snapshot_and_lock.sql");
      const sql = fs.readFileSync(migPath, "utf8");
      await pool.query(sql);
      res.json({ success: true, message: "تم تشغيل migration 0014 — qty_before/qty_after بنجاح" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message ?? "خطأ في تشغيل المايجريشن" });
    }
  });

  // ── Migration 0012 ─────────────────────────────────────────────────────────
  app.post("/api/run-migration-0012", requireAuth, requireOwnerOrAdmin, async (_req, res) => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const migPath = path.join(process.cwd(), "migrations", "0012_pos_orders_system.sql");
      const sql = fs.readFileSync(migPath, "utf8");
      await pool.query(sql);
      res.json({ success: true, message: "تم تشغيل migration 0012 — POS & Orders بنجاح" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message ?? "خطأ في تشغيل المايجريشن" });
    }
  });

  // ── Migration 0011 ─────────────────────────────────────────────────────────
  app.post("/api/run-migration-0011", requireAuth, requireOwnerOrAdmin, async (_req, res) => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const migPath = path.join(process.cwd(), "migrations", "0011_roles_permissions.sql");
      const sql = fs.readFileSync(migPath, "utf8");
      await pool.query(sql);
      res.json({ success: true, message: "تم تشغيل migration 0011 — الأدوار والصلاحيات بنجاح" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message ?? "خطأ في تشغيل المايجريشن" });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // API: الأدوار والصلاحيات
  // ══════════════════════════════════════════════════════════════════════════

  // قائمة الأدوار مع عدد الصلاحيات
  app.get("/api/roles", requireAuth, async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT r.id, r.name, r.description, r.is_active, r.created_at,
               COUNT(rp.permission_id)::int AS permission_count
        FROM roles r
        LEFT JOIN role_permissions rp ON rp.role_id = r.id
        GROUP BY r.id
        ORDER BY r.id
      `);
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // قائمة كل الصلاحيات مجمّعة حسب الفئة
  app.get("/api/permissions", requireAuth, async (_req, res) => {
    try {
      const result = await pool.query(
        "SELECT id, code, name, category FROM permissions ORDER BY category, id"
      );
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // صلاحيات دور محدد
  app.get("/api/roles/:id/permissions", requireAuth, async (req, res) => {
    const roleId = Number(req.params.id);
    try {
      const result = await pool.query(
        `SELECT p.id, p.code, p.name, p.category
         FROM permissions p
         JOIN role_permissions rp ON rp.permission_id = p.id
         WHERE rp.role_id = $1
         ORDER BY p.category, p.id`,
        [roleId]
      );
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // تحديث صلاحيات دور (المالك فقط)
  app.put("/api/roles/:id/permissions", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    const roleId = Number(req.params.id);
    const { permissionIds } = req.body as { permissionIds: number[] };
    if (!Array.isArray(permissionIds)) {
      return res.status(400).json({ message: "permissionIds يجب أن يكون مصفوفة" });
    }
    try {
      // المالك لا يمكن تعديل صلاحياته (دائماً كاملة)
      const role = await pool.query("SELECT name FROM roles WHERE id = $1", [roleId]);
      if (role.rows[0]?.name === "owner") {
        return res.status(403).json({ message: "لا يمكن تعديل صلاحيات المالك" });
      }
      await pool.query("DELETE FROM role_permissions WHERE role_id = $1", [roleId]);
      if (permissionIds.length > 0) {
        const vals = permissionIds.map((pid, i) => `($1, $${i + 2})`).join(",");
        await pool.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ${vals} ON CONFLICT DO NOTHING`,
          [roleId, ...permissionIds]
        );
      }
      res.json({ success: true, message: "تم تحديث الصلاحيات" });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // إضافة مستخدم مع التحقق من كلمة المرور وسجل التاريخ
  app.patch("/api/users/:id/toggle", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    const id = Number(req.params.id);
    try {
      const user = await storage.getUser(id);
      if (!user) return res.status(404).json({ message: "المستخدم غير موجود" });
      const updated = await storage.updateUser(id, { isActive: !user.isActive });
      if (!updated) return res.status(404).json({ message: "فشل التحديث" });
      const { password: _, ...safe } = updated;
      res.json(safe);
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // حذف مستخدم (إلغاء تفعيل فقط — لا حذف فعلي)
  app.delete("/api/users/:id", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    const id = Number(req.params.id);
    try {
      const actor = await storage.getUser(req.session.userId!);
      if (actor?.id === id) {
        return res.status(400).json({ message: "لا يمكنك حذف حسابك الخاص" });
      }
      // إلغاء تفعيل بدلاً من الحذف الفعلي
      const updated = await storage.updateUser(id, { isActive: false });
      if (!updated) return res.status(404).json({ message: "المستخدم غير موجود" });
      await storage.addAuditLog({
        action: "user_update",
        entityType: "user",
        entityId: id,
        branchId: updated.branchId,
        userId: actor?.id ?? null,
        userName: actor?.name ?? null,
        details: `تم إلغاء تفعيل المستخدم "${updated.name}"`,
        oldValue: JSON.stringify({ isActive: true }),
        newValue: JSON.stringify({ isActive: false }),
      });
      res.json({ success: true, message: "تم إلغاء تفعيل المستخدم" });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // تحديث role_id عند تعيين دور جديد للمستخدم
  app.patch("/api/users/:id/role", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const { roleId } = req.body as { roleId: number };
    if (!roleId) return res.status(400).json({ message: "roleId مطلوب" });
    try {
      const roleRow = await pool.query("SELECT name FROM roles WHERE id = $1", [roleId]);
      if (!roleRow.rows.length) return res.status(404).json({ message: "الدور غير موجود" });
      const roleName = roleRow.rows[0].name; // 'owner' or 'sales'
      await pool.query(
        "UPDATE users SET role_id = $1, role = $2 WHERE id = $3",
        [roleId, roleName, id]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // فحص صلاحية المستخدم الحالي
  app.get("/api/my-permissions", requireAuth, async (req, res) => {
    try {
      const userRow = await pool.query(
        "SELECT role, role_id FROM users WHERE id = $1", [req.session.userId]
      );
      const { role, role_id } = userRow.rows[0] || {};
      if (role === "owner" || role === "admin") {
        const all = await pool.query("SELECT code FROM permissions");
        return res.json({ role, permissions: all.rows.map((r: any) => r.code) });
      }
      if (!role_id) return res.json({ role, permissions: [] });
      const perms = await pool.query(
        `SELECT p.code FROM permissions p
         JOIN role_permissions rp ON rp.permission_id = p.id
         WHERE rp.role_id = $1`, [role_id]
      );
      res.json({ role, permissions: perms.rows.map((r: any) => r.code) });
    } catch {
      res.json({ role: "unknown", permissions: [] });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // POS ROUTES — نقطة البيع
  // ═══════════════════════════════════════════════════════════════════

  /** GET /api/pos/products — قائمة المنتجات للـ POS مع المخزون */
  app.get("/api/pos/products", requireAuth, requirePermission("pos.access"), async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "غير مصرح" });
      const { search, categoryId } = req.query;
      const branchId = user.branchId;

      let query = `
        SELECT
          p.id, p.name, p.barcode, p.price, p.avg_cost as "avgCost",
          p.image, p.active, p.category_id as "categoryId",
          c.name as "categoryName",
          COALESCE((
            SELECT SUM(li.qty_on_hand)
            FROM location_inventory li
            JOIN locations l ON l.id = li.location_id
            WHERE li.product_id = p.id AND l.branch_id = $1
          ), 0)::int as "stockQty"
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.active = true
      `;
      const params: any[] = [branchId];
      if (search) {
        params.push(`%${search}%`);
        query += ` AND (p.name ILIKE $${params.length} OR p.barcode ILIKE $${params.length})`;
      }
      if (categoryId) {
        params.push(Number(categoryId));
        query += ` AND (p.category_id = $${params.length} OR (SELECT parent_id FROM categories WHERE id = p.category_id) = $${params.length})`;
      }
      query += ` ORDER BY p.name ASC LIMIT 200`;
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** GET /api/pos/top — أكثر 5 منتجات مبيعاً */
  app.get("/api/pos/top", requireAuth, requirePermission("pos.access"), async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "غير مصرح" });
      const result = await pool.query(`
        SELECT p.id, p.name, p.price, p.image, p.avg_cost as "avgCost", p.category_id as "categoryId",
               COUNT(si.id) as sold_count,
               COALESCE((
                 SELECT SUM(li.qty_on_hand)
                 FROM location_inventory li
                 JOIN locations l ON l.id = li.location_id
                 WHERE li.product_id = p.id AND l.branch_id = $1
               ), 0)::int as "stockQty"
        FROM products p
        JOIN sale_items si ON si.product_id = p.id
        JOIN sales s ON s.id = si.sale_id AND s.branch_id = $1
        WHERE p.active = true
          AND s.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY p.id, p.name, p.price, p.image, p.avg_cost, p.category_id
        ORDER BY sold_count DESC
        LIMIT 5
      `, [user.branchId]);
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** GET /api/pos/held — الفواتير المعلقة */
  app.get("/api/pos/held", requireAuth, requirePermission("pos.access"), async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "غير مصرح" });
      const result = await pool.query(
        `SELECT * FROM held_invoices WHERE branch_id = $1 AND created_by = $2 ORDER BY created_at DESC`,
        [user.branchId, user.id]
      );
      res.json(result.rows.map((r: any) => ({ ...r, items: JSON.parse(r.items || "[]") })));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** POST /api/pos/held — تعليق فاتورة */
  app.post("/api/pos/held", requireAuth, requirePermission("pos.access"), async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "غير مصرح" });
      const { items, customerId, customerName, customerPhone } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "السلة فارغة" });
      }
      const cntRes = await pool.query(`SELECT COALESCE(MAX(id),0)+1 as next FROM held_invoices`);
      const holdNumber = `HOLD-${String(cntRes.rows[0].next).padStart(4, "0")}`;
      const result = await pool.query(
        `INSERT INTO held_invoices (hold_number, items, customer_id, customer_name, customer_phone, branch_id, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [holdNumber, JSON.stringify(items), customerId || null, customerName || null, customerPhone || null, user.branchId, user.id]
      );
      const row = result.rows[0];
      res.status(201).json({ ...row, items: JSON.parse(row.items || "[]") });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** POST /api/pos/held/:id/resume — استئناف فاتورة معلقة (تُرجع البيانات وتحذف السجل) */
  app.post("/api/pos/held/:id/resume", requireAuth, requirePermission("pos.access"), async (req, res) => {
    try {
      const result = await pool.query(
        `DELETE FROM held_invoices WHERE id=$1 RETURNING *`,
        [Number(req.params.id)]
      );
      if (result.rowCount === 0) return res.status(404).json({ message: "الفاتورة المعلقة غير موجودة" });
      const row = result.rows[0];
      res.json({ ...row, items: JSON.parse(row.items || "[]") });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** DELETE /api/pos/held/:id — حذف فاتورة معلقة */
  app.delete("/api/pos/held/:id", requireAuth, requirePermission("pos.access"), async (req, res) => {
    try {
      await pool.query(`DELETE FROM held_invoices WHERE id=$1`, [Number(req.params.id)]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** PUT /api/orders/:id — تعديل طلب */
  app.put("/api/orders/:id", requireAuth, async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const { items, ...data } = req.body;
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "غير مصرح" });

      // تحديث بيانات الطلب
      const fields: string[] = [];
      const vals: any[] = [];
      const allowed = ["customer_name","customer_phone","source","delivery_method","delivery_address",
        "delivery_fee","subtotal","discount","discount_type","total","status","payment_method",
        "payment_status","payment_reference","notes","customer_id"];
      for (const [k, v] of Object.entries(data)) {
        const col = k.replace(/([A-Z])/g, "_$1").toLowerCase();
        if (allowed.includes(col)) { vals.push(v); fields.push(`${col}=$${vals.length}`); }
      }
      if (fields.length > 0) {
        vals.push(orderId);
        await pool.query(`UPDATE orders SET ${fields.join(",")} WHERE id=$${vals.length}`, vals);
      }

      // تحديث بنود الطلب إذا أُرسلت
      if (items && Array.isArray(items)) {
        await pool.query(`DELETE FROM order_items WHERE order_id=$1`, [orderId]);
        for (const item of items) {
          await pool.query(
            `INSERT INTO order_items (order_id,product_id,variant_id,quantity,unit_price,total,unit_cost_at_sale,line_cogs,color,size)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [orderId, item.productId, item.variantId||null, item.quantity, item.unitPrice,
             (parseFloat(item.unitPrice)*item.quantity).toFixed(3),
             item.costPrice||"0", "0", item.color||null, item.size||null]
          );
        }
      }

      const updated = await pool.query(`SELECT * FROM orders WHERE id=$1`, [orderId]);
      res.json(updated.rows[0]);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** DELETE /api/orders/:id — حذف طلب */
  app.delete("/api/orders/:id", requireAuth, requireManager, async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      await pool.query(`DELETE FROM order_items WHERE order_id=$1`, [orderId]);
      await pool.query(`DELETE FROM orders WHERE id=$1`, [orderId]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** POST /api/orders/:id/convert-to-invoice — تحويل طلب لفاتورة بيع */
  app.post("/api/orders/:id/convert-to-invoice", requireAuth, async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "غير مصرح" });

      const orderRes = await pool.query(`SELECT * FROM orders WHERE id=$1`, [orderId]);
      if (orderRes.rowCount === 0) return res.status(404).json({ message: "الطلب غير موجود" });
      const order = orderRes.rows[0];
      if (order.status !== "delivered") return res.status(400).json({ message: "الطلب يجب أن يكون في حالة 'تم التسليم' أولاً" });
      if (order.invoice_id) return res.status(400).json({ message: "الطلب محول لفاتورة مسبقاً" });

      const itemsRes = await pool.query(
        `SELECT oi.*, p.avg_cost FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id=$1`,
        [orderId]
      );
      const items = itemsRes.rows;
      if (items.length === 0) return res.status(400).json({ message: "الطلب لا يحتوي على منتجات" });

      // تحقق من المخزون
      for (const item of items) {
        const stockRes = await pool.query(`
          SELECT COALESCE(SUM(li.qty_on_hand),0) as qty
          FROM location_inventory li JOIN locations l ON l.id=li.location_id
          WHERE li.product_id=$1 AND l.branch_id=$2
        `, [item.product_id, order.branch_id]);
        if (parseInt(stockRes.rows[0].qty) < item.quantity) {
          return res.status(400).json({ message: `مخزون المنتج ${item.product_id} غير كافٍ` });
        }
      }

      const { paymentMethod, paymentReference, amountPaid } = req.body;
      const subtotal = parseFloat(order.total || "0");
      const cogsTotal = items.reduce((s: number, i: any) => s + parseFloat(i.avg_cost||"0")*i.quantity, 0);

      let shiftId: number | null = null;
      const shift = await storage.getCurrentShift(order.branch_id, user.terminalName);
      if (shift) shiftId = shift.id;

      const invNumRes = await pool.query(`SELECT COALESCE(MAX(id),0)+1 as next FROM sales`);
      const invoiceNumber = `INV-${String(invNumRes.rows[0].next).padStart(5, "0")}`;

      const saleRes = await pool.query(`
        INSERT INTO sales (invoice_number, branch_id, shift_id, cashier_id, customer_id,
          subtotal, discount, discount_type, vat, total, amount_paid, change_amount,
          payment_method, payment_reference, cogs_total, gross_profit, status, order_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'value','0',$8,$9,$10,$11,$12,$13,$14,'completed',$15)
        RETURNING *
      `, [invoiceNumber, order.branch_id, shiftId, user.id, order.customer_id||null,
          subtotal.toFixed(3), "0", subtotal.toFixed(3),
          amountPaid||subtotal.toFixed(3),
          Math.max(0, parseFloat(amountPaid||"0")-subtotal).toFixed(3),
          paymentMethod||order.payment_method||"cash",
          paymentReference||null,
          cogsTotal.toFixed(3),
          (subtotal-cogsTotal).toFixed(3),
          orderId]);
      const sale = saleRes.rows[0];

      // بنود الفاتورة + خصم المخزون
      for (const item of items) {
        await pool.query(
          `INSERT INTO sale_items (sale_id,product_id,quantity,unit_price,total,unit_cost_at_sale,line_cogs,color,size)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [sale.id, item.product_id, item.quantity, item.unit_price,
           (parseFloat(item.unit_price)*item.quantity).toFixed(3),
           item.avg_cost||"0",
           (parseFloat(item.avg_cost||"0")*item.quantity).toFixed(3),
           item.color||null, item.size||null]
        );
        // خصم المخزون
        await pool.query(`
          UPDATE location_inventory SET qty_on_hand = qty_on_hand - $1
          WHERE product_id = $2
            AND location_id = (SELECT id FROM locations WHERE branch_id=$3 AND is_branch_default=true LIMIT 1)
        `, [item.quantity, item.product_id, order.branch_id]);
      }

      // ربط الطلب بالفاتورة
      await pool.query(`UPDATE orders SET invoice_id=$1, status='delivered' WHERE id=$2`, [sale.id, orderId]);

      // قيد محاسبي
      journalForSale({
        id: sale.id,
        invoiceNumber: sale.invoice_number,
        total: sale.total,
        vat: "0",
        paymentMethod: sale.payment_method,
        branchId: sale.branch_id,
        cashierId: sale.cashier_id,
        cogsTotal: sale.cogs_total,
        createdAt: sale.created_at,
      }).catch(() => {});

      res.status(201).json({ sale, orderId });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // CUSTOMERS — العملاء (إضافة حقول بحث)
  // ═══════════════════════════════════════════════════════════════════

  /** تم نقل GET /api/customers/search — انظر قبل /:id مباشرة */

  // ═══════════════════════════════════════════════════════════════════
  // NOTIFICATIONS — نظام الإشعارات
  // ═══════════════════════════════════════════════════════════════════

  /** POST /api/run-migration-0013 — تشغيل migration جدول الإشعارات */
  app.post("/api/run-migration-0013", requireAuth, requireOwnerOrAdmin, async (_req, res) => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id          SERIAL PRIMARY KEY,
          type        TEXT    NOT NULL,
          title       TEXT    NOT NULL,
          body        TEXT,
          data        JSONB,
          target_role TEXT    NOT NULL DEFAULT 'owner',
          created_by  INTEGER REFERENCES users(id),
          created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
          is_read     BOOLEAN   NOT NULL DEFAULT FALSE,
          read_at     TIMESTAMP,
          read_by     INTEGER REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_notifications_target_role ON notifications(target_role);
        CREATE INDEX IF NOT EXISTS idx_notifications_is_read     ON notifications(is_read);
        CREATE INDEX IF NOT EXISTS idx_notifications_created_at  ON notifications(created_at DESC);
      `);
      res.json({ success: true, message: "Migration 0013 تم بنجاح" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  /** GET /api/notifications/count — عدد الإشعارات غير المقروءة (للـ badge) */
  app.get("/api/notifications/count", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || (user.role !== "owner" && user.role !== "admin")) {
        return res.json({ count: 0 });
      }
      const result = await pool.query(
        `SELECT COUNT(*) as count FROM notifications WHERE target_role = 'owner' AND is_read = FALSE`
      );
      res.json({ count: Number(result.rows[0].count) });
    } catch {
      res.json({ count: 0 });
    }
  });

  /** GET /api/notifications — قائمة الإشعارات */
  app.get("/api/notifications", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const limit = Number(req.query.limit) || 20;
      const result = await pool.query(
        `SELECT n.*, u.name as creator_name
         FROM notifications n
         LEFT JOIN users u ON u.id = n.created_by
         WHERE n.target_role = 'owner'
         ORDER BY n.created_at DESC
         LIMIT $1`,
        [limit]
      );
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** PATCH /api/notifications/:id/read — تحديد إشعار كمقروء */
  app.patch("/api/notifications/:id/read", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      await pool.query(
        `UPDATE notifications SET is_read = TRUE, read_at = NOW(), read_by = $1 WHERE id = $2`,
        [req.session.userId, Number(req.params.id)]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** PATCH /api/notifications/read-all — تحديد كل الإشعارات كمقروءة */
  app.patch("/api/notifications/read-all", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      await pool.query(
        `UPDATE notifications SET is_read = TRUE, read_at = NOW(), read_by = $1 WHERE target_role = 'owner' AND is_read = FALSE`,
        [req.session.userId]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  registerExportRoutes(app);
  registerBackupRoutes(app);
  registerMobileRoutes(app);

  // ── Migration 0022 — إصلاح branch_id للمخزن المركزي ──────────────────────
  app.post("/api/run-migration-0022", requireAuth, requireOwnerOrAdmin, async (_req, res) => {
    try {
      // المخزن المركزي يجب أن يكون branch_id = NULL حتى لا يُعرض كفرع
      await pool.query(`UPDATE locations SET branch_id = NULL WHERE is_central = TRUE`);

      // تشخيص: إرجاع حالة المواقع بعد الإصلاح
      const locResult = await pool.query(`
        SELECT id, name, is_central, branch_id, is_branch_default, active
        FROM locations ORDER BY is_central DESC, id
      `);
      res.json({
        success: true,
        message: "تم إصلاح المخزن المركزي — branch_id = NULL الآن",
        locations: locResult.rows,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message ?? "خطأ" });
    }
  });

  // ── تشخيص المواقع ────────────────────────────────────────────────────────
  app.get("/api/admin/locations-diagnostic", requireAuth, requireOwnerOrAdmin, async (_req, res) => {
    try {
      const locs = await pool.query(`
        SELECT l.id, l.name, l.is_central, l.branch_id, l.is_branch_default, l.active,
               b.name as branch_name
        FROM locations l LEFT JOIN branches b ON b.id = l.branch_id
        ORDER BY l.is_central DESC, l.id
      `);
      const centralInventory = await pool.query(`
        SELECT COUNT(*) as records, SUM(ib.qty_on_hand) as total_qty
        FROM inventory_balances ib
        JOIN locations l ON l.id = ib.location_id
        WHERE l.is_central = TRUE
      `);
      res.json({ locations: locs.rows, centralInventory: centralInventory.rows[0] });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ── Migration 0023 — تجميع كل المخزون في المخزن المركزي ──────────────────
  app.post("/api/run-migration-0023", requireAuth, requireOwnerOrAdmin, async (_req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. إيجاد المخزن المركزي
      const centralRes = await client.query(`SELECT id FROM locations WHERE is_central = TRUE LIMIT 1`);
      if (centralRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: "لا يوجد مخزن مركزي" });
      }
      const centralId = centralRes.rows[0].id;

      // 2. نقل inventory_balances من الفروع → المخزن المركزي
      await client.query(`
        INSERT INTO inventory_balances (location_id, variant_id, qty_on_hand, qty_reserved)
        SELECT $1, ib.variant_id, SUM(ib.qty_on_hand), 0
        FROM inventory_balances ib
        JOIN locations l ON l.id = ib.location_id
        WHERE l.is_central = FALSE AND ib.qty_on_hand > 0
        GROUP BY ib.variant_id
        ON CONFLICT (location_id, variant_id)
        DO UPDATE SET qty_on_hand = inventory_balances.qty_on_hand + EXCLUDED.qty_on_hand
      `, [centralId]);

      // 3. نقل location_inventory من الفروع → المخزن المركزي
      await client.query(`
        INSERT INTO location_inventory (location_id, product_id, qty_on_hand, updated_at)
        SELECT $1, li.product_id, SUM(li.qty_on_hand), now()
        FROM location_inventory li
        JOIN locations l ON l.id = li.location_id
        WHERE l.is_central = FALSE AND li.qty_on_hand > 0
        GROUP BY li.product_id
        ON CONFLICT (location_id, product_id)
        DO UPDATE SET qty_on_hand = location_inventory.qty_on_hand + EXCLUDED.qty_on_hand,
                      updated_at = now()
      `, [centralId]);

      // 4. حذف سجلات الفروع بعد النقل
      await client.query(`
        DELETE FROM inventory_balances
        WHERE location_id IN (SELECT id FROM locations WHERE is_central = FALSE)
      `);
      await client.query(`
        DELETE FROM location_inventory
        WHERE location_id IN (SELECT id FROM locations WHERE is_central = FALSE)
      `);

      await client.query("COMMIT");

      // إحصاء بعد النقل
      const afterRes = await client.query(`
        SELECT COUNT(*) as records, COALESCE(SUM(qty_on_hand),0) as total_qty
        FROM inventory_balances WHERE location_id = $1
      `, [centralId]);

      res.json({
        success: true,
        message: `تم نقل كل المخزون إلى المخزن المركزي (id=${centralId})`,
        centralId,
        after: afterRes.rows[0],
      });
    } catch (err: any) {
      await client.query("ROLLBACK");
      res.status(500).json({ success: false, message: err?.message ?? "خطأ" });
    } finally {
      client.release();
    }
  });

  // ── تشخيص وإصلاح فواتير الشراء المفقودة من الأرصدة ──────────────────────────

  app.get("/api/admin/purchase-inventory-diagnostic", requireAuth, requireOwnerOrAdmin, async (_req, res) => {
    try {
      const centralRes = await pool.query(`SELECT id FROM locations WHERE is_central = TRUE LIMIT 1`);
      const centralId = centralRes.rows[0]?.id;
      if (!centralId) return res.status(400).json({ ok: false, message: "لا يوجد مخزن مركزي" });

      // variants من فواتير معتمدة غائبة كلياً عن inventory_balances
      const missing = await pool.query(`
        SELECT DISTINCT
          pit.variant_id,
          pit.product_id,
          p.name        AS product_name,
          pi.id         AS purchase_id,
          pi.invoice_number,
          pi.status,
          pit.qty
        FROM purchase_invoices pi
        JOIN purchase_items pit ON pit.purchase_id = pi.id
        LEFT JOIN products p    ON p.id = pit.product_id
        WHERE pi.status IN ('approved','received')
          AND pit.variant_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM inventory_balances ib
            WHERE ib.variant_id = pit.variant_id AND ib.location_id = $1
          )
        ORDER BY pi.id
      `, [centralId]);

      // فواتير بها بنود variant_id = NULL
      const nullVariants = await pool.query(`
        SELECT pi.id, pi.invoice_number, pi.status, pi.invoice_date,
               COUNT(pit.id) AS items_without_variant
        FROM purchase_invoices pi
        JOIN purchase_items pit ON pit.purchase_id = pi.id
        WHERE pi.status IN ('approved','received')
          AND pit.variant_id IS NULL
        GROUP BY pi.id, pi.invoice_number, pi.status, pi.invoice_date
      `);

      // ملخص رصيد المخزن المركزي الحالي
      const balSummary = await pool.query(`
        SELECT COUNT(*) AS variant_count, COALESCE(SUM(qty_on_hand),0) AS total_qty
        FROM inventory_balances WHERE location_id = $1
      `, [centralId]);

      res.json({
        ok: true,
        central_id: centralId,
        inventory_summary: balSummary.rows[0],
        missing_from_balances: missing.rows,
        invoices_with_null_variant: nullVariants.rows,
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err?.message ?? "خطأ" });
    }
  });

  app.post("/api/admin/repair-purchase-inventory", requireAuth, requireOwnerOrAdmin, async (_req, res) => {
    const client = await pool.connect();
    try {
      const centralRes = await client.query(`SELECT id FROM locations WHERE is_central = TRUE LIMIT 1`);
      if (centralRes.rows.length === 0) {
        return res.status(400).json({ ok: false, message: "لا يوجد مخزن مركزي" });
      }
      const centralId = centralRes.rows[0].id;

      // البنود التي variant_id موجود لكن غائب كلياً من inventory_balances
      // (ما لم يُضف أصلاً لا يمكن أن تُخصم منه مبيعات → نضيف كامل الكمية)
      const gapRes = await client.query(`
        SELECT
          pit.variant_id,
          pit.product_id,
          MIN(pi.created_by) AS created_by,
          SUM(pit.qty)       AS total_qty,
          MIN(pi.id)         AS ref_purchase_id
        FROM purchase_invoices pi
        JOIN purchase_items pit ON pit.purchase_id = pi.id
        WHERE pi.status IN ('approved','received')
          AND pit.variant_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM inventory_balances ib
            WHERE ib.variant_id = pit.variant_id AND ib.location_id = $1
          )
        GROUP BY pit.variant_id, pit.product_id
      `, [centralId]);

      if (gapRes.rows.length === 0) {
        return res.json({ ok: true, message: "لا توجد بنود مفقودة — الأرصدة مكتملة", fixed: 0 });
      }

      await client.query("BEGIN");

      for (const row of gapRes.rows) {
        const qty = parseFloat(row.total_qty);

        // تحقق من وجود الـ variant — إذا غير موجود أنشئه
        const varCheck = await client.query(
          `SELECT id FROM product_variants WHERE id = $1`,
          [row.variant_id]
        );
        let variantId = row.variant_id;
        if (varCheck.rows.length === 0) {
          // الـ variant محذوف أو غير موجود — ابحث عن variant بديل لنفس المنتج
          const existingVar = await client.query(
            `SELECT id FROM product_variants WHERE product_id = $1 AND active = true LIMIT 1`,
            [row.product_id]
          );
          if (existingVar.rows.length > 0) {
            variantId = existingVar.rows[0].id;
            // حدّث purchase_items ليشير للـ variant الصحيح
            await client.query(
              `UPDATE purchase_items SET variant_id = $1 WHERE variant_id = $2`,
              [variantId, row.variant_id]
            );
          } else {
            // أنشئ variant جديد للمنتج
            const prod = await client.query(
              `SELECT name, barcode, price, avg_cost FROM products WHERE id = $1`,
              [row.product_id]
            );
            if (prod.rows.length === 0) continue; // منتج غير موجود أصلاً
            const p = prod.rows[0];
            const sku = `SKU-${row.product_id}-REPAIR-${Date.now()}`;
            const newVar = await client.query(
              `INSERT INTO product_variants (product_id, sku, barcode, color, size, cost_default, price, active)
               VALUES ($1, $2, $3, '', '', $4, $5, true) RETURNING id`,
              [row.product_id, sku, p.barcode ?? null, p.avg_cost ?? 0, p.price ?? 0]
            );
            variantId = newVar.rows[0].id;
            await client.query(
              `UPDATE purchase_items SET variant_id = $1 WHERE variant_id = $2`,
              [variantId, row.variant_id]
            );
          }
        }

        await client.query(
          `INSERT INTO inventory_balances (location_id, variant_id, qty_on_hand, qty_reserved)
           VALUES ($1, $2, $3, 0)
           ON CONFLICT (location_id, variant_id)
           DO UPDATE SET qty_on_hand = inventory_balances.qty_on_hand + EXCLUDED.qty_on_hand`,
          [centralId, variantId, qty]
        );
        await client.query(
          `INSERT INTO location_inventory (location_id, product_id, qty_on_hand, updated_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (location_id, product_id)
           DO UPDATE SET qty_on_hand = location_inventory.qty_on_hand + EXCLUDED.qty_on_hand,
                         updated_at = now()`,
          [centralId, row.product_id, qty]
        );
        await client.query(
          `INSERT INTO inventory_ledger (variant_id, location_id, qty_change, reason, ref_table, ref_id, created_by, created_at)
           VALUES ($1, $2, $3, 'purchase_repair', 'purchase_invoices', $4, $5, now())`,
          [variantId, centralId, qty, row.ref_purchase_id, row.created_by ?? 1]
        );
      }

      await client.query("COMMIT");

      res.json({
        ok: true,
        message: `تم إصلاح ${gapRes.rows.length} بند مفقود وإضافتها للمخزن المركزي`,
        fixed: gapRes.rows.length,
        details: gapRes.rows.map((r: any) => ({
          variant_id: r.variant_id,
          product_id: r.product_id,
          qty_added: r.total_qty,
        })),
      });
    } catch (err: any) {
      await client.query("ROLLBACK");
      res.status(500).json({ ok: false, message: err?.message ?? "خطأ" });
    } finally {
      client.release();
    }
  });

  // ── Migration 0021 ─────────────────────────────────────────────────────────
  app.post("/api/run-migration-0021", requireAuth, requireOwnerOrAdmin, async (_req, res) => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const migPath = path.join(process.cwd(), "migrations", "0021_purchase_attachments_table.sql");
      const sqlText = fs.readFileSync(migPath, "utf8");
      await pool.query(sqlText);
      res.json({ success: true, message: "تم تشغيل migration 0021 — جدول المرفقات الدائمة بنجاح" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message ?? "خطأ في تشغيل المايجريشن" });
    }
  });

  // ── Migration 0020 ─────────────────────────────────────────────────────────
  app.post("/api/run-migration-0020", requireAuth, requireOwnerOrAdmin, async (_req, res) => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const migPath = path.join(process.cwd(), "migrations", "0020_purchase_multi_attachments.sql");
      const sqlText = fs.readFileSync(migPath, "utf8");
      await pool.query(sqlText);
      res.json({ success: true, message: "تم تشغيل migration 0020 — دعم مرفقات متعددة بنجاح" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message ?? "خطأ في تشغيل المايجريشن" });
    }
  });

  // ── Migration 0016 ─────────────────────────────────────────────────────────
  app.post("/api/run-migration-0016", requireAuth, requireOwnerOrAdmin, async (_req, res) => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const migPath = path.join(process.cwd(), "migrations", "0016_inventory_constraints.sql");
      const sqlText = fs.readFileSync(migPath, "utf8");
      await pool.query(sqlText);
      res.json({ success: true, message: "تم تشغيل migration 0016 — قيود المخزون والفهارس بنجاح" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message ?? "خطأ في تشغيل المايجريشن" });
    }
  });

  // ── Migration 0018 ─────────────────────────────────────────────────────────
  // ── Migration 0019 ─────────────────────────────────────────────────────────
  app.post("/api/run-migration-0019", requireAuth, requireOwnerOrAdmin, async (_req, res) => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const migPath = path.join(process.cwd(), "migrations", "0019_branches_address_phone.sql");
      const sqlText = fs.readFileSync(migPath, "utf8");
      await pool.query(sqlText);
      res.json({ success: true, message: "تم تشغيل migration 0019 — إضافة address + phone للفروع بنجاح" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message ?? "خطأ في تشغيل المايجريشن" });
    }
  });

  app.post("/api/run-migration-0018", requireAuth, requireOwnerOrAdmin, async (_req, res) => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const migPath = path.join(process.cwd(), "migrations", "0018_products_description_mincost.sql");
      const sqlText = fs.readFileSync(migPath, "utf8");
      await pool.query(sqlText);
      res.json({ success: true, message: "تم تشغيل migration 0018 — إضافة description + cost_default + min_qty للمنتجات بنجاح" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message ?? "خطأ في تشغيل المايجريشن" });
    }
  });

  // ── Migration 0017 ─────────────────────────────────────────────────────────
  app.post("/api/run-migration-0017", requireAuth, requireOwnerOrAdmin, async (_req, res) => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const migPath = path.join(process.cwd(), "migrations", "0017_order_items_variant_id.sql");
      const sqlText = fs.readFileSync(migPath, "utf8");
      await pool.query(sqlText);
      res.json({ success: true, message: "تم تشغيل migration 0017 — إضافة variant_id لـ order_items بنجاح" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message ?? "خطأ في تشغيل المايجريشن" });
    }
  });

  // ── Reset Demo Data ────────────────────────────────────────────────────────
  app.post("/api/admin/reset-demo-data", requireAuth, requireOwnerOrAdmin, async (_req, res) => {
    try {
      await pool.query(`
        BEGIN;

        -- بنود وتفاصيل (أولاً لأنها تعتمد على الجداول الرئيسية)
        TRUNCATE TABLE sale_return_items    RESTART IDENTITY CASCADE;
        TRUNCATE TABLE sale_returns         RESTART IDENTITY CASCADE;
        TRUNCATE TABLE sale_items           RESTART IDENTITY CASCADE;
        TRUNCATE TABLE order_items          RESTART IDENTITY CASCADE;
        TRUNCATE TABLE purchase_extra_costs RESTART IDENTITY CASCADE;
        TRUNCATE TABLE purchase_items       RESTART IDENTITY CASCADE;
        TRUNCATE TABLE location_transfer_items RESTART IDENTITY CASCADE;
        TRUNCATE TABLE stock_transfer_lines RESTART IDENTITY CASCADE;
        TRUNCATE TABLE stocktake_items      RESTART IDENTITY CASCADE;
        TRUNCATE TABLE payroll_details      RESTART IDENTITY CASCADE;
        TRUNCATE TABLE journal_entry_lines  RESTART IDENTITY CASCADE;
        TRUNCATE TABLE product_composite_items RESTART IDENTITY CASCADE;
        TRUNCATE TABLE price_list_items     RESTART IDENTITY CASCADE;

        -- الجداول الرئيسية
        TRUNCATE TABLE sales                RESTART IDENTITY CASCADE;
        TRUNCATE TABLE orders               RESTART IDENTITY CASCADE;
        TRUNCATE TABLE purchase_invoices    RESTART IDENTITY CASCADE;
        TRUNCATE TABLE held_invoices        RESTART IDENTITY CASCADE;
        TRUNCATE TABLE location_transfers   RESTART IDENTITY CASCADE;
        TRUNCATE TABLE stock_transfers      RESTART IDENTITY CASCADE;
        TRUNCATE TABLE stocktakes           RESTART IDENTITY CASCADE;
        TRUNCATE TABLE inventory_adjustments RESTART IDENTITY CASCADE;
        TRUNCATE TABLE inventory_ledger     RESTART IDENTITY CASCADE;
        TRUNCATE TABLE inventory_balances   RESTART IDENTITY CASCADE;
        TRUNCATE TABLE inventory_transactions RESTART IDENTITY CASCADE;
        TRUNCATE TABLE location_inventory   RESTART IDENTITY CASCADE;
        TRUNCATE TABLE journal_entries      RESTART IDENTITY CASCADE;
        TRUNCATE TABLE cash_ledger          RESTART IDENTITY CASCADE;
        TRUNCATE TABLE bank_ledger          RESTART IDENTITY CASCADE;
        TRUNCATE TABLE shifts               RESTART IDENTITY CASCADE;
        TRUNCATE TABLE expenses             RESTART IDENTITY CASCADE;
        TRUNCATE TABLE payroll_runs         RESTART IDENTITY CASCADE;
        TRUNCATE TABLE employee_advances    RESTART IDENTITY CASCADE;
        TRUNCATE TABLE employee_deductions  RESTART IDENTITY CASCADE;
        TRUNCATE TABLE employee_commissions RESTART IDENTITY CASCADE;
        TRUNCATE TABLE employee_entitlements RESTART IDENTITY CASCADE;
        TRUNCATE TABLE employee_financial_ledger RESTART IDENTITY CASCADE;
        TRUNCATE TABLE salary_payments      RESTART IDENTITY CASCADE;
        TRUNCATE TABLE notifications        RESTART IDENTITY CASCADE;
        TRUNCATE TABLE audit_log            RESTART IDENTITY CASCADE;
        TRUNCATE TABLE supplier_ocr_templates RESTART IDENTITY CASCADE;
        TRUNCATE TABLE price_lists          RESTART IDENTITY CASCADE;
        TRUNCATE TABLE discount_rules       RESTART IDENTITY CASCADE;

        -- المنتجات والأطراف التجارية
        TRUNCATE TABLE product_variants     RESTART IDENTITY CASCADE;
        TRUNCATE TABLE products             RESTART IDENTITY CASCADE;
        TRUNCATE TABLE categories           RESTART IDENTITY CASCADE;
        TRUNCATE TABLE customers            RESTART IDENTITY CASCADE;
        TRUNCATE TABLE suppliers            RESTART IDENTITY CASCADE;

        COMMIT;
      `);
      res.json({ success: true, message: "تم مسح جميع البيانات التجريبية بنجاح. النظام جاهز للبيانات الحقيقية." });
    } catch (err: any) {
      await pool.query("ROLLBACK;").catch(() => {});
      res.status(500).json({ success: false, message: err?.message ?? "خطأ أثناء مسح البيانات" });
    }
  });

  return httpServer;
}
