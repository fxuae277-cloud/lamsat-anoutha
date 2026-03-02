import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { and, eq, desc } from "drizzle-orm";
import { 
  insertBranchSchema, insertCategorySchema, insertProductSchema,
  insertCustomerSchema, insertSupplierSchema, insertExpenseSchema,
  insertEmployeeSchema, insertOrderSchema, insertSaleSchema,
  insertInventoryTransferSchema, insertCitySchema, insertUserSchema,
  insertWarehouseSchema, insertShiftSchema, shifts,
  PAYMENT_METHODS, type PaymentMethod,
} from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/dashboard", async (_req, res) => {
    const stats = await storage.getDashboardStats();
    res.json(stats);
  });

  app.get("/api/branches", async (_req, res) => {
    res.json(await storage.getBranches());
  });
  app.post("/api/branches", async (req, res) => {
    const parsed = insertBranchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createBranch(parsed.data));
  });
  app.patch("/api/branches/:id", async (req, res) => {
    const row = await storage.updateBranch(Number(req.params.id), req.body);
    if (!row) return res.status(404).json({ message: "لم يتم العثور على الفرع" });
    res.json(row);
  });

  app.get("/api/cities", async (_req, res) => {
    res.json(await storage.getCities());
  });
  app.post("/api/cities", async (req, res) => {
    const parsed = insertCitySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createCity(parsed.data));
  });

  app.get("/api/users", async (_req, res) => {
    res.json(await storage.getUsers());
  });
  app.post("/api/users", async (req, res) => {
    const parsed = insertUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createUser(parsed.data));
  });

  app.get("/api/categories", async (_req, res) => {
    res.json(await storage.getCategories());
  });
  app.post("/api/categories", async (req, res) => {
    const parsed = insertCategorySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createCategory(parsed.data));
  });

  app.get("/api/products", async (_req, res) => {
    res.json(await storage.getProducts());
  });
  app.get("/api/products/:id", async (req, res) => {
    const row = await storage.getProduct(Number(req.params.id));
    if (!row) return res.status(404).json({ message: "المنتج غير موجود" });
    res.json(row);
  });
  app.get("/api/products/barcode/:barcode", async (req, res) => {
    const row = await storage.getProductByBarcode(req.params.barcode);
    if (!row) return res.status(404).json({ message: "المنتج غير موجود" });
    res.json(row);
  });
  app.post("/api/products", async (req, res) => {
    const parsed = insertProductSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createProduct(parsed.data));
  });
  app.patch("/api/products/:id", async (req, res) => {
    const row = await storage.updateProduct(Number(req.params.id), req.body);
    if (!row) return res.status(404).json({ message: "المنتج غير موجود" });
    res.json(row);
  });
  app.delete("/api/products/:id", async (req, res) => {
    await storage.deleteProduct(Number(req.params.id));
    res.json({ message: "تم حذف المنتج" });
  });

  app.get("/api/warehouses", async (_req, res) => {
    res.json(await storage.getWarehouses());
  });
  app.post("/api/warehouses", async (req, res) => {
    const parsed = insertWarehouseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createWarehouse(parsed.data));
  });

  app.get("/api/inventory", async (_req, res) => {
    res.json(await storage.getInventory());
  });
  app.get("/api/inventory/low-stock", async (_req, res) => {
    res.json(await storage.getLowStockAlerts());
  });
  app.post("/api/inventory/receive", async (req, res) => {
    const { productId, warehouseId, quantity } = req.body;
    if (!productId || !warehouseId || !quantity) {
      return res.status(400).json({ message: "البيانات ناقصة" });
    }
    res.json(await storage.adjustInventory(productId, warehouseId, quantity));
  });
  app.post("/api/inventory/transfer", async (req, res) => {
    const parsed = insertInventoryTransferSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    try {
      res.status(201).json(await storage.createTransfer(parsed.data));
    } catch (e: any) {
      res.status(400).json({ message: e.message || "فشل التحويل" });
    }
  });

  app.get("/api/customers", async (_req, res) => {
    res.json(await storage.getCustomers());
  });
  app.post("/api/customers", async (req, res) => {
    const parsed = insertCustomerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createCustomer(parsed.data));
  });

  app.get("/api/suppliers", async (_req, res) => {
    res.json(await storage.getSuppliers());
  });
  app.post("/api/suppliers", async (req, res) => {
    const parsed = insertSupplierSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createSupplier(parsed.data));
  });

  app.get("/api/sales", async (_req, res) => {
    res.json(await storage.getSales());
  });
  app.get("/api/sales/:id", async (req, res) => {
    const sale = await storage.getSale(Number(req.params.id));
    if (!sale) return res.status(404).json({ message: "الفاتورة غير موجودة" });
    const items = await storage.getSaleItems(sale.id);
    res.json({ ...sale, items });
  });
  app.post("/api/sales", async (req, res) => {
    const { items, ...saleData } = req.body;
    const parsed = insertSaleSchema.safeParse(saleData);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "لا توجد منتجات في الفاتورة" });
    }
    res.status(201).json(await storage.createSale(parsed.data, items));
  });
  app.get("/api/sales/daily/summary", async (_req, res) => {
    res.json(await storage.getDailySalesTotal());
  });

  app.get("/api/orders", async (_req, res) => {
    res.json(await storage.getOrders());
  });
  app.get("/api/orders/:id", async (req, res) => {
    const order = await storage.getOrder(Number(req.params.id));
    if (!order) return res.status(404).json({ message: "الطلب غير موجود" });
    const items = await storage.getOrderItems(order.id);
    res.json({ ...order, items });
  });
  app.post("/api/orders", async (req, res) => {
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
      const order = await storage.createOrder({ ...parsed.data, shiftId }, items);
      res.status(201).json(order);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });
  app.patch("/api/orders/:id/status", async (req, res) => {
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: "الحالة مطلوبة" });
    const row = await storage.updateOrderStatus(Number(req.params.id), status);
    if (!row) return res.status(404).json({ message: "الطلب غير موجود" });
    res.json(row);
  });
  app.post("/api/orders/:id/pay", async (req, res) => {
    const { paymentMethod, bankTxnId } = req.body;
    if (!paymentMethod || !PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ message: "طريقة الدفع غير صالحة. الخيارات: cash, card, bank_transfer" });
    }
    const row = await storage.payOrder(Number(req.params.id), paymentMethod as PaymentMethod, bankTxnId);
    if (!row) return res.status(404).json({ message: "الطلب غير موجود" });
    res.json(row);
  });

  app.get("/api/expenses", async (_req, res) => {
    res.json(await storage.getExpenses());
  });
  app.post("/api/expenses", async (req, res) => {
    try {
      const { amount, notes, source, branchId, shiftId, category } = req.body;
      if (!amount || !branchId) {
        return res.status(400).json({ message: "المبلغ والفرع مطلوبان" });
      }
      const expenseSource = source || "cash";
      if (!["cash", "card", "bank_transfer"].includes(expenseSource)) {
        return res.status(400).json({ message: "مصدر غير صالح. الخيارات: cash, card, bank_transfer" });
      }
      const todayStr = new Date().toISOString().slice(0, 10);
      const expense = await storage.createExpense({
        branchId,
        shiftId: shiftId || null,
        category: category || "عام",
        amount: String(amount),
        source: expenseSource,
        date: todayStr,
        notes: notes || null,
      });

      if (expenseSource === "cash") {
        await storage.addCashLedgerEntry({
          date: todayStr,
          branchId,
          shiftId: shiftId || null,
          type: "expense",
          amountIn: "0",
          amountOut: String(amount),
          note: notes || `مصروف: ${category || "عام"}`,
        });
      } else {
        await storage.addBankLedgerEntry({
          date: todayStr,
          branchId,
          shiftId: shiftId || null,
          method: expenseSource,
          amountIn: "0",
          amountOut: String(amount),
          note: notes || `مصروف: ${category || "عام"}`,
        });
      }

      res.status(201).json(expense);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/employees", async (_req, res) => {
    res.json(await storage.getEmployees());
  });
  app.post("/api/employees", async (req, res) => {
    const parsed = insertEmployeeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createEmployee(parsed.data));
  });

  app.get("/api/shifts/current", async (req, res) => {
    const branchId = Number(req.query.branchId);
    const terminalName = String(req.query.terminalName || "");
    if (!branchId || !terminalName) {
      return res.status(400).json({ message: "branchId و terminalName مطلوبان" });
    }
    const shift = await storage.getCurrentShift(branchId, terminalName);
    if (!shift) return res.json({ shift: null });
    res.json({ shift });
  });

  app.get("/api/shifts", async (_req, res) => {
    res.json(await storage.getShifts());
  });
  app.post("/api/shifts", async (req, res) => {
    const parsed = insertShiftSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createShift(parsed.data));
  });
  app.patch("/api/shifts/:id/close", async (req, res) => {
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

  app.get("/api/reports/shift", async (req, res) => {
    const shiftId = Number(req.query.shiftId);
    if (!shiftId) return res.status(400).json({ message: "shiftId مطلوب" });
    const report = await storage.getShiftReport(shiftId);
    if (!report) return res.status(404).json({ message: "الشفت غير موجود" });
    res.json(report);
  });

  return httpServer;
}
