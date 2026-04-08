import type { Express, Request, Response, NextFunction } from "express";
import { pool } from "./db";
import { storage } from "./storage";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) return res.status(401).json({ message: "غير مصرح" });
  next();
}

async function requireOwnerOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) return res.status(401).json({ message: "غير مصرح" });
  const user = await storage.getUser(req.session.userId);
  if (!user || (user.role !== "owner" && user.role !== "admin")) {
    return res.status(403).json({ message: "غير مصرح - صلاحيات غير كافية" });
  }
  next();
}

export function registerMobileRoutes(app: Express) {

  app.get("/api/mobile/employee/home", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "مستخدم غير موجود" });

      const branch = user.branchId ? await storage.getBranch(user.branchId) : null;
      const shift = user.branchId
        ? await storage.getCurrentShift(user.branchId, user.terminalName || "POS-1")
        : null;

      let todaySales = 0;
      let todayCount = 0;
      if (shift) {
        const salesResult = await pool.query(
          `SELECT COALESCE(SUM(total::numeric), 0) as total, COUNT(*) as count
           FROM sales WHERE shift_id = $1`,
          [shift.id]
        );
        todaySales = parseFloat(salesResult.rows[0].total);
        todayCount = parseInt(salesResult.rows[0].count);
      }

      res.json({
        user: { id: user.id, name: user.name, role: user.role, branchId: user.branchId, terminalName: user.terminalName },
        branch: branch ? { id: branch.id, name: branch.address ? `${branch.name} - ${branch.address}` : branch.name } : null,
        shift: shift ? { id: shift.id, status: shift.status, startedAt: shift.startedAt, openingCash: shift.openingCash } : null,
        todaySales,
        todayCount,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/mobile/owner/dashboard", requireOwnerOrAdmin, async (req, res) => {
    try {
      const branchId = req.query.branchId ? Number(req.query.branchId) : null;
      const period = (req.query.period as string) || "today";

      let dateFilter = "";
      if (period === "today") dateFilter = "AND s.created_at::date = CURRENT_DATE";
      else if (period === "7days") dateFilter = "AND s.created_at >= NOW() - INTERVAL '7 days'";
      else if (period === "30days") dateFilter = "AND s.created_at >= NOW() - INTERVAL '30 days'";
      else if (period === "month") dateFilter = "AND EXTRACT(MONTH FROM s.created_at) = EXTRACT(MONTH FROM NOW()) AND EXTRACT(YEAR FROM s.created_at) = EXTRACT(YEAR FROM NOW())";

      const branchFilter = branchId ? `AND s.branch_id = ${branchId}` : "";

      const salesQ = await pool.query(`
        SELECT COALESCE(SUM(s.total::numeric), 0) as total_sales,
               COALESCE(SUM(s.gross_profit::numeric), 0) as gross_profit,
               COUNT(*) as invoice_count,
               COALESCE(AVG(s.total::numeric), 0) as avg_invoice
        FROM sales s WHERE 1=1 ${dateFilter} ${branchFilter}
      `);
      const { total_sales, gross_profit, invoice_count, avg_invoice } = salesQ.rows[0];

      const monthSalesQ = await pool.query(`
        SELECT COALESCE(SUM(total::numeric), 0) as month_sales FROM sales
        WHERE EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())
        AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
        ${branchId ? `AND branch_id = ${branchId}` : ""}
      `);

      const expensesQ = await pool.query(`
        SELECT COALESCE(SUM(amount::numeric), 0) as total_expenses FROM expenses
        WHERE created_at::date = CURRENT_DATE ${branchId ? `AND branch_id = ${branchId}` : ""}
      `);

      const openShiftsQ = await pool.query(`SELECT COUNT(*) as count FROM shifts WHERE status = 'open'`);

      const lowStockQ = await pool.query(`
        SELECT COUNT(*) as count FROM location_inventory WHERE quantity < 5 AND quantity > 0
      `);
      const outOfStockQ = await pool.query(`
        SELECT COUNT(*) as count FROM location_inventory WHERE quantity <= 0
      `);

      const pendingTransfersQ = await pool.query(`
        SELECT COUNT(*) as count FROM stock_transfers WHERE status = 'draft'
      `);

      const branchesQ = await pool.query(`SELECT id, name FROM branches`);

      const topProductsQ = await pool.query(`
        SELECT p.name, SUM(si.quantity) as qty, SUM(si.total::numeric) as total
        FROM sale_items si JOIN products p ON si.product_id = p.id
        JOIN sales s ON si.sale_id = s.id
        WHERE s.created_at::date = CURRENT_DATE ${branchId ? `AND s.branch_id = ${branchId}` : ""}
        GROUP BY p.id, p.name ORDER BY total DESC LIMIT 5
      `);

      const branchPerfQ = await pool.query(`
        SELECT (b.name || CASE WHEN b.address IS NOT NULL AND b.address <> '' THEN ' - ' || b.address ELSE '' END) as branch_name, COALESCE(SUM(s.total::numeric), 0) as total
        FROM branches b LEFT JOIN sales s ON s.branch_id = b.id AND s.created_at::date = CURRENT_DATE
        GROUP BY b.id, b.name, b.address ORDER BY total DESC
      `);

      const recentOpsQ = await pool.query(`
        SELECT description, created_at, table_name FROM audit_log
        ORDER BY created_at DESC LIMIT 10
      `);

      const cashQ = await pool.query(`
        SELECT COALESCE(SUM(CASE WHEN type='deposit' THEN amount::numeric ELSE -amount::numeric END), 0) as net
        FROM cash_ledger WHERE created_at::date = CURRENT_DATE ${branchId ? `AND branch_id = ${branchId}` : ""}
      `);

      const timeseriesQ = await pool.query(`
        SELECT created_at::date as date, SUM(total::numeric) as sales
        FROM sales WHERE created_at >= NOW() - INTERVAL '7 days'
        ${branchId ? `AND branch_id = ${branchId}` : ""}
        GROUP BY created_at::date ORDER BY date
      `);

      res.json({
        kpi: {
          todaySales: parseFloat(total_sales),
          monthSales: parseFloat(monthSalesQ.rows[0].month_sales),
          invoiceCount: parseInt(invoice_count),
          avgInvoice: parseFloat(avg_invoice),
          grossProfit: parseFloat(gross_profit),
          expenses: parseFloat(expensesQ.rows[0].total_expenses),
          netCash: parseFloat(cashQ.rows[0].net),
          openShifts: parseInt(openShiftsQ.rows[0].count),
          lowStock: parseInt(lowStockQ.rows[0].count),
          outOfStock: parseInt(outOfStockQ.rows[0].count),
          pendingTransfers: parseInt(pendingTransfersQ.rows[0].count),
          branchCount: branchesQ.rows.length,
        },
        branches: branchesQ.rows,
        topProducts: topProductsQ.rows,
        branchPerformance: branchPerfQ.rows,
        recentOps: recentOpsQ.rows,
        timeseries: timeseriesQ.rows,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/mobile/my-invoices", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const result = await pool.query(
        `SELECT s.*, (b.name || CASE WHEN b.address IS NOT NULL AND b.address <> '' THEN ' - ' || b.address ELSE '' END) as branch_name FROM sales s
         LEFT JOIN branches b ON s.branch_id = b.id
         WHERE s.cashier_id = $1 AND s.created_at::date = CURRENT_DATE
         ORDER BY s.created_at DESC`,
        [userId]
      );
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/mobile/shift/open", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "مستخدم غير موجود" });

      const existing = await storage.getCurrentShift(user.branchId!, user.terminalName || "POS-1");
      if (existing) return res.status(400).json({ message: "يوجد شفت مفتوح بالفعل" });

      const { openingCash } = req.body;
      const shift = await storage.createShift({
        branchId: user.branchId!,
        cashierId: userId,
        terminalName: user.terminalName || "POS-1",
        openingCash: String(openingCash || 0),
      });
      res.json(shift);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/mobile/shift/close", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "مستخدم غير موجود" });

      const shift = await storage.getCurrentShift(user.branchId!, user.terminalName || "POS-1");
      if (!shift) return res.status(400).json({ message: "لا يوجد شفت مفتوح" });

      const { actualCash } = req.body;
      const closed = await storage.closeShift(shift.id, String(actualCash || 0));
      res.json(closed);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
