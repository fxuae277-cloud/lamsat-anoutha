import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db, pool } from "./db";
import { and, eq, desc } from "drizzle-orm";
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
import { registerExportRoutes } from "./exports";
import { registerBackupRoutes } from "./backup";
import { saveUploadedFile, parseInvoiceFile } from "./ocr";

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

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "غير مصرح - يجب تسجيل الدخول" });
  }
  next();
}

async function requireOwnerOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "غير مصرح - يجب تسجيل الدخول" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user || (user.role !== "owner" && user.role !== "admin")) {
    return res.status(403).json({ message: "غير مصرح - صلاحيات غير كافية" });
  }
  next();
}

function requireRole(allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "غير مصرح - يجب تسجيل الدخول" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({ message: "غير مصرح لك. هذه العملية للمدير فقط." });
    }
    next();
  };
}

const requireManager = requireRole(["owner", "admin", "manager"]);

async function enforceBranchScope(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "غير مصرح - يجب تسجيل الدخول" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user) {
    return res.status(401).json({ message: "المستخدم غير موجود" });
  }
  if (user.role === "owner" || user.role === "admin") {
    const qb = (req.query.branchId || req.query.branch_id || req.body?.branchId) as string | undefined;
    if (qb && !isNaN(Number(qb))) {
      req.branchScope = { mode: "branch", branchId: Number(qb) };
    } else {
      req.branchScope = { mode: "company", branchId: null };
    }
  } else {
    req.branchScope = { mode: "branch", branchId: user.branchId ?? 0 };
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "اسم المستخدم وكلمة المرور مطلوبان" });
    }
    const user = await storage.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    }
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: "الحساب معطّل" });
    }
    req.session.userId = user.id;
    const { password: _, ...safeUser } = user;
    res.json({ user: safeUser });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ message: "تم تسجيل الخروج" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "غير مصرح" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !user.isActive) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "غير مصرح" });
    }
    const { password: _, ...safeUser } = user;
    res.json({ user: safeUser });
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

  app.get("/api/cities", requireAuth, async (_req, res) => {
    res.json(await storage.getCities());
  });
  app.post("/api/cities", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    const parsed = insertCitySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createCity(parsed.data));
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
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
    const { name, username, password, role, branchId, terminalName, isActive, pin, phone, salary } = req.body;
    if (!name || !username || !password) {
      return res.status(400).json({ message: "الاسم واسم المستخدم وكلمة المرور مطلوبة" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
    }
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
    const { name, role, branchId, terminalName, isActive, pin, phone, salary, salaryType, commissionRate } = req.body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
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
  app.patch("/api/users/:id/reset-password", requireOwnerOrAdmin, async (req, res) => {
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
      const bf = branchId ? `AND branch_id = ${branchId}` : "";
      const sbf = branchId ? `AND s.branch_id = ${branchId}` : "";
      const lbf = branchId ? `AND l.branch_id = ${branchId}` : "";
      const ebf = branchId ? `AND e.branch_id = ${branchId}` : "";

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
        WHERE DATE(created_at) >= '${from}' AND DATE(created_at) <= '${to}' ${bf}
      `);

      const expQ = await pool.query(`
        SELECT
          COALESCE(SUM(amount::numeric),0) AS total_expenses,
          COALESCE(SUM(CASE WHEN source='cash' THEN amount::numeric ELSE 0 END),0) AS cash_expenses
        FROM expenses e
        WHERE e.date >= '${from}' AND e.date <= '${to}' ${ebf}
      `);

      const cashSalesQ = await pool.query(`
        SELECT COALESCE(SUM(total),0) AS cash_sales
        FROM sales
        WHERE payment_method='cash' AND DATE(created_at) >= '${from}' AND DATE(created_at) <= '${to}' ${bf}
      `);

      const paymentQ = await pool.query(`
        SELECT payment_method, COALESCE(SUM(total),0) AS amount, COUNT(*)::int AS cnt
        FROM sales
        WHERE DATE(created_at) >= '${from}' AND DATE(created_at) <= '${to}' ${bf}
        GROUP BY payment_method ORDER BY amount DESC
      `);

      const todayStr = new Date().toISOString().slice(0, 10);
      const yd = new Date(); yd.setDate(yd.getDate() - 1);
      const yesterdayStr = yd.toISOString().slice(0, 10);

      const todayVsQ = await pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN DATE(created_at)='${todayStr}' THEN total ELSE 0 END),0) AS today_sales,
          COALESCE(SUM(CASE WHEN DATE(created_at)='${todayStr}' THEN cogs_total ELSE 0 END),0) AS today_cogs,
          COALESCE(SUM(CASE WHEN DATE(created_at)='${yesterdayStr}' THEN total ELSE 0 END),0) AS yesterday_sales,
          COALESCE(SUM(CASE WHEN DATE(created_at)='${yesterdayStr}' THEN cogs_total ELSE 0 END),0) AS yesterday_cogs
        FROM sales
        WHERE DATE(created_at) >= '${yesterdayStr}' ${bf}
      `);

      const todayExpQ = await pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN e.date='${todayStr}' THEN amount::numeric ELSE 0 END),0) AS today_exp,
          COALESCE(SUM(CASE WHEN e.date='${yesterdayStr}' THEN amount::numeric ELSE 0 END),0) AS yesterday_exp
        FROM expenses e
        WHERE e.date >= '${yesterdayStr}' AND e.date <= '${todayStr}' ${ebf}
      `);

      const timeseriesQ = await pool.query(`
        WITH dates AS (
          SELECT generate_series('${from}'::date, '${to}'::date, '1 day'::interval)::date AS d
        ),
        daily_sales AS (
          SELECT DATE(created_at) AS d, COALESCE(SUM(total),0) AS sales, COALESCE(SUM(cogs_total),0) AS cogs
          FROM sales
          WHERE DATE(created_at) >= '${from}' AND DATE(created_at) <= '${to}' ${bf}
          GROUP BY DATE(created_at)
        ),
        daily_exp AS (
          SELECT e.date::date AS d, COALESCE(SUM(amount::numeric),0) AS expenses
          FROM expenses e
          WHERE e.date >= '${from}' AND e.date <= '${to}' ${ebf}
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
      `);

      const topProductsQ = await pool.query(`
        SELECT si.product_id, p.name,
          COALESCE(SUM(si.quantity),0)::int AS qty_sold,
          COALESCE(SUM(si.total),0) AS revenue,
          COALESCE(SUM(si.line_cogs),0) AS cogs,
          COALESCE(SUM(si.total - si.line_cogs),0) AS profit
        FROM sale_items si
        JOIN sales s ON s.id=si.sale_id
        JOIN products p ON p.id=si.product_id
        WHERE DATE(s.created_at) >= '${from}' AND DATE(s.created_at) <= '${to}' ${sbf}
        GROUP BY si.product_id, p.name
        ORDER BY revenue DESC LIMIT 10
      `);

      const branchPerfQ = await pool.query(`
        SELECT s.branch_id, b.name AS branch_name,
          COALESCE(SUM(s.total),0) AS revenue,
          COALESCE(SUM(s.cogs_total),0) AS cogs,
          COALESCE(SUM(s.total - s.cogs_total),0) AS gross_profit,
          COUNT(s.id)::int AS invoice_count,
          ROUND(COALESCE(AVG(s.total),0),3) AS avg_invoice
        FROM sales s
        JOIN branches b ON b.id=s.branch_id
        WHERE DATE(s.created_at) >= '${from}' AND DATE(s.created_at) <= '${to}' ${sbf}
        GROUP BY s.branch_id, b.name ORDER BY revenue DESC
      `);

      const branchExpQ = await pool.query(`
        SELECT e.branch_id, COALESCE(SUM(e.amount::numeric),0) AS expenses
        FROM expenses e
        WHERE e.date >= '${from}' AND e.date <= '${to}' ${ebf}
        GROUP BY e.branch_id
      `);
      const branchExpMap: Record<number, number> = {};
      branchExpQ.rows.forEach((r: any) => { branchExpMap[r.branch_id] = parseFloat(r.expenses); });

      const recentExpQ = await pool.query(`
        SELECT e.id, e.branch_id, b.name AS branch_name, e.category, e.amount, e.source, e.notes, e.date,
          e.created_at, u.name AS created_by_name
        FROM expenses e
        LEFT JOIN branches b ON b.id=e.branch_id
        LEFT JOIN users u ON u.id=e.created_by
        WHERE e.date >= '${from}' AND e.date <= '${to}' ${ebf}
        ORDER BY e.created_at DESC LIMIT 20
      `);

      const lowStockQ = await pool.query(`
        SELECT li.product_id, p.name,
          SUM(li.qty_on_hand)::int AS total_qty,
          MAX(li.reorder_level)::int AS reorder_level
        FROM location_inventory li
        JOIN products p ON p.id=li.product_id
        JOIN locations l ON l.id=li.location_id
        WHERE 1=1 ${lbf}
        GROUP BY li.product_id, p.name
        HAVING SUM(li.qty_on_hand) <= MAX(li.reorder_level)
        ORDER BY total_qty ASC LIMIT 50
      `);

      const invValueQ = await pool.query(`
        WITH last_cost AS (
          SELECT DISTINCT ON (pi.product_id)
            pi.product_id, pi.unit_cost_final AS unit_cost
          FROM purchase_items pi
          JOIN purchase_invoices pv ON pv.id=pi.purchase_id
          WHERE pv.status='approved'
          ORDER BY pi.product_id, pv.invoice_date DESC, pv.id DESC, pi.id DESC
        ),
        qty AS (
          SELECT li.product_id, SUM(li.qty_on_hand) AS qty_on_hand
          FROM location_inventory li
          JOIN locations l ON l.id=li.location_id
          WHERE 1=1 ${lbf}
          GROUP BY li.product_id
        )
        SELECT COALESCE(SUM(qty.qty_on_hand * COALESCE(last_cost.unit_cost,0)),0) AS value
        FROM qty
        LEFT JOIN last_cost ON last_cost.product_id=qty.product_id
      `);

      const k = kpiQ.rows[0];
      const ex = expQ.rows[0];
      const grossProfit = parseFloat(k.gross_profit);
      const totalExpenses = parseFloat(ex.total_expenses);
      const netProfit = grossProfit - totalExpenses;
      const cashSales = parseFloat(cashSalesQ.rows[0].cash_sales);
      const cashExp = parseFloat(ex.cash_expenses);
      const netCash = cashSales - cashExp;

      const tv = todayVsQ.rows[0];
      const te = todayExpQ.rows[0];
      const todaySalesVal = parseFloat(tv.today_sales);
      const todayCogsVal = parseFloat(tv.today_cogs);
      const todayExpVal = parseFloat(te.today_exp);
      const todayNet = todaySalesVal - todayCogsVal - todayExpVal;
      const yestSalesVal = parseFloat(tv.yesterday_sales);
      const yestCogsVal = parseFloat(tv.yesterday_cogs);
      const yestExpVal = parseFloat(te.yesterday_exp);
      const yestNet = yestSalesVal - yestCogsVal - yestExpVal;

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
          today: { sales: todaySalesVal, expenses: todayExpVal, net: todayNet },
          yesterday: { sales: yestSalesVal, expenses: yestExpVal, net: yestNet },
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
      const bf = branchId ? `AND branch_id = ${branchId}` : "";
      const sbf = branchId ? `AND s.branch_id = ${branchId}` : "";
      const lbf = branchId ? `AND l.branch_id = ${branchId}` : "";

      const todayKpi = await pool.query(`
        SELECT
          COALESCE(SUM(total),0) AS revenue,
          COALESCE(SUM(cogs_total),0) AS cogs,
          COALESCE(SUM(total - cogs_total),0) AS profit,
          ROUND(CASE WHEN COALESCE(SUM(total),0)=0 THEN 0
               ELSE (COALESCE(SUM(total - cogs_total),0)/SUM(total))*100 END, 2) AS margin_percent,
          ROUND(COALESCE(AVG(total),0),3) AS avg_invoice,
          COUNT(*)::int AS invoice_count
        FROM sales WHERE DATE(created_at)=CURRENT_DATE ${bf}
      `);

      const vsYesterday = await pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN DATE(created_at)=CURRENT_DATE THEN total ELSE 0 END),0) AS today_sales,
          COALESCE(SUM(CASE WHEN DATE(created_at)=CURRENT_DATE-1 THEN total ELSE 0 END),0) AS yesterday_sales
        FROM sales WHERE DATE(created_at) >= CURRENT_DATE-1 ${bf}
      `);

      const monthRes = await pool.query(`
        SELECT COALESCE(SUM(total),0) AS revenue, COALESCE(SUM(total - cogs_total),0) AS profit
        FROM sales WHERE DATE_TRUNC('month', created_at)=DATE_TRUNC('month', CURRENT_DATE) ${bf}
      `);

      const paymentRes = await pool.query(`
        SELECT payment_method, COALESCE(SUM(total),0) AS amount
        FROM sales WHERE DATE(created_at)=CURRENT_DATE ${bf}
        GROUP BY payment_method ORDER BY amount DESC
      `);

      const trend7d = await pool.query(`
        SELECT d::date AS day,
          COALESCE(SUM(s.total),0) AS revenue,
          COALESCE(SUM(s.total - s.cogs_total),0) AS profit,
          ROUND(CASE WHEN COALESCE(SUM(s.total),0)=0 THEN 0
               ELSE (COALESCE(SUM(s.total - s.cogs_total),0)/SUM(s.total))*100 END,2) AS margin
        FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day') d
        LEFT JOIN sales s ON DATE(s.created_at) = d ${bf}
        GROUP BY d ORDER BY d
      `);

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
          WHERE 1=1 ${lbf} GROUP BY li.product_id
        )
        SELECT COALESCE(SUM(qty.qty_on_hand * COALESCE(last_cost.unit_cost,0)),0) AS value
        FROM qty LEFT JOIN last_cost ON last_cost.product_id=qty.product_id
      `);

      const turnover30 = await pool.query(`
        WITH cogs30 AS (
          SELECT COALESCE(SUM(si.line_cogs),0) AS total_cogs
          FROM sale_items si JOIN sales s ON s.id=si.sale_id
          WHERE s.created_at >= CURRENT_DATE - 30 ${sbf}
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
            WHERE 1=1 ${lbf} GROUP BY li.product_id
          )
          SELECT COALESCE(SUM(qty.qty_on_hand * COALESCE(last_cost.unit_cost,0)),0) AS avg_value
          FROM qty LEFT JOIN last_cost ON last_cost.product_id=qty.product_id
        )
        SELECT CASE WHEN avg_inv.avg_value = 0 THEN 0
             ELSE ROUND((cogs30.total_cogs / avg_inv.avg_value)::numeric, 2) END AS turnover
        FROM cogs30, avg_inv
      `);

      const topProfit7d = await pool.query(`
        SELECT si.product_id, p.name,
          COALESCE(SUM(si.quantity),0)::int AS qty_sold,
          COALESCE(SUM(si.total),0) AS revenue,
          COALESCE(SUM(si.line_cogs),0) AS cogs,
          COALESCE(SUM(si.total - si.line_cogs),0) AS profit
        FROM sale_items si
        JOIN sales s ON s.id=si.sale_id
        JOIN products p ON p.id=si.product_id
        WHERE s.created_at >= CURRENT_DATE - 7 ${sbf}
        GROUP BY si.product_id, p.name
        ORDER BY profit DESC LIMIT 3
      `);

      const cashiers = await pool.query(`
        SELECT s.cashier_id, u.name AS cashier_name,
          COUNT(DISTINCT s.id)::int AS invoices_count,
          COALESCE(SUM(s.total),0) AS revenue,
          COALESCE(SUM(s.cogs_total),0) AS cogs,
          COALESCE(SUM(s.total - s.cogs_total),0) AS profit
        FROM sales s LEFT JOIN users u ON u.id=s.cashier_id
        WHERE DATE(s.created_at)=CURRENT_DATE ${sbf}
        GROUP BY s.cashier_id, u.name ORDER BY revenue DESC
      `);

      const lowStock = await pool.query(`
        SELECT li.product_id, p.name,
          SUM(li.qty_on_hand)::int AS total_qty,
          MAX(li.reorder_level)::int AS reorder_level
        FROM location_inventory li
        JOIN products p ON p.id=li.product_id
        JOIN locations l ON l.id=li.location_id
        WHERE 1=1 ${lbf}
        GROUP BY li.product_id, p.name
        HAVING SUM(li.qty_on_hand) <= MAX(li.reorder_level)
        ORDER BY total_qty ASC LIMIT 50
      `);

      const missingCogsToday = await pool.query(`
        SELECT
          COUNT(DISTINCT si.id) FILTER (WHERE COALESCE(si.unit_cost_at_sale,0) = 0) AS missing_count,
          COUNT(DISTINCT si.id) AS total_count
        FROM sale_items si JOIN sales s ON s.id=si.sale_id
        WHERE DATE(s.created_at)=CURRENT_DATE ${sbf}
      `);

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

  app.get("/api/categories", requireAuth, async (_req, res) => {
    res.json(await storage.getCategories());
  });
  app.post("/api/categories", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    const parsed = insertCategorySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createCategory(parsed.data));
  });

  app.get("/api/products", requireAuth, async (_req, res) => {
    res.json(await storage.getProducts());
  });
  app.get("/api/products/:id", requireAuth, async (req, res) => {
    const row = await storage.getProduct(Number(req.params.id));
    if (!row) return res.status(404).json({ message: "المنتج غير موجود" });
    res.json(row);
  });
  app.get("/api/products/barcode/:barcode", requireAuth, async (req, res) => {
    const row = await storage.getProductByBarcode(req.params.barcode);
    if (!row) return res.status(404).json({ message: "المنتج غير موجود" });
    res.json(row);
  });
  app.post("/api/products", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    const parsed = insertProductSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createProduct(parsed.data));
  });
  app.patch("/api/products/:id", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    const row = await storage.updateProduct(Number(req.params.id), req.body);
    if (!row) return res.status(404).json({ message: "المنتج غير موجود" });
    res.json(row);
  });
  app.delete("/api/products/:id", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    await storage.deleteProduct(Number(req.params.id));
    res.json({ message: "تم حذف المنتج" });
  });

  // ── Product Variants ──
  app.get("/api/products/:id/variants", requireAuth, async (req, res) => {
    res.json(await storage.getVariantsByProduct(Number(req.params.id)));
  });
  app.post("/api/products/:id/variants", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const productId = Number(req.params.id);
      const product = await storage.getProduct(productId);
      if (!product) return res.status(404).json({ message: "المنتج غير موجود" });
      if (req.body.barcode) {
        const existing = await storage.getVariantByBarcode(req.body.barcode);
        if (existing) return res.status(400).json({ message: "الباركود مستخدم بالفعل" });
      }
      if (req.body.sku) {
        const existing = await storage.getVariantBySku(req.body.sku);
        if (existing) return res.status(400).json({ message: "رمز SKU مستخدم بالفعل" });
      }
      const variant = await storage.createVariant({ ...req.body, productId });
      res.status(201).json(variant);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ" });
    }
  });
  app.get("/api/variants", requireAuth, async (_req, res) => {
    res.json(await storage.getAllVariants());
  });
  app.get("/api/variants/barcode/:barcode", requireAuth, async (req, res) => {
    const variant = await storage.getVariantByBarcode(req.params.barcode);
    if (!variant) return res.status(404).json({ message: "الباركود غير موجود" });
    res.json(variant);
  });
  app.patch("/api/variants/:id", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (req.body.barcode) {
        const existing = await storage.getVariantByBarcode(req.body.barcode);
        if (existing && existing.id !== id) return res.status(400).json({ message: "الباركود مستخدم بالفعل" });
      }
      if (req.body.sku) {
        const existing = await storage.getVariantBySku(req.body.sku);
        if (existing && existing.id !== id) return res.status(400).json({ message: "رمز SKU مستخدم بالفعل" });
      }
      const variant = await storage.updateVariant(id, req.body);
      if (!variant) return res.status(404).json({ message: "المتغير غير موجود" });
      res.json(variant);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ" });
    }
  });
  app.delete("/api/variants/:id", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    await storage.deleteVariant(Number(req.params.id));
    res.json({ message: "تم حذف المتغير" });
  });
  app.post("/api/variants/quick-create", requireAuth, async (req, res) => {
    try {
      const { productName, categoryId, barcode, sku, color, size, price, costDefault } = req.body;
      if (!productName) return res.status(400).json({ message: "اسم المنتج مطلوب" });
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
  app.get("/api/inventory-balances", requireAuth, async (req, res) => {
    const locationId = req.query.locationId ? Number(req.query.locationId) : undefined;
    res.json(await storage.getInventoryBalances(locationId));
  });

  // ── Stock Transfers ──
  app.get("/api/stock-transfers", requireAuth, async (_req, res) => {
    res.json(await storage.getStockTransfers());
  });
  app.get("/api/stock-transfers/:id", requireAuth, async (req, res) => {
    const transfer = await storage.getStockTransfer(Number(req.params.id));
    if (!transfer) return res.status(404).json({ message: "التحويل غير موجود" });
    const lines = await storage.getStockTransferLines(transfer.id);
    res.json({ ...transfer, lines });
  });
  app.post("/api/stock-transfers", requireAuth, async (req, res) => {
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
  app.post("/api/stock-transfers/:id/lines", requireAuth, async (req, res) => {
    try {
      const transfer = await storage.getStockTransfer(Number(req.params.id));
      if (!transfer || transfer.status !== "draft") return res.status(400).json({ message: "لا يمكن التعديل" });
      const line = await storage.addStockTransferLine({
        transferId: transfer.id,
        variantId: req.body.variantId,
        qty: req.body.qty,
      });
      res.status(201).json(line);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ" });
    }
  });
  app.delete("/api/stock-transfer-lines/:id", requireAuth, async (req, res) => {
    await storage.deleteStockTransferLine(Number(req.params.id));
    res.json({ message: "تم الحذف" });
  });
  app.post("/api/stock-transfers/:id/approve", requireAuth, async (req, res) => {
    try {
      const result = await storage.approveStockTransfer(Number(req.params.id), req.session.userId!);
      if (!result) return res.status(400).json({ message: "لا يمكن اعتماد التحويل" });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err?.message ?? "خطأ في اعتماد التحويل" });
    }
  });

  // ── Inventory Ledger ──
  app.get("/api/inventory-ledger", requireAuth, async (req, res) => {
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

  app.get("/api/inventory", requireAuth, requireManager, async (_req, res) => {
    res.json(await storage.getInventory());
  });
  app.get("/api/inventory/low-stock", requireAuth, async (_req, res) => {
    res.json(await storage.getLowStockAlerts());
  });
  app.post("/api/inventory/receive", requireAuth, requireManager, async (req, res) => {
    const { productId, warehouseId, quantity } = req.body;
    if (!productId || !warehouseId || !quantity) {
      return res.status(400).json({ message: "البيانات ناقصة" });
    }
    res.json(await storage.adjustInventory(productId, warehouseId, quantity));
  });
  app.post("/api/inventory/transfer", requireAuth, requireManager, async (req, res) => {
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

  app.post("/api/location-inventory/transfer", requireAuth, requireManager, async (req, res) => {
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

  app.post("/api/inventory-transfers", requireAuth, requireManager, async (req, res) => {
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

  app.post("/api/location-inventory/add-stock", requireAuth, requireManager, async (req, res) => {
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

  app.get("/api/customers", requireAuth, async (_req, res) => {
    res.json(await storage.getCustomers());
  });
  app.get("/api/customers/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const result = await storage.getCustomerWithInvoices(id);
    if (!result) return res.status(404).json({ message: "Customer not found" });
    res.json(result);
  });
  app.post("/api/customers", requireAuth, async (req, res) => {
    const parsed = insertCustomerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createCustomer(parsed.data));
  });
  app.post("/api/customers/find-or-create", requireAuth, async (req, res) => {
    const { phone, name } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone is required" });
    const customer = await storage.findOrCreateCustomerByPhone(phone, name);
    res.json(customer);
  });
  app.put("/api/customers/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const { name, phone } = req.body;
    const updated = await storage.updateCustomer(id, { name, phone });
    if (!updated) return res.status(404).json({ message: "Customer not found" });
    res.json(updated);
  });

  app.get("/api/suppliers", requireAuth, requireManager, async (req, res) => {
    const activeOnly = req.query.activeOnly === "true";
    res.json(await storage.getSuppliers(activeOnly));
  });
  app.get("/api/suppliers/:id", requireAuth, requireManager, async (req, res) => {
    const row = await storage.getSupplier(Number(req.params.id));
    if (!row) return res.status(404).json({ message: "المورد غير موجود" });
    res.json(row);
  });
  app.post("/api/suppliers", requireAuth, requireManager, async (req, res) => {
    const parsed = insertSupplierSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    if (!parsed.data.name || !parsed.data.name.trim()) {
      return res.status(400).json({ message: "اسم المورد مطلوب" });
    }
    const existing = await storage.getSupplierByName(parsed.data.name.trim());
    if (existing) {
      return res.status(409).json({ message: "يوجد مورد بنفس الاسم" });
    }
    res.status(201).json(await storage.createSupplier(parsed.data));
  });
  app.patch("/api/suppliers/:id", requireAuth, requireManager, async (req, res) => {
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
  app.get("/api/sales/:id", requireAuth, async (req, res) => {
    const detail = await storage.getSaleWithDetails(Number(req.params.id));
    if (!detail) return res.status(404).json({ message: "الفاتورة غير موجودة" });
    const user = await storage.getUser(req.session.userId!);
    const isBranchOnly = user?.role === "cashier" || user?.role === "employee" || user?.role === "manager";
    if (isBranchOnly && detail.branchId !== user!.branchId) {
      return res.status(403).json({ message: "غير مصرح" });
    }
    res.json(detail);
  });
  app.post("/api/sales", requireAuth, async (req, res) => {
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
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "لا توجد منتجات في الفاتورة" });
    }
    try {
      const sale = await storage.createSale(parsed.data, items);
      if (parsed.data.customerId) {
        storage.updateCustomerAfterSale(parsed.data.customerId, String(parsed.data.total || "0")).catch(() => {});
      }
      res.status(201).json(sale);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "فشل إنشاء الفاتورة" });
    }
  });
  app.get("/api/sales/daily/summary", requireAuth, enforceBranchScope, async (req, res) => {
    res.json(await storage.getDailySalesTotal());
  });

  app.get("/api/orders", requireAuth, async (req, res) => {
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
  app.get("/api/orders/:id", requireAuth, async (req, res) => {
    const order = await storage.getOrder(Number(req.params.id));
    if (!order) return res.status(404).json({ message: "الطلب غير موجود" });
    const items = await storage.getOrderItems(order.id);
    res.json({ ...order, items });
  });
  app.post("/api/orders", requireAuth, async (req, res) => {
    try {
      const { items, ...orderData } = req.body;
      const parsed = insertOrderSchema.safeParse(orderData);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ message: "لا توجد منتجات في الطلب" });
      }
      const branchId = parsed.data.branchId;
      let shiftId = parsed.data.shiftId ?? null;
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
      if (parsed.data.customerPhone) {
        storage.findOrCreateCustomerByPhone(parsed.data.customerPhone, parsed.data.customerName || undefined).catch(() => {});
      }
      res.status(201).json(order);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });
  app.patch("/api/orders/:id/status", requireAuth, async (req, res) => {
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: "الحالة مطلوبة" });
    const existing = await storage.getOrder(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "الطلب غير موجود" });
    const oldStatus = existing.status;
    const row = await storage.updateOrderStatus(Number(req.params.id), status);
    if (!row) return res.status(404).json({ message: "الطلب غير موجود" });
    const user = req.session?.user;
    if (status === "cancelled" || oldStatus !== status) {
      await storage.addAuditLog({
        action: status === "cancelled" ? "order_cancel" : "order_status_change",
        entityType: "order",
        entityId: row.id,
        branchId: row.branchId ?? null,
        userId: user?.id ?? null,
        userName: user?.name ?? null,
        details: `تغيير حالة الطلب ${row.orderNumber} من ${oldStatus} إلى ${status}`,
        oldValue: JSON.stringify({ status: oldStatus }),
        newValue: JSON.stringify({ status }),
      });
    }
    res.json(row);
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

  app.post("/api/orders/:id/cancel", requireAuth, async (req, res) => {
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

  app.post("/api/sales/:id/return", requireAuth, async (req, res) => {
    try {
      const saleId = Number(req.params.id);
      const user = req.session?.user;
      if (!user) return res.status(401).json({ message: "غير مسجل دخول" });
      if (!["owner", "admin", "manager"].includes(user.role)) {
        return res.status(403).json({ message: "ليس لديك صلاحية إنشاء مرتجعات" });
      }

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

  app.get("/api/sale-returns/:id", requireAuth, async (req, res) => {
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
      const rows = await storage.getExpensesEnriched(branchId, dateStr);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });
  app.get("/api/expenses/summary", requireAuth, enforceBranchScope, async (req, res) => {
    try {
      const scope = req.branchScope!;
      const branchId = scope.mode === "branch" ? scope.branchId! : (req.query.branchId ? Number(req.query.branchId) : undefined);
      const dateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10);
      const summary = await storage.getExpensesSummary(branchId, dateStr);
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });
  app.post("/api/expenses", requireAuth, async (req, res) => {
    try {
      const { amount, notes, source, category } = req.body;
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

      const todayStr = new Date().toISOString().slice(0, 10);
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

  app.get("/api/shifts/current", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user || !user.branchId || !user.terminalName) {
      return res.status(400).json({ message: "بيانات المستخدم ناقصة (الفرع أو الجهاز)" });
    }
    const shift = await storage.getCurrentShift(user.branchId, user.terminalName);
    if (!shift) return res.json({ shift: null });
    res.json({ shift });
  });

  app.get("/api/shifts", requireAuth, async (_req, res) => {
    res.json(await storage.getShifts());
  });
  app.post("/api/shifts", requireAuth, async (req, res) => {
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
  app.patch("/api/shifts/:id/close", requireAuth, async (req, res) => {
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

  app.get("/api/reports/shift", requireAuth, enforceBranchScope, async (req, res) => {
    const shiftId = Number(req.query.shiftId);
    if (!shiftId) return res.status(400).json({ message: "shiftId مطلوب" });
    const report = await storage.getShiftReport(shiftId);
    if (!report) return res.status(404).json({ message: "الشفت غير موجود" });
    res.json(report);
  });

  app.get("/api/reports/daily", requireAuth, enforceBranchScope, async (req, res) => {
    const dateStr = req.query.date as string;
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ message: "التاريخ مطلوب بصيغة YYYY-MM-DD" });
    }
    const scope = req.branchScope!;
    const branchId = scope.mode === "branch" ? scope.branchId! : undefined;
    const report = await storage.getDailyReport(dateStr, branchId);
    res.json(report);
  });

  app.get("/api/reports/shifts-by-date", requireAuth, enforceBranchScope, async (req, res) => {
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

  app.get("/api/reports/overview", requireAuth, enforceBranchScope, async (req, res) => {
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ message: "from & to required (YYYY-MM-DD)" });
    }
    const scope = req.branchScope!;
    const branchId = req.query.branchId ? Number(req.query.branchId) : (scope.mode === "branch" ? scope.branchId! : undefined);
    res.json(await storage.getOverviewReport(from, to, branchId));
  });

  app.get("/api/reports/sales-list", requireAuth, enforceBranchScope, async (req, res) => {
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

  app.get("/api/reports/categories-report", requireAuth, enforceBranchScope, async (req, res) => {
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ message: "from & to required (YYYY-MM-DD)" });
    }
    const scope = req.branchScope!;
    const branchId = req.query.branchId ? Number(req.query.branchId) : (scope.mode === "branch" ? scope.branchId! : undefined);
    res.json(await storage.getCategoriesReport(from, to, branchId));
  });

  app.get("/api/reports/payments-report", requireAuth, enforceBranchScope, async (req, res) => {
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ message: "from & to required (YYYY-MM-DD)" });
    }
    const scope = req.branchScope!;
    const branchId = req.query.branchId ? Number(req.query.branchId) : (scope.mode === "branch" ? scope.branchId! : undefined);
    res.json(await storage.getPaymentsReport(from, to, branchId));
  });

  app.get("/api/reports/shifts-report", requireAuth, enforceBranchScope, async (req, res) => {
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

  app.get("/api/purchases", requireAuth, async (_req, res) => {
    const invoices = await storage.getPurchaseInvoices();
    res.json(invoices);
  });

  app.get("/api/purchases/:id", requireAuth, async (req, res) => {
    const invoice = await storage.getPurchaseInvoice(Number(req.params.id));
    if (!invoice) return res.status(404).json({ message: "فاتورة المشتريات غير موجودة" });
    const items = await storage.getPurchaseItems(invoice.id);
    res.json({ ...invoice, items });
  });

  app.post("/api/purchases", requireAuth, async (req, res) => {
    try {
      const { supplierId, invoiceDate, shippingCost, customsCost, clearanceCost, otherCost, notes } = req.body;
      if (!invoiceDate) {
        return res.status(400).json({ message: "تاريخ الفاتورة مطلوب" });
      }
      const invoiceNumber = `PUR-${Date.now()}`;
      const data = {
        invoiceNumber,
        supplierId: supplierId || null,
        branchId: null as any,
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

  app.patch("/api/purchases/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const invoice = await storage.getPurchaseInvoice(id);
    if (!invoice) return res.status(404).json({ message: "فاتورة المشتريات غير موجودة" });
    if (invoice.status !== "pending") {
      return res.status(400).json({ message: "لا يمكن تعديل فاتورة معتمدة أو ملغاة" });
    }
    const updateData: any = {};
    const { shippingCost, customsCost, clearanceCost, otherCost, notes, supplierId } = req.body;
    if (shippingCost !== undefined) updateData.shippingCost = String(shippingCost);
    if (customsCost !== undefined) updateData.customsCost = String(customsCost);
    if (clearanceCost !== undefined) updateData.clearanceCost = String(clearanceCost);
    if (otherCost !== undefined) updateData.otherCost = String(otherCost);
    if (notes !== undefined) updateData.notes = notes;
    if (supplierId !== undefined) updateData.supplierId = supplierId;
    const row = await storage.updatePurchaseInvoice(id, updateData);
    res.json(row);
  });

  app.post("/api/purchases/:id/items", requireAuth, async (req, res) => {
    try {
      const purchaseId = Number(req.params.id);
      const invoice = await storage.getPurchaseInvoice(purchaseId);
      if (!invoice) return res.status(404).json({ message: "فاتورة المشتريات غير موجودة" });
      if (invoice.status !== "pending") {
        return res.status(400).json({ message: "لا يمكن إضافة أصناف لفاتورة معتمدة أو ملغاة" });
      }
      const { productId, qty, unitCostBase } = req.body;
      if (!productId || !qty || !unitCostBase) {
        return res.status(400).json({ message: "المنتج والكمية وسعر التكلفة مطلوبة" });
      }
      const lineSubtotal = Number(qty) * Number(unitCostBase);
      const item = await storage.addPurchaseItem({
        purchaseId,
        productId: Number(productId),
        qty: Number(qty),
        unitCostBase: String(unitCostBase),
        lineSubtotal: lineSubtotal.toFixed(3),
        allocatedExtraCost: "0",
        unitCostFinal: "0",
      });
      res.status(201).json(item);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.patch("/api/purchases/:purchaseId/items/:itemId", requireAuth, async (req, res) => {
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

  app.delete("/api/purchases/:purchaseId/items/:itemId", requireAuth, async (req, res) => {
    const purchaseId = Number(req.params.purchaseId);
    const invoice = await storage.getPurchaseInvoice(purchaseId);
    if (!invoice) return res.status(404).json({ message: "فاتورة المشتريات غير موجودة" });
    if (invoice.status !== "pending") {
      return res.status(400).json({ message: "لا يمكن حذف أصناف من فاتورة معتمدة أو ملغاة" });
    }
    await storage.deletePurchaseItem(Number(req.params.itemId));
    res.json({ message: "تم الحذف" });
  });

  app.post("/api/purchase-invoices/:id/approve", requireAuth, requireManager, async (req, res) => {
    try {
      const result = await storage.approvePurchaseInvoice(Number(req.params.id));
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err?.message ?? "فشل الترحيل" });
    }
  });

  app.post("/api/purchases/:purchaseId/invoice-image", requireAuth, upload.single("file"), async (req: any, res) => {
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

  app.post("/api/purchases/:purchaseId/parse-invoice", requireAuth, async (req, res) => {
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

  app.post("/api/purchases/:id/receive", requireAuth, requireManager, async (req, res) => {
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
    const branchId = req.branchScope!.mode === "branch" ? req.branchScope!.branchId : (req.query.branchId ? Number(req.query.branchId) : undefined);
    const filterDate = date ? String(date) : new Date().toISOString().slice(0, 10);
    const entries = await storage.getCashLedgerByDate(branchId, filterDate);
    res.json(entries);
  });

  app.get("/api/bank-ledger", requireAuth, enforceBranchScope, async (req, res) => {
    const { date } = req.query;
    const branchId = req.branchScope!.mode === "branch" ? req.branchScope!.branchId : (req.query.branchId ? Number(req.query.branchId) : undefined);
    const filterDate = date ? String(date) : new Date().toISOString().slice(0, 10);
    const entries = await storage.getBankLedgerByDate(branchId, filterDate);
    res.json(entries);
  });

  app.get("/api/cash-ledger/summary", requireAuth, enforceBranchScope, async (req, res) => {
    const { date } = req.query;
    const branchId = req.branchScope!.mode === "branch" ? req.branchScope!.branchId : (req.query.branchId ? Number(req.query.branchId) : undefined);
    const filterDate = date ? String(date) : new Date().toISOString().slice(0, 10);
    const summary = await storage.getDailyCashSummary(branchId, filterDate);
    res.json(summary);
  });

  app.post("/api/cash-ledger/deposit", requireAuth, requireManager, async (req, res) => {
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

  app.post("/api/cash-ledger/withdrawal", requireAuth, requireManager, async (req, res) => {
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
    const branchId = req.branchScope!.mode === "branch" ? req.branchScope!.branchId : (req.query.branchId ? Number(req.query.branchId) : undefined);
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
            b.name as branch_name,
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
            b.name as branch_name,
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
            b.name as branch_name,
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
            b.name as branch_name,
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
            b.name as branch_name,
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
            b.name as branch_name,
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
            b.name as branch_name,
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
            b.name as branch_name,
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

  app.get("/api/stocktakes", requireAuth, requireManager, async (req, res) => {
    try {
      const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
      const list = await storage.getStocktakes(branchId);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/stocktakes", requireAuth, requireManager, async (req, res) => {
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

  app.get("/api/stocktakes/:id/items", requireAuth, requireManager, async (req, res) => {
    try {
      const items = await storage.getStocktakeItems(Number(req.params.id));
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.patch("/api/stocktake-items/:id", requireAuth, requireManager, async (req, res) => {
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

  app.post("/api/stocktakes/:id/approve", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const updated = await storage.approveStocktake(Number(req.params.id), req.session.userId!);
      if (!updated) return res.status(400).json({ message: "لا يمكن اعتماد هذا الجرد" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/inventory-adjustments", requireAuth, requireManager, async (req, res) => {
    try {
      const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
      const locationId = req.query.locationId ? Number(req.query.locationId) : undefined;
      const list = await storage.getInventoryAdjustments(branchId, locationId);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/inventory-adjustments", requireAuth, requireManager, async (req, res) => {
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

      res.status(201).json(adj);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/payroll-runs", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const runs = await storage.getPayrollRuns();
      res.json(runs);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/payroll-runs", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const { month, year, note } = req.body;
      if (!month || !year) return res.status(400).json({ message: "الشهر والسنة مطلوبة" });
      const run = await storage.createPayrollRun({
        month: String(month),
        year: Number(year),
        status: "draft",
        note: note || null,
        createdBy: req.session.userId!,
      });
      await storage.generatePayrollRun(run.id, String(month), Number(year));
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
      const { employeeId, amount, date, note } = req.body;
      if (!employeeId || !amount || !date) return res.status(400).json({ message: "بيانات ناقصة" });
      const advance = await storage.createEmployeeAdvance({
        employeeId: Number(employeeId),
        amount: String(amount),
        date,
        note: note || null,
        settled: false,
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
      const { employeeId, amount, reason, date } = req.body;
      if (!employeeId || !amount || !reason || !date) return res.status(400).json({ message: "بيانات ناقصة" });
      const deduction = await storage.createEmployeeDeduction({
        employeeId: Number(employeeId),
        amount: String(amount),
        reason,
        date,
        createdBy: req.session.userId!,
      });
      res.status(201).json(deduction);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  registerExportRoutes(app);
  registerBackupRoutes(app);

  return httpServer;
}
