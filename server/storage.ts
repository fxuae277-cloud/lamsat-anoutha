import { db } from "./db";
import { eq, desc, sql, and, lte } from "drizzle-orm";
import {
  branches, insertBranchSchema, type InsertBranch, type Branch,
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
} from "@shared/schema";

export interface IStorage {
  // Branches
  getBranches(): Promise<Branch[]>;
  getBranch(id: number): Promise<Branch | undefined>;
  createBranch(data: InsertBranch): Promise<Branch>;
  updateBranch(id: number, data: Partial<InsertBranch>): Promise<Branch | undefined>;

  // Cities
  getCities(): Promise<City[]>;
  createCity(data: InsertCity): Promise<City>;

  // Users
  getUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(data: InsertUser): Promise<User>;

  // Categories
  getCategories(): Promise<Category[]>;
  createCategory(data: InsertCategory): Promise<Category>;

  // Products
  getProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductByBarcode(barcode: string): Promise<Product | undefined>;
  createProduct(data: InsertProduct): Promise<Product>;
  updateProduct(id: number, data: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<void>;

  // Warehouses
  getWarehouses(): Promise<Warehouse[]>;
  createWarehouse(data: InsertWarehouse): Promise<Warehouse>;

  // Inventory
  getInventory(): Promise<Inventory[]>;
  getInventoryByWarehouse(warehouseId: number): Promise<Inventory[]>;
  getInventoryByProduct(productId: number): Promise<Inventory[]>;
  upsertInventory(productId: number, warehouseId: number, quantity: number): Promise<Inventory>;
  adjustInventory(productId: number, warehouseId: number, delta: number): Promise<Inventory | undefined>;
  getLowStockAlerts(): Promise<any[]>;

  // Inventory Transfers
  createTransfer(data: InsertInventoryTransfer): Promise<InventoryTransfer>;

  // Customers
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(data: InsertCustomer): Promise<Customer>;

  // Suppliers
  getSuppliers(): Promise<Supplier[]>;
  createSupplier(data: InsertSupplier): Promise<Supplier>;

  // Sales (POS)
  getSales(): Promise<Sale[]>;
  getSale(id: number): Promise<Sale | undefined>;
  createSale(data: InsertSale, items: InsertSaleItem[]): Promise<Sale>;
  getSaleItems(saleId: number): Promise<SaleItem[]>;
  getDailySalesTotal(branchId?: number): Promise<{ total: string; vatTotal: string; count: number }>;
  getWeeklySales(): Promise<{ date: string; total: string }[]>;

  // Orders (WhatsApp/Instagram)
  getOrders(): Promise<Order[]>;
  getOrder(id: number): Promise<Order | undefined>;
  createOrder(data: InsertOrder, items: InsertOrderItem[]): Promise<Order>;
  updateOrderStatus(id: number, status: string): Promise<Order | undefined>;
  getOrderItems(orderId: number): Promise<OrderItem[]>;

  // Expenses
  getExpenses(): Promise<Expense[]>;
  createExpense(data: InsertExpense): Promise<Expense>;

  // Employees
  getEmployees(): Promise<Employee[]>;
  createEmployee(data: InsertEmployee): Promise<Employee>;

  // Shifts
  getShifts(): Promise<Shift[]>;
  createShift(data: InsertShift): Promise<Shift>;
  closeShift(id: number, totalSales: string, totalCash: string, totalBank: string): Promise<Shift | undefined>;

  // Dashboard
  getDashboardStats(branchId?: number): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // Branches
  async getBranches() {
    return db.select().from(branches);
  }
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

  // Cities
  async getCities() {
    return db.select().from(cities);
  }
  async createCity(data: InsertCity) {
    const [row] = await db.insert(cities).values(data).returning();
    return row;
  }

  // Users
  async getUsers() {
    return db.select().from(users);
  }
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

  // Categories
  async getCategories() {
    return db.select().from(categories);
  }
  async createCategory(data: InsertCategory) {
    const [row] = await db.insert(categories).values(data).returning();
    return row;
  }

  // Products
  async getProducts() {
    return db.select().from(products).orderBy(desc(products.id));
  }
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

  // Warehouses
  async getWarehouses() {
    return db.select().from(warehouses);
  }
  async createWarehouse(data: InsertWarehouse) {
    const [row] = await db.insert(warehouses).values(data).returning();
    return row;
  }

  // Inventory
  async getInventory() {
    return db.select().from(inventory);
  }
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
      const [row] = await db.update(inventory)
        .set({ quantity })
        .where(eq(inventory.id, existing[0].id))
        .returning();
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
    const [row] = await db.update(inventory)
      .set({ quantity: newQty })
      .where(eq(inventory.id, existing[0].id))
      .returning();
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

  // Inventory Transfers
  async createTransfer(data: InsertInventoryTransfer) {
    const [row] = await db.insert(inventoryTransfers).values(data).returning();
    await this.adjustInventory(data.productId, data.fromWarehouseId, -data.quantity);
    await this.adjustInventory(data.productId, data.toWarehouseId, data.quantity);
    return row;
  }

  // Customers
  async getCustomers() {
    return db.select().from(customers);
  }
  async getCustomer(id: number) {
    const [row] = await db.select().from(customers).where(eq(customers.id, id));
    return row;
  }
  async createCustomer(data: InsertCustomer) {
    const [row] = await db.insert(customers).values(data).returning();
    return row;
  }

  // Suppliers
  async getSuppliers() {
    return db.select().from(suppliers);
  }
  async createSupplier(data: InsertSupplier) {
    const [row] = await db.insert(suppliers).values(data).returning();
    return row;
  }

  // Sales
  async getSales() {
    return db.select().from(sales).orderBy(desc(sales.createdAt));
  }
  async getSale(id: number) {
    const [row] = await db.select().from(sales).where(eq(sales.id, id));
    return row;
  }
  async createSale(data: InsertSale, items: InsertSaleItem[]) {
    const [sale] = await db.insert(sales).values(data).returning();
    for (const item of items) {
      await db.insert(saleItems).values({ ...item, saleId: sale.id });
      const whList = await db.select().from(warehouses)
        .where(eq(warehouses.branchId, data.branchId));
      if (whList.length > 0) {
        await this.adjustInventory(item.productId, whList[0].id, -item.quantity);
      }
    }
    return sale;
  }
  async getSaleItems(saleId: number) {
    return db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
  }
  async getDailySalesTotal(branchId?: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let query = db.select({
      total: sql<string>`coalesce(sum(${sales.total}::numeric), 0)::text`,
      vatTotal: sql<string>`coalesce(sum(${sales.vat}::numeric), 0)::text`,
      count: sql<number>`count(*)::int`,
    }).from(sales).where(sql`${sales.createdAt} >= ${today}`);
    const [row] = await query;
    return row;
  }
  async getWeeklySales() {
    const result = await db.select({
      date: sql<string>`to_char(${sales.createdAt}, 'YYYY-MM-DD')`,
      total: sql<string>`coalesce(sum(${sales.total}::numeric), 0)::text`,
    }).from(sales)
      .where(sql`${sales.createdAt} >= now() - interval '7 days'`)
      .groupBy(sql`to_char(${sales.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${sales.createdAt}, 'YYYY-MM-DD')`);
    return result;
  }

  // Orders
  async getOrders() {
    return db.select().from(orders).orderBy(desc(orders.createdAt));
  }
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

  // Expenses
  async getExpenses() {
    return db.select().from(expenses).orderBy(desc(expenses.createdAt));
  }
  async createExpense(data: InsertExpense) {
    const [row] = await db.insert(expenses).values(data).returning();
    return row;
  }

  // Employees
  async getEmployees() {
    return db.select().from(employees);
  }
  async createEmployee(data: InsertEmployee) {
    const [row] = await db.insert(employees).values(data).returning();
    return row;
  }

  // Shifts
  async getShifts() {
    return db.select().from(shifts).orderBy(desc(shifts.startedAt));
  }
  async createShift(data: InsertShift) {
    const [row] = await db.insert(shifts).values(data).returning();
    return row;
  }
  async closeShift(id: number, totalSales: string, totalCash: string, totalBank: string) {
    const [row] = await db.update(shifts)
      .set({ endedAt: new Date(), totalSales, totalCash, totalBank, status: "closed" })
      .where(eq(shifts.id, id))
      .returning();
    return row;
  }

  // Dashboard
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
}

export const storage = new DatabaseStorage();
