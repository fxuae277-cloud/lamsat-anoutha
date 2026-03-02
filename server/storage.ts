import { db, pool } from "./db";
import { eq, desc, sql, and, lte, gte } from "drizzle-orm";
import {
  branches, type InsertBranch, type Branch,
  cities, type InsertCity, type City,
  users, type InsertUser, type User,
  categories, type InsertCategory, type Category,
  products, type InsertProduct, type Product,
  warehouses, type InsertWarehouse, type Warehouse,
  inventory, type InsertInventory, type Inventory,
  inventoryTransfers, type InsertInventoryTransfer, type InventoryTransfer,
  customers, type InsertCustomer, type Customer,
  suppliers, type InsertSupplier, type Supplier,
  sales, type InsertSale, type Sale,
  saleItems, type InsertSaleItem, type SaleItem,
  orders, type InsertOrder, type Order,
  orderItems, type InsertOrderItem, type OrderItem,
  expenses, type InsertExpense, type Expense,
  employees, type InsertEmployee, type Employee,
  shifts, type InsertShift, type Shift,
  cashLedger, type InsertCashLedger, type CashLedger,
  bankLedger, type InsertBankLedger, type BankLedger,
  purchaseInvoices, type InsertPurchaseInvoice, type PurchaseInvoice,
  purchaseItems, type InsertPurchaseItem, type PurchaseItem,
  locations, type InsertLocation, type Location,
  locationInventory, type InsertLocationInventory, type LocationInventory,
  inventoryTransactions, type InsertInventoryTransaction, type InventoryTransaction,
  locationTransfers, type InsertLocationTransfer, type LocationTransfer,
  locationTransferItems, type InsertLocationTransferItem, type LocationTransferItem,
  type PaymentMethod, PAYMENT_METHODS,
} from "@shared/schema";

