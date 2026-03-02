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
} from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // === Dashboard ===
  app.get("/api/dashboard", async (_req, res) => {
    const stats = await storage.getDashboardStats();
    res.json(stats);
  });

  // === Branches ===
  app.get("/api/branches", async (_req, res) => {
    const data = await storage.getBranches();
    res.json(data);
  });
  app.post("/api/branches", async (req, res) => {
    const parsed = insertBranchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const row = await storage.createBranch(parsed.data);
    res.status(201).json(row);
  });
  app.patch("/api/branches/:id", async (req, res) => {
    const row = await storage.updateBranch(Number(req.params.id), req.body);
    if (!row) return res.status(404).json({ message: "لم يتم العثور على الفرع" });
    res.json(row);
  });

  // === Cities ===
  app.get("/api/cities", async (_req, res) => {
    res.json(await storage.getCities());
  });
  app.post("/api/cities", async (req, res) => {
    const parsed = insertCitySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createCity(parsed.data));
  });

  // === Users ===
  app.get("/api/users", async (_req, res) => {
    res.json(await storage.getUsers());
  });
  app.post("/api/users", async (req, res) => {
    const parsed = insertUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createUser(parsed.data));
  });

  // === Categories ===
  app.get("/api/categories", async (_req, res) => {
    res.json(await storage.getCategories());
  });
  app.post("/api/categories", async (req, res) => {
    const parsed = insertCategorySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createCategory(parsed.data));
  });

  // === Products ===
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

  // === Warehouses ===
  app.get("/api/warehouses", async (_req, res) => {
    res.json(await storage.getWarehouses());
  });
  app.post("/api/warehouses", async (req, res) => {
    const parsed = insertWarehouseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createWarehouse(parsed.data));
  });

  // === Inventory ===
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
    const row = await storage.adjustInventory(productId, warehouseId, quantity);
    res.json(row);
  });
  app.post("/api/inventory/transfer", async (req, res) => {
    const parsed = insertInventoryTransferSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    try {
      const row = await storage.createTransfer(parsed.data);
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "فشل التحويل" });
    }
  });

  // === Customers ===
  app.get("/api/customers", async (_req, res) => {
    res.json(await storage.getCustomers());
  });
  app.post("/api/customers", async (req, res) => {
    const parsed = insertCustomerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createCustomer(parsed.data));
  });

  // === Suppliers ===
  app.get("/api/suppliers", async (_req, res) => {
    res.json(await storage.getSuppliers());
  });
  app.post("/api/suppliers", async (req, res) => {
    const parsed = insertSupplierSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createSupplier(parsed.data));
  });

  // === Sales (POS) ===
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
    const sale = await storage.createSale(parsed.data, items);
    res.status(201).json(sale);
  });
  app.get("/api/sales/daily/summary", async (_req, res) => {
    const stats = await storage.getDailySalesTotal();
    res.json(stats);
  });

  // === Orders (WhatsApp/Instagram) ===
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
        if (openShift) {
          shiftId = openShift.id;
        }
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

  // === Expenses ===
  app.get("/api/expenses", async (_req, res) => {
    res.json(await storage.getExpenses());
  });
  app.post("/api/expenses", async (req, res) => {
    const parsed = insertExpenseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createExpense(parsed.data));
  });

  // === Employees ===
  app.get("/api/employees", async (_req, res) => {
    res.json(await storage.getEmployees());
  });
  app.post("/api/employees", async (req, res) => {
    const parsed = insertEmployeeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createEmployee(parsed.data));
  });

  // === Shifts ===
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
    const { totalSales, totalCash, totalBank } = req.body;
    const row = await storage.closeShift(shiftId, totalSales, totalCash, totalBank);
    if (!row) return res.status(404).json({ message: "الوردية غير موجودة" });
    res.json(row);
  });

  return httpServer;
}
