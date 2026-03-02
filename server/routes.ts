import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { and, eq, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { 
  insertBranchSchema, insertCategorySchema, insertProductSchema,
  insertCustomerSchema, insertSupplierSchema, insertExpenseSchema,
  insertEmployeeSchema, insertOrderSchema, insertSaleSchema,
  insertInventoryTransferSchema, insertCitySchema, insertUserSchema,
  insertWarehouseSchema, insertShiftSchema, insertPurchaseInvoiceSchema,
  shifts,
  PAYMENT_METHODS, type PaymentMethod,
} from "@shared/schema";
import { registerExportRoutes } from "./exports";

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
    const { name, username, password, role, branchId, terminalName, isActive } = req.body;
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
    const hashed = await bcrypt.hash(password, 10);
    const { password: _, ...safeUser } = await storage.createUser({
      name,
      username,
      password: hashed,
      role: role || "employee",
      branchId: branchId ? Number(branchId) : 1,
      terminalName: terminalName || "T1",
      isActive: isActive !== undefined ? isActive : true,
    });
    res.status(201).json(safeUser);
  });
  app.patch("/api/users/:id", requireOwnerOrAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const { name, role, branchId, terminalName, isActive } = req.body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (branchId !== undefined) updateData.branchId = Number(branchId);
    if (terminalName !== undefined) updateData.terminalName = terminalName;
    if (isActive !== undefined) updateData.isActive = isActive;
    const updated = await storage.updateUser(id, updateData);
    if (!updated) return res.status(404).json({ message: "المستخدم غير موجود" });
    const { password: _, ...safeUser } = updated;
    res.json(safeUser);
  });
  app.patch("/api/users/:id/reset-password", requireOwnerOrAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
    }
    const user = await storage.getUser(id);
    if (!user) return res.status(404).json({ message: "المستخدم غير موجود" });
    const hashed = await bcrypt.hash(newPassword, 10);
    await storage.updateUser(id, { password: hashed });
    res.json({ message: "تم إعادة تعيين كلمة المرور بنجاح" });
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

  app.get("/api/central-inventory", requireAuth, async (req, res) => {
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

  app.get("/api/customers", async (_req, res) => {
    res.json(await storage.getCustomers());
  });
  app.post("/api/customers", async (req, res) => {
    const parsed = insertCustomerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createCustomer(parsed.data));
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

  app.get("/api/sales", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    const isBranchOnly = user?.role === "cashier" || user?.role === "employee" || user?.role === "manager";
    const filters: any = {};
    if (req.query.from) filters.from = req.query.from as string;
    if (req.query.to) filters.to = req.query.to as string;
    if (req.query.paymentMethod) filters.paymentMethod = req.query.paymentMethod as string;
    if (req.query.employeeId) filters.employeeId = Number(req.query.employeeId);
    if (isBranchOnly) {
      filters.branchId = user!.branchId;
    } else if (req.query.branchId) {
      filters.branchId = Number(req.query.branchId);
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
      res.status(201).json(await storage.createSale(parsed.data, items));
    } catch (e: any) {
      res.status(400).json({ message: e.message || "فشل إنشاء الفاتورة" });
    }
  });
  app.get("/api/sales/daily/summary", async (_req, res) => {
    res.json(await storage.getDailySalesTotal());
  });

  app.get("/api/orders", requireAuth, async (_req, res) => {
    res.json(await storage.getOrders());
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
      res.status(201).json(order);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err?.message ?? "خطأ في الخادم" });
    }
  });
  app.patch("/api/orders/:id/status", requireAuth, async (req, res) => {
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: "الحالة مطلوبة" });
    const row = await storage.updateOrderStatus(Number(req.params.id), status);
    if (!row) return res.status(404).json({ message: "الطلب غير موجود" });
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

  app.get("/api/expenses", requireAuth, async (_req, res) => {
    res.json(await storage.getExpenses());
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

  app.get("/api/ledger/cash", requireAuth, async (req, res) => {
    const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
    res.json(await storage.getCashLedgerEntries(branchId));
  });
  app.get("/api/ledger/bank", requireAuth, async (req, res) => {
    const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
    res.json(await storage.getBankLedgerEntries(branchId));
  });

  app.get("/api/employees", async (_req, res) => {
    res.json(await storage.getEmployees());
  });
  app.post("/api/employees", async (req, res) => {
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

  app.get("/api/reports/shift", requireAuth, async (req, res) => {
    const shiftId = Number(req.query.shiftId);
    if (!shiftId) return res.status(400).json({ message: "shiftId مطلوب" });
    const report = await storage.getShiftReport(shiftId);
    if (!report) return res.status(404).json({ message: "الشفت غير موجود" });
    res.json(report);
  });

  app.get("/api/reports/daily", requireAuth, async (req, res) => {
    const dateStr = req.query.date as string;
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ message: "التاريخ مطلوب بصيغة YYYY-MM-DD" });
    }
    const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
    const report = await storage.getDailyReport(dateStr, branchId);
    res.json(report);
  });

  app.get("/api/reports/shifts-by-date", requireAuth, async (req, res) => {
    const dateStr = req.query.date as string;
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ message: "التاريخ مطلوب بصيغة YYYY-MM-DD" });
    }
    const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
    res.json(await storage.getShiftsByDate(dateStr, branchId));
  });

  app.get("/api/reports/branch-comparison", requireAuth, async (req, res) => {
    const dateStr = req.query.date as string;
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ message: "التاريخ مطلوب بصيغة YYYY-MM-DD" });
    }
    res.json(await storage.getBranchComparisonReport(dateStr));
  });

  app.get("/api/reports/profit/branches", requireAuth, async (req, res) => {
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ message: "التاريخ مطلوب بصيغة YYYY-MM-DD (from & to)" });
    }
    res.json(await storage.getProfitByBranches(from, to));
  });

  app.get("/api/reports/profit/employees", requireAuth, async (req, res) => {
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ message: "التاريخ مطلوب بصيغة YYYY-MM-DD (from & to)" });
    }
    const user = await storage.getUser(req.session.userId!);
    const branchId = req.query.branchId ? Number(req.query.branchId)
      : (user?.role === "owner" || user?.role === "admin" ? undefined : user?.branchId);
    res.json(await storage.getProfitByEmployees(from, to, branchId));
  });

  app.get("/api/reports/profit/products", requireAuth, async (req, res) => {
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ message: "التاريخ مطلوب بصيغة YYYY-MM-DD (from & to)" });
    }
    const user = await storage.getUser(req.session.userId!);
    const branchId = req.query.branchId ? Number(req.query.branchId)
      : (user?.role === "owner" || user?.role === "admin" ? undefined : user?.branchId);
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

  registerExportRoutes(app);

  return httpServer;
}