export interface IStorage {
  getBranches(): Promise<Branch[]>;
  getBranch(id: number): Promise<Branch | undefined>;
  createBranch(data: InsertBranch): Promise<Branch>;
  updateBranch(id: number, data: Partial<InsertBranch>): Promise<Branch | undefined>;
  getCities(): Promise<City[]>;
  createCity(data: InsertCity): Promise<City>;
  getUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(data: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  getCategories(): Promise<Category[]>;
  createCategory(data: InsertCategory): Promise<Category>;
  getProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductByBarcode(barcode: string): Promise<Product | undefined>;
  createProduct(data: InsertProduct): Promise<Product>;
  updateProduct(id: number, data: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<void>;
  getWarehouses(): Promise<Warehouse[]>;
  createWarehouse(data: InsertWarehouse): Promise<Warehouse>;
  getInventory(): Promise<Inventory[]>;
  getInventoryByWarehouse(warehouseId: number): Promise<Inventory[]>;
  getInventoryByProduct(productId: number): Promise<Inventory[]>;
  upsertInventory(productId: number, warehouseId: number, quantity: number): Promise<Inventory>;
  adjustInventory(productId: number, warehouseId: number, delta: number): Promise<Inventory | undefined>;
  getLowStockAlerts(): Promise<any[]>;
  createTransfer(data: InsertInventoryTransfer): Promise<InventoryTransfer>;
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(data: InsertCustomer): Promise<Customer>;
  getSuppliers(activeOnly?: boolean): Promise<Supplier[]>;
  getSupplier(id: number): Promise<Supplier | undefined>;
  getSupplierByName(name: string): Promise<Supplier | undefined>;
  createSupplier(data: InsertSupplier): Promise<Supplier>;
  getSales(): Promise<Sale[]>;
  getSalesFiltered(filters: { from?: string; to?: string; paymentMethod?: string; employeeId?: number; branchId?: number }): Promise<any[]>;
  getSale(id: number): Promise<Sale | undefined>;
  getSaleWithDetails(id: number): Promise<any>;
  createSale(data: InsertSale, items: InsertSaleItem[]): Promise<Sale>;
  getSaleItems(saleId: number): Promise<SaleItem[]>;
  getDailySalesTotal(branchId?: number): Promise<{ total: string; vatTotal: string; count: number }>;
  getWeeklySales(): Promise<{ date: string; total: string }[]>;
  getOrders(): Promise<Order[]>;
  getOrder(id: number): Promise<Order | undefined>;
  createOrder(data: InsertOrder, items: InsertOrderItem[]): Promise<Order>;
  updateOrderStatus(id: number, status: string): Promise<Order | undefined>;
  getOrderItems(orderId: number): Promise<OrderItem[]>;
  getPendingOrdersByShift(shiftId: number): Promise<Order[]>;
  payOrder(id: number, paymentMethod: PaymentMethod, bankTxnId?: string): Promise<Order | undefined>;
  getExpenses(): Promise<Expense[]>;
  createExpense(data: InsertExpense): Promise<Expense>;
  getEmployees(): Promise<Employee[]>;
  createEmployee(data: InsertEmployee): Promise<Employee>;
  getShifts(): Promise<Shift[]>;
  createShift(data: InsertShift): Promise<Shift>;
  closeShift(id: number, actualCash: string): Promise<Shift | undefined>;
  getCurrentShift(branchId: number, terminalName: string): Promise<Shift | null>;
  addCashLedgerEntry(data: InsertCashLedger): Promise<CashLedger>;
  addBankLedgerEntry(data: InsertBankLedger): Promise<BankLedger>;
  getCashLedgerEntries(branchId?: number): Promise<CashLedger[]>;
  getBankLedgerEntries(branchId?: number): Promise<BankLedger[]>;
  getShiftReport(shiftId: number): Promise<any>;
  getDailyReport(dateStr: string, branchId?: number): Promise<any>;
  getShiftsByDate(dateStr: string, branchId?: number): Promise<any[]>;
  getDashboardStats(branchId?: number): Promise<any>;
  getProfitByBranches(from: string, to: string): Promise<any[]>;
  getProfitByEmployees(from: string, to: string, branchId?: number): Promise<any[]>;
  getProfitByProducts(from: string, to: string, branchId?: number): Promise<any[]>;
  getPurchaseInvoices(): Promise<PurchaseInvoice[]>;
  getPurchaseInvoice(id: number): Promise<PurchaseInvoice | undefined>;
  createPurchaseInvoice(data: InsertPurchaseInvoice): Promise<PurchaseInvoice>;
  updatePurchaseInvoice(id: number, data: Partial<InsertPurchaseInvoice>): Promise<PurchaseInvoice | undefined>;
  getPurchaseItems(purchaseId: number): Promise<PurchaseItem[]>;
  addPurchaseItem(data: InsertPurchaseItem): Promise<PurchaseItem>;
  deletePurchaseItem(id: number): Promise<void>;
  approvePurchaseInvoice(id: number): Promise<PurchaseInvoice>;
  updateSupplier(id: number, data: Partial<InsertSupplier>): Promise<Supplier | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getBranches() { return db.select().from(branches); }
  async getBranch(id: number) {
    const [row] = await db.select().from(branches).where(eq(branches.id, id));
    return row;
  }
  async createBranch(data: InsertBranch) {
    const [row] = await db.insert(branches).values(data).returning();
    return row;
  }
  async updateBranch(id: number, data: Partial<InsertBranch>) {
    const [row] = await db.update(branches).set(data).where(eq(branches.id, id)).returning();
    return row;
  }

  async getCities() { return db.select().from(cities); }
  async createCity(data: InsertCity) {
    const [row] = await db.insert(cities).values(data).returning();
    return row;
  }

  async getUsers() { return db.select().from(users); }
  async getUser(id: number) {
    const [row] = await db.select().from(users).where(eq(users.id, id));
    return row;
  }
  async getUserByUsername(username: string) {
    const [row] = await db.select().from(users).where(eq(users.username, username));
    return row;
  }
  async createUser(data: InsertUser) {
    const [row] = await db.insert(users).values(data).returning();
    return row;
  }
  async updateUser(id: number, data: Partial<InsertUser>) {
    const [row] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return row;
  }

  async getCategories() { return db.select().from(categories); }
  async createCategory(data: InsertCategory) {
    const [row] = await db.insert(categories).values(data).returning();
    return row;
  }

  async getProducts() { return db.select().from(products).orderBy(desc(products.id)); }
  async getProduct(id: number) {
    const [row] = await db.select().from(products).where(eq(products.id, id));
    return row;
  }
  async getProductByBarcode(barcode: string) {
    const [row] = await db.select().from(products).where(eq(products.barcode, barcode));
    return row;
  }
  async createProduct(data: InsertProduct) {
    const [row] = await db.insert(products).values(data).returning();
    return row;
  }
  async updateProduct(id: number, data: Partial<InsertProduct>) {
    const [row] = await db.update(products).set(data).where(eq(products.id, id)).returning();
    return row;
  }
  async deleteProduct(id: number) {
    await db.delete(products).where(eq(products.id, id));
  }

  async getWarehouses() { return db.select().from(warehouses); }
  async createWarehouse(data: InsertWarehouse) {
    const [row] = await db.insert(warehouses).values(data).returning();
    return row;
  }

  async getInventory() { return db.select().from(inventory); }
  async getInventoryByWarehouse(warehouseId: number) {
    return db.select().from(inventory).where(eq(inventory.warehouseId, warehouseId));
  }
  async getInventoryByProduct(productId: number) {
    return db.select().from(inventory).where(eq(inventory.productId, productId));
  }
  async upsertInventory(productId: number, warehouseId: number, quantity: number) {
    const existing = await db.select().from(inventory)
      .where(and(eq(inventory.productId, productId), eq(inventory.warehouseId, warehouseId)));
    if (existing.length > 0) {
      const [row] = await db.update(inventory).set({ quantity }).where(eq(inventory.id, existing[0].id)).returning();
      return row;
    }
    const [row] = await db.insert(inventory).values({ productId, warehouseId, quantity }).returning();
    return row;
  }
  async adjustInventory(productId: number, warehouseId: number, delta: number) {
    const existing = await db.select().from(inventory)
      .where(and(eq(inventory.productId, productId), eq(inventory.warehouseId, warehouseId)));
    if (existing.length === 0) {
      if (delta > 0) {
        const [row] = await db.insert(inventory).values({ productId, warehouseId, quantity: delta }).returning();
        return row;
      }
      return undefined;
    }
    const newQty = (existing[0].quantity || 0) + delta;
    if (newQty < 0) return undefined;
    const [row] = await db.update(inventory).set({ quantity: newQty }).where(eq(inventory.id, existing[0].id)).returning();
    return row;
  }
  async getLowStockAlerts() {
    return db.select({
      inventoryId: inventory.id,
      productId: inventory.productId,
      productName: products.name,
      warehouseId: inventory.warehouseId,
      warehouseName: warehouses.name,
      quantity: inventory.quantity,
      minQuantity: inventory.minQuantity,
    })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .innerJoin(warehouses, eq(inventory.warehouseId, warehouses.id))
    .where(sql`${inventory.quantity} <= ${inventory.minQuantity}`);
  }

  async createTransfer(data: InsertInventoryTransfer) {
    const [row] = await db.insert(inventoryTransfers).values(data).returning();
    await this.adjustInventory(data.productId, data.fromWarehouseId, -data.quantity);
    await this.adjustInventory(data.productId, data.toWarehouseId, data.quantity);
    return row;
  }

  async getCustomers() { return db.select().from(customers); }
  async getCustomer(id: number) {
    const [row] = await db.select().from(customers).where(eq(customers.id, id));
    return row;
  }
  async createCustomer(data: InsertCustomer) {
    const [row] = await db.insert(customers).values(data).returning();
    return row;
  }

  async getSuppliers(activeOnly?: boolean) {
    if (activeOnly) {
      return db.select().from(suppliers).where(eq(suppliers.active, true)).orderBy(desc(suppliers.createdAt));
    }
    return db.select().from(suppliers).orderBy(desc(suppliers.createdAt));
  }
  async getSupplier(id: number) {
    const [row] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return row;
  }
  async getSupplierByName(name: string) {
    const [row] = await db.select().from(suppliers).where(eq(suppliers.name, name));
    return row;
  }
  async createSupplier(data: InsertSupplier) {
    const [row] = await db.insert(suppliers).values(data).returning();
    return row;
  }

  async getSales() { return db.select().from(sales).orderBy(desc(sales.createdAt)); }

  async getSalesFiltered(filters: { from?: string; to?: string; paymentMethod?: string; employeeId?: number; branchId?: number }) {
    const conditions: any[] = [];
    if (filters.from) conditions.push(gte(sales.createdAt, new Date(filters.from + "T00:00:00")));
    if (filters.to) conditions.push(lte(sales.createdAt, new Date(filters.to + "T23:59:59.999")));
    if (filters.paymentMethod) conditions.push(eq(sales.paymentMethod, filters.paymentMethod));
    if (filters.employeeId) conditions.push(eq(sales.cashierId, filters.employeeId));
    if (filters.branchId) conditions.push(eq(sales.branchId, filters.branchId));

    const rows = await db
      .select({
        id: sales.id,
        invoiceNumber: sales.invoiceNumber,
        branchId: sales.branchId,
        branchName: branches.name,
        shiftId: sales.shiftId,
        cashierId: sales.cashierId,
        cashierName: users.name,
        customerId: sales.customerId,
        subtotal: sales.subtotal,
        discount: sales.discount,
        discountType: sales.discountType,
        vat: sales.vat,
        total: sales.total,
        paymentMethod: sales.paymentMethod,
        cogsTotal: sales.cogsTotal,
        grossProfit: sales.grossProfit,
        createdAt: sales.createdAt,
      })
      .from(sales)
      .leftJoin(branches, eq(sales.branchId, branches.id))
      .leftJoin(users, eq(sales.cashierId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(sales.createdAt));

    return rows;
  }

  async getSale(id: number) {
    const [row] = await db.select().from(sales).where(eq(sales.id, id));
    return row;
  }

  async getSaleWithDetails(id: number) {
    const [row] = await db
      .select({
        id: sales.id,
        invoiceNumber: sales.invoiceNumber,
        branchId: sales.branchId,
        branchName: branches.name,
        shiftId: sales.shiftId,
        cashierId: sales.cashierId,
        cashierName: users.name,
        customerId: sales.customerId,
        subtotal: sales.subtotal,
        discount: sales.discount,
        discountType: sales.discountType,
        vat: sales.vat,
        total: sales.total,
        paymentMethod: sales.paymentMethod,
        cogsTotal: sales.cogsTotal,
        grossProfit: sales.grossProfit,
        createdAt: sales.createdAt,
      })
      .from(sales)
      .leftJoin(branches, eq(sales.branchId, branches.id))
      .leftJoin(users, eq(sales.cashierId, users.id))
      .where(eq(sales.id, id));

    if (!row) return null;

    const items = await db
      .select({
        id: saleItems.id,
        saleId: saleItems.saleId,
        productId: saleItems.productId,
        productName: products.name,
        quantity: saleItems.quantity,
        unitPrice: saleItems.unitPrice,
        total: saleItems.total,
        unitCostAtSale: saleItems.unitCostAtSale,
        lineCogs: saleItems.lineCogs,
      })
      .from(saleItems)
      .leftJoin(products, eq(saleItems.productId, products.id))
      .where(eq(saleItems.saleId, id));

    return { ...row, items };
  }
  async createSale(data: InsertSale, items: InsertSaleItem[]) {
    const [sale] = await db.insert(sales).values(data).returning();
    let cogsTotal = 0;
    for (const item of items) {
      const [product] = await db.select().from(products).where(eq(products.id, item.productId));
      const unitCost = product ? parseFloat(product.avgCost || "0") : 0;
      const lineCogs = item.quantity * unitCost;
      cogsTotal += lineCogs;

      await db.insert(saleItems).values({
        ...item,
        saleId: sale.id,
        unitCostAtSale: unitCost.toFixed(3),
        lineCogs: lineCogs.toFixed(3),
      });
      const whList = await db.select().from(warehouses).where(eq(warehouses.branchId, data.branchId));
      if (whList.length > 0) {
        await this.adjustInventory(item.productId, whList[0].id, -item.quantity);
      }
      await this.removeStock(data.branchId, item.productId, item.quantity, "sale", "sales", sale.id, `بيع فاتورة ${sale.invoiceNumber}`, data.cashierId ?? undefined);
    }

    const saleTotal = parseFloat(sale.total || "0");
    const grossProfit = saleTotal - cogsTotal;
    const [updatedSale] = await db.update(sales).set({
      cogsTotal: cogsTotal.toFixed(3),
      grossProfit: grossProfit.toFixed(3),
    }).where(eq(sales.id, sale.id)).returning();

    const todayStr = new Date().toISOString().slice(0, 10);
    const amount = sale.total || "0";
    const pm = data.paymentMethod || "cash";

    if (pm === "cash") {
      await this.addCashLedgerEntry({
        date: todayStr,
        branchId: data.branchId,
        shiftId: data.shiftId ?? null,
        type: "sale",
        amountIn: amount,
        amountOut: "0",
        category: "sale",
        note: `بيع فاتورة ${sale.invoiceNumber}`,
        createdBy: data.cashierId ?? null,
      });
    } else {
      await this.addBankLedgerEntry({
        date: todayStr,
        branchId: data.branchId,
        shiftId: data.shiftId ?? null,
        method: pm,
        amountIn: amount,
        amountOut: "0",
        refId: data.bankTxnId || null,
        category: "sale",
        note: `بيع فاتورة ${sale.invoiceNumber}`,
        createdBy: data.cashierId ?? null,
      });
    }

    return updatedSale;
  }
  async getSaleItems(saleId: number) {
    return db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
  }
  async getDailySalesTotal(branchId?: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [row] = await db.select({
      total: sql<string>`coalesce(sum(${sales.total}::numeric), 0)::text`,
      vatTotal: sql<string>`coalesce(sum(${sales.vat}::numeric), 0)::text`,
      count: sql<number>`count(*)::int`,
    }).from(sales).where(sql`${sales.createdAt} >= ${today}`);
    return row;
  }
  async getWeeklySales() {
    return db.select({
      date: sql<string>`to_char(${sales.createdAt}, 'YYYY-MM-DD')`,
      total: sql<string>`coalesce(sum(${sales.total}::numeric), 0)::text`,
    }).from(sales)
      .where(sql`${sales.createdAt} >= now() - interval '7 days'`)
      .groupBy(sql`to_char(${sales.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${sales.createdAt}, 'YYYY-MM-DD')`);
  }

  async getOrders() { return db.select().from(orders).orderBy(desc(orders.createdAt)); }
  async getOrder(id: number) {
    const [row] = await db.select().from(orders).where(eq(orders.id, id));
    return row;
  }
  async createOrder(data: InsertOrder, items: InsertOrderItem[]) {
    const [order] = await db.insert(orders).values(data).returning();
    for (const item of items) {
      await db.insert(orderItems).values({ ...item, orderId: order.id });
    }
    return order;
  }
  async updateOrderStatus(id: number, status: string) {
    const [row] = await db.update(orders).set({ status }).where(eq(orders.id, id)).returning();
    return row;
  }
  async getOrderItems(orderId: number) {
    return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }
  async getPendingOrdersByShift(shiftId: number) {
    return db.select().from(orders).where(
      and(
        eq(orders.shiftId, shiftId),
        sql`${orders.status} IN ('new', 'processing', 'pending')`
      )
    );
  }

  async payOrder(id: number, paymentMethod: PaymentMethod, bankTxnId?: string) {
    const order = await this.getOrder(id);
    if (!order) return undefined;
    if (order.status === "paid") return order;

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const items = await this.getOrderItems(id);
    let cogsTotal = 0;
    for (const item of items) {
      const [product] = await db.select().from(products).where(eq(products.id, item.productId));
      const unitCost = product ? parseFloat(product.avgCost || "0") : 0;
      const lineCogs = item.quantity * unitCost;
      cogsTotal += lineCogs;

      await db.update(orderItems).set({
        unitCostAtSale: unitCost.toFixed(3),
        lineCogs: lineCogs.toFixed(3),
      }).where(eq(orderItems.id, item.id));
    }
    const orderTotal = parseFloat(order.total || "0");
    const grossProfit = orderTotal - cogsTotal;

    const [updated] = await db.update(orders).set({
      status: "paid",
      paymentMethod,
      bankTxnId: bankTxnId || null,
      paidAt: now,
      cogsTotal: cogsTotal.toFixed(3),
      grossProfit: grossProfit.toFixed(3),
    }).where(eq(orders.id, id)).returning();

    const amount = updated.total || "0";

    if (paymentMethod === "cash") {
      await this.addCashLedgerEntry({
        date: todayStr,
        branchId: updated.branchId!,
        shiftId: updated.shiftId,
        type: "order_payment",
        amountIn: amount,
        amountOut: "0",
        note: `دفع طلب ${updated.orderNumber}`,
      });
    } else {
      await this.addBankLedgerEntry({
        date: todayStr,
        branchId: updated.branchId!,
        shiftId: updated.shiftId,
        method: paymentMethod,
        amountIn: amount,
        amountOut: "0",
        refId: bankTxnId || null,
        note: `دفع طلب ${updated.orderNumber}`,
      });
    }

    return updated;
  }

  async getExpenses() { return db.select().from(expenses).orderBy(desc(expenses.createdAt)); }
  async createExpense(data: InsertExpense) {
    const [row] = await db.insert(expenses).values(data).returning();
    return row;
  }

  async getEmployees() { return db.select().from(employees); }
  async createEmployee(data: InsertEmployee) {
    const [row] = await db.insert(employees).values(data).returning();
    return row;
  }

  async getShifts() { return db.select().from(shifts).orderBy(desc(shifts.startedAt)); }
  async createShift(data: InsertShift) {
    const [row] = await db.insert(shifts).values(data).returning();
    return row;
  }

  async getCurrentShift(branchId: number, terminalName: string) {
    const [row] = await db.select().from(shifts).where(
      and(eq(shifts.status, "open"), eq(shifts.branchId, branchId), eq(shifts.terminalName, terminalName))
    ).orderBy(desc(shifts.id)).limit(1);
    return row || null;
  }

  async closeShift(id: number, actualCash: string) {
    const [cashOrdersRow] = await db.select({
      total: sql<string>`coalesce(sum(${orders.total}::numeric), 0)::text`,
    }).from(orders).where(
      and(eq(orders.shiftId, id), eq(orders.status, "paid"), eq(orders.paymentMethod, "cash"))
    );
    const [cardOrdersRow] = await db.select({
      total: sql<string>`coalesce(sum(${orders.total}::numeric), 0)::text`,
    }).from(orders).where(
      and(eq(orders.shiftId, id), eq(orders.status, "paid"), eq(orders.paymentMethod, "card"))
    );
    const [bankOrdersRow] = await db.select({
      total: sql<string>`coalesce(sum(${orders.total}::numeric), 0)::text`,
    }).from(orders).where(
      and(eq(orders.shiftId, id), eq(orders.status, "paid"), eq(orders.paymentMethod, "bank_transfer"))
    );

    const [cashSalesRow] = await db.select({
      total: sql<string>`coalesce(sum(${sales.total}::numeric), 0)::text`,
    }).from(sales).where(
      and(eq(sales.shiftId, id), eq(sales.paymentMethod, "cash"))
    );
    const [cardSalesRow] = await db.select({
      total: sql<string>`coalesce(sum(${sales.total}::numeric), 0)::text`,
    }).from(sales).where(
      and(eq(sales.shiftId, id), eq(sales.paymentMethod, "card"))
    );
    const [bankSalesRow] = await db.select({
      total: sql<string>`coalesce(sum(${sales.total}::numeric), 0)::text`,
    }).from(sales).where(
      and(eq(sales.shiftId, id), eq(sales.paymentMethod, "bank_transfer"))
    );

    const [cashExpenseRow] = await db.select({
      total: sql<string>`coalesce(sum(${expenses.amount}::numeric), 0)::text`,
    }).from(expenses).where(
      and(eq(expenses.shiftId, id), eq(expenses.source, "cash"))
    );

    const totalCashIn = parseFloat(cashOrdersRow.total) + parseFloat(cashSalesRow.total);
    const totalCardIn = parseFloat(cardOrdersRow.total) + parseFloat(cardSalesRow.total);
    const totalBankIn = parseFloat(bankOrdersRow.total) + parseFloat(bankSalesRow.total);

    const expectedCash = totalCashIn - parseFloat(cashExpenseRow.total);
    const actual = parseFloat(actualCash);
    const diff = actual - expectedCash;

    const totalSales = (totalCashIn + totalCardIn + totalBankIn).toFixed(3);
    const totalBank = (totalCardIn + totalBankIn).toFixed(3);

    const todayStr = new Date().toISOString().slice(0, 10);

    if (Math.abs(diff) > 0.001) {
      await this.addCashLedgerEntry({
        date: todayStr,
        branchId: (await db.select({ branchId: shifts.branchId }).from(shifts).where(eq(shifts.id, id)))[0].branchId,
        shiftId: id,
        type: "shift_difference",
        amountIn: diff > 0 ? diff.toFixed(3) : "0",
        amountOut: diff < 0 ? Math.abs(diff).toFixed(3) : "0",
        note: `فرق إغلاق شفت #${id}`,
      });
    }

    const [row] = await db.update(shifts).set({
      endedAt: new Date(),
      totalSales,
      totalCash: totalCashIn.toFixed(3),
      totalBank,
      expectedCash: expectedCash.toFixed(3),
      actualCash,
      difference: diff.toFixed(3),
      status: "closed",
    }).where(eq(shifts.id, id)).returning();
    return row;
  }

  async addCashLedgerEntry(data: InsertCashLedger) {
    const [row] = await db.insert(cashLedger).values(data).returning();
    return row;
  }
  async addBankLedgerEntry(data: InsertBankLedger) {
    const [row] = await db.insert(bankLedger).values(data).returning();
    return row;
  }
  async getCashLedgerEntries(branchId?: number) {
    if (branchId) {
      return db.select().from(cashLedger).where(eq(cashLedger.branchId, branchId)).orderBy(desc(cashLedger.createdAt));
    }
    return db.select().from(cashLedger).orderBy(desc(cashLedger.createdAt));
  }
  async getBankLedgerEntries(branchId?: number) {
    if (branchId) {
      return db.select().from(bankLedger).where(eq(bankLedger.branchId, branchId)).orderBy(desc(bankLedger.createdAt));
    }
    return db.select().from(bankLedger).orderBy(desc(bankLedger.createdAt));
  }

  async getShiftReport(shiftId: number) {
    const [shiftRow] = await db.select().from(shifts).where(eq(shifts.id, shiftId));
    if (!shiftRow) return null;

    const cashierRow = shiftRow.cashierId
      ? await db.select({ name: users.name }).from(users).where(eq(users.id, shiftRow.cashierId))
      : [];

    const [cashOrders] = await db.select({
      total: sql<string>`coalesce(sum(${orders.total}::numeric), 0)::text`,
      count: sql<number>`count(*)::int`,
    }).from(orders).where(
      and(eq(orders.shiftId, shiftId), eq(orders.status, "paid"), eq(orders.paymentMethod, "cash"))
    );
    const [cardOrders] = await db.select({
      total: sql<string>`coalesce(sum(${orders.total}::numeric), 0)::text`,
      count: sql<number>`count(*)::int`,
    }).from(orders).where(
      and(eq(orders.shiftId, shiftId), eq(orders.status, "paid"), eq(orders.paymentMethod, "card"))
    );
    const [bankOrders] = await db.select({
      total: sql<string>`coalesce(sum(${orders.total}::numeric), 0)::text`,
      count: sql<number>`count(*)::int`,
    }).from(orders).where(
      and(eq(orders.shiftId, shiftId), eq(orders.status, "paid"), eq(orders.paymentMethod, "bank_transfer"))
    );

    const [cashPosSales] = await db.select({
      total: sql<string>`coalesce(sum(${sales.total}::numeric), 0)::text`,
      count: sql<number>`count(*)::int`,
    }).from(sales).where(
      and(eq(sales.shiftId, shiftId), eq(sales.paymentMethod, "cash"))
    );
    const [cardPosSales] = await db.select({
      total: sql<string>`coalesce(sum(${sales.total}::numeric), 0)::text`,
      count: sql<number>`count(*)::int`,
    }).from(sales).where(
      and(eq(sales.shiftId, shiftId), eq(sales.paymentMethod, "card"))
    );
    const [bankPosSales] = await db.select({
      total: sql<string>`coalesce(sum(${sales.total}::numeric), 0)::text`,
      count: sql<number>`count(*)::int`,
    }).from(sales).where(
      and(eq(sales.shiftId, shiftId), eq(sales.paymentMethod, "bank_transfer"))
    );

    const [cashExpenses] = await db.select({
      total: sql<string>`coalesce(sum(${expenses.amount}::numeric), 0)::text`,
      count: sql<number>`count(*)::int`,
    }).from(expenses).where(and(eq(expenses.shiftId, shiftId), eq(expenses.source, "cash")));

    const [bankExpenses] = await db.select({
      total: sql<string>`coalesce(sum(${expenses.amount}::numeric), 0)::text`,
      count: sql<number>`count(*)::int`,
    }).from(expenses).where(and(eq(expenses.shiftId, shiftId), sql`${expenses.source} != 'cash'`));

    const salesCash = parseFloat(cashOrders.total) + parseFloat(cashPosSales.total);
    const salesCard = parseFloat(cardOrders.total) + parseFloat(cardPosSales.total);
    const salesBankTransfer = parseFloat(bankOrders.total) + parseFloat(bankPosSales.total);
    const expCash = parseFloat(cashExpenses.total);
    const expBank = parseFloat(bankExpenses.total);
    const totalSalesAll = salesCash + salesCard + salesBankTransfer;
    const totalExpenses = expCash + expBank;
    const netTotal = totalSalesAll - totalExpenses;
    const openingCash = parseFloat(shiftRow.openingCash || "0");
    const expectedCash = openingCash + salesCash - expCash;

    return {
      shift: shiftRow,
      cashierName: cashierRow.length > 0 ? cashierRow[0].name : null,
      salesCash: { total: salesCash.toFixed(3), count: cashOrders.count + cashPosSales.count },
      salesCard: { total: salesCard.toFixed(3), count: cardOrders.count + cardPosSales.count },
      salesBankTransfer: { total: salesBankTransfer.toFixed(3), count: bankOrders.count + bankPosSales.count },
      expensesCash: { total: cashExpenses.total, count: cashExpenses.count },
      expensesBank: { total: bankExpenses.total, count: bankExpenses.count },
      totalSales: totalSalesAll.toFixed(3),
      totalExpenses: totalExpenses.toFixed(3),
      netTotal: netTotal.toFixed(3),
      openingCash: openingCash.toFixed(3),
      expectedCash: expectedCash.toFixed(3),
      actualCash: shiftRow.actualCash || null,
      difference: shiftRow.difference || null,
    };
  }

  async getDailyReport(dateStr: string, branchId?: number) {
    const dayStart = new Date(dateStr + "T00:00:00");
    const dayEnd = new Date(dateStr + "T23:59:59.999");

    const branchFilter = branchId ? eq(shifts.branchId, branchId) : undefined;
    const orderBranchFilter = branchId ? eq(orders.branchId, branchId) : undefined;
    const saleBranchFilter = branchId ? eq(sales.branchId, branchId) : undefined;
    const expBranchFilter = branchId ? eq(expenses.branchId, branchId) : undefined;

    const dayShifts = await db.select().from(shifts).where(
      and(
        sql`${shifts.startedAt} >= ${dayStart}`,
        sql`${shifts.startedAt} <= ${dayEnd}`,
        branchFilter
      )
    ).orderBy(shifts.startedAt);

    const sumOpeningCash = dayShifts.reduce((s, sh) => s + parseFloat(sh.openingCash || "0"), 0);

    const queryOrderSum = async (pm: string) => {
      const [row] = await db.select({
        total: sql<string>`coalesce(sum(${orders.total}::numeric), 0)::text`,
        count: sql<number>`count(*)::int`,
      }).from(orders).where(
        and(
          eq(orders.status, "paid"),
          eq(orders.paymentMethod, pm),
          sql`${orders.createdAt} >= ${dayStart}`,
          sql`${orders.createdAt} <= ${dayEnd}`,
          orderBranchFilter
        )
      );
      return row;
    };

    const querySaleSum = async (pm: string) => {
      const [row] = await db.select({
        total: sql<string>`coalesce(sum(${sales.total}::numeric), 0)::text`,
        count: sql<number>`count(*)::int`,
      }).from(sales).where(
        and(
          eq(sales.paymentMethod, pm),
          sql`${sales.createdAt} >= ${dayStart}`,
          sql`${sales.createdAt} <= ${dayEnd}`,
          saleBranchFilter
        )
      );
      return row;
    };

    const cashOrd = await queryOrderSum("cash");
    const cardOrd = await queryOrderSum("card");
    const bankOrd = await queryOrderSum("bank_transfer");
    const cashSale = await querySaleSum("cash");
    const cardSale = await querySaleSum("card");
    const bankSale = await querySaleSum("bank_transfer");

    const salesCash = parseFloat(cashOrd.total) + parseFloat(cashSale.total);
    const salesCard = parseFloat(cardOrd.total) + parseFloat(cardSale.total);
    const salesBank = parseFloat(bankOrd.total) + parseFloat(bankSale.total);

    const [cashExp] = await db.select({
      total: sql<string>`coalesce(sum(${expenses.amount}::numeric), 0)::text`,
      count: sql<number>`count(*)::int`,
    }).from(expenses).where(
      and(eq(expenses.source, "cash"), sql`${expenses.date} = ${dateStr}`, expBranchFilter)
    );
    const [bankExp] = await db.select({
      total: sql<string>`coalesce(sum(${expenses.amount}::numeric), 0)::text`,
      count: sql<number>`count(*)::int`,
    }).from(expenses).where(
      and(sql`${expenses.source} != 'cash'`, sql`${expenses.date} = ${dateStr}`, expBranchFilter)
    );

    const expCash = parseFloat(cashExp.total);
    const expBank = parseFloat(bankExp.total);
    const totalSales = salesCash + salesCard + salesBank;
    const totalExpenses = expCash + expBank;

    const [orderCogs] = await db.select({
      total: sql<string>`coalesce(sum(${orders.cogsTotal}::numeric), 0)::text`,
    }).from(orders).where(
      and(eq(orders.status, "paid"), sql`${orders.createdAt} >= ${dayStart}`, sql`${orders.createdAt} <= ${dayEnd}`, orderBranchFilter)
    );
    const [saleCogs] = await db.select({
      total: sql<string>`coalesce(sum(${sales.cogsTotal}::numeric), 0)::text`,
    }).from(sales).where(
      and(sql`${sales.createdAt} >= ${dayStart}`, sql`${sales.createdAt} <= ${dayEnd}`, saleBranchFilter)
    );
    const cogsTotal = parseFloat(orderCogs.total) + parseFloat(saleCogs.total);
    const grossProfit = totalSales - cogsTotal;
    const netProfit = grossProfit - totalExpenses;
    const net = totalSales - totalExpenses;

    const cashClosingBalance = sumOpeningCash + salesCash - expCash;

    const sumDifferences = dayShifts
      .filter(s => s.status === "closed" && s.difference)
      .reduce((s, sh) => s + parseFloat(sh.difference || "0"), 0);

    return {
      date: dateStr,
      branchId: branchId || null,
      shifts: dayShifts,
      salesCash: { total: salesCash.toFixed(3), count: cashOrd.count + cashSale.count },
      salesCard: { total: salesCard.toFixed(3), count: cardOrd.count + cardSale.count },
      salesBankTransfer: { total: salesBank.toFixed(3), count: bankOrd.count + bankSale.count },
      expensesCash: { total: cashExp.total, count: cashExp.count },
      expensesBank: { total: bankExp.total, count: bankExp.count },
      totalSales: totalSales.toFixed(3),
      totalExpenses: totalExpenses.toFixed(3),
      cogsTotal: cogsTotal.toFixed(3),
      grossProfit: grossProfit.toFixed(3),
      netProfit: netProfit.toFixed(3),
      net: net.toFixed(3),
      openingCash: sumOpeningCash.toFixed(3),
      cashClosingBalance: cashClosingBalance.toFixed(3),
      differencesSum: sumDifferences.toFixed(3),
    };
  }

  async getShiftsByDate(dateStr: string, branchId?: number) {
    const dayStart = new Date(dateStr + "T00:00:00");
    const dayEnd = new Date(dateStr + "T23:59:59.999");
    const branchFilter = branchId ? eq(shifts.branchId, branchId) : undefined;

    const rows = await db.select({
      id: shifts.id,
      branchId: shifts.branchId,
      cashierId: shifts.cashierId,
      cashierName: users.name,
      terminalName: shifts.terminalName,
      startedAt: shifts.startedAt,
      endedAt: shifts.endedAt,
      status: shifts.status,
      totalSales: shifts.totalSales,
      openingCash: shifts.openingCash,
    }).from(shifts)
      .leftJoin(users, eq(shifts.cashierId, users.id))
      .where(
        and(
          sql`${shifts.startedAt} >= ${dayStart}`,
          sql`${shifts.startedAt} <= ${dayEnd}`,
          branchFilter
        )
      )
      .orderBy(desc(shifts.startedAt));

    return rows;
  }

  async getDashboardStats(branchId?: number) {
    const dailyStats = await this.getDailySalesTotal(branchId);
    const lowStock = await this.getLowStockAlerts();
    const weeklySales = await this.getWeeklySales();
    const recentOrders = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(5);
    return {
      todaySales: dailyStats.total,
      todayVat: dailyStats.vatTotal,
      todayOrderCount: dailyStats.count,
      lowStockCount: lowStock.length,
      lowStockItems: lowStock,
      weeklySales,
      recentOrders,
    };
  }

  async getPurchaseInvoices() {
    return db.select().from(purchaseInvoices).orderBy(desc(purchaseInvoices.createdAt));
  }

  async getPurchaseInvoice(id: number) {
    const [row] = await db.select().from(purchaseInvoices).where(eq(purchaseInvoices.id, id));
    return row;
  }

  async createPurchaseInvoice(data: InsertPurchaseInvoice) {
    const [row] = await db.insert(purchaseInvoices).values(data).returning();
    return row;
  }

  async updatePurchaseInvoice(id: number, data: Partial<InsertPurchaseInvoice>) {
    const [row] = await db.update(purchaseInvoices).set(data).where(eq(purchaseInvoices.id, id)).returning();
    return row;
  }

  async getPurchaseItems(purchaseId: number) {
    return db.select({
      id: purchaseItems.id,
      purchaseId: purchaseItems.purchaseId,
      productId: purchaseItems.productId,
      productName: products.name,
      qty: purchaseItems.qty,
      unitCostBase: purchaseItems.unitCostBase,
      lineSubtotal: purchaseItems.lineSubtotal,
      allocatedExtraCost: purchaseItems.allocatedExtraCost,
      unitCostFinal: purchaseItems.unitCostFinal,
    }).from(purchaseItems)
      .leftJoin(products, eq(purchaseItems.productId, products.id))
      .where(eq(purchaseItems.purchaseId, purchaseId));
  }

  async addPurchaseItem(data: InsertPurchaseItem) {
    const [row] = await db.insert(purchaseItems).values(data).returning();
    return row;
  }

  async deletePurchaseItem(id: number) {
    await db.delete(purchaseItems).where(eq(purchaseItems.id, id));
  }

  async updateSupplier(id: number, data: Partial<InsertSupplier>) {
    const [row] = await db.update(suppliers).set(data).where(eq(suppliers.id, id)).returning();
    return row;
  }

  async approvePurchaseInvoice(id: number): Promise<PurchaseInvoice> {
    const invoice = await this.getPurchaseInvoice(id);
    if (!invoice) throw new Error("الفاتورة غير موجودة");
    if (invoice.status === "approved") throw new Error("الفاتورة معتمدة مسبقاً — لا يمكن اعتمادها مرة أخرى");
    if (invoice.status !== "pending") throw new Error("لا يمكن اعتماد فاتورة بحالة: " + invoice.status);

    const items = await db.select().from(purchaseItems).where(eq(purchaseItems.purchaseId, id));
    if (items.length === 0) throw new Error("لا يمكن اعتماد فاتورة بدون أصناف");

    const subtotalItems = items.reduce((s, it) => s + parseFloat(it.lineSubtotal), 0);
    const totalExtraCost =
      parseFloat(invoice.shippingCost || "0") +
      parseFloat(invoice.customsCost || "0") +
      parseFloat(invoice.clearanceCost || "0") +
      parseFloat(invoice.otherCost || "0");
    const grandTotal = subtotalItems + totalExtraCost;

    const [centralLoc] = await db.select({ id: locations.id })
      .from(locations)
      .where(eq(locations.isCentral, true))
      .orderBy(locations.id)
      .limit(1);
    if (!centralLoc) throw new Error("لا يوجد مخزن مركزي — يرجى إنشاؤه أولاً");
    const centralLocationId = centralLoc.id;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const item of items) {
        const lineSubVal = parseFloat(item.lineSubtotal);
        let allocatedExtra: number;
        let unitCostFinal: number;

        if (subtotalItems > 0) {
          allocatedExtra = (lineSubVal / subtotalItems) * totalExtraCost;
          unitCostFinal = item.qty > 0 ? (lineSubVal + allocatedExtra) / item.qty : 0;
        } else {
          allocatedExtra = 0;
          unitCostFinal = parseFloat(item.unitCostBase);
        }

        await client.query(
          `UPDATE purchase_items
           SET allocated_extra_cost = $1, unit_cost_final = $2
           WHERE id = $3`,
          [allocatedExtra.toFixed(3), unitCostFinal.toFixed(3), item.id]
        );

        const prodRes = await client.query(
          `SELECT stock_qty, avg_cost FROM products WHERE id = $1`,
          [item.productId]
        );
        if (prodRes.rows.length > 0) {
          const oldQty = prodRes.rows[0].stock_qty || 0;
          const oldAvgCost = parseFloat(prodRes.rows[0].avg_cost || "0");
          const newQty = oldQty + item.qty;
          const newAvgCost = newQty > 0
            ? ((oldAvgCost * oldQty) + (unitCostFinal * item.qty)) / newQty
            : unitCostFinal;

          await client.query(
            `UPDATE products SET stock_qty = $1, avg_cost = $2 WHERE id = $3`,
            [newQty, newAvgCost.toFixed(3), item.productId]
          );
        }

        await client.query(
          `INSERT INTO location_inventory (location_id, product_id, qty_on_hand, updated_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (location_id, product_id)
           DO UPDATE SET qty_on_hand = location_inventory.qty_on_hand + EXCLUDED.qty_on_hand,
                         updated_at = now()`,
          [centralLocationId, item.productId, item.qty]
        );

        await client.query(
          `INSERT INTO inventory_transactions
           (date, branch_id, from_location_id, to_location_id,
            product_id, type, qty,
            ref_table, ref_id,
            note, created_by, created_at)
           VALUES
           (now(), $1, NULL, $2,
            $3, 'PURCHASE', $4,
            'purchase_invoices', $5,
            'Purchase Invoice Approved', $6, now())`,
          [invoice.branchId, centralLocationId, item.productId, item.qty, id, invoice.createdBy]
        );
      }

      const result = await client.query(
        `UPDATE purchase_invoices
         SET subtotal = $1, total_extra_cost = $2, grand_total = $3, status = 'approved'
         WHERE id = $4 AND status = 'pending'
         RETURNING *`,
        [subtotalItems.toFixed(3), totalExtraCost.toFixed(3), grandTotal.toFixed(3), id]
      );

      if (result.rows.length === 0) {
        throw new Error("فشل تحديث حالة الفاتورة — ربما تم اعتمادها من مستخدم آخر");
      }

      await client.query("COMMIT");

      const [updated] = await db.select().from(purchaseInvoices).where(eq(purchaseInvoices.id, id));
      return updated;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async getLocations(branchId?: number) {
    if (branchId) {
      return db.select().from(locations).where(eq(locations.branchId, branchId));
    }
    return db.select().from(locations);
  }

  async getLocationByCode(branchId: number, code: string) {
    const [row] = await db.select().from(locations)
      .where(and(eq(locations.branchId, branchId), eq(locations.code, code)));
    return row;
  }

  async addStock(
    branchId: number, productId: number, qty: number,
    type: string, refTable?: string, refId?: number, note?: string, createdBy?: number
  ) {
    const backstore = await this.getLocationByCode(branchId, "backstore");
    if (!backstore) throw new Error(`لم يتم العثور على موقع المخزن للفرع #${branchId}`);

    const existing = await db.select().from(locationInventory)
      .where(and(eq(locationInventory.locationId, backstore.id), eq(locationInventory.productId, productId)));

    if (existing.length > 0) {
      await db.update(locationInventory).set({
        qtyOnHand: existing[0].qtyOnHand + qty,
        updatedAt: new Date(),
      }).where(eq(locationInventory.id, existing[0].id));
    } else {
      await db.insert(locationInventory).values({
        locationId: backstore.id, productId, qtyOnHand: qty, reorderLevel: 5,
      });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    await db.insert(inventoryTransactions).values({
      date: todayStr, branchId, productId, type, qty,
      toLocationId: backstore.id,
      refTable: refTable || null, refId: refId || null,
      note: note || null, createdBy: createdBy || null,
    });
  }

  async removeStock(
    branchId: number, productId: number, qty: number,
    type: string, refTable?: string, refId?: number, note?: string, createdBy?: number
  ) {
    const showroom = await this.getLocationByCode(branchId, "showroom");
    if (!showroom) throw new Error(`لم يتم العثور على صالة العرض للفرع #${branchId}`);

    const existing = await db.select().from(locationInventory)
      .where(and(eq(locationInventory.locationId, showroom.id), eq(locationInventory.productId, productId)));

    const available = existing.length > 0 ? existing[0].qtyOnHand : 0;
    if (available < qty) {
      const [prod] = await db.select({ name: products.name }).from(products).where(eq(products.id, productId));
      const pName = prod?.name || `#${productId}`;
      throw new Error(`الكمية غير كافية في صالة العرض: "${pName}" — المتوفر ${available}، المطلوب ${qty}`);
    }

    await db.update(locationInventory).set({
      qtyOnHand: available - qty,
      updatedAt: new Date(),
    }).where(eq(locationInventory.id, existing[0].id));

    const todayStr = new Date().toISOString().slice(0, 10);
    await db.insert(inventoryTransactions).values({
      date: todayStr, branchId, productId, type, qty,
      fromLocationId: showroom.id,
      refTable: refTable || null, refId: refId || null,
      note: note || null, createdBy: createdBy || null,
    });
  }

  async transferStock(
    fromLocationId: number, toLocationId: number, productId: number, qty: number,
    note?: string, createdBy?: number
  ) {
    const [fromLoc] = await db.select().from(locations).where(eq(locations.id, fromLocationId));
    const [toLoc] = await db.select().from(locations).where(eq(locations.id, toLocationId));
    if (!fromLoc || !toLoc) throw new Error("الموقع غير موجود");
    if (fromLoc.branchId !== toLoc.branchId) throw new Error("لا يمكن النقل بين فروع مختلفة من هنا");

    const existing = await db.select().from(locationInventory)
      .where(and(eq(locationInventory.locationId, fromLocationId), eq(locationInventory.productId, productId)));
    const available = existing.length > 0 ? existing[0].qtyOnHand : 0;
    if (available < qty) {
      throw new Error(`الكمية غير كافية: المتوفر ${available}، المطلوب ${qty}`);
    }

    await db.update(locationInventory).set({
      qtyOnHand: available - qty, updatedAt: new Date(),
    }).where(eq(locationInventory.id, existing[0].id));

    const toExisting = await db.select().from(locationInventory)
      .where(and(eq(locationInventory.locationId, toLocationId), eq(locationInventory.productId, productId)));
    if (toExisting.length > 0) {
      await db.update(locationInventory).set({
        qtyOnHand: toExisting[0].qtyOnHand + qty, updatedAt: new Date(),
      }).where(eq(locationInventory.id, toExisting[0].id));
    } else {
      await db.insert(locationInventory).values({
        locationId: toLocationId, productId, qtyOnHand: qty, reorderLevel: 5,
      });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    await db.insert(inventoryTransactions).values({
      date: todayStr, branchId: fromLoc.branchId, productId, type: "internal_transfer", qty,
      fromLocationId, toLocationId,
      note: note || `نقل من ${fromLoc.name} إلى ${toLoc.name}`,
      createdBy: createdBy || null,
    });
  }

  async getLocationInventoryList(branchId?: number, locationCode?: string) {
    const conditions: any[] = [];
    if (branchId) conditions.push(eq(locations.branchId, branchId));
    if (locationCode) conditions.push(eq(locations.code, locationCode));
    const cond = conditions.length > 0 ? and(...conditions) : undefined;

    return db.select({
      id: locationInventory.id,
      locationId: locationInventory.locationId,
      locationName: locations.name,
      locationCode: locations.code,
      branchId: locations.branchId,
      branchName: branches.name,
      productId: locationInventory.productId,
      productName: products.name,
      barcode: products.barcode,
      qtyOnHand: locationInventory.qtyOnHand,
      reorderLevel: locationInventory.reorderLevel,
      avgCost: products.avgCost,
      price: products.price,
      updatedAt: locationInventory.updatedAt,
    }).from(locationInventory)
      .innerJoin(locations, eq(locationInventory.locationId, locations.id))
      .innerJoin(products, eq(locationInventory.productId, products.id))
      .innerJoin(branches, eq(locations.branchId, branches.id))
      .where(cond)
      .orderBy(products.name);
  }

  async getBranchInventory(branchId?: number) {
    const conditions: any[] = [];
    if (branchId) conditions.push(eq(locations.branchId, branchId));
    const cond = conditions.length > 0 ? and(...conditions) : undefined;

    return db.select({
      branchId: locations.branchId,
      branchName: branches.name,
      productId: locationInventory.productId,
      productName: products.name,
      barcode: products.barcode,
      totalQty: sql<number>`SUM(${locationInventory.qtyOnHand})`.as("totalQty"),
      avgCost: products.avgCost,
      price: products.price,
    }).from(locationInventory)
      .innerJoin(locations, eq(locationInventory.locationId, locations.id))
      .innerJoin(products, eq(locationInventory.productId, products.id))
      .innerJoin(branches, eq(locations.branchId, branches.id))
      .where(cond)
      .groupBy(locations.branchId, branches.name, locationInventory.productId, products.name, products.barcode, products.avgCost, products.price)
      .orderBy(products.name);
  }

  async getLocationTransactions(branchId?: number, type?: string) {
    const conditions: any[] = [];
    if (branchId) conditions.push(eq(inventoryTransactions.branchId, branchId));
    if (type) conditions.push(eq(inventoryTransactions.type, type));
    const cond = conditions.length > 0 ? and(...conditions) : undefined;

    const fromLoc = db.$with("from_loc").as(db.select({ id: locations.id, name: locations.name }).from(locations));
    const toLoc = db.$with("to_loc").as(db.select({ id: locations.id, name: locations.name }).from(locations));

    return db.select({
      id: inventoryTransactions.id,
      date: inventoryTransactions.date,
      branchId: inventoryTransactions.branchId,
      branchName: branches.name,
      fromLocationId: inventoryTransactions.fromLocationId,
      toLocationId: inventoryTransactions.toLocationId,
      productId: inventoryTransactions.productId,
      productName: products.name,
      type: inventoryTransactions.type,
      qty: inventoryTransactions.qty,
      refTable: inventoryTransactions.refTable,
      refId: inventoryTransactions.refId,
      note: inventoryTransactions.note,
      createdBy: inventoryTransactions.createdBy,
      createdAt: inventoryTransactions.createdAt,
    }).from(inventoryTransactions)
      .innerJoin(products, eq(inventoryTransactions.productId, products.id))
      .innerJoin(branches, eq(inventoryTransactions.branchId, branches.id))
      .where(cond)
      .orderBy(desc(inventoryTransactions.createdAt))
      .limit(500);
  }

  async getLocationLowStock(branchId?: number, locationCode?: string) {
    const conditions: any[] = [
      sql`${locationInventory.qtyOnHand} <= ${locationInventory.reorderLevel}`,
    ];
    if (branchId) conditions.push(eq(locations.branchId, branchId));
    if (locationCode) conditions.push(eq(locations.code, locationCode));

    return db.select({
      id: locationInventory.id,
      locationId: locationInventory.locationId,
      locationName: locations.name,
      locationCode: locations.code,
      branchId: locations.branchId,
      branchName: branches.name,
      productId: locationInventory.productId,
      productName: products.name,
      qtyOnHand: locationInventory.qtyOnHand,
      reorderLevel: locationInventory.reorderLevel,
    }).from(locationInventory)
      .innerJoin(locations, eq(locationInventory.locationId, locations.id))
      .innerJoin(products, eq(locationInventory.productId, products.id))
      .innerJoin(branches, eq(locations.branchId, branches.id))
      .where(and(...conditions))
      .orderBy(locationInventory.qtyOnHand);
  }

  async getProfitByBranches(from: string, to: string) {
    const fromDate = new Date(from + "T00:00:00");
    const toDate = new Date(to + "T23:59:59.999");
    const allBranches = await db.select().from(branches);

    const results = [];
    for (const branch of allBranches) {
      const [ordSales] = await db.select({
        total: sql<string>`coalesce(sum(${orders.total}::numeric), 0)::text`,
        cogs: sql<string>`coalesce(sum(${orders.cogsTotal}::numeric), 0)::text`,
      }).from(orders).where(
        and(eq(orders.status, "paid"), eq(orders.branchId, branch.id),
          sql`${orders.paidAt} >= ${fromDate}`, sql`${orders.paidAt} <= ${toDate}`)
      );
      const [posSales] = await db.select({
        total: sql<string>`coalesce(sum(${sales.total}::numeric), 0)::text`,
        cogs: sql<string>`coalesce(sum(${sales.cogsTotal}::numeric), 0)::text`,
      }).from(sales).where(
        and(eq(sales.branchId, branch.id),
          sql`${sales.createdAt} >= ${fromDate}`, sql`${sales.createdAt} <= ${toDate}`)
      );
      const [expRow] = await db.select({
        total: sql<string>`coalesce(sum(${expenses.amount}::numeric), 0)::text`,
      }).from(expenses).where(
        and(eq(expenses.branchId, branch.id),
          sql`${expenses.date} >= ${from}`, sql`${expenses.date} <= ${to}`)
      );

      const salesTotal = parseFloat(ordSales.total) + parseFloat(posSales.total);
      const cogsTotal = parseFloat(ordSales.cogs) + parseFloat(posSales.cogs);
      const grossProfit = salesTotal - cogsTotal;
      const expensesTotal = parseFloat(expRow.total);
      const netProfit = grossProfit - expensesTotal;
      const margin = salesTotal > 0 ? ((netProfit / salesTotal) * 100) : 0;

      results.push({
        branchId: branch.id,
        branchName: branch.name,
        salesTotal: salesTotal.toFixed(3),
        cogsTotal: cogsTotal.toFixed(3),
        grossProfit: grossProfit.toFixed(3),
        expensesTotal: expensesTotal.toFixed(3),
        netProfit: netProfit.toFixed(3),
        margin: margin.toFixed(1),
      });
    }
    return results;
  }

  async getProfitByEmployees(from: string, to: string, branchId?: number) {
    const fromDate = new Date(from + "T00:00:00");
    const toDate = new Date(to + "T23:59:59.999");

    const orderConditions: any[] = [
      eq(orders.status, "paid"),
      sql`${orders.paidAt} >= ${fromDate}`,
      sql`${orders.paidAt} <= ${toDate}`,
    ];
    if (branchId) orderConditions.push(eq(orders.branchId, branchId));

    const saleConditions: any[] = [
      sql`${sales.createdAt} >= ${fromDate}`,
      sql`${sales.createdAt} <= ${toDate}`,
    ];
    if (branchId) saleConditions.push(eq(sales.branchId, branchId));

    const orderRows = await db.select({
      employeeId: orders.employeeId,
      employeeName: users.name,
      ordersCount: sql<number>`count(*)::int`,
      salesTotal: sql<string>`coalesce(sum(${orders.total}::numeric), 0)::text`,
      cogsTotal: sql<string>`coalesce(sum(${orders.cogsTotal}::numeric), 0)::text`,
      grossProfit: sql<string>`coalesce(sum(${orders.grossProfit}::numeric), 0)::text`,
    }).from(orders)
      .leftJoin(users, eq(orders.employeeId, users.id))
      .where(and(...orderConditions))
      .groupBy(orders.employeeId, users.name);

    const saleRows = await db.select({
      employeeId: sales.cashierId,
      employeeName: users.name,
      ordersCount: sql<number>`count(*)::int`,
      salesTotal: sql<string>`coalesce(sum(${sales.total}::numeric), 0)::text`,
      cogsTotal: sql<string>`coalesce(sum(${sales.cogsTotal}::numeric), 0)::text`,
      grossProfit: sql<string>`coalesce(sum(${sales.grossProfit}::numeric), 0)::text`,
    }).from(sales)
      .leftJoin(users, eq(sales.cashierId, users.id))
      .where(and(...saleConditions))
      .groupBy(sales.cashierId, users.name);

    const empMap = new Map<number, { name: string; ordersCount: number; salesTotal: number; cogsTotal: number; grossProfit: number }>();

    for (const row of [...orderRows, ...saleRows]) {
      const eId = row.employeeId ?? 0;
      const existing = empMap.get(eId) || { name: row.employeeName || "غير محدد", ordersCount: 0, salesTotal: 0, cogsTotal: 0, grossProfit: 0 };
      existing.ordersCount += row.ordersCount;
      existing.salesTotal += parseFloat(row.salesTotal);
      existing.cogsTotal += parseFloat(row.cogsTotal);
      existing.grossProfit += parseFloat(row.grossProfit);
      empMap.set(eId, existing);
    }

    return Array.from(empMap.entries()).map(([empId, data]) => {
      const margin = data.salesTotal > 0 ? ((data.grossProfit / data.salesTotal) * 100) : 0;
      return {
        employeeId: empId,
        employeeName: data.name,
        ordersCount: data.ordersCount,
        salesTotal: data.salesTotal.toFixed(3),
        cogsTotal: data.cogsTotal.toFixed(3),
        grossProfit: data.grossProfit.toFixed(3),
        margin: margin.toFixed(1),
      };
    }).sort((a, b) => parseFloat(b.salesTotal) - parseFloat(a.salesTotal));
  }

  async getProfitByProducts(from: string, to: string, branchId?: number) {
    const fromDate = new Date(from + "T00:00:00");
    const toDate = new Date(to + "T23:59:59.999");

    const orderItemConditions: any[] = [
      eq(orders.status, "paid"),
      sql`${orders.paidAt} >= ${fromDate}`,
      sql`${orders.paidAt} <= ${toDate}`,
    ];
    if (branchId) orderItemConditions.push(eq(orders.branchId, branchId));

    const saleItemConditions: any[] = [
      sql`${sales.createdAt} >= ${fromDate}`,
      sql`${sales.createdAt} <= ${toDate}`,
    ];
    if (branchId) saleItemConditions.push(eq(sales.branchId, branchId));

    const oiRows = await db.select({
      productId: orderItems.productId,
      productName: products.name,
      qtySold: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
      salesTotal: sql<string>`coalesce(sum(${orderItems.total}::numeric), 0)::text`,
      cogsTotal: sql<string>`coalesce(sum(${orderItems.lineCogs}::numeric), 0)::text`,
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(and(...orderItemConditions))
      .groupBy(orderItems.productId, products.name);

    const siRows = await db.select({
      productId: saleItems.productId,
      productName: products.name,
      qtySold: sql<number>`coalesce(sum(${saleItems.quantity}), 0)::int`,
      salesTotal: sql<string>`coalesce(sum(${saleItems.total}::numeric), 0)::text`,
      cogsTotal: sql<string>`coalesce(sum(${saleItems.lineCogs}::numeric), 0)::text`,
    }).from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(products, eq(saleItems.productId, products.id))
      .where(and(...saleItemConditions))
      .groupBy(saleItems.productId, products.name);

    const prodMap = new Map<number, { name: string; qtySold: number; salesTotal: number; cogsTotal: number }>();

    for (const row of [...oiRows, ...siRows]) {
      const existing = prodMap.get(row.productId) || { name: row.productName || "", qtySold: 0, salesTotal: 0, cogsTotal: 0 };
      existing.qtySold += row.qtySold;
      existing.salesTotal += parseFloat(row.salesTotal);
      existing.cogsTotal += parseFloat(row.cogsTotal);
      prodMap.set(row.productId, existing);
    }

    return Array.from(prodMap.entries()).map(([prodId, data]) => {
      const grossProfit = data.salesTotal - data.cogsTotal;
      const margin = data.salesTotal > 0 ? ((grossProfit / data.salesTotal) * 100) : 0;
      return {
        productId: prodId,
        productName: data.name,
        qtySold: data.qtySold,
        salesTotal: data.salesTotal.toFixed(3),
        cogsTotal: data.cogsTotal.toFixed(3),
        grossProfit: grossProfit.toFixed(3),
        margin: margin.toFixed(1),
      };
    }).sort((a, b) => parseFloat(b.grossProfit) - parseFloat(a.grossProfit));
  }

  async getBranchComparisonReport(dateStr: string) {
    const dayStart = new Date(dateStr + "T00:00:00");
    const dayEnd = new Date(dateStr + "T23:59:59.999");

    const allBranches = await db.select().from(branches);

    const results = [];
    for (const branch of allBranches) {
      const [ordSales] = await db.select({
        total: sql<string>`coalesce(sum(${orders.total}::numeric), 0)::text`,
        cogs: sql<string>`coalesce(sum(${orders.cogsTotal}::numeric), 0)::text`,
      }).from(orders).where(
        and(eq(orders.status, "paid"), eq(orders.branchId, branch.id),
          sql`${orders.createdAt} >= ${dayStart}`, sql`${orders.createdAt} <= ${dayEnd}`)
      );

      const [posSales] = await db.select({
        total: sql<string>`coalesce(sum(${sales.total}::numeric), 0)::text`,
        cogs: sql<string>`coalesce(sum(${sales.cogsTotal}::numeric), 0)::text`,
      }).from(sales).where(
        and(eq(sales.branchId, branch.id),
          sql`${sales.createdAt} >= ${dayStart}`, sql`${sales.createdAt} <= ${dayEnd}`)
      );

      const [expRow] = await db.select({
        total: sql<string>`coalesce(sum(${expenses.amount}::numeric), 0)::text`,
      }).from(expenses).where(
        and(eq(expenses.branchId, branch.id), sql`${expenses.date} = ${dateStr}`)
      );

      const totalSales = parseFloat(ordSales.total) + parseFloat(posSales.total);
      const totalCogs = parseFloat(ordSales.cogs) + parseFloat(posSales.cogs);
      const grossProfit = totalSales - totalCogs;
      const totalExpenses = parseFloat(expRow.total);
      const netProfit = grossProfit - totalExpenses;

      results.push({
        branchId: branch.id,
        branchName: branch.name,
        totalSales: totalSales.toFixed(3),
        cogsTotal: totalCogs.toFixed(3),
        grossProfit: grossProfit.toFixed(3),
        totalExpenses: totalExpenses.toFixed(3),
        netProfit: netProfit.toFixed(3),
      });
    }

    return { date: dateStr, branches: results };
  }

  async createLocationTransfer(
    branchId: number,
    items: { productId: number; qty: number }[],
    createdBy: number
  ) {
    if (items.length === 0) throw new Error("يجب إضافة صنف واحد على الأقل");

    const [centralLoc] = await db.select().from(locations).where(eq(locations.isCentral, true)).orderBy(locations.id).limit(1);
    if (!centralLoc) throw new Error("لا يوجد مخزن مركزي");
    const fromLocationId = centralLoc.id;

    const [branchLoc] = await db.select().from(locations)
      .where(and(eq(locations.branchId, branchId), eq(locations.isBranchDefault, true)))
      .orderBy(locations.id).limit(1);
    if (!branchLoc) throw new Error("لا يوجد مخزن افتراضي لهذا الفرع");
    const toLocationId = branchLoc.id;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const transferRes = await client.query(
        `INSERT INTO location_transfers (branch_id, from_location_id, to_location_id, note, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, now()) RETURNING id`,
        [branchId, fromLocationId, toLocationId, `تحويل من ${centralLoc.name} إلى ${branchLoc.name}`, createdBy]
      );
      const transferId = transferRes.rows[0].id;

      for (const item of items) {
        if (item.qty <= 0) throw new Error("الكمية يجب أن تكون أكبر من صفر");

        const invRes = await client.query(
          `SELECT qty_on_hand FROM location_inventory WHERE location_id = $1 AND product_id = $2`,
          [fromLocationId, item.productId]
        );
        const available = invRes.rows.length > 0 ? invRes.rows[0].qty_on_hand : 0;
        if (available < item.qty) {
          const [prod] = await db.select({ name: products.name }).from(products).where(eq(products.id, item.productId));
          throw new Error(`الكمية المتاحة من "${prod?.name || item.productId}" في المخزن المركزي هي ${available} فقط`);
        }

        await client.query(
          `INSERT INTO location_transfer_items (transfer_id, product_id, qty) VALUES ($1, $2, $3)`,
          [transferId, item.productId, item.qty]
        );

        await client.query(
          `UPDATE location_inventory SET qty_on_hand = qty_on_hand - $1, updated_at = now()
           WHERE location_id = $2 AND product_id = $3`,
          [item.qty, fromLocationId, item.productId]
        );

        await client.query(
          `INSERT INTO location_inventory (location_id, product_id, qty_on_hand, updated_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (location_id, product_id)
           DO UPDATE SET qty_on_hand = location_inventory.qty_on_hand + EXCLUDED.qty_on_hand, updated_at = now()`,
          [toLocationId, item.productId, item.qty]
        );

        await client.query(
          `INSERT INTO inventory_transactions
           (date, branch_id, from_location_id, to_location_id, product_id, type, qty, ref_table, ref_id, note, created_by, created_at)
           VALUES (now(), $1, $2, NULL, $3, 'TRANSFER_OUT', $4, 'location_transfers', $5, $6, $7, now())`,
          [branchId, fromLocationId, item.productId, item.qty, transferId, `صادر من المركزي إلى ${branchLoc.name}`, createdBy]
        );

        await client.query(
          `INSERT INTO inventory_transactions
           (date, branch_id, from_location_id, to_location_id, product_id, type, qty, ref_table, ref_id, note, created_by, created_at)
           VALUES (now(), $1, NULL, $2, $3, 'TRANSFER_IN', $4, 'location_transfers', $5, $6, $7, now())`,
          [branchId, toLocationId, item.productId, item.qty, transferId, `وارد من المركزي`, createdBy]
        );
      }

      await client.query("COMMIT");
      return { transferId, itemCount: items.length };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async getCentralInventory() {
    const [centralLoc] = await db.select().from(locations).where(eq(locations.isCentral, true)).orderBy(locations.id).limit(1);
    if (!centralLoc) return [];
    return db.select({
      id: locationInventory.id,
      locationId: locationInventory.locationId,
      productId: locationInventory.productId,
      productName: products.name,
      qtyOnHand: locationInventory.qtyOnHand,
    }).from(locationInventory)
      .innerJoin(products, eq(locationInventory.productId, products.id))
      .where(eq(locationInventory.locationId, centralLoc.id))
      .orderBy(products.name);
  }

  async getLocationTransfersList(branchId?: number) {
    let query = `
      SELECT lt.id, lt.branch_id as "branchId", b.name as "branchName",
             lt.from_location_id as "fromLocationId", fl.name as "fromLocationName",
             lt.to_location_id as "toLocationId", tl.name as "toLocationName",
             lt.note, lt.created_by as "createdBy", lt.created_at as "createdAt",
             (SELECT json_agg(json_build_object(
                'productId', lti.product_id,
                'productName', p.name,
                'qty', lti.qty
             )) FROM location_transfer_items lti
             JOIN products p ON p.id = lti.product_id
             WHERE lti.transfer_id = lt.id) as items
      FROM location_transfers lt
      JOIN branches b ON b.id = lt.branch_id
      JOIN locations fl ON fl.id = lt.from_location_id
      JOIN locations tl ON tl.id = lt.to_location_id
    `;
    const params: any[] = [];
    if (branchId) {
      query += ` WHERE lt.branch_id = $1`;
      params.push(branchId);
    }
    query += ` ORDER BY lt.created_at DESC LIMIT 200`;
    const result = await pool.query(query, params);
    return result.rows;
  }
}

export const storage = new DatabaseStorage();
