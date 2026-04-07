import { db, pool } from "./db";
import { eq, desc, sql, and, lte, gte, ilike, or, isNull, asc } from "drizzle-orm";
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
  saleReturns, type InsertSaleReturn, type SaleReturn,
  saleReturnItems, type InsertSaleReturnItem, type SaleReturnItem,
  auditLog, type InsertAuditLog, type AuditLog,
  payrollRuns, type InsertPayrollRun, type PayrollRun,
  payrollDetails, type InsertPayrollDetail, type PayrollDetail,
  employeeAdvances, type InsertEmployeeAdvance, type EmployeeAdvance,
  employeeDeductions, type InsertEmployeeDeduction, type EmployeeDeduction,
  stocktakes, type InsertStocktake, type Stocktake,
  stocktakeItems, type InsertStocktakeItem, type StocktakeItem,
  inventoryAdjustments, type InsertInventoryAdjustment, type InventoryAdjustment,
  productVariants, type InsertProductVariant, type ProductVariant,
  inventoryBalances, type InsertInventoryBalance, type InventoryBalance,
  stockTransfers, type InsertStockTransfer, type StockTransfer,
  stockTransferLines, type InsertStockTransferLine, type StockTransferLine,
  inventoryLedger, type InsertInventoryLedger, type InventoryLedger,
  purchaseExtraCosts, type InsertPurchaseExtraCost, type PurchaseExtraCost,
  supplierOcrTemplates, type InsertSupplierOcrTemplate, type SupplierOcrTemplate,
  accounts, type InsertAccount, type Account,
  journalEntries, type InsertJournalEntry, type JournalEntry,
  journalEntryLines, type InsertJournalEntryLine, type JournalEntryLine,
  salaryPayments, type InsertSalaryPayment, type SalaryPayment,
  employeeFinancialLedger, type InsertEmployeeFinancialLedger, type EmployeeFinancialLedger,
  employeeCommissions, type InsertEmployeeCommission, type EmployeeCommission,
  employeeEntitlements, type InsertEmployeeEntitlement, type EmployeeEntitlement,
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
  getUserByPin(pin: string): Promise<User | undefined>;
  createUser(data: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  getEmployeePerformance(employeeId: number, from: string, to: string): Promise<any>;
  getCategories(filters?: { search?: string; parentId?: number | null; isActive?: boolean }): Promise<Category[]>;
  createCategory(data: InsertCategory): Promise<Category>;
  updateCategory(id: number, data: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<void>;
  toggleCategoryActive(id: number): Promise<Category | undefined>;
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
  getCustomerByPhone(phone: string): Promise<Customer | undefined>;
  findOrCreateCustomerByPhone(phone: string, name?: string): Promise<Customer>;
  createCustomer(data: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, data: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<void>;
  updateCustomerAfterSale(customerId: number, saleTotal: string): Promise<void>;
  getCustomerWithInvoices(id: number): Promise<any>;
  getCustomerKpis(): Promise<any>;
  getCustomerStatement(id: number, from?: string, to?: string): Promise<any>;
  getSupplierStatement(id: number, from?: string, to?: string): Promise<any>;
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
  getCashLedgerByDate(branchId: number | undefined, date: string): Promise<CashLedger[]>;
  getBankLedgerByDate(branchId: number | undefined, date: string): Promise<BankLedger[]>;
  getDailyCashSummary(branchId: number | undefined, date: string): Promise<any>;
  getClosedShiftsByDate(branchId: number | undefined, date: string): Promise<any[]>;
  getShiftReport(shiftId: number): Promise<any>;
  getDailyReport(dateStr: string, branchId?: number): Promise<any>;
  getShiftsByDate(dateStr: string, branchId?: number): Promise<any[]>;
  getDashboardStats(branchId?: number): Promise<any>;
  getProfitByBranches(from: string, to: string): Promise<any[]>;
  getProfitByEmployees(from: string, to: string, branchId?: number): Promise<any[]>;
  getProfitByProducts(from: string, to: string, branchId?: number): Promise<any[]>;
  getOverviewReport(from: string, to: string, branchId?: number): Promise<any>;
  getSalesListReport(from: string, to: string, branchId?: number, paymentMethod?: string): Promise<any>;
  getCategoriesReport(from: string, to: string, branchId?: number): Promise<any[]>;
  getPaymentsReport(from: string, to: string, branchId?: number): Promise<any>;
  getShiftsReport(from: string, to: string, branchId?: number): Promise<any[]>;
  getShiftDetails(shiftId: number): Promise<any>;
  getBranchComparisonRange(from: string, to: string): Promise<any>;
  getPurchaseInvoices(): Promise<PurchaseInvoice[]>;
  getPurchaseInvoice(id: number): Promise<PurchaseInvoice | undefined>;
  createPurchaseInvoice(data: InsertPurchaseInvoice): Promise<PurchaseInvoice>;
  updatePurchaseInvoice(id: number, data: Partial<InsertPurchaseInvoice>): Promise<PurchaseInvoice | undefined>;
  getPurchaseItems(purchaseId: number): Promise<PurchaseItem[]>;
  addPurchaseItem(data: InsertPurchaseItem): Promise<PurchaseItem>;
  updatePurchaseItem(id: number, data: { qty?: number; unitCostBase?: number; variantId?: number; productId?: number }): Promise<PurchaseItem | undefined>;
  deletePurchaseItem(id: number): Promise<void>;
  approvePurchaseInvoice(id: number): Promise<PurchaseInvoice>;
  receivePurchaseInvoice(id: number): Promise<PurchaseInvoice>;
  updateSupplier(id: number, data: Partial<InsertSupplier>): Promise<Supplier | undefined>;
  createSupplierPayment(supplierId: number, data: { amount: number; method: PaymentMethod; note?: string; branchId: number; createdBy: number }): Promise<any>;
  createSaleReturn(data: InsertSaleReturn, items: InsertSaleReturnItem[]): Promise<SaleReturn>;
  getSaleReturns(branchId?: number): Promise<any[]>;
  getSaleReturn(id: number): Promise<SaleReturn | undefined>;
  getSaleReturnItems(returnId: number): Promise<SaleReturnItem[]>;
  cancelOrderFull(orderId: number, userId: number, userName: string, reason: string): Promise<Order | undefined>;
  deductOrderInventory(orderId: number, changedBy: number | null): Promise<void>;
  restoreOrderInventory(orderId: number, changedBy: number | null): Promise<void>;
  addAuditLog(data: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(filters?: { entityType?: string; branchId?: number; from?: string; to?: string }): Promise<any[]>;
  getPayrollRuns(): Promise<PayrollRun[]>;
  getPayrollRun(id: number): Promise<PayrollRun | undefined>;
  createPayrollRun(data: InsertPayrollRun): Promise<PayrollRun>;
  updatePayrollRun(id: number, data: Partial<InsertPayrollRun>): Promise<PayrollRun | undefined>;
  getPayrollDetails(payrollId: number): Promise<any[]>;
  createPayrollDetail(data: InsertPayrollDetail): Promise<PayrollDetail>;
  deletePayrollDetails(payrollId: number): Promise<void>;
  getEmployeeAdvances(employeeId?: number, settledOnly?: boolean): Promise<EmployeeAdvance[]>;
  createEmployeeAdvance(data: InsertEmployeeAdvance): Promise<EmployeeAdvance>;
  settleAdvance(id: number, payrollId: number): Promise<EmployeeAdvance | undefined>;
  getEmployeeDeductions(employeeId?: number): Promise<EmployeeDeduction[]>;
  createEmployeeDeduction(data: InsertEmployeeDeduction): Promise<EmployeeDeduction>;
  getUnsettledAdvances(employeeId: number): Promise<EmployeeAdvance[]>;
  getUnappliedDeductions(employeeId: number): Promise<EmployeeDeduction[]>;
  generatePayrollRun(payrollId: number, month: string, year: number): Promise<void>;
  previewPayrollRun(month: string, year: number): Promise<any>;
  approvePayrollRun(id: number, userId: number): Promise<PayrollRun | undefined>;
  reviewPayrollRun(id: number, userId: number): Promise<PayrollRun | undefined>;
  reopenPayrollRun(id: number, userId: number): Promise<PayrollRun | undefined>;
  cancelPayrollRun(id: number, userId: number): Promise<PayrollRun | undefined>;
  createEmployeeLedgerEntry(data: InsertEmployeeFinancialLedger): Promise<EmployeeFinancialLedger>;
  getEmployeeLedger(employeeId: number, filters?: { from?: string; to?: string; movementType?: string }): Promise<EmployeeFinancialLedger[]>;
  getEmployeeStatement(employeeId: number, from: string, to: string): Promise<any>;
  getPayrollPaymentsReport(filters?: { month?: string; year?: number; branchId?: number }): Promise<any[]>;
  getRecurringDeductionsReport(): Promise<any[]>;
  getPayrollByBranch(month: string, year: number): Promise<any[]>;
  getPayrollComparison(year: number): Promise<any[]>;
  getPayrollRemainingByEmployee(): Promise<any[]>;
  getEmployeeCommissions(employeeId?: number, month?: string, year?: number): Promise<EmployeeCommission[]>;
  createEmployeeCommission(data: InsertEmployeeCommission): Promise<EmployeeCommission>;
  getEmployeeEntitlements(employeeId?: number, month?: string, year?: number): Promise<EmployeeEntitlement[]>;
  createEmployeeEntitlement(data: InsertEmployeeEntitlement): Promise<EmployeeEntitlement>;
  getStocktakes(branchId?: number): Promise<any[]>;
  getStocktake(id: number): Promise<Stocktake | undefined>;
  createStocktake(data: InsertStocktake): Promise<Stocktake>;
  getStocktakeItems(stocktakeId: number): Promise<any[]>;
  updateStocktakeItem(id: number, countedQty: number, note?: string): Promise<StocktakeItem | undefined>;
  approveStocktake(id: number, userId: number): Promise<Stocktake | undefined>;
  createInventoryAdjustment(data: InsertInventoryAdjustment): Promise<InventoryAdjustment>;
  getInventoryAdjustments(branchId?: number, locationId?: number): Promise<any[]>;

  // Variants
  createVariant(data: InsertProductVariant): Promise<ProductVariant>;
  getVariantsByProduct(productId: number): Promise<ProductVariant[]>;
  getAllVariants(): Promise<any[]>;
  getVariantByBarcode(barcode: string): Promise<any>;
  getVariantBySku(sku: string): Promise<ProductVariant | undefined>;
  getVariant(id: number): Promise<ProductVariant | undefined>;
  updateVariant(id: number, data: Partial<InsertProductVariant>): Promise<ProductVariant | undefined>;
  deleteVariant(id: number): Promise<void>;

  // Inventory Balances
  getInventoryBalances(locationId?: number): Promise<any[]>;
  getBalanceByVariantLocation(variantId: number, locationId: number): Promise<InventoryBalance | undefined>;
  upsertBalance(locationId: number, variantId: number, qtyChange: number): Promise<InventoryBalance>;

  // Stock Transfers
  createStockTransfer(data: InsertStockTransfer): Promise<StockTransfer>;
  getStockTransfers(): Promise<any[]>;
  getStockTransfer(id: number): Promise<StockTransfer | undefined>;
  getStockTransferLines(transferId: number): Promise<any[]>;
  addStockTransferLine(data: InsertStockTransferLine): Promise<StockTransferLine>;
  deleteStockTransferLine(id: number): Promise<void>;
  approveStockTransfer(id: number, userId: number): Promise<StockTransfer | undefined>;

  // Inventory Ledger
  createLedgerEntry(data: InsertInventoryLedger): Promise<InventoryLedger>;
  getInventoryLedgerEntries(filters?: { variantId?: number; locationId?: number; limit?: number }): Promise<any[]>;

  // Supplier OCR Templates
  getSupplierOcrTemplate(supplierId: number): Promise<SupplierOcrTemplate | undefined>;
  upsertSupplierOcrTemplate(supplierId: number, data: { tableStartKeyword?: string | null; columnOrder?: string | null }): Promise<SupplierOcrTemplate>;

  // Chart of Accounts
  getAccounts(): Promise<Account[]>;
  getAccount(id: number): Promise<Account | undefined>;
  createAccount(data: InsertAccount): Promise<Account>;
  updateAccount(id: number, data: Partial<InsertAccount>): Promise<Account | undefined>;
  seedDefaultAccounts(): Promise<void>;

  // Journal Entries
  getJournalEntries(filters?: { from?: string; to?: string; status?: string; sourceType?: string }): Promise<any[]>;
  getJournalEntry(id: number): Promise<any>;
  createJournalEntry(data: InsertJournalEntry, lines: InsertJournalEntryLine[]): Promise<JournalEntry>;
  postJournalEntry(id: number): Promise<JournalEntry | undefined>;
  getNextEntryNumber(): Promise<string>;

  // General Ledger
  getGeneralLedger(accountId: number, from?: string, to?: string): Promise<any[]>;
  getTrialBalance(from?: string, to?: string): Promise<any[]>;

  // Products (extended)
  createProductWithVariants(
    productData: InsertProduct,
    variants: Omit<InsertProductVariant, "productId">[]
  ): Promise<{ product: Product; variants: ProductVariant[] }>;
  getLocationInventoryByProduct(productId: number): Promise<any[]>;

  // Inventory Transactions (extended)
  getInventoryTransactions(filters?: {
    branchId?: number;
    productId?: number;
    type?: string;
    from?: string;
    to?: string;
    limit?: number;
  }): Promise<any[]>;

  // Payroll UI helpers
  getPayrollEmployees(branchId?: number): Promise<any[]>;
  getPayrollMovements(month: number, year: number, branchId?: number): Promise<any[]>;
  getPayrollPayments(month: number, year: number, branchId?: number): Promise<any[]>;
  addPayrollPayment(data: {
    employeeId: number;
    month: number;
    year: number;
    amount: number | string;
    paymentMethod: string;
    paidBy: number;
    branchId?: number;
    note?: string;
    referenceNo?: string;
  }): Promise<any>;
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
  async getUserByPin(pin: string) {
    const [row] = await db.select().from(users).where(and(eq(users.pin, pin), eq(users.isActive, true)));
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

  async getCategories(filters?: { search?: string; parentId?: number | null; isActive?: boolean }) {
    const conditions: any[] = [];
    if (filters?.search)
      conditions.push(ilike(categories.name, `%${filters.search}%`));
    if (filters?.parentId !== undefined)
      conditions.push(filters.parentId === null ? isNull(categories.parentId) : eq(categories.parentId, filters.parentId));
    if (filters?.isActive !== undefined)
      conditions.push(eq(categories.isActive, filters.isActive));
    const base = db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
    return conditions.length > 0 ? base.where(and(...conditions)) : base;
  }
  async createCategory(data: InsertCategory) {
    const [row] = await db.insert(categories).values(data).returning();
    return row;
  }
  async updateCategory(id: number, data: Partial<InsertCategory>) {
    const [row] = await db.update(categories).set(data).where(eq(categories.id, id)).returning();
    return row;
  }
  async deleteCategory(id: number) {
    await db.delete(categories).where(eq(categories.id, id));
  }
  async toggleCategoryActive(id: number) {
    const [current] = await db.select({ isActive: categories.isActive }).from(categories).where(eq(categories.id, id));
    if (!current) return undefined;
    const [row] = await db.update(categories).set({ isActive: !current.isActive }).where(eq(categories.id, id)).returning();
    return row;
  }

  async getProducts(filters?: { q?: string; barcode?: string; categoryId?: number; productType?: string }) {
    let rows: Product[];
    if (!filters || (!filters.q && !filters.barcode && !filters.categoryId && !filters.productType)) {
      rows = await db.select().from(products).orderBy(desc(products.id));
    } else {
      const conditions: SQL[] = [];
      if (filters.barcode) conditions.push(eq(products.barcode, filters.barcode));
      if (filters.categoryId) conditions.push(eq(products.categoryId, filters.categoryId));
      if (filters.productType) conditions.push(eq(products.productType, filters.productType));
      if (filters.q) {
        conditions.push(or(
          ilike(products.name, `%${filters.q}%`),
          ilike(products.barcode, `%${filters.q}%`),
        )!);
      }
      rows = await db.select().from(products).where(and(...conditions)).orderBy(desc(products.id));
    }
    if (rows.length === 0) return rows.map(r => ({ ...r, totalStock: 0 }));
    const ids = rows.map(r => r.id);
    const stockResult = await db.execute(sql`
      SELECT pv.product_id, COALESCE(SUM(ib.qty_on_hand), 0)::int AS total_stock
      FROM product_variants pv
      LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
      WHERE pv.product_id = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}::int`), sql`, `)}])
      GROUP BY pv.product_id
    `);
    const stockMap = new Map<number, number>();
    for (const r of stockResult.rows as any[]) stockMap.set(Number(r.product_id), Number(r.total_stock));
    return rows.map(r => ({ ...r, totalStock: stockMap.get(r.id) ?? 0 }));
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
    const variantRows = await db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.productId, id));
    const variantIds = variantRows.map(v => v.id);
    if (variantIds.length > 0) {
      const anyVariant = sql`= ANY(ARRAY[${sql.join(variantIds.map(vid => sql`${vid}::int`), sql`, `)}])`;
      await db.execute(sql`DELETE FROM inventory_ledger WHERE variant_id ${anyVariant}`);
      await db.execute(sql`DELETE FROM stock_transfer_lines WHERE variant_id ${anyVariant}`);
      await db.execute(sql`DELETE FROM inventory_balances WHERE variant_id ${anyVariant}`);
      await db.delete(productVariants).where(eq(productVariants.productId, id));
    }
    await db.delete(locationInventory).where(eq(locationInventory.productId, id));
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

  async getCustomers() { return db.select().from(customers).orderBy(desc(customers.lastVisit)); }
  async getCustomer(id: number) {
    const [row] = await db.select().from(customers).where(eq(customers.id, id));
    return row;
  }
  private normalizePhone(phone: string): string {
    let p = phone.replace(/[\s\-\+]/g, "");
    if (p.startsWith("00968")) p = p.slice(5);
    else if (p.startsWith("968") && p.length > 8) p = p.slice(3);
    return p;
  }
  async getCustomerByPhone(phone: string) {
    const normalized = this.normalizePhone(phone);
    const [row] = await db.select().from(customers).where(eq(customers.phone, normalized));
    return row;
  }
  async findOrCreateCustomerByPhone(phone: string, name?: string) {
    const normalized = this.normalizePhone(phone);
    const existing = await this.getCustomerByPhone(normalized);
    if (existing) return existing;
    const [row] = await db.insert(customers).values({ phone: normalized, name: name || null }).returning();
    return row;
  }
  async createCustomer(data: InsertCustomer) {
    if (data.phone) data.phone = this.normalizePhone(data.phone);
    const [row] = await db.insert(customers).values(data).returning();
    return row;
  }
  async updateCustomer(id: number, data: Partial<InsertCustomer>) {
    const updateData: any = { ...data };
    if (data.phone !== undefined) updateData.phone = this.normalizePhone(data.phone);
    const [row] = await db.update(customers).set(updateData).where(eq(customers.id, id)).returning();
    return row;
  }
  async deleteCustomer(id: number) {
    await db.delete(customers).where(eq(customers.id, id));
  }
  async updateCustomerAfterSale(customerId: number, saleTotal: string) {
    await pool.query(
      `UPDATE customers SET visits = COALESCE(visits, 0) + 1, invoice_count = COALESCE(invoice_count, 0) + 1, total_spent = COALESCE(total_spent, 0) + $1, last_visit = now() WHERE id = $2`,
      [saleTotal, customerId]
    );
  }
  async getCustomerWithInvoices(id: number) {
    const customer = await this.getCustomer(id);
    if (!customer) return null;
    const invoices = await pool.query(
      `SELECT s.id, s.invoice_number, s.total, s.subtotal, s.discount, s.vat, s.payment_method, s.created_at, b.name as branch_name, s.branch_id
       FROM sales s
       LEFT JOIN branches b ON b.id = s.branch_id
       WHERE s.customer_id = $1
       ORDER BY s.created_at DESC`,
      [id]
    );
    const returns = await pool.query(
      `SELECT sr.id, sr.refund_amount, sr.reason, sr.created_at, s.invoice_number, b.name as branch_name
       FROM sale_returns sr
       LEFT JOIN sales s ON s.id = sr.sale_id
       LEFT JOIN branches b ON b.id = sr.branch_id
       WHERE s.customer_id = $1
       ORDER BY sr.created_at DESC`,
      [id]
    );
    const branchStats = await pool.query(
      `SELECT b.name, COUNT(*)::int as count, SUM(s.total::numeric)::numeric as total
       FROM sales s LEFT JOIN branches b ON b.id = s.branch_id
       WHERE s.customer_id = $1 GROUP BY b.name ORDER BY total DESC LIMIT 1`,
      [id]
    );
    return {
      ...customer,
      invoices: invoices.rows,
      returns: returns.rows,
      topBranch: branchStats.rows[0]?.name || null,
      returnsTotal: returns.rows.reduce((s: number, r: any) => s + parseFloat(r.refund_amount || "0"), 0),
      returnsCount: returns.rows.length,
      avgInvoice: invoices.rows.length > 0
        ? invoices.rows.reduce((s: number, i: any) => s + parseFloat(i.total || "0"), 0) / invoices.rows.length
        : 0,
    };
  }
  async getCustomerKpis() {
    const totalRes = await pool.query(`SELECT COUNT(*)::int as total FROM customers`);
    const activeRes = await pool.query(`SELECT COUNT(*)::int as total FROM customers WHERE active = true OR active IS NULL`);
    const inactiveRes = await pool.query(`SELECT COUNT(*)::int as total FROM customers WHERE active = false`);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const newThisMonthRes = await pool.query(`SELECT COUNT(*)::int as total FROM customers WHERE created_at >= $1`, [monthStart]);
    const totalPurchasesRes = await pool.query(`SELECT COALESCE(SUM(total_spent::numeric), 0)::numeric as total FROM customers`);
    const topRes = await pool.query(
      `SELECT id, name, phone, total_spent FROM customers ORDER BY total_spent::numeric DESC LIMIT 1`
    );
    return {
      totalCustomers: totalRes.rows[0]?.total || 0,
      activeCustomers: activeRes.rows[0]?.total || 0,
      inactiveCustomers: inactiveRes.rows[0]?.total || 0,
      newThisMonth: newThisMonthRes.rows[0]?.total || 0,
      totalPurchases: parseFloat(totalPurchasesRes.rows[0]?.total || "0"),
      topCustomer: topRes.rows[0] || null,
    };
  }
  async getCustomerStatement(id: number, from?: string, to?: string) {
    const customer = await this.getCustomer(id);
    if (!customer) return null;
    let salesQuery = `SELECT s.id, s.invoice_number, s.total, s.payment_method, s.created_at, b.name as branch_name, 'sale' as type
       FROM sales s LEFT JOIN branches b ON b.id = s.branch_id
       WHERE s.customer_id = $1`;
    const params: any[] = [id];
    if (from) { params.push(from); salesQuery += ` AND s.created_at >= $${params.length}`; }
    if (to) { params.push(to + "T23:59:59"); salesQuery += ` AND s.created_at <= $${params.length}`; }
    salesQuery += ` ORDER BY s.created_at DESC`;
    const salesRes = await pool.query(salesQuery, params);

    let returnsQuery = `SELECT sr.id, s.invoice_number, sr.refund_amount as total, sr.reason as notes, sr.created_at, b.name as branch_name, 'return' as type
       FROM sale_returns sr LEFT JOIN sales s ON s.id = sr.sale_id LEFT JOIN branches b ON b.id = sr.branch_id
       WHERE s.customer_id = $1`;
    const rParams: any[] = [id];
    if (from) { rParams.push(from); returnsQuery += ` AND sr.created_at >= $${rParams.length}`; }
    if (to) { rParams.push(to + "T23:59:59"); returnsQuery += ` AND sr.created_at <= $${rParams.length}`; }
    returnsQuery += ` ORDER BY sr.created_at DESC`;
    const returnsRes = await pool.query(returnsQuery, rParams);

    const entries = [...salesRes.rows, ...returnsRes.rows].sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const totalSales = salesRes.rows.reduce((s: number, r: any) => s + parseFloat(r.total || "0"), 0);
    const totalReturns = returnsRes.rows.reduce((s: number, r: any) => s + parseFloat(r.total || "0"), 0);
    return {
      customer,
      entries,
      summary: {
        totalSales,
        totalReturns,
        netAmount: totalSales - totalReturns,
        operationCount: entries.length,
        avgInvoice: salesRes.rows.length > 0 ? totalSales / salesRes.rows.length : 0,
        salesCount: salesRes.rows.length,
        returnsCount: returnsRes.rows.length,
      },
    };
  }

  async getSupplierStatement(id: number, from?: string, to?: string) {
    const supplier = await this.getSupplier(id);
    if (!supplier) return null;

    let purchasesQuery = `
      SELECT pi.id, pi.invoice_number, pi.grand_total as total, pi.invoice_date as created_at, b.name as branch_name, 'purchase' as type
      FROM purchase_invoices pi
      LEFT JOIN branches b ON b.id = pi.branch_id
      WHERE pi.supplier_id = $1 AND pi.status = 'approved'
    `;
    const params: any[] = [id];
    if (from) {
      params.push(from);
      purchasesQuery += ` AND pi.invoice_date >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      purchasesQuery += ` AND pi.invoice_date <= $${params.length}`;
    }
    purchasesQuery += ` ORDER BY pi.invoice_date DESC`;

    const purchasesRes = await pool.query(purchasesQuery, params);

    // For now, we only have purchases. If we add payments later in T003, we would union them here.
    const transactions = purchasesRes.rows.map(r => ({
      ...r,
      total: parseFloat(r.total || "0")
    })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    let runningBalance = 0;
    const items = transactions.reverse().map(t => {
      // In a supplier statement, a purchase increases what we owe (positive balance/credit)
      // A payment would decrease it.
      runningBalance += t.total;
      return { ...t, balance: runningBalance };
    }).reverse();

    return {
      supplier,
      items,
      totalPurchases: items.filter(i => i.type === 'purchase').reduce((sum, i) => sum + i.total, 0),
      currentBalance: runningBalance
    };
  }

  async getSuppliers(activeOnly?: boolean) {
    const rows = activeOnly
      ? await db.select().from(suppliers).where(eq(suppliers.active, true)).orderBy(desc(suppliers.createdAt))
      : await db.select().from(suppliers).orderBy(desc(suppliers.createdAt));
    if (rows.length === 0) return rows.map(r => ({ ...r, lastPurchaseDate: null }));
    const ids = rows.map(r => r.id);
    const lpResult = await db.execute(sql`
      SELECT supplier_id, MAX(invoice_date) AS last_purchase_date
      FROM purchase_invoices
      WHERE supplier_id = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}::int`), sql`, `)}])
        AND status = 'approved'
      GROUP BY supplier_id
    `);
    const lpMap = new Map<number, string>();
    for (const r of lpResult.rows as any[]) lpMap.set(Number(r.supplier_id), r.last_purchase_date);
    return rows.map(r => ({ ...r, lastPurchaseDate: lpMap.get(r.id) ?? null }));
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

  async getSalesFiltered(filters: { from?: string; to?: string; paymentMethod?: string; employeeId?: number; branchId?: number; invoiceNumber?: string }) {
    const conditions: any[] = [];
    if (filters.from) conditions.push(gte(sales.createdAt, new Date(filters.from + "T00:00:00")));
    if (filters.to) conditions.push(lte(sales.createdAt, new Date(filters.to + "T23:59:59.999")));
    if (filters.paymentMethod) conditions.push(eq(sales.paymentMethod, filters.paymentMethod));
    if (filters.employeeId) conditions.push(eq(sales.cashierId, filters.employeeId));
    if (filters.branchId) conditions.push(eq(sales.branchId, filters.branchId));
    if (filters.invoiceNumber) conditions.push(eq(sales.invoiceNumber, filters.invoiceNumber));

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
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const branchLocRes = await client.query(
        `SELECT id FROM locations WHERE branch_id = $1 AND is_branch_default = true ORDER BY id LIMIT 1`,
        [data.branchId]
      );
      if (branchLocRes.rows.length === 0) throw new Error("لا يوجد مخزن افتراضي للفرع");
      const branchLocationId = branchLocRes.rows[0].id;

      const saleRes = await client.query(
        `INSERT INTO sales (invoice_number, branch_id, cashier_id, customer_id, subtotal, discount, discount_type, vat, total, payment_method, bank_txn_id, shift_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [
          data.invoiceNumber || null, data.branchId, data.cashierId || null, data.customerId || null,
          data.subtotal || "0", data.discount || "0", data.discountType || "percentage",
          data.vat || "0", data.total || "0", data.paymentMethod || "cash",
          data.bankTxnId || null, data.shiftId || null,
        ]
      );
      const sale = saleRes.rows[0];
      const saleId = sale.id;

      let cogsTotal = 0;

      for (const item of items) {
        const variantRes = await client.query(
          `SELECT pv.id as variant_id FROM product_variants pv WHERE pv.product_id = $1 ORDER BY pv.id LIMIT 1`,
          [item.productId]
        );
        const variantId = variantRes.rows[0]?.variant_id;

        if (variantId) {
          await client.query(
            `SELECT id FROM inventory_balances
             WHERE variant_id = $1 AND location_id IN (SELECT id FROM locations WHERE branch_id = $2)
             FOR UPDATE`,
            [variantId, data.branchId]
          );

          const invRow = await client.query(
            `SELECT COALESCE(SUM(ib.qty_on_hand), 0) as total_available,
                    COUNT(ib.id) as tracked_rows
             FROM inventory_balances ib
             JOIN locations l ON l.id = ib.location_id
             WHERE l.branch_id = $1 AND ib.variant_id = $2`,
            [data.branchId, variantId]
          );
          const available = Number(invRow.rows[0]?.total_available || 0);
          const trackedRows = Number(invRow.rows[0]?.tracked_rows || 0);
          // Only enforce when stock has been explicitly received.
          // If trackedRows = 0 the product was never stocked, so allow the sale
          // and record a negative balance to reconcile when stock arrives.
          if (trackedRows > 0 && available < item.quantity) {
            const prodRes = await client.query(`SELECT name FROM products WHERE id = $1`, [item.productId]);
            const pName = prodRes.rows[0]?.name || `#${item.productId}`;
            throw new Error(`المخزون غير كاف للمنتج "${pName}" — المتوفر: ${available}، المطلوب: ${item.quantity}`);
          }

          const balRow = await client.query(
            `SELECT qty_on_hand FROM inventory_balances WHERE location_id = $1 AND variant_id = $2`,
            [branchLocationId, variantId]
          );
          if (balRow.rows.length > 0) {
            await client.query(
              `UPDATE inventory_balances SET qty_on_hand = qty_on_hand - $1
               WHERE location_id = $2 AND variant_id = $3`,
              [item.quantity, branchLocationId, variantId]
            );
          } else {
            await client.query(
              `INSERT INTO inventory_balances (location_id, variant_id, qty_on_hand)
               VALUES ($1, $2, (0 - $3::numeric))`,
              [branchLocationId, variantId, item.quantity]
            );
          }

          await client.query(`
            INSERT INTO inventory_ledger (variant_id, location_id, qty_change, reason, ref_table, ref_id, created_by)
            VALUES ($1, $2, $3, 'sale_out', 'sales', $4, $5)
          `, [variantId, branchLocationId, -item.quantity, saleId, data.cashierId || null]);
        }

        await client.query(
          `INSERT INTO location_inventory (location_id, product_id, qty_on_hand, reorder_level, updated_at)
           VALUES ($1, $2, (0 - $3::int), 5, now())
           ON CONFLICT (location_id, product_id) DO UPDATE SET qty_on_hand = location_inventory.qty_on_hand - $3::int, updated_at = now()`,
          [branchLocationId, item.productId, item.quantity]
        );

        const costRes = await client.query(
          `SELECT pi.unit_cost_final FROM purchase_items pi
           JOIN purchase_invoices pv ON pv.id = pi.purchase_id
           WHERE pv.status = 'approved' AND pi.product_id = $1
           ORDER BY pv.invoice_date DESC, pv.id DESC, pi.id DESC LIMIT 1`,
          [item.productId]
        );
        let unitCost = 0;
        if (costRes.rows.length > 0 && costRes.rows[0].unit_cost_final) {
          unitCost = parseFloat(costRes.rows[0].unit_cost_final);
        } else {
          const prodCost = await client.query(`SELECT avg_cost FROM products WHERE id = $1`, [item.productId]);
          unitCost = prodCost.rows.length > 0 ? parseFloat(prodCost.rows[0].avg_cost || "0") : 0;
        }
        const lineCogs = unitCost * item.quantity;
        cogsTotal += lineCogs;

        await client.query(
          `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total, unit_cost_at_sale, line_cogs)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [saleId, item.productId, item.quantity, item.unitPrice || "0", item.total || "0", unitCost.toFixed(3), lineCogs.toFixed(3)]
        );

        await client.query(
          `INSERT INTO inventory_transactions
           (date, branch_id, from_location_id, to_location_id, product_id, type, qty, ref_table, ref_id, note, created_by, created_at)
           VALUES (now(), $1, $2, NULL, $3, 'sale_out', $4, 'sales', $5, $6, $7, now())`,
          [data.branchId, branchLocationId, item.productId, item.quantity, saleId, `بيع فاتورة ${sale.invoice_number}`, data.cashierId || null]
        );
      }

      const saleTotal = parseFloat(sale.total || "0");
      const grossProfit = saleTotal - cogsTotal;
      await client.query(
        `UPDATE sales SET cogs_total = $1, gross_profit = $2 WHERE id = $3`,
        [cogsTotal.toFixed(3), grossProfit.toFixed(3), saleId]
      );

      const pm = data.paymentMethod || "cash";
      const amount = sale.total || "0";

      if (data.shiftId) {
        if (pm === "cash") {
          await client.query(
            `UPDATE shifts SET total_sales = COALESCE(total_sales, '0')::numeric + $1::numeric,
                               total_cash = COALESCE(total_cash, '0')::numeric + $1::numeric
             WHERE id = $2`,
            [amount, data.shiftId]
          );
        } else {
          await client.query(
            `UPDATE shifts SET total_sales = COALESCE(total_sales, '0')::numeric + $1::numeric,
                               total_bank = COALESCE(total_bank, '0')::numeric + $1::numeric
             WHERE id = $2`,
            [amount, data.shiftId]
          );
        }
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      if (pm === "cash") {
        await client.query(
          `INSERT INTO cash_ledger (date, branch_id, shift_id, type, amount_in, amount_out, category, note, created_by)
           VALUES ($1, $2, $3, 'sale', $4, '0', 'sale', $5, $6)`,
          [todayStr, data.branchId, data.shiftId || null, amount, `بيع فاتورة ${sale.invoice_number}`, data.cashierId || null]
        );
      } else {
        await client.query(
          `INSERT INTO bank_ledger (date, branch_id, shift_id, method, amount_in, amount_out, ref_id, category, note, created_by)
           VALUES ($1, $2, $3, $4, $5, '0', $6, 'sale', $7, $8)`,
          [todayStr, data.branchId, data.shiftId || null, pm, amount, data.bankTxnId || null, `بيع فاتورة ${sale.invoice_number}`, data.cashierId || null]
        );
      }

      await client.query("COMMIT");

      const [updatedSale] = await db.select().from(sales).where(eq(sales.id, saleId));
      return updatedSale;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
  async getSaleItems(saleId: number) {
    return db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
  }
  async getDailySalesTotal(branchId?: number) {
    const [row] = await db.select({
      total: sql<string>`coalesce(sum(${sales.total}::numeric), 0)::text`,
      vatTotal: sql<string>`coalesce(sum(${sales.vat}::numeric), 0)::text`,
      count: sql<number>`count(*)::int`,
    }).from(sales).where(sql`date_trunc('month', ${sales.createdAt}) = date_trunc('month', now())`);
    return row;
  }
  async getWeeklySales() {
    return db.select({
      date: sql<string>`to_char(${sales.createdAt}, 'YYYY-MM-DD')`,
      total: sql<string>`coalesce(sum(${sales.total}::numeric), 0)::text`,
    }).from(sales)
      .where(sql`${sales.createdAt} >= now() - interval '30 days'`)
      .groupBy(sql`to_char(${sales.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${sales.createdAt}, 'YYYY-MM-DD')`);
  }

  async getOrders() { return db.select().from(orders).orderBy(desc(orders.createdAt)); }
  async getOrder(id: number) {
    const [row] = await db.select().from(orders).where(eq(orders.id, id));
    return row;
  }
  async createOrder(data: InsertOrder, items: InsertOrderItem[]) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Availability check only — deduction happens on status → completed
      for (const item of items) {
        const variantRes = await client.query(
          `SELECT pv.id as variant_id FROM product_variants pv WHERE pv.product_id = $1 ORDER BY pv.id LIMIT 1`,
          [item.productId]
        );
        const variantId = variantRes.rows[0]?.variant_id;
        if (variantId) {
          // Lock rows to prevent concurrent orders from bypassing the check
          await client.query(
            `SELECT id FROM inventory_balances
             WHERE variant_id = $1 AND location_id IN (SELECT id FROM locations WHERE branch_id = $2)
             FOR UPDATE`,
            [variantId, data.branchId]
          );
          const invRow = await client.query(
            `SELECT COALESCE(SUM(ib.qty_on_hand), 0) as total_available,
                    COUNT(ib.id) as tracked_rows
             FROM inventory_balances ib
             JOIN locations l ON l.id = ib.location_id
             WHERE l.branch_id = $1 AND ib.variant_id = $2`,
            [data.branchId, variantId]
          );
          const available = Number(invRow.rows[0]?.total_available || 0);
          const trackedRows = Number(invRow.rows[0]?.tracked_rows || 0);
          if (trackedRows > 0 && available < item.quantity) {
            const prodRes = await client.query(`SELECT name FROM products WHERE id = $1`, [item.productId]);
            const pName = prodRes.rows[0]?.name || `#${item.productId}`;
            throw new Error(`المخزون غير كاف للمنتج "${pName}" — المتوفر: ${available}، المطلوب: ${item.quantity}`);
          }
        }
      }

      const orderRes = await client.query(
        `INSERT INTO orders (order_number, customer_name, customer_phone, city, address, branch_id, shift_id, employee_id, delivery_type, status, payment_method, bank_txn_id, total, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [
          data.orderNumber, data.customerName, data.customerPhone || null,
          data.city || null, data.address || null, data.branchId || null,
          data.shiftId || null, data.employeeId || null, data.deliveryType || "pickup",
          data.status || "new", data.paymentMethod || "cash",
          data.bankTxnId || null, data.total || "0", data.notes || null,
        ]
      );
      const order = orderRes.rows[0];
      const orderId = order.id;

      for (const item of items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price, total)
           VALUES ($1,$2,$3,$4,$5)`,
          [orderId, item.productId, item.quantity, item.unitPrice || "0", item.total || "0"]
        );
      }

      await client.query("COMMIT");
      return order;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async deductOrderInventory(orderId: number, changedBy: number | null): Promise<void> {
    const order = await this.getOrder(orderId);
    if (!order || !order.branchId) return;
    const items = await this.getOrderItems(orderId);
    if (items.length === 0) return;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const branchLocRes = await client.query(
        `SELECT id FROM locations WHERE branch_id = $1 AND is_branch_default = true ORDER BY id LIMIT 1`,
        [order.branchId]
      );
      if (branchLocRes.rows.length === 0) throw new Error("لا يوجد مخزن افتراضي للفرع");
      const branchLocationId = branchLocRes.rows[0].id;

      for (const item of items) {
        const variantRes = await client.query(
          `SELECT pv.id as variant_id FROM product_variants pv WHERE pv.product_id = $1 ORDER BY pv.id LIMIT 1`,
          [item.productId]
        );
        const variantId = variantRes.rows[0]?.variant_id;

        if (variantId) {
          // Lock + verify availability one more time
          await client.query(
            `SELECT id FROM inventory_balances
             WHERE variant_id = $1 AND location_id IN (SELECT id FROM locations WHERE branch_id = $2)
             FOR UPDATE`,
            [variantId, order.branchId]
          );
          const invRow = await client.query(
            `SELECT COALESCE(SUM(ib.qty_on_hand), 0) as total_available
             FROM inventory_balances ib
             JOIN locations l ON l.id = ib.location_id
             WHERE l.branch_id = $1 AND ib.variant_id = $2`,
            [order.branchId, variantId]
          );
          const available = Number(invRow.rows[0]?.total_available || 0);
          if (available < item.quantity) {
            const prodRes = await client.query(`SELECT name FROM products WHERE id = $1`, [item.productId]);
            const pName = prodRes.rows[0]?.name || `#${item.productId}`;
            throw new Error(`المخزون غير كاف للمنتج "${pName}" — المتوفر: ${available}، المطلوب: ${item.quantity}`);
          }

          // Deduct from inventory_balances
          const balRow = await client.query(
            `SELECT qty_on_hand FROM inventory_balances WHERE location_id = $1 AND variant_id = $2`,
            [branchLocationId, variantId]
          );
          if (balRow.rows.length > 0) {
            await client.query(
              `UPDATE inventory_balances SET qty_on_hand = qty_on_hand - $1
               WHERE location_id = $2 AND variant_id = $3`,
              [item.quantity, branchLocationId, variantId]
            );
          } else {
            await client.query(
              `INSERT INTO inventory_balances (location_id, variant_id, qty_on_hand)
               VALUES ($1, $2, (0 - $3::numeric))`,
              [branchLocationId, variantId, item.quantity]
            );
          }

          await client.query(`
            INSERT INTO inventory_ledger (variant_id, location_id, qty_change, reason, ref_table, ref_id, created_by)
            VALUES ($1, $2, $3, 'order_completed', 'orders', $4, $5)
          `, [variantId, branchLocationId, -item.quantity, orderId, changedBy]);
        }

        // Deduct from location_inventory (product-level)
        await client.query(
          `INSERT INTO location_inventory (location_id, product_id, qty_on_hand, reorder_level, updated_at)
           VALUES ($1, $2, (0 - $3::int), 5, now())
           ON CONFLICT (location_id, product_id) DO UPDATE
           SET qty_on_hand = location_inventory.qty_on_hand - $3::int, updated_at = now()`,
          [branchLocationId, item.productId, item.quantity]
        );
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async restoreOrderInventory(orderId: number, changedBy: number | null): Promise<void> {
    const order = await this.getOrder(orderId);
    if (!order || !order.branchId) return;
    const items = await this.getOrderItems(orderId);
    if (items.length === 0) return;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const branchLocRes = await client.query(
        `SELECT id FROM locations WHERE branch_id = $1 AND is_branch_default = true ORDER BY id LIMIT 1`,
        [order.branchId]
      );
      if (branchLocRes.rows.length === 0) throw new Error("لا يوجد مخزن افتراضي للفرع");
      const branchLocationId = branchLocRes.rows[0].id;

      for (const item of items) {
        const variantRes = await client.query(
          `SELECT pv.id as variant_id FROM product_variants pv WHERE pv.product_id = $1 ORDER BY pv.id LIMIT 1`,
          [item.productId]
        );
        const variantId = variantRes.rows[0]?.variant_id;

        if (variantId) {
          // Restore to inventory_balances
          await client.query(
            `UPDATE inventory_balances SET qty_on_hand = qty_on_hand + $1
             WHERE location_id = $2 AND variant_id = $3`,
            [item.quantity, branchLocationId, variantId]
          );

          await client.query(`
            INSERT INTO inventory_ledger (variant_id, location_id, qty_change, reason, ref_table, ref_id, created_by)
            VALUES ($1, $2, $3, 'order_cancelled', 'orders', $4, $5)
          `, [variantId, branchLocationId, item.quantity, orderId, changedBy]);
        }

        // Restore to location_inventory (product-level)
        await client.query(
          `INSERT INTO location_inventory (location_id, product_id, qty_on_hand, reorder_level, updated_at)
           VALUES ($1, $2, $3::int, 5, now())
           ON CONFLICT (location_id, product_id) DO UPDATE
           SET qty_on_hand = location_inventory.qty_on_hand + $3::int, updated_at = now()`,
          [branchLocationId, item.productId, item.quantity]
        );
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
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
  async getExpensesEnriched(branchId?: number, dateStr?: string, fromDate?: string, toDate?: string) {
    const conditions: any[] = [];
    if (branchId) conditions.push(eq(expenses.branchId, branchId));
    if (fromDate && toDate) {
      conditions.push(sql`${expenses.date} >= ${fromDate} AND ${expenses.date} <= ${toDate}`);
    } else if (dateStr) {
      conditions.push(sql`${expenses.date} = ${dateStr}`);
    }

    const rows = await db.select({
      id: expenses.id,
      branchId: expenses.branchId,
      branchName: branches.name,
      shiftId: expenses.shiftId,
      category: expenses.category,
      amount: expenses.amount,
      source: expenses.source,
      date: expenses.date,
      notes: expenses.notes,
      createdBy: expenses.createdBy,
      createdByName: users.name,
      createdAt: expenses.createdAt,
    }).from(expenses)
      .leftJoin(branches, eq(expenses.branchId, branches.id))
      .leftJoin(users, eq(expenses.createdBy, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(expenses.createdAt));
    return rows;
  }
  async getExpensesSummary(branchId?: number, dateStr?: string, fromDate?: string, toDate?: string) {
    const conditions: any[] = [];
    if (branchId) conditions.push(eq(expenses.branchId, branchId));
    if (fromDate && toDate) {
      conditions.push(sql`${expenses.date} >= ${fromDate} AND ${expenses.date} <= ${toDate}`);
    } else if (dateStr) {
      conditions.push(sql`${expenses.date} = ${dateStr}`);
    }

    const [cashTotal] = await db.select({
      total: sql<string>`coalesce(sum(${expenses.amount}::numeric), 0)::text`,
      count: sql<number>`count(*)::int`,
    }).from(expenses).where(
      and(eq(expenses.source, "cash"), ...(conditions.length > 0 ? conditions : []))
    );
    const [cardTotal] = await db.select({
      total: sql<string>`coalesce(sum(${expenses.amount}::numeric), 0)::text`,
      count: sql<number>`count(*)::int`,
    }).from(expenses).where(
      and(eq(expenses.source, "card"), ...(conditions.length > 0 ? conditions : []))
    );
    const [bankTotal] = await db.select({
      total: sql<string>`coalesce(sum(${expenses.amount}::numeric), 0)::text`,
      count: sql<number>`count(*)::int`,
    }).from(expenses).where(
      and(eq(expenses.source, "bank_transfer"), ...(conditions.length > 0 ? conditions : []))
    );

    const cash = parseFloat(cashTotal.total);
    const card = parseFloat(cardTotal.total);
    const bank = parseFloat(bankTotal.total);

    const byCategory = await db.select({
      category: expenses.category,
      total: sql<string>`sum(${expenses.amount}::numeric)::text`,
      count: sql<number>`count(*)::int`,
    }).from(expenses)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(expenses.category)
      .orderBy(sql`sum(${expenses.amount}::numeric) desc`);

    return {
      cash: { total: cash.toFixed(3), count: cashTotal.count },
      card: { total: card.toFixed(3), count: cardTotal.count },
      bank: { total: bank.toFixed(3), count: bankTotal.count },
      total: (cash + card + bank).toFixed(3),
      totalCount: cashTotal.count + cardTotal.count + bankTotal.count,
      byCategory,
    };
  }
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
    const [shiftRow] = await db.select().from(shifts).where(eq(shifts.id, id));
    if (!shiftRow) return undefined;
    const openingCash = parseFloat(shiftRow.openingCash || "0");

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

    const [cashDepositRow] = await db.select({
      totalIn: sql<string>`coalesce(sum(amount_in::numeric),0)::text`,
      totalOut: sql<string>`coalesce(sum(amount_out::numeric),0)::text`,
    }).from(cashLedger).where(
      and(eq(cashLedger.shiftId, id), sql`${cashLedger.type} IN ('deposit','withdrawal')`)
    );

    const totalCashIn = parseFloat(cashOrdersRow.total) + parseFloat(cashSalesRow.total);
    const totalCardIn = parseFloat(cardOrdersRow.total) + parseFloat(cardSalesRow.total);
    const totalBankIn = parseFloat(bankOrdersRow.total) + parseFloat(bankSalesRow.total);
    const depositsIn = parseFloat(cashDepositRow.totalIn);
    const withdrawalsOut = parseFloat(cashDepositRow.totalOut);

    const expectedCash = openingCash + totalCashIn - parseFloat(cashExpenseRow.total) + depositsIn - withdrawalsOut;
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

  async getCashLedgerByDate(branchId: number | undefined, date: string) {
    const conditions = [eq(cashLedger.date, date)];
    if (branchId) conditions.push(eq(cashLedger.branchId, branchId));
    return db.select().from(cashLedger).where(and(...conditions)).orderBy(cashLedger.createdAt);
  }

  async getBankLedgerByDate(branchId: number | undefined, date: string) {
    const conditions = [eq(bankLedger.date, date)];
    if (branchId) conditions.push(eq(bankLedger.branchId, branchId));
    return db.select().from(bankLedger).where(and(...conditions)).orderBy(bankLedger.createdAt);
  }

  async getDailyCashSummary(branchId: number | undefined, date: string) {
    const branchFilter = branchId ? `AND cl.branch_id = ${Number(branchId)}` : "";
    const shiftFilter = branchId ? `AND s.branch_id = ${Number(branchId)}` : "";

    const result = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN cl.type = 'sale' THEN cl.amount_in::numeric ELSE 0 END), 0) AS cash_sales,
        COALESCE(SUM(CASE WHEN cl.type = 'expense' THEN cl.amount_out::numeric ELSE 0 END), 0) AS cash_expenses,
        COALESCE(SUM(CASE WHEN cl.type = 'deposit' THEN cl.amount_in::numeric ELSE 0 END), 0) AS deposits,
        COALESCE(SUM(CASE WHEN cl.type = 'withdrawal' THEN cl.amount_out::numeric ELSE 0 END), 0) AS withdrawals,
        COALESCE(SUM(CASE WHEN cl.type = 'shift_difference' THEN cl.amount_in::numeric - cl.amount_out::numeric ELSE 0 END), 0) AS shift_differences,
        COALESCE(SUM(cl.amount_in::numeric), 0) AS total_in,
        COALESCE(SUM(cl.amount_out::numeric), 0) AS total_out
      FROM cash_ledger cl
      WHERE cl.date = $1 ${branchFilter}
    `, [date]);

    const shiftResult = await pool.query(`
      SELECT
        COALESCE(SUM(s.opening_cash::numeric), 0) AS total_opening,
        COALESCE(SUM(CASE WHEN s.status = 'closed' THEN s.actual_cash::numeric ELSE 0 END), 0) AS total_closing,
        COALESCE(SUM(CASE WHEN s.status = 'closed' THEN s.difference::numeric ELSE 0 END), 0) AS total_difference
      FROM shifts s
      WHERE s.started_at::date = $1 ${shiftFilter}
    `, [date]);

    const row = result.rows[0];
    const shiftRow = shiftResult.rows[0];
    const openingCash = parseFloat(shiftRow.total_opening || "0");
    const cashSales = parseFloat(row.cash_sales || "0");
    const cashExpenses = parseFloat(row.cash_expenses || "0");
    const deposits = parseFloat(row.deposits || "0");
    const withdrawals = parseFloat(row.withdrawals || "0");
    const shiftDifferences = parseFloat(row.shift_differences || "0");
    const totalIn = parseFloat(row.total_in || "0");
    const totalOut = parseFloat(row.total_out || "0");
    const expectedClosing = openingCash + cashSales - cashExpenses + deposits - withdrawals;
    const actualClosing = parseFloat(shiftRow.total_closing || "0");
    const totalDifference = parseFloat(shiftRow.total_difference || "0");

    return {
      date,
      openingCash,
      cashSales,
      cashExpenses,
      deposits,
      withdrawals,
      shiftDifferences,
      totalIn,
      totalOut,
      expectedClosing,
      actualClosing,
      totalDifference,
      netCash: openingCash + totalIn - totalOut,
    };
  }

  async getClosedShiftsByDate(branchId: number | undefined, date: string) {
    const conditions = [
      eq(shifts.status, "closed"),
      sql`${shifts.startedAt}::date = ${date}`,
    ];
    if (branchId) conditions.push(eq(shifts.branchId, branchId));

    const rows = await db.select({
      id: shifts.id,
      branchId: shifts.branchId,
      cashierId: shifts.cashierId,
      cashierName: users.name,
      startedAt: shifts.startedAt,
      endedAt: shifts.endedAt,
      openingCash: shifts.openingCash,
      totalSales: shifts.totalSales,
      totalCash: shifts.totalCash,
      totalBank: shifts.totalBank,
      expectedCash: shifts.expectedCash,
      actualCash: shifts.actualCash,
      difference: shifts.difference,
      terminalName: shifts.terminalName,
    }).from(shifts)
      .leftJoin(users, eq(shifts.cashierId, users.id))
      .where(and(...conditions))
      .orderBy(desc(shifts.endedAt));
    return rows;
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
      variantId: purchaseItems.variantId,
      productName: products.name,
      barcode: productVariants.barcode,
      color: productVariants.color,
      size: productVariants.size,
      qty: purchaseItems.qty,
      unitCostBase: purchaseItems.unitCostBase,
      lineSubtotal: purchaseItems.lineSubtotal,
      allocatedExtraCost: purchaseItems.allocatedExtraCost,
      unitCostFinal: purchaseItems.unitCostFinal,
    }).from(purchaseItems)
      .leftJoin(products, eq(purchaseItems.productId, products.id))
      .leftJoin(productVariants, eq(purchaseItems.variantId, productVariants.id))
      .where(eq(purchaseItems.purchaseId, purchaseId));
  }

  async addPurchaseItem(data: InsertPurchaseItem) {
    const [row] = await db.insert(purchaseItems).values(data).returning();
    return row;
  }

  async updatePurchaseItem(id: number, data: { qty?: number; unitCostBase?: number; variantId?: number; productId?: number }) {
    const updates: any = {};
    if (data.qty !== undefined) updates.qty = data.qty;
    if (data.unitCostBase !== undefined) {
      updates.unitCostBase = String(data.unitCostBase);
    }
    if (data.variantId !== undefined) updates.variantId = data.variantId;
    if (data.productId !== undefined) updates.productId = data.productId;
    if (data.qty !== undefined || data.unitCostBase !== undefined) {
      const current = await db.select().from(purchaseItems).where(eq(purchaseItems.id, id)).then(r => r[0]);
      if (current) {
        const qty = data.qty ?? current.qty;
        const cost = data.unitCostBase !== undefined ? data.unitCostBase : parseFloat(current.unitCostBase || "0");
        updates.lineSubtotal = String(qty * cost);
      }
    }
    const [row] = await db.update(purchaseItems).set(updates).where(eq(purchaseItems.id, id)).returning();
    return row;
  }

  async deletePurchaseItem(id: number) {
    await db.delete(purchaseItems).where(eq(purchaseItems.id, id));
  }

  async updateSupplier(id: number, data: Partial<InsertSupplier>) {
    const [row] = await db.update(suppliers).set(data).where(eq(suppliers.id, id)).returning();
    return row;
  }

  async createSupplierPayment(supplierId: number, data: { amount: number; method: PaymentMethod; note?: string; branchId: number; createdBy: number }) {
    const supplier = await this.getSupplier(supplierId);
    if (!supplier) throw new Error("المورد غير موجود");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Update supplier balance
      await client.query(
        `UPDATE suppliers SET balance = COALESCE(balance, 0) - $1 WHERE id = $2`,
        [data.amount.toFixed(3), supplierId]
      );

      // Log to cash/bank ledger
      const todayStr = new Date().toISOString().slice(0, 10);
      if (data.method === "cash") {
        await client.query(
          `INSERT INTO cash_ledger (date, branch_id, type, amount_out, category, note, created_by, created_at)
           VALUES ($1, $2, 'SUPPLIER_PAYMENT', $3, 'Purchases', $4, $5, now())`,
          [todayStr, data.branchId, data.amount.toFixed(3), data.note || `دفع للمورد: ${supplier.name}`, data.createdBy]
        );
      } else {
        await client.query(
          `INSERT INTO bank_ledger (date, branch_id, method, amount_out, category, note, created_by, created_at)
           VALUES ($1, $2, $3, $4, 'Purchases', $5, $6, now())`,
          [todayStr, data.branchId, data.method, data.amount.toFixed(3), data.note || `دفع للمورد: ${supplier.name}`, data.createdBy]
        );
      }

      await client.query("COMMIT");
      return { success: true };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
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

    const marginRow = await pool.query(`SELECT value FROM settings WHERE key = 'default_profit_margin'`);
    const profitMargin = parseFloat(marginRow.rows[0]?.value || "50") / 100;

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

          const suggestedPrice = unitCostFinal * (1 + profitMargin);
          await client.query(
            `UPDATE products SET stock_qty = $1, avg_cost = $2, last_purchase_price = $3, price = $4 WHERE id = $5`,
            [newQty, newAvgCost.toFixed(3), unitCostFinal.toFixed(3), suggestedPrice.toFixed(3), item.productId]
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
           (now(), NULL, NULL, $1,
            $2, 'PURCHASE', $3,
            'purchase_invoices', $4,
            'اعتماد فاتورة شراء', $5, now())`,
          [centralLocationId, item.productId, item.qty, id, invoice.createdBy]
        );

        let variantId = item.variantId;
        if (!variantId) {
          const existingVar = await client.query(
            `SELECT id FROM product_variants WHERE product_id = $1 LIMIT 1`,
            [item.productId]
          );
          if (existingVar.rows.length > 0) {
            variantId = existingVar.rows[0].id;
          } else {
            const prodName = await client.query(`SELECT name, barcode FROM products WHERE id = $1`, [item.productId]);
            const pName = prodName.rows[0]?.name || `Product-${item.productId}`;
            const sku = `SKU-${item.productId}-${Date.now()}`;
            const newVar = await client.query(
              `INSERT INTO product_variants (product_id, sku, barcode, color, size, cost_default, price, active)
               VALUES ($1, $2, $3, '', '', $4, $4, true) RETURNING id`,
              [item.productId, sku, prodName.rows[0]?.barcode || null, unitCostFinal.toFixed(3)]
            );
            variantId = newVar.rows[0].id;
          }
          await client.query(
            `UPDATE purchase_items SET variant_id = $1 WHERE id = $2`,
            [variantId, item.id]
          );
        }

        const suggestedVariantPrice = unitCostFinal * (1 + profitMargin);
        await client.query(
          `UPDATE product_variants 
           SET last_purchase_price = $1, last_receipt_date = now(), cost_default = $1, price = $2
           WHERE id = $3`,
          [unitCostFinal.toFixed(3), suggestedVariantPrice.toFixed(3), variantId]
        );

        await client.query(
          `INSERT INTO inventory_balances (location_id, variant_id, qty_on_hand, qty_reserved)
           VALUES ($1, $2, $3, 0)
           ON CONFLICT (location_id, variant_id)
           DO UPDATE SET qty_on_hand = inventory_balances.qty_on_hand + EXCLUDED.qty_on_hand`,
          [centralLocationId, variantId, item.qty]
        );
        await client.query(
          `INSERT INTO inventory_ledger (variant_id, location_id, qty_change, reason, ref_table, ref_id, created_by, created_at)
           VALUES ($1, $2, $3, 'purchase_posted', 'purchase_invoices', $4, $5, now())`,
          [variantId, centralLocationId, item.qty, id, invoice.createdBy]
        );
      }

      await client.query(
        `UPDATE suppliers 
         SET total_purchases = COALESCE(total_purchases, 0) + $1, 
             balance = COALESCE(balance, 0) + $1 
         WHERE id = $2`,
        [grandTotal.toFixed(3), invoice.supplierId]
      );

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

  async receivePurchaseInvoice(id: number): Promise<PurchaseInvoice> {
    const invoice = await this.getPurchaseInvoice(id);
    if (!invoice) throw new Error("الفاتورة غير موجودة");
    if (invoice.status === "received") throw new Error("الفاتورة مستلمة مسبقاً");
    if (invoice.status !== "approved") throw new Error("يجب اعتماد الفاتورة أولاً قبل الاستلام");

    const items = await db.select().from(purchaseItems).where(eq(purchaseItems.purchaseId, id));
    if (items.length === 0) throw new Error("لا يوجد أصناف في الفاتورة");

    const totalAmount = items.reduce((s, it) => s + (it.qty * parseFloat(it.unitCostBase)), 0);
    const totalExtraCost =
      parseFloat(invoice.shippingCost || "0") +
      parseFloat(invoice.customsCost || "0") +
      parseFloat(invoice.clearanceCost || "0") +
      parseFloat(invoice.otherCost || "0");
    const grandTotal = totalAmount + totalExtraCost;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const result = await client.query(
        `UPDATE purchase_invoices
         SET status = 'received', total_amount = $1, grand_total = $2, received_at = now()
         WHERE id = $3 AND status = 'approved'
         RETURNING *`,
        [totalAmount.toFixed(3), grandTotal.toFixed(3), id]
      );

      if (result.rows.length === 0) {
        throw new Error("فشل تحديث حالة الفاتورة");
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
    let query = `
      SELECT l.*, b.name as branch_name
      FROM locations l
      LEFT JOIN branches b ON b.id = l.branch_id
    `;
    const params: any[] = [];
    if (branchId) {
      query += ` WHERE l.branch_id = $1`;
      params.push(branchId);
    }
    query += ` ORDER BY l.is_central DESC, b.name, l.name`;
    const result = await pool.query(query, params);
    return result.rows.map((r: any) => ({
      id: r.id,
      branchId: r.branch_id,
      code: r.code,
      name: r.name,
      type: r.type,
      isMain: r.is_main,
      kind: r.kind,
      isCentral: r.is_central,
      isBranchDefault: r.is_branch_default,
      active: r.active,
      branchName: r.branch_name,
    }));
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

  async getEmployeePerformance(employeeId: number, from: string, to: string) {
    const fromDate = new Date(from + "T00:00:00");
    const toDate = new Date(to + "T23:59:59.999");

    const [posSales] = await db.select({
      count: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${sales.total}::numeric), 0)::text`,
      cogs: sql<string>`coalesce(sum(${sales.cogsTotal}::numeric), 0)::text`,
      profit: sql<string>`coalesce(sum(${sales.grossProfit}::numeric), 0)::text`,
    }).from(sales).where(
      and(eq(sales.cashierId, employeeId), sql`${sales.createdAt} >= ${fromDate}`, sql`${sales.createdAt} <= ${toDate}`)
    );

    const [ordSales] = await db.select({
      count: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${orders.total}::numeric), 0)::text`,
      cogs: sql<string>`coalesce(sum(${orders.cogsTotal}::numeric), 0)::text`,
      profit: sql<string>`coalesce(sum(${orders.grossProfit}::numeric), 0)::text`,
    }).from(orders).where(
      and(eq(orders.employeeId, employeeId), eq(orders.status, "paid"), sql`${orders.paidAt} >= ${fromDate}`, sql`${orders.paidAt} <= ${toDate}`)
    );

    const [expData] = await db.select({
      count: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${expenses.amount}::numeric), 0)::text`,
    }).from(expenses).where(
      and(eq(expenses.createdBy, employeeId), sql`${expenses.date} >= ${from}`, sql`${expenses.date} <= ${to}`)
    );

    const shiftRows = await db.select({
      count: sql<number>`count(*)::int`,
      totalDiff: sql<string>`coalesce(sum(${shifts.difference}::numeric), 0)::text`,
    }).from(shifts).where(
      and(eq(shifts.cashierId, employeeId), eq(shifts.status, "closed"), sql`${shifts.startedAt} >= ${fromDate}`, sql`${shifts.startedAt} <= ${toDate}`)
    );

    const totalSales = parseFloat(posSales.total) + parseFloat(ordSales.total);
    const totalCogs = parseFloat(posSales.cogs) + parseFloat(ordSales.cogs);
    const totalProfit = parseFloat(posSales.profit) + parseFloat(ordSales.profit);
    const totalCount = posSales.count + ordSales.count;

    return {
      salesCount: totalCount,
      salesTotal: totalSales.toFixed(3),
      cogsTotal: totalCogs.toFixed(3),
      grossProfit: totalProfit.toFixed(3),
      margin: totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : "0.0",
      expensesCount: expData.count,
      expensesTotal: expData.total,
      shiftsCount: shiftRows[0]?.count || 0,
      shiftsDifference: shiftRows[0]?.totalDiff || "0.000",
      posSalesCount: posSales.count,
      posSalesTotal: posSales.total,
      ordersSalesCount: ordSales.count,
      ordersSalesTotal: ordSales.total,
    };
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

  async getOverviewReport(from: string, to: string, branchId?: number) {
    const fromDate = new Date(from + "T00:00:00");
    const toDate = new Date(to + "T23:59:59.999");

    const saleBranchFilter = branchId ? eq(sales.branchId, branchId) : undefined;
    const orderBranchFilter = branchId ? eq(orders.branchId, branchId) : undefined;
    const expBranchFilter = branchId ? eq(expenses.branchId, branchId) : undefined;
    const shiftBranchFilter = branchId ? eq(shifts.branchId, branchId) : undefined;

    const querySaleSum = async (pm?: string) => {
      const conds: any[] = [sql`${sales.createdAt} >= ${fromDate}`, sql`${sales.createdAt} <= ${toDate}`];
      if (saleBranchFilter) conds.push(saleBranchFilter);
      if (pm) conds.push(eq(sales.paymentMethod, pm));
      const [row] = await db.select({
        total: sql<string>`coalesce(sum(${sales.total}::numeric), 0)::text`,
        count: sql<number>`count(*)::int`,
        cogs: sql<string>`coalesce(sum(${sales.cogsTotal}::numeric), 0)::text`,
      }).from(sales).where(and(...conds));
      return row;
    };

    const queryOrderSum = async (pm?: string) => {
      const conds: any[] = [eq(orders.status, "paid"), sql`${orders.createdAt} >= ${fromDate}`, sql`${orders.createdAt} <= ${toDate}`];
      if (orderBranchFilter) conds.push(orderBranchFilter);
      if (pm) conds.push(eq(orders.paymentMethod, pm));
      const [row] = await db.select({
        total: sql<string>`coalesce(sum(${orders.total}::numeric), 0)::text`,
        count: sql<number>`count(*)::int`,
        cogs: sql<string>`coalesce(sum(${orders.cogsTotal}::numeric), 0)::text`,
      }).from(orders).where(and(...conds));
      return row;
    };

    const [cashS, cardS, bankS] = await Promise.all([querySaleSum("cash"), querySaleSum("card"), querySaleSum("bank_transfer")]);
    const [cashO, cardO, bankO] = await Promise.all([queryOrderSum("cash"), queryOrderSum("card"), queryOrderSum("bank_transfer")]);
    const [allS] = await Promise.all([querySaleSum()]);
    const [allO] = await Promise.all([queryOrderSum()]);

    const salesCash = parseFloat(cashS.total) + parseFloat(cashO.total);
    const salesCard = parseFloat(cardS.total) + parseFloat(cardO.total);
    const salesBank = parseFloat(bankS.total) + parseFloat(bankO.total);
    const totalSales = parseFloat(allS.total) + parseFloat(allO.total);
    const totalCogs = parseFloat(allS.cogs) + parseFloat(allO.cogs);
    const grossProfit = totalSales - totalCogs;
    const invoiceCount = allS.count + allO.count;

    const [cashExp] = await db.select({
      total: sql<string>`coalesce(sum(${expenses.amount}::numeric), 0)::text`,
      count: sql<number>`count(*)::int`,
    }).from(expenses).where(and(eq(expenses.source, "cash"), sql`${expenses.date} >= ${from}`, sql`${expenses.date} <= ${to}`, expBranchFilter));

    const [bankExp] = await db.select({
      total: sql<string>`coalesce(sum(${expenses.amount}::numeric), 0)::text`,
      count: sql<number>`count(*)::int`,
    }).from(expenses).where(and(sql`${expenses.source} != 'cash'`, sql`${expenses.date} >= ${from}`, sql`${expenses.date} <= ${to}`, expBranchFilter));

    const totalExpenses = parseFloat(cashExp.total) + parseFloat(bankExp.total);
    const netProfit = grossProfit - totalExpenses;

    const dayShifts = await db.select().from(shifts).where(
      and(sql`${shifts.startedAt} >= ${fromDate}`, sql`${shifts.startedAt} <= ${toDate}`, shiftBranchFilter)
    ).orderBy(shifts.startedAt);

    const sumOpeningCash = dayShifts.reduce((s, sh) => s + parseFloat(sh.openingCash || "0"), 0);
    const cashClosingBalance = sumOpeningCash + salesCash - parseFloat(cashExp.total);
    const sumDifferences = dayShifts.filter(s => s.status === "closed" && s.difference).reduce((s, sh) => s + parseFloat(sh.difference || "0"), 0);

    return {
      from, to, branchId: branchId || null,
      totalSales: totalSales.toFixed(3),
      cogsTotal: totalCogs.toFixed(3),
      grossProfit: grossProfit.toFixed(3),
      totalExpenses: totalExpenses.toFixed(3),
      netProfit: netProfit.toFixed(3),
      invoiceCount,
      salesCash: { total: salesCash.toFixed(3), count: cashS.count + cashO.count },
      salesCard: { total: salesCard.toFixed(3), count: cardS.count + cardO.count },
      salesBankTransfer: { total: salesBank.toFixed(3), count: bankS.count + bankO.count },
      expensesCash: { total: cashExp.total, count: cashExp.count },
      expensesBank: { total: bankExp.total, count: bankExp.count },
      openingCash: sumOpeningCash.toFixed(3),
      cashClosingBalance: cashClosingBalance.toFixed(3),
      differencesSum: sumDifferences.toFixed(3),
      shiftsCount: dayShifts.length,
    };
  }

  async getSalesListReport(from: string, to: string, branchId?: number, paymentMethod?: string) {
    const fromDate = new Date(from + "T00:00:00");
    const toDate = new Date(to + "T23:59:59.999");

    const saleConds: any[] = [sql`${sales.createdAt} >= ${fromDate}`, sql`${sales.createdAt} <= ${toDate}`];
    if (branchId) saleConds.push(eq(sales.branchId, branchId));
    if (paymentMethod) saleConds.push(eq(sales.paymentMethod, paymentMethod));

    const saleRows = await db.select({
      id: sales.id,
      invoiceNumber: sales.invoiceNumber,
      branchId: sales.branchId,
      shiftId: sales.shiftId,
      cashierId: sales.cashierId,
      cashierName: users.name,
      subtotal: sales.subtotal,
      discount: sales.discount,
      vat: sales.vat,
      total: sales.total,
      paymentMethod: sales.paymentMethod,
      bankTxnId: sales.bankTxnId,
      cogsTotal: sales.cogsTotal,
      grossProfit: sales.grossProfit,
      createdAt: sales.createdAt,
    }).from(sales)
      .leftJoin(users, eq(sales.cashierId, users.id))
      .where(and(...saleConds))
      .orderBy(desc(sales.createdAt));

    const allBranches = await db.select().from(branches);
    const branchMap = Object.fromEntries(allBranches.map(b => [b.id, b.name]));

    const rows = saleRows.map(s => ({
      type: "sale" as const,
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      branchName: branchMap[s.branchId] || "",
      branchId: s.branchId,
      shiftId: s.shiftId,
      cashierName: s.cashierName || "",
      subtotal: s.subtotal,
      discount: s.discount,
      vat: s.vat,
      total: s.total,
      paymentMethod: s.paymentMethod,
      bankTxnId: s.bankTxnId,
      cogsTotal: s.cogsTotal,
      grossProfit: s.grossProfit,
      createdAt: s.createdAt,
    }));

    const totalSales = rows.reduce((s, r) => s + parseFloat(String(r.total || "0")), 0);
    const totalDiscount = rows.reduce((s, r) => s + parseFloat(String(r.discount || "0")), 0);
    const totalVat = rows.reduce((s, r) => s + parseFloat(String(r.vat || "0")), 0);

    return {
      rows,
      summary: {
        count: rows.length,
        totalSales: totalSales.toFixed(3),
        totalDiscount: totalDiscount.toFixed(3),
        totalVat: totalVat.toFixed(3),
      }
    };
  }

  async getCategoriesReport(from: string, to: string, branchId?: number) {
    const fromDate = new Date(from + "T00:00:00");
    const toDate = new Date(to + "T23:59:59.999");

    const siConds: any[] = [sql`${sales.createdAt} >= ${fromDate}`, sql`${sales.createdAt} <= ${toDate}`];
    if (branchId) siConds.push(eq(sales.branchId, branchId));

    const oiConds: any[] = [eq(orders.status, "paid"), sql`${orders.createdAt} >= ${fromDate}`, sql`${orders.createdAt} <= ${toDate}`];
    if (branchId) oiConds.push(eq(orders.branchId, branchId));

    const siRows = await db.select({
      categoryId: products.categoryId,
      categoryName: categories.name,
      qtySold: sql<number>`coalesce(sum(${saleItems.quantity}), 0)::int`,
      revenue: sql<string>`coalesce(sum(${saleItems.total}::numeric), 0)::text`,
      cogs: sql<string>`coalesce(sum(${saleItems.lineCogs}::numeric), 0)::text`,
    }).from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(products, eq(saleItems.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(...siConds))
      .groupBy(products.categoryId, categories.name);

    const oiRows = await db.select({
      categoryId: products.categoryId,
      categoryName: categories.name,
      qtySold: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
      revenue: sql<string>`coalesce(sum(${orderItems.total}::numeric), 0)::text`,
      cogs: sql<string>`coalesce(sum(${orderItems.lineCogs}::numeric), 0)::text`,
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(...oiConds))
      .groupBy(products.categoryId, categories.name);

    const catMap = new Map<number | null, { name: string; qtySold: number; revenue: number; cogs: number }>();
    for (const row of [...siRows, ...oiRows]) {
      const key = row.categoryId;
      const existing = catMap.get(key) || { name: row.categoryName || "—", qtySold: 0, revenue: 0, cogs: 0 };
      existing.qtySold += row.qtySold;
      existing.revenue += parseFloat(row.revenue);
      existing.cogs += parseFloat(row.cogs);
      catMap.set(key, existing);
    }

    return Array.from(catMap.entries()).map(([catId, data]) => {
      const profit = data.revenue - data.cogs;
      const margin = data.revenue > 0 ? ((profit / data.revenue) * 100) : 0;
      return {
        categoryId: catId,
        categoryName: data.name,
        qtySold: data.qtySold,
        revenue: data.revenue.toFixed(3),
        cogs: data.cogs.toFixed(3),
        profit: profit.toFixed(3),
        margin: margin.toFixed(1),
      };
    }).sort((a, b) => parseFloat(b.revenue) - parseFloat(a.revenue));
  }

  async getPaymentsReport(from: string, to: string, branchId?: number) {
    const fromDate = new Date(from + "T00:00:00");
    const toDate = new Date(to + "T23:59:59.999");

    const saleConds: any[] = [sql`${sales.createdAt} >= ${fromDate}`, sql`${sales.createdAt} <= ${toDate}`];
    if (branchId) saleConds.push(eq(sales.branchId, branchId));

    const orderConds: any[] = [eq(orders.status, "paid"), sql`${orders.createdAt} >= ${fromDate}`, sql`${orders.createdAt} <= ${toDate}`];
    if (branchId) orderConds.push(eq(orders.branchId, branchId));

    const saleByMethod = await db.select({
      method: sales.paymentMethod,
      total: sql<string>`coalesce(sum(${sales.total}::numeric), 0)::text`,
      count: sql<number>`count(*)::int`,
    }).from(sales).where(and(...saleConds)).groupBy(sales.paymentMethod);

    const orderByMethod = await db.select({
      method: orders.paymentMethod,
      total: sql<string>`coalesce(sum(${orders.total}::numeric), 0)::text`,
      count: sql<number>`count(*)::int`,
    }).from(orders).where(and(...orderConds)).groupBy(orders.paymentMethod);

    const methodMap = new Map<string, { total: number; count: number }>();
    for (const row of [...saleByMethod, ...orderByMethod]) {
      const key = row.method || "cash";
      const existing = methodMap.get(key) || { total: 0, count: 0 };
      existing.total += parseFloat(row.total);
      existing.count += row.count;
      methodMap.set(key, existing);
    }

    const grandTotal = Array.from(methodMap.values()).reduce((s, v) => s + v.total, 0);

    const methods = Array.from(methodMap.entries()).map(([method, data]) => ({
      method,
      total: data.total.toFixed(3),
      count: data.count,
      percentage: grandTotal > 0 ? ((data.total / grandTotal) * 100).toFixed(1) : "0.0",
    }));

    const allBranches = await db.select().from(branches);
    const branchMap = Object.fromEntries(allBranches.map(b => [b.id, b.name]));

    const transactions = await db.select({
      id: sales.id,
      invoiceNumber: sales.invoiceNumber,
      branchId: sales.branchId,
      method: sales.paymentMethod,
      total: sales.total,
      bankTxnId: sales.bankTxnId,
      createdAt: sales.createdAt,
      cashierName: users.name,
    }).from(sales)
      .leftJoin(users, eq(sales.cashierId, users.id))
      .where(and(...saleConds))
      .orderBy(desc(sales.createdAt))
      .limit(200);

    const txnRows = transactions.map(t => ({
      id: t.id,
      invoiceNumber: t.invoiceNumber,
      branchName: branchMap[t.branchId] || "",
      method: t.method,
      total: t.total,
      bankTxnId: t.bankTxnId,
      createdAt: t.createdAt,
      cashierName: t.cashierName || "",
    }));

    return { methods, transactions: txnRows, grandTotal: grandTotal.toFixed(3) };
  }

  async getShiftsReport(from: string, to: string, branchId?: number) {
    const fromDate = new Date(from + "T00:00:00");
    const toDate = new Date(to + "T23:59:59.999");

    const conds: any[] = [sql`${shifts.startedAt} >= ${fromDate}`, sql`${shifts.startedAt} <= ${toDate}`];
    if (branchId) conds.push(eq(shifts.branchId, branchId));

    const rows = await db.select({
      id: shifts.id,
      branchId: shifts.branchId,
      cashierId: shifts.cashierId,
      cashierName: users.name,
      terminalName: shifts.terminalName,
      startedAt: shifts.startedAt,
      endedAt: shifts.endedAt,
      status: shifts.status,
      openingCash: shifts.openingCash,
      expectedCash: shifts.expectedCash,
      actualCash: shifts.actualCash,
      difference: shifts.difference,
      totalSales: shifts.totalSales,
      totalCash: shifts.totalCash,
      totalBank: shifts.totalBank,
    }).from(shifts)
      .leftJoin(users, eq(shifts.cashierId, users.id))
      .where(and(...conds))
      .orderBy(desc(shifts.startedAt));

    const allBranches = await db.select().from(branches);
    const branchMap = Object.fromEntries(allBranches.map(b => [b.id, b.name]));

    return rows.map(s => ({
      ...s,
      branchName: branchMap[s.branchId] || "",
    }));
  }

  async getShiftDetails(shiftId: number) {
    const report = await this.getShiftReport(shiftId);
    if (!report) return null;

    const shiftSales = await db.select({
      id: sales.id,
      invoiceNumber: sales.invoiceNumber,
      total: sales.total,
      paymentMethod: sales.paymentMethod,
      createdAt: sales.createdAt,
    }).from(sales).where(eq(sales.shiftId, shiftId)).orderBy(sales.createdAt);

    const shiftExpenses = await db.select({
      id: expenses.id,
      category: expenses.category,
      amount: expenses.amount,
      source: expenses.source,
      note: expenses.note,
      date: expenses.date,
    }).from(expenses).where(eq(expenses.shiftId, shiftId)).orderBy(expenses.date);

    return { ...report, sales: shiftSales, expenses: shiftExpenses };
  }

  async getBranchComparisonRange(from: string, to: string) {
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
          sql`${orders.createdAt} >= ${fromDate}`, sql`${orders.createdAt} <= ${toDate}`)
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
        and(eq(expenses.branchId, branch.id), sql`${expenses.date} >= ${from}`, sql`${expenses.date} <= ${to}`)
      );

      const totalSales = parseFloat(ordSales.total) + parseFloat(posSales.total);
      const totalCogs = parseFloat(ordSales.cogs) + parseFloat(posSales.cogs);
      const grossProfit = totalSales - totalCogs;
      const totalExpenses = parseFloat(expRow.total);
      const netProfit = grossProfit - totalExpenses;
      const margin = totalSales > 0 ? ((netProfit / totalSales) * 100) : 0;

      results.push({
        branchId: branch.id,
        branchName: branch.name,
        totalSales: totalSales.toFixed(3),
        cogsTotal: totalCogs.toFixed(3),
        grossProfit: grossProfit.toFixed(3),
        totalExpenses: totalExpenses.toFixed(3),
        netProfit: netProfit.toFixed(3),
        margin: margin.toFixed(1),
      });
    }

    return { from, to, branches: results };
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

    const [branch] = await db.select({ name: branches.name }).from(branches).where(eq(branches.id, branchId));
    const branchName = branch?.name || `فرع ${branchId}`;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const transferRes = await client.query(
        `INSERT INTO location_transfers (branch_id, from_location_id, to_location_id, note, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, now()) RETURNING id`,
        [branchId, fromLocationId, toLocationId, `تحويل من المخزن المركزي إلى ${branchName}`, createdBy]
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
          [branchId, fromLocationId, item.productId, item.qty, transferId, `صادر من المخزن المركزي إلى ${branchName}`, createdBy]
        );

        await client.query(
          `INSERT INTO inventory_transactions
           (date, branch_id, from_location_id, to_location_id, product_id, type, qty, ref_table, ref_id, note, created_by, created_at)
           VALUES (now(), $1, NULL, $2, $3, 'TRANSFER_IN', $4, 'location_transfers', $5, $6, $7, now())`,
          [branchId, toLocationId, item.productId, item.qty, transferId, `وارد من المخزن المركزي إلى ${branchName}`, createdBy]
        );

        await client.query(
          `INSERT INTO stock_movements (product_id, branch_id, quantity, movement_type, reference_id, created_at)
           VALUES ($1, 0, $2, 'transfer_out', $3, now())`,
          [item.productId, -item.qty, transferId]
        );

        await client.query(
          `INSERT INTO stock_movements (product_id, branch_id, quantity, movement_type, reference_id, created_at)
           VALUES ($1, $2, $3, 'transfer_in', $4, now())`,
          [item.productId, branchId, item.qty, transferId]
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

  async createSaleReturn(data: InsertSaleReturn, items: InsertSaleReturnItem[]) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const sale = await this.getSale(data.saleId);
      if (!sale) throw new Error("الفاتورة غير موجودة");

      const branchLocRes = await client.query(
        `SELECT id FROM locations WHERE branch_id = $1 AND is_branch_default = true ORDER BY id LIMIT 1`,
        [data.branchId]
      );
      if (branchLocRes.rows.length === 0) throw new Error("لا يوجد مخزن افتراضي للفرع");
      const branchLocationId = branchLocRes.rows[0].id;

      const retRes = await client.query(
        `INSERT INTO sale_returns (return_number, sale_id, branch_id, shift_id, refund_amount, refund_method, cogs_returned, reason, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [data.returnNumber, data.saleId, data.branchId, data.shiftId || null,
         data.refundAmount, data.refundMethod || "cash", "0", data.reason || null, data.createdBy || null]
      );
      const ret = retRes.rows[0];
      const returnId = ret.id;

      let totalCogs = 0;

      for (const item of items) {
        const saleItemRes = await client.query(
          `SELECT * FROM sale_items WHERE id = $1`,
          [item.saleItemId]
        );
        if (saleItemRes.rows.length === 0) throw new Error(`عنصر البيع غير موجود: ${item.saleItemId}`);
        const si = saleItemRes.rows[0];

        const unitCost = parseFloat(si.unit_cost_at_sale || "0");
        const lineCogs = unitCost * item.quantity;
        totalCogs += lineCogs;

        await client.query(
          `INSERT INTO sale_return_items (return_id, sale_item_id, product_id, quantity, unit_price, unit_cost, line_total, line_cogs)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [returnId, item.saleItemId, item.productId, item.quantity, item.unitPrice, unitCost.toFixed(3), item.lineTotal, lineCogs.toFixed(3)]
        );

        // Update variant-based inventory_balances
        const variantRes = await client.query(
          `SELECT pv.id as variant_id FROM product_variants pv WHERE pv.product_id = $1 ORDER BY pv.id LIMIT 1`,
          [item.productId]
        );
        const variantId = variantRes.rows[0]?.variant_id;
        if (variantId) {
          await client.query(`
            INSERT INTO inventory_balances (location_id, variant_id, qty_on_hand, qty_reserved)
            VALUES ($1, $2, $3, 0)
            ON CONFLICT (location_id, variant_id) DO UPDATE SET qty_on_hand = inventory_balances.qty_on_hand + $3
          `, [branchLocationId, variantId, item.quantity]);

          await client.query(`
            INSERT INTO inventory_ledger (variant_id, location_id, qty_change, reason, ref_table, ref_id, created_by)
            VALUES ($1, $2, $3, 'return', 'sale_returns', $4, $5)
          `, [variantId, branchLocationId, item.quantity, returnId, data.createdBy || null]);
        }

        // Also sync old location_inventory for backward compatibility
        await client.query(
          `UPDATE location_inventory SET qty_on_hand = qty_on_hand + $1, updated_at = now()
           WHERE location_id = $2 AND product_id = $3`,
          [item.quantity, branchLocationId, item.productId]
        );

        const invCheck = await client.query(
          `SELECT id FROM location_inventory WHERE location_id = $1 AND product_id = $2`,
          [branchLocationId, item.productId]
        );
        if (invCheck.rows.length === 0) {
          await client.query(
            `INSERT INTO location_inventory (location_id, product_id, qty_on_hand) VALUES ($1, $2, $3)`,
            [branchLocationId, item.productId, item.quantity]
          );
        }

        await client.query(
          `INSERT INTO inventory_transactions
           (date, branch_id, from_location_id, to_location_id, product_id, type, qty, ref_table, ref_id, note, created_by, created_at)
           VALUES (now(), $1, NULL, $2, $3, 'RETURN', $4, 'sale_returns', $5, $6, $7, now())`,
          [data.branchId, branchLocationId, item.productId, item.quantity, returnId,
           `مرتجع فاتورة ${sale.invoiceNumber}`, data.createdBy || null]
        );
      }

      await client.query(
        `UPDATE sale_returns SET cogs_returned = $1 WHERE id = $2`,
        [totalCogs.toFixed(3), returnId]
      );

      await client.query("COMMIT");

      const todayStr = new Date().toISOString().slice(0, 10);
      const refundAmount = data.refundAmount;
      const pm = data.refundMethod || "cash";

      if (pm === "cash") {
        await this.addCashLedgerEntry({
          date: todayStr,
          branchId: data.branchId,
          shiftId: data.shiftId ?? null,
          type: "sale_return",
          amountIn: "0",
          amountOut: refundAmount,
          category: "return",
          note: `مرتجع مبيعات - فاتورة ${sale.invoiceNumber} - مرتجع #${ret.return_number}`,
          createdBy: data.createdBy ?? null,
        });
      } else {
        await this.addBankLedgerEntry({
          date: todayStr,
          branchId: data.branchId,
          shiftId: data.shiftId ?? null,
          method: pm,
          amountIn: "0",
          amountOut: refundAmount,
          refId: null,
          category: "return",
          note: `مرتجع مبيعات - فاتورة ${sale.invoiceNumber} - مرتجع #${ret.return_number}`,
          createdBy: data.createdBy ?? null,
        });
      }

      await this.addAuditLog({
        action: "sale_return",
        entityType: "sale_return",
        entityId: returnId,
        branchId: data.branchId,
        userId: data.createdBy ?? null,
        userName: null,
        details: `مرتجع مبيعات بقيمة ${refundAmount} - فاتورة #${sale.invoiceNumber} - السبب: ${data.reason || "لم يحدد"}`,
        oldValue: null,
        newValue: JSON.stringify({ returnId, saleId: data.saleId, refundAmount, itemsCount: items.length }),
      });

      const [updated] = await db.select().from(saleReturns).where(eq(saleReturns.id, returnId));
      return updated;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async getSaleReturns(branchId?: number) {
    let query = `
      SELECT sr.*, s.invoice_number, u.name as created_by_name, b.name as branch_name,
             (SELECT json_agg(json_build_object(
                'id', sri.id, 'productId', sri.product_id, 'productName', p.name,
                'quantity', sri.quantity, 'unitPrice', sri.unit_price, 'lineTotal', sri.line_total
             )) FROM sale_return_items sri
             JOIN products p ON p.id = sri.product_id
             WHERE sri.return_id = sr.id) as items
      FROM sale_returns sr
      JOIN sales s ON s.id = sr.sale_id
      LEFT JOIN users u ON u.id = sr.created_by
      JOIN branches b ON b.id = sr.branch_id
    `;
    const params: any[] = [];
    if (branchId) {
      query += ` WHERE sr.branch_id = $1`;
      params.push(branchId);
    }
    query += ` ORDER BY sr.created_at DESC LIMIT 200`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  async getSaleReturn(id: number) {
    const [row] = await db.select().from(saleReturns).where(eq(saleReturns.id, id));
    return row;
  }

  async getSaleReturnItems(returnId: number) {
    return db.select().from(saleReturnItems).where(eq(saleReturnItems.returnId, returnId));
  }

  async cancelOrderFull(orderId: number, userId: number, userName: string, reason: string) {
    const order = await this.getOrder(orderId);
    if (!order) return undefined;

    const oldStatus = order.status;

    // Restore inventory if it was already deducted (only happens after completed)
    if (oldStatus === "completed") {
      await this.restoreOrderInventory(orderId, userId);
    }

    if (order.status === "paid") {
      const todayStr = new Date().toISOString().slice(0, 10);
      const amount = order.total || "0";
      const pm = order.paymentMethod || "cash";

      if (pm === "cash") {
        await this.addCashLedgerEntry({
          date: todayStr,
          branchId: order.branchId!,
          shiftId: order.shiftId,
          type: "order_cancel_refund",
          amountIn: "0",
          amountOut: amount,
          category: "cancel",
          note: `إلغاء طلب مدفوع ${order.orderNumber} - ${reason}`,
          createdBy: userId,
        });
      } else {
        await this.addBankLedgerEntry({
          date: todayStr,
          branchId: order.branchId!,
          shiftId: order.shiftId,
          method: pm,
          amountIn: "0",
          amountOut: amount,
          refId: null,
          category: "cancel",
          note: `إلغاء طلب مدفوع ${order.orderNumber} - ${reason}`,
          createdBy: userId,
        });
      }
    }

    const [updated] = await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, orderId)).returning();

    await this.addAuditLog({
      action: "order_cancel",
      entityType: "order",
      entityId: orderId,
      branchId: order.branchId ?? null,
      userId,
      userName,
      details: `إلغاء طلب ${order.orderNumber} - السبب: ${reason}`,
      oldValue: JSON.stringify({ status: oldStatus, total: order.total }),
      newValue: JSON.stringify({ status: "cancelled" }),
    });

    return updated;
  }

  async addAuditLog(data: InsertAuditLog) {
    const [row] = await db.insert(auditLog).values(data).returning();
    return row;
  }

  async getAuditLogs(filters?: { entityType?: string; branchId?: number; from?: string; to?: string }) {
    let query = `
      SELECT al.*, u.name as actor_name, b.name as branch_name
      FROM audit_log al
      LEFT JOIN users u ON u.id = al.user_id
      LEFT JOIN branches b ON b.id = al.branch_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIdx = 1;

    if (filters?.entityType) {
      query += ` AND al.entity_type = $${paramIdx++}`;
      params.push(filters.entityType);
    }
    if (filters?.branchId) {
      query += ` AND al.branch_id = $${paramIdx++}`;
      params.push(filters.branchId);
    }
    if (filters?.from) {
      query += ` AND al.created_at >= $${paramIdx++}::timestamp`;
      params.push(filters.from + " 00:00:00");
    }
    if (filters?.to) {
      query += ` AND al.created_at <= $${paramIdx++}::timestamp`;
      params.push(filters.to + " 23:59:59.999");
    }

    query += ` ORDER BY al.created_at DESC LIMIT 500`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  async getPayrollRuns(filters?: { branchId?: number; month?: string; year?: number; status?: string }) {
    let query = `
      SELECT pr.*, u1.name as creator_name, u2.name as approver_name,
             u3.name as reviewer_name, u4.name as cancelled_by_name,
             COALESCE((SELECT SUM(sp.amount) FROM salary_payments sp WHERE sp.payroll_id = pr.id), 0) as total_paid
      FROM payroll_runs pr
      LEFT JOIN users u1 ON u1.id = pr.created_by
      LEFT JOIN users u2 ON u2.id = pr.approved_by
      LEFT JOIN users u3 ON u3.id = pr.reviewed_by
      LEFT JOIN users u4 ON u4.id = pr.cancelled_by
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;
    if (filters?.month) { query += ` AND pr.month = $${idx++}`; params.push(filters.month); }
    if (filters?.year) { query += ` AND pr.year = $${idx++}`; params.push(filters.year); }
    if (filters?.status) { query += ` AND pr.status = $${idx++}`; params.push(filters.status); }
    query += ` ORDER BY pr.year DESC, pr.month DESC`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  async getPayrollRun(id: number) {
    const [row] = await db.select().from(payrollRuns).where(eq(payrollRuns.id, id));
    return row;
  }

  async createPayrollRun(data: InsertPayrollRun) {
    const [row] = await db.insert(payrollRuns).values(data).returning();
    return row;
  }

  async updatePayrollRun(id: number, data: Partial<InsertPayrollRun>) {
    const [row] = await db.update(payrollRuns).set(data).where(eq(payrollRuns.id, id)).returning();
    return row;
  }

  async getPayrollDetails(payrollId: number) {
    const result = await pool.query(`
      SELECT pd.*, u.name as employee_name, u.salary_type, u.branch_id,
             b.name as branch_name
      FROM payroll_details pd
      JOIN users u ON u.id = pd.employee_id
      LEFT JOIN branches b ON b.id = u.branch_id
      WHERE pd.payroll_id = $1
      ORDER BY u.name
    `, [payrollId]);
    return result.rows;
  }

  async createPayrollDetail(data: InsertPayrollDetail) {
    const [row] = await db.insert(payrollDetails).values(data).returning();
    return row;
  }

  async deletePayrollDetails(payrollId: number) {
    await db.delete(payrollDetails).where(eq(payrollDetails.payrollId, payrollId));
  }

  async getEmployeeAdvances(employeeId?: number, settledOnly?: boolean) {
    let query = `
      SELECT ea.*, u.name as employee_name, uc.name as created_by_name,
             (ea.amount::numeric - ea.total_repaid::numeric) as remaining_amount
      FROM employee_advances ea
      JOIN users u ON u.id = ea.employee_id
      LEFT JOIN users uc ON uc.id = ea.created_by
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;
    if (employeeId) {
      query += ` AND ea.employee_id = $${idx++}`;
      params.push(employeeId);
    }
    if (settledOnly !== undefined) {
      query += ` AND ea.settled = $${idx++}`;
      params.push(settledOnly);
    }
    query += ` ORDER BY ea.date DESC`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  async createEmployeeAdvance(data: InsertEmployeeAdvance) {
    const [row] = await db.insert(employeeAdvances).values(data).returning();
    return row;
  }

  async settleAdvance(id: number, payrollId: number) {
    const [row] = await db.update(employeeAdvances)
      .set({ settled: true, settledInPayrollId: payrollId })
      .where(eq(employeeAdvances.id, id))
      .returning();
    return row;
  }

  async getEmployeeDeductions(employeeId?: number) {
    let query = `
      SELECT ed.*, u.name as employee_name, uc.name as created_by_name
      FROM employee_deductions ed
      JOIN users u ON u.id = ed.employee_id
      LEFT JOIN users uc ON uc.id = ed.created_by
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;
    if (employeeId) {
      query += ` AND ed.employee_id = $${idx++}`;
      params.push(employeeId);
    }
    query += ` ORDER BY ed.date DESC`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  async createEmployeeDeduction(data: InsertEmployeeDeduction) {
    const [row] = await db.insert(employeeDeductions).values(data).returning();
    return row;
  }

  async getUnsettledAdvances(employeeId: number) {
    const result = await pool.query(
      `SELECT *, (amount::numeric - total_repaid::numeric) as remaining_amount 
       FROM employee_advances 
       WHERE employee_id = $1 AND (amount::numeric - total_repaid::numeric) > 0 
       ORDER BY date`,
      [employeeId]
    );
    return result.rows;
  }

  async getUnappliedDeductions(employeeId: number, month?: string, year?: number) {
    let query = `SELECT * FROM employee_deductions WHERE employee_id = $1 AND applied_in_payroll_id IS NULL`;
    const params: any[] = [employeeId];
    if (month && year) {
      const monthRef = `${month}/${year}`;
      query += ` AND (deduction_type = 'recurring' OR month_reference = $2 OR month_reference IS NULL)`;
      params.push(monthRef);
    }
    query += ` ORDER BY date`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  private async _calculatePayrollForEmployee(emp: any, month: string, year: number) {
    const basicSalary = parseFloat(emp.salary || "0");
    const monthStart = `${year}-${month.padStart(2, '0')}-01`;
    const monthEnd = new Date(year, parseInt(month), 0).toISOString().slice(0, 10);

    let commission = 0;
    let commissionSource: string = "manual";
    if (emp.salary_type === "commission" && parseFloat(emp.commission_rate || "0") > 0) {
      const salesResult = await pool.query(
        `SELECT COALESCE(SUM(s.total::numeric), 0) as total_sales
         FROM sales s
         WHERE s.cashier_id = $1
           AND s.created_at >= $2::timestamp
           AND s.created_at <= ($3::date + interval '1 day')::timestamp`,
        [emp.id, monthStart, monthEnd]
      );
      const totalSales = parseFloat(salesResult.rows[0]?.total_sales || "0");
      commission = totalSales * (parseFloat(emp.commission_rate || "0") / 100);
      commissionSource = "sales_based";
    }

    const unsettledAdv = await this.getUnsettledAdvances(emp.id);
    let advTotal = 0;
    const advanceDetails: any[] = [];
    for (const adv of unsettledAdv) {
      const remaining = parseFloat(adv.remaining_amount || (parseFloat(adv.amount) - parseFloat(adv.total_repaid || "0")));
      const mode = adv.deduction_mode || "full_next_payroll";
      let deductAmount = 0;
      if (mode === "manual") {
        continue;
      } else if (mode === "fixed_installment" && adv.installment_amount) {
        deductAmount = Math.min(parseFloat(adv.installment_amount), remaining);
      } else {
        deductAmount = remaining;
      }
      advanceDetails.push({ id: adv.id, deductAmount, remaining });
      advTotal += deductAmount;
    }

    const unappliedDed = await this.getUnappliedDeductions(emp.id, month, year);
    const dedTotal = unappliedDed.reduce((s: number, d: any) => s + parseFloat(d.amount), 0);

    const grossSalary = basicSalary + commission;
    let netBeforeAdvances = grossSalary - dedTotal;
    let actualAdvances = Math.min(advTotal, Math.max(netBeforeAdvances, 0));
    const net = grossSalary - dedTotal - actualAdvances;

    const warnings: string[] = [];
    const existingRun = await pool.query(
      `SELECT id FROM payroll_runs WHERE month = $1 AND year = $2 AND status != 'cancelled'`, [month, year]
    );
    if (existingRun.rows.length > 0) warnings.push("payroll_exists_for_period");
    if (basicSalary === 0) warnings.push("zero_salary");
    if (actualAdvances < advTotal) warnings.push("advance_exceeds_net");
    if (emp.employment_status === "suspended") warnings.push("employee_suspended");
    if (emp.employment_status === "terminated") warnings.push("employee_terminated");

    return {
      employeeId: emp.id, employeeName: emp.name, branchId: emp.branch_id,
      basicSalary, commission, commissionSource, grossSalary,
      deductions: dedTotal, advances: actualAdvances, bonus: 0, netSalary: net,
      warnings, advanceDetails, deductionDetails: unappliedDed,
    };
  }

  async generatePayrollRun(payrollId: number, month: string, year: number) {
    await this.deletePayrollDetails(payrollId);

    const activeUsers = await pool.query(
      `SELECT * FROM users WHERE is_active = true AND role != 'owner' AND employment_status = 'active'`
    );

    let totalBasic = 0, totalCommission = 0, totalDeductions = 0, totalAdvances = 0, totalNet = 0;

    for (const emp of activeUsers.rows) {
      const calc = await this._calculatePayrollForEmployee(emp, month, year);

      await this.createPayrollDetail({
        payrollId,
        employeeId: emp.id,
        basicSalary: calc.basicSalary.toFixed(3),
        commission: calc.commission.toFixed(3),
        commissionSource: calc.commissionSource,
        grossSalary: calc.grossSalary.toFixed(3),
        deductions: calc.deductions.toFixed(3),
        advances: calc.advances.toFixed(3),
        bonus: "0",
        netSalary: calc.netSalary.toFixed(3),
      });

      totalBasic += calc.basicSalary;
      totalCommission += calc.commission;
      totalDeductions += calc.deductions;
      totalAdvances += calc.advances;
      totalNet += calc.netSalary;
    }

    await this.updatePayrollRun(payrollId, {
      totalBasic: totalBasic.toFixed(3),
      totalCommission: totalCommission.toFixed(3),
      totalDeductions: totalDeductions.toFixed(3),
      totalAdvances: totalAdvances.toFixed(3),
      totalNet: totalNet.toFixed(3),
    });
  }

  async previewPayrollRun(month: string, year: number) {
    const activeUsers = await pool.query(
      `SELECT * FROM users WHERE is_active = true AND role != 'owner' AND employment_status != 'terminated'`
    );
    const details: any[] = [];
    const warnings: string[] = [];
    let totalBasic = 0, totalCommission = 0, totalDeductions = 0, totalAdvances = 0, totalNet = 0;

    const existingRun = await pool.query(
      `SELECT id FROM payroll_runs WHERE month = $1 AND year = $2 AND status != 'cancelled'`, [month, year]
    );
    if (existingRun.rows.length > 0) warnings.push("payroll_exists_for_period");

    for (const emp of activeUsers.rows) {
      const calc = await this._calculatePayrollForEmployee(emp, month, year);
      details.push(calc);
      totalBasic += calc.basicSalary;
      totalCommission += calc.commission;
      totalDeductions += calc.deductions;
      totalAdvances += calc.advances;
      totalNet += calc.netSalary;
    }

    return {
      month, year, warnings,
      totals: {
        basic: totalBasic.toFixed(3), commission: totalCommission.toFixed(3),
        deductions: totalDeductions.toFixed(3), advances: totalAdvances.toFixed(3),
        net: totalNet.toFixed(3), employeeCount: details.length,
      },
      details,
    };
  }

  async approvePayrollRun(id: number, userId: number) {
    const run = await this.getPayrollRun(id);
    if (!run || (run.status !== "draft" && run.status !== "reviewed")) return undefined;

    const details = await this.getPayrollDetails(id);
    const today = new Date().toISOString().slice(0, 10);

    for (const d of details) {
      const advanceApplied = parseFloat(d.advances || "0");
      if (advanceApplied > 0) {
        const unsettled = await this.getUnsettledAdvances(d.employee_id);
        let remaining = advanceApplied;
        for (const adv of unsettled) {
          if (remaining <= 0) break;
          const mode = adv.deduction_mode || "full_next_payroll";
          if (mode === "manual") continue;

          const advRemaining = parseFloat(adv.remaining_amount || (parseFloat(adv.amount) - parseFloat(adv.total_repaid || "0")));
          let repayAmount: number;
          if (mode === "fixed_installment" && adv.installment_amount) {
            repayAmount = Math.min(parseFloat(adv.installment_amount), advRemaining, remaining);
          } else {
            repayAmount = Math.min(remaining, advRemaining);
          }
          const newTotalRepaid = parseFloat(adv.total_repaid || "0") + repayAmount;
          const isFullyRepaid = newTotalRepaid >= parseFloat(adv.amount) - 0.001;
          await pool.query(
            `UPDATE employee_advances SET total_repaid = $1, settled = $2, settled_in_payroll_id = CASE WHEN $2 THEN $3 ELSE settled_in_payroll_id END WHERE id = $4`,
            [newTotalRepaid.toFixed(3), isFullyRepaid, id, adv.id]
          );
          remaining -= repayAmount;

          await this.createEmployeeLedgerEntry({
            employeeId: d.employee_id, movementType: "advance_repayment_from_payroll",
            referenceType: "payroll_run", referenceId: id,
            amount: (-repayAmount).toFixed(3), date: today,
            note: `خصم سلفة #${adv.id} من كشف الراتب`, createdBy: userId,
          });
        }
      }

      const dedApplied = parseFloat(d.deductions || "0");
      if (dedApplied > 0) {
        const unapplied = await this.getUnappliedDeductions(d.employee_id, run.month, run.year);
        for (const ded of unapplied) {
          await pool.query(
            `UPDATE employee_deductions SET applied_in_payroll_id = $1 WHERE id = $2`,
            [id, ded.id]
          );
        }
        await this.createEmployeeLedgerEntry({
          employeeId: d.employee_id, movementType: "deduction_applied",
          referenceType: "payroll_run", referenceId: id,
          amount: (-dedApplied).toFixed(3), date: today,
          note: `خصومات مطبقة من كشف الراتب`, createdBy: userId,
        });
      }

      await this.createEmployeeLedgerEntry({
        employeeId: d.employee_id, movementType: "payroll_generated",
        referenceType: "payroll_run", referenceId: id,
        amount: parseFloat(d.net_salary || "0").toFixed(3), date: today,
        note: `كشف راتب ${run.month}/${run.year}`, createdBy: userId,
      });
    }

    const [updated] = await db.update(payrollRuns)
      .set({ status: "approved", approvedBy: userId, approvedAt: new Date() })
      .where(eq(payrollRuns.id, id))
      .returning();
    return updated;
  }

  async reviewPayrollRun(id: number, userId: number) {
    const run = await this.getPayrollRun(id);
    if (!run || run.status !== "draft") return undefined;
    const [updated] = await db.update(payrollRuns)
      .set({ status: "reviewed", reviewedBy: userId, reviewedAt: new Date() })
      .where(eq(payrollRuns.id, id))
      .returning();
    return updated;
  }

  async reopenPayrollRun(id: number, userId: number) {
    const run = await this.getPayrollRun(id);
    if (!run || !["approved", "partial", "paid"].includes(run.status)) return undefined;

    if (run.status === "approved") {
      const details = await this.getPayrollDetails(id);
      for (const d of details) {
        await pool.query(
          `UPDATE employee_advances SET total_repaid = GREATEST(total_repaid::numeric - $1::numeric, 0),
            settled = false, settled_in_payroll_id = NULL
           WHERE settled_in_payroll_id = $2 AND employee_id = $3`,
          [parseFloat(d.advances || "0").toFixed(3), id, d.employee_id]
        );
        await pool.query(
          `UPDATE employee_deductions SET applied_in_payroll_id = NULL WHERE applied_in_payroll_id = $1 AND employee_id = $2`,
          [id, d.employee_id]
        );
      }
      await pool.query(`DELETE FROM employee_financial_ledger WHERE reference_type = 'payroll_run' AND reference_id = $1`, [id]);
    }

    const [updated] = await db.update(payrollRuns)
      .set({ status: "draft", approvedBy: null, approvedAt: null, reviewedBy: null, reviewedAt: null })
      .where(eq(payrollRuns.id, id))
      .returning();
    return updated;
  }

  async cancelPayrollRun(id: number, userId: number) {
    const run = await this.getPayrollRun(id);
    if (!run || ["paid", "cancelled"].includes(run.status)) return undefined;

    if (run.status === "approved") {
      const details = await this.getPayrollDetails(id);
      for (const d of details) {
        await pool.query(
          `UPDATE employee_advances SET total_repaid = GREATEST(total_repaid::numeric - $1::numeric, 0),
            settled = false, settled_in_payroll_id = NULL
           WHERE settled_in_payroll_id = $2 AND employee_id = $3`,
          [parseFloat(d.advances || "0").toFixed(3), id, d.employee_id]
        );
        await pool.query(
          `UPDATE employee_deductions SET applied_in_payroll_id = NULL WHERE applied_in_payroll_id = $1 AND employee_id = $2`,
          [id, d.employee_id]
        );
      }
      await pool.query(`DELETE FROM employee_financial_ledger WHERE reference_type = 'payroll_run' AND reference_id = $1`, [id]);
    }

    const [updated] = await db.update(payrollRuns)
      .set({ status: "cancelled", cancelledBy: userId, cancelledAt: new Date() })
      .where(eq(payrollRuns.id, id))
      .returning();
    return updated;
  }

  async createSalaryPayment(data: any) {
    const result = await pool.query(`
      INSERT INTO salary_payments (payroll_id, payroll_detail_id, employee_id, amount, payment_date, payment_method, reference_no, branch_id, paid_by, note)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [data.payrollId, data.payrollDetailId, data.employeeId, data.amount, data.paymentDate, data.paymentMethod, data.referenceNo || null, data.branchId || null, data.paidBy, data.note || null]);

    const payment = result.rows[0];

    await this.createEmployeeLedgerEntry({
      employeeId: data.employeeId, movementType: "payroll_payment",
      referenceType: "salary_payment", referenceId: payment.id,
      amount: (-parseFloat(data.amount)).toFixed(3),
      date: data.paymentDate,
      note: `دفعة راتب - ${data.paymentMethod}`, createdBy: data.paidBy,
    });

    const detailPayments = await pool.query(
      `SELECT COALESCE(SUM(amount::numeric), 0) as total_paid FROM salary_payments WHERE payroll_detail_id = $1`,
      [data.payrollDetailId]
    );
    const totalDetailPaid = parseFloat(detailPayments.rows[0].total_paid || "0");
    const detailResult = await pool.query(`SELECT net_salary FROM payroll_details WHERE id = $1`, [data.payrollDetailId]);
    const netSalary = parseFloat(detailResult.rows[0]?.net_salary || "0");

    const allDetails = await this.getPayrollDetailsWithPayments(data.payrollId);
    const allPaid = allDetails.every((d: any) => d.payment_status === "paid");
    const anyPaid = allDetails.some((d: any) => d.payment_status === "paid" || d.payment_status === "partial");

    const run = await this.getPayrollRun(data.payrollId);
    if (run && ["approved", "partial", "reviewed"].includes(run.status)) {
      let newStatus = run.status;
      if (allPaid) newStatus = "paid";
      else if (anyPaid) newStatus = "partial";
      if (newStatus !== run.status) {
        await db.update(payrollRuns).set({ status: newStatus }).where(eq(payrollRuns.id, data.payrollId));
      }
    }

    return payment;
  }

  async getSalaryPayments(payrollId?: number) {
    let query = `
      SELECT sp.*, u.name as employee_name, b.name as branch_name, u2.name as paid_by_name
      FROM salary_payments sp
      JOIN users u ON u.id = sp.employee_id
      LEFT JOIN branches b ON b.id = sp.branch_id
      LEFT JOIN users u2 ON u2.id = sp.paid_by
    `;
    const params: any[] = [];
    if (payrollId) {
      query += ` WHERE sp.payroll_id = $1`;
      params.push(payrollId);
    }
    query += ` ORDER BY sp.created_at DESC`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  async getPayrollDetailPayments(payrollDetailId: number) {
    const result = await pool.query(`
      SELECT sp.*, u2.name as paid_by_name
      FROM salary_payments sp
      LEFT JOIN users u2 ON u2.id = sp.paid_by
      WHERE sp.payroll_detail_id = $1
      ORDER BY sp.created_at DESC
    `, [payrollDetailId]);
    return result.rows;
  }

  async getPayrollDetailsWithPayments(payrollId: number) {
    const result = await pool.query(`
      SELECT pd.*, u.name as employee_name, u.salary_type, u.branch_id,
             b.name as branch_name,
             COALESCE((SELECT SUM(sp.amount::numeric) FROM salary_payments sp WHERE sp.payroll_detail_id = pd.id), 0) as total_paid
      FROM payroll_details pd
      JOIN users u ON u.id = pd.employee_id
      LEFT JOIN branches b ON b.id = u.branch_id
      WHERE pd.payroll_id = $1
      ORDER BY u.name
    `, [payrollId]);
    return result.rows.map((r: any) => {
      const net = parseFloat(r.net_salary || "0");
      const paid = parseFloat(r.total_paid || "0");
      let paymentStatus = "unpaid";
      if (paid >= net && net > 0) paymentStatus = "paid";
      else if (paid > 0) paymentStatus = "partial";
      return { ...r, total_paid: paid.toFixed(3), payment_status: paymentStatus, remaining: (net - paid).toFixed(3) };
    });
  }

  async getPayrollSummary(payrollId: number) {
    const details = await this.getPayrollDetailsWithPayments(payrollId);
    const totalBasic = details.reduce((s: number, d: any) => s + parseFloat(d.basic_salary || "0"), 0);
    const totalCommission = details.reduce((s: number, d: any) => s + parseFloat(d.commission || "0"), 0);
    const totalDeductions = details.reduce((s: number, d: any) => s + parseFloat(d.deductions || "0"), 0);
    const totalAdvances = details.reduce((s: number, d: any) => s + parseFloat(d.advances || "0"), 0);
    const totalNet = details.reduce((s: number, d: any) => s + parseFloat(d.net_salary || "0"), 0);
    const totalPaid = details.reduce((s: number, d: any) => s + parseFloat(d.total_paid || "0"), 0);
    const totalRemaining = totalNet - totalPaid;
    const paidCount = details.filter((d: any) => d.payment_status === "paid").length;
    const partialCount = details.filter((d: any) => d.payment_status === "partial").length;
    const unpaidCount = details.filter((d: any) => d.payment_status === "unpaid").length;
    return {
      employeeCount: details.length, totalBasic: totalBasic.toFixed(3), totalCommission: totalCommission.toFixed(3),
      totalDeductions: totalDeductions.toFixed(3), totalAdvances: totalAdvances.toFixed(3), totalNet: totalNet.toFixed(3),
      totalPaid: totalPaid.toFixed(3), totalRemaining: totalRemaining.toFixed(3),
      paidCount, partialCount, unpaidCount, details,
    };
  }

  async getEmployeeFinancialProfile(employeeId: number) {
    const empResult = await pool.query(`SELECT id, name, salary, salary_type, commission_rate, branch_id, role, is_active, employment_status, opening_advance_balance, opening_payable_balance FROM users WHERE id = $1`, [employeeId]);
    if (!empResult.rows[0]) return null;
    const emp = empResult.rows[0];

    const branchResult = await pool.query(`SELECT name FROM branches WHERE id = $1`, [emp.branch_id]);
    const branchName = branchResult.rows[0]?.name || null;

    const advResult = await pool.query(`
      SELECT COALESCE(SUM(amount::numeric), 0) as total_advances,
             COALESCE(SUM(total_repaid::numeric), 0) as total_repaid,
             COALESCE(SUM(amount::numeric - total_repaid::numeric), 0) as total_remaining
      FROM employee_advances WHERE employee_id = $1
    `, [employeeId]);

    const dedResult = await pool.query(`
      SELECT COALESCE(SUM(amount::numeric), 0) as total_deductions
      FROM employee_deductions WHERE employee_id = $1
    `, [employeeId]);

    const lastPayroll = await pool.query(`
      SELECT pd.*, pr.month, pr.year, pr.status as run_status,
             COALESCE((SELECT SUM(sp.amount::numeric) FROM salary_payments sp WHERE sp.payroll_detail_id = pd.id), 0) as total_paid
      FROM payroll_details pd
      JOIN payroll_runs pr ON pr.id = pd.payroll_id
      WHERE pd.employee_id = $1
      ORDER BY pr.year DESC, pr.month::int DESC
      LIMIT 1
    `, [employeeId]);

    const payrollHistory = await pool.query(`
      SELECT pd.*, pr.month, pr.year, pr.status as run_status,
             COALESCE((SELECT SUM(sp.amount::numeric) FROM salary_payments sp WHERE sp.payroll_detail_id = pd.id), 0) as total_paid
      FROM payroll_details pd
      JOIN payroll_runs pr ON pr.id = pd.payroll_id
      WHERE pd.employee_id = $1
      ORDER BY pr.year DESC, pr.month::int DESC
      LIMIT 12
    `, [employeeId]);

    const lastPayment = await pool.query(`
      SELECT * FROM salary_payments WHERE employee_id = $1 ORDER BY payment_date DESC LIMIT 1
    `, [employeeId]);

    const openAdvances = await pool.query(`
      SELECT id, amount, total_repaid, (amount::numeric - total_repaid::numeric) as remaining_amount, date, note, settled
      FROM employee_advances WHERE employee_id = $1 AND (amount::numeric - total_repaid::numeric) > 0
      ORDER BY date DESC
    `, [employeeId]);

    const lp = lastPayroll.rows[0];
    const lpPaid = lp ? parseFloat(lp.total_paid || "0") : 0;
    const lpNet = lp ? parseFloat(lp.net_salary || "0") : 0;

    return {
      employee: { ...emp, branch_name: branchName },
      advances: {
        total: parseFloat(advResult.rows[0].total_advances),
        repaid: parseFloat(advResult.rows[0].total_repaid),
        remaining: parseFloat(advResult.rows[0].total_remaining),
        openAdvances: openAdvances.rows,
      },
      deductions: {
        total: parseFloat(dedResult.rows[0].total_deductions),
      },
      lastPayroll: lp ? {
        month: lp.month, year: lp.year, status: lp.run_status,
        basicSalary: lp.basic_salary, commission: lp.commission,
        deductions: lp.deductions, advances: lp.advances,
        netSalary: lp.net_salary, totalPaid: lpPaid.toFixed(3),
        remaining: (lpNet - lpPaid).toFixed(3),
      } : null,
      lastPaymentDate: lastPayment.rows[0]?.payment_date || null,
      payrollHistory: payrollHistory.rows.map((r: any) => {
        const paid = parseFloat(r.total_paid || "0");
        const net = parseFloat(r.net_salary || "0");
        return {
          month: r.month, year: r.year, status: r.run_status,
          netSalary: r.net_salary, totalPaid: paid.toFixed(3),
          remaining: (net - paid).toFixed(3),
          paymentStatus: paid >= net && net > 0 ? "paid" : paid > 0 ? "partial" : "unpaid",
        };
      }),
    };
  }

  async getPayrollOutstandingReport() {
    const result = await pool.query(`
      SELECT pd.employee_id, u.name as employee_name, b.name as branch_name,
             pr.month, pr.year, pd.net_salary,
             COALESCE((SELECT SUM(sp.amount::numeric) FROM salary_payments sp WHERE sp.payroll_detail_id = pd.id), 0) as total_paid
      FROM payroll_details pd
      JOIN payroll_runs pr ON pr.id = pd.payroll_id AND pr.status = 'approved'
      JOIN users u ON u.id = pd.employee_id
      LEFT JOIN branches b ON b.id = u.branch_id
      ORDER BY pr.year DESC, pr.month::int DESC, u.name
    `);
    return result.rows.filter((r: any) => {
      const net = parseFloat(r.net_salary || "0");
      const paid = parseFloat(r.total_paid || "0");
      return net > paid + 0.001;
    }).map((r: any) => {
      const net = parseFloat(r.net_salary || "0");
      const paid = parseFloat(r.total_paid || "0");
      return {
        ...r, remaining: (net - paid).toFixed(3),
        paymentStatus: paid > 0.001 ? "partial" : "unpaid",
      };
    });
  }

  async getAdvancesOutstandingReport() {
    const result = await pool.query(`
      SELECT ea.id, ea.employee_id, u.name as employee_name, b.name as branch_name,
             ea.amount, ea.total_repaid, (ea.amount::numeric - ea.total_repaid::numeric) as remaining_amount,
             ea.date, ea.note
      FROM employee_advances ea
      JOIN users u ON u.id = ea.employee_id
      LEFT JOIN branches b ON b.id = u.branch_id
      WHERE (ea.amount::numeric - ea.total_repaid::numeric) > 0
      ORDER BY u.name, ea.date DESC
    `);
    return result.rows;
  }

  async createEmployeeLedgerEntry(data: InsertEmployeeFinancialLedger) {
    const [row] = await db.insert(employeeFinancialLedger).values(data).returning();
    return row;
  }

  async getEmployeeLedger(employeeId: number, filters?: { from?: string; to?: string; movementType?: string }) {
    let query = `
      SELECT efl.*, u.name as employee_name, uc.name as created_by_name
      FROM employee_financial_ledger efl
      JOIN users u ON u.id = efl.employee_id
      LEFT JOIN users uc ON uc.id = efl.created_by
      WHERE efl.employee_id = $1
    `;
    const params: any[] = [employeeId];
    let idx = 2;
    if (filters?.from) { query += ` AND efl.date >= $${idx++}`; params.push(filters.from); }
    if (filters?.to) { query += ` AND efl.date <= $${idx++}`; params.push(filters.to); }
    if (filters?.movementType) { query += ` AND efl.movement_type = $${idx++}`; params.push(filters.movementType); }
    query += ` ORDER BY efl.created_at DESC`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  async getEmployeeStatement(employeeId: number, from: string, to: string) {
    const empResult = await pool.query(`SELECT id, name, salary, salary_type, branch_id, employment_status FROM users WHERE id = $1`, [employeeId]);
    if (!empResult.rows[0]) return null;
    const emp = empResult.rows[0];

    const branchResult = await pool.query(`SELECT name FROM branches WHERE id = $1`, [emp.branch_id]);

    const ledger = await this.getEmployeeLedger(employeeId, { from, to });

    const totals = {
      payroll: 0, payments: 0, advances: 0, advanceRepayments: 0, deductions: 0, bonuses: 0, adjustments: 0,
    };
    for (const entry of ledger) {
      const amt = parseFloat(entry.amount || "0");
      switch (entry.movement_type) {
        case "payroll_generated": totals.payroll += amt; break;
        case "payroll_payment": totals.payments += amt; break;
        case "advance_given": totals.advances += amt; break;
        case "advance_repayment_from_payroll": totals.advanceRepayments += amt; break;
        case "deduction_applied": totals.deductions += amt; break;
        case "bonus": totals.bonuses += amt; break;
        case "manual_adjustment": totals.adjustments += amt; break;
      }
    }

    return {
      employee: { ...emp, branch_name: branchResult.rows[0]?.name },
      period: { from, to },
      ledger,
      totals,
    };
  }

  async getPayrollPaymentsReport(filters?: { month?: string; year?: number; branchId?: number }) {
    let query = `
      SELECT sp.*, u.name as employee_name, b.name as branch_name, u2.name as paid_by_name,
             pr.month, pr.year
      FROM salary_payments sp
      JOIN users u ON u.id = sp.employee_id
      LEFT JOIN branches b ON b.id = sp.branch_id
      LEFT JOIN users u2 ON u2.id = sp.paid_by
      JOIN payroll_runs pr ON pr.id = sp.payroll_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;
    if (filters?.month) { query += ` AND pr.month = $${idx++}`; params.push(filters.month); }
    if (filters?.year) { query += ` AND pr.year = $${idx++}`; params.push(filters.year); }
    if (filters?.branchId) { query += ` AND sp.branch_id = $${idx++}`; params.push(filters.branchId); }
    query += ` ORDER BY sp.created_at DESC`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  async getRecurringDeductionsReport() {
    const result = await pool.query(`
      SELECT ed.*, u.name as employee_name, b.name as branch_name
      FROM employee_deductions ed
      JOIN users u ON u.id = ed.employee_id
      LEFT JOIN branches b ON b.id = u.branch_id
      WHERE ed.deduction_type = 'recurring' AND ed.applied_in_payroll_id IS NULL
      ORDER BY u.name, ed.date DESC
    `);
    return result.rows;
  }

  async getPayrollByBranch(month: string, year: number) {
    const result = await pool.query(`
      SELECT b.id as branch_id, b.name as branch_name,
             COUNT(pd.id) as employee_count,
             COALESCE(SUM(pd.basic_salary::numeric), 0) as total_basic,
             COALESCE(SUM(pd.commission::numeric), 0) as total_commission,
             COALESCE(SUM(pd.deductions::numeric), 0) as total_deductions,
             COALESCE(SUM(pd.advances::numeric), 0) as total_advances,
             COALESCE(SUM(pd.net_salary::numeric), 0) as total_net,
             COALESCE(SUM((SELECT COALESCE(SUM(sp.amount::numeric), 0) FROM salary_payments sp WHERE sp.payroll_detail_id = pd.id)), 0) as total_paid
      FROM payroll_details pd
      JOIN payroll_runs pr ON pr.id = pd.payroll_id AND pr.month = $1 AND pr.year = $2 AND pr.status != 'cancelled'
      JOIN users u ON u.id = pd.employee_id
      LEFT JOIN branches b ON b.id = u.branch_id
      GROUP BY b.id, b.name
      ORDER BY b.name
    `, [month, year]);
    return result.rows;
  }

  async getPayrollComparison(year: number) {
    const result = await pool.query(`
      SELECT pr.month,
             COALESCE(SUM(pd.basic_salary::numeric), 0) as total_basic,
             COALESCE(SUM(pd.commission::numeric), 0) as total_commission,
             COALESCE(SUM(pd.deductions::numeric), 0) as total_deductions,
             COALESCE(SUM(pd.advances::numeric), 0) as total_advances,
             COALESCE(SUM(pd.net_salary::numeric), 0) as total_net,
             COUNT(pd.id) as employee_count
      FROM payroll_details pd
      JOIN payroll_runs pr ON pr.id = pd.payroll_id AND pr.year = $1 AND pr.status != 'cancelled'
      GROUP BY pr.month
      ORDER BY pr.month::int
    `, [year]);
    return result.rows;
  }

  async getPayrollRemainingByEmployee(): Promise<any[]> {
    const result = await pool.query(`
      SELECT 
        u.id as employee_id,
        u.name as employee_name,
        u.salary as basic_salary,
        COALESCE(
          (SELECT SUM(amount::numeric) FROM employee_financial_ledger WHERE employee_id = u.id),
          0
        ) as balance
      FROM users u
      WHERE u.is_active = true
      ORDER BY u.name
    `);
    return result.rows;
  }

  async getEmployeeCommissions(employeeId?: number, month?: string, year?: number): Promise<EmployeeCommission[]> {
    let query = db.select().from(employeeCommissions);
    const conditions = [];
    if (employeeId) conditions.push(eq(employeeCommissions.employeeId, employeeId));
    if (month) conditions.push(eq(employeeCommissions.month, month));
    if (year) conditions.push(eq(employeeCommissions.year, year));
    
    if (conditions.length > 0) {
      return query.where(and(...conditions)).orderBy(desc(employeeCommissions.date));
    }
    return query.orderBy(desc(employeeCommissions.date));
  }

  async createEmployeeCommission(data: InsertEmployeeCommission): Promise<EmployeeCommission> {
    const [row] = await db.insert(employeeCommissions).values(data).returning();
    return row;
  }

  async getEmployeeEntitlements(employeeId?: number, month?: string, year?: number): Promise<EmployeeEntitlement[]> {
    let query = db.select().from(employeeEntitlements);
    const conditions = [];
    if (employeeId) conditions.push(eq(employeeEntitlements.employeeId, employeeId));
    if (month) conditions.push(eq(employeeEntitlements.month, month));
    if (year) conditions.push(eq(employeeEntitlements.year, year));
    
    if (conditions.length > 0) {
      return query.where(and(...conditions)).orderBy(desc(employeeEntitlements.date));
    }
    return query.orderBy(desc(employeeEntitlements.date));
  }

  async createEmployeeEntitlement(data: InsertEmployeeEntitlement): Promise<EmployeeEntitlement> {
    const [row] = await db.insert(employeeEntitlements).values(data).returning();
    return row;
  }

  async getStocktakes(branchId?: number) {
    let query = `
      SELECT st.*, b.name as branch_name, l.name as location_name,
             u1.name as creator_name, u2.name as approver_name
      FROM stocktakes st
      LEFT JOIN branches b ON b.id = st.branch_id
      LEFT JOIN locations l ON l.id = st.location_id
      LEFT JOIN users u1 ON u1.id = st.created_by
      LEFT JOIN users u2 ON u2.id = st.approved_by
    `;
    const params: any[] = [];
    if (branchId) {
      query += ` WHERE st.branch_id = $1`;
      params.push(branchId);
    }
    query += ` ORDER BY st.created_at DESC`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  async getStocktake(id: number) {
    const [row] = await db.select().from(stocktakes).where(eq(stocktakes.id, id));
    return row;
  }

  async createStocktake(data: InsertStocktake) {
    const [st] = await db.insert(stocktakes).values(data).returning();

    const invRows = await pool.query(
      `SELECT li.product_id, li.qty_on_hand, p.name as product_name, p.barcode
       FROM location_inventory li
       JOIN products p ON p.id = li.product_id
       WHERE li.location_id = $1
       ORDER BY p.name`,
      [data.locationId]
    );

    for (const row of invRows.rows) {
      await db.insert(stocktakeItems).values({
        stocktakeId: st.id,
        productId: row.product_id,
        systemQty: row.qty_on_hand,
        countedQty: null,
        difference: 0,
      });
    }

    await db.update(stocktakes)
      .set({ totalItems: invRows.rows.length })
      .where(eq(stocktakes.id, st.id));

    return { ...st, totalItems: invRows.rows.length };
  }

  async getStocktakeItems(stocktakeId: number) {
    const result = await pool.query(
      `SELECT si.*, p.name as product_name, p.barcode
       FROM stocktake_items si
       JOIN products p ON p.id = si.product_id
       WHERE si.stocktake_id = $1
       ORDER BY p.name`,
      [stocktakeId]
    );
    return result.rows;
  }

  async updateStocktakeItem(id: number, countedQty: number, note?: string) {
    const item = await pool.query(`SELECT * FROM stocktake_items WHERE id = $1`, [id]);
    if (!item.rows[0]) return undefined;
    const systemQty = item.rows[0].system_qty;
    const difference = countedQty - systemQty;

    const [updated] = await db.update(stocktakeItems)
      .set({ countedQty, difference, note: note || null })
      .where(eq(stocktakeItems.id, id))
      .returning();

    const stId = item.rows[0].stocktake_id;
    const allItems = await pool.query(
      `SELECT * FROM stocktake_items WHERE stocktake_id = $1`, [stId]
    );
    let matched = 0, surplus = 0, shortage = 0;
    for (const it of allItems.rows) {
      if (it.counted_qty === null) continue;
      const diff = it.counted_qty - it.system_qty;
      if (diff === 0) matched++;
      else if (diff > 0) surplus++;
      else shortage++;
    }
    await db.update(stocktakes)
      .set({ matchedItems: matched, surplusItems: surplus, shortageItems: shortage })
      .where(eq(stocktakes.id, stId));

    return updated;
  }

  async approveStocktake(id: number, userId: number) {
    const st = await this.getStocktake(id);
    if (!st || st.status !== "draft") return undefined;

    const items = await this.getStocktakeItems(id);
    const todayStr = new Date().toISOString().slice(0, 10);

    for (const item of items) {
      if (item.counted_qty === null) continue;
      const diff = item.counted_qty - item.system_qty;
      if (diff === 0) continue;

      await pool.query(
        `UPDATE location_inventory SET qty_on_hand = $1, updated_at = now()
         WHERE location_id = $2 AND product_id = $3`,
        [item.counted_qty, st.locationId, item.product_id]
      );

      // Sync inventory_balances (variant system)
      const varRes = await pool.query(
        `SELECT id FROM product_variants WHERE product_id = $1 ORDER BY id LIMIT 1`,
        [item.product_id]
      );
      const variantId = varRes.rows[0]?.id;
      if (variantId) {
        await pool.query(`
          INSERT INTO inventory_balances (location_id, variant_id, qty_on_hand, qty_reserved)
          VALUES ($1, $2, $3, 0)
          ON CONFLICT (location_id, variant_id) DO UPDATE SET qty_on_hand = inventory_balances.qty_on_hand + $3
        `, [st.locationId, variantId, diff]);

        await pool.query(`
          INSERT INTO inventory_ledger (variant_id, location_id, qty_change, reason, ref_table, ref_id, created_by)
          VALUES ($1, $2, $3, 'stocktake_adjustment', 'stocktakes', $4, $5)
        `, [variantId, st.locationId, diff, id, userId]);
      }

      await this.createInventoryAdjustment({
        branchId: st.branchId,
        locationId: st.locationId,
        productId: item.product_id,
        type: diff > 0 ? "surplus" : "shortage",
        qtyBefore: item.system_qty,
        qtyChange: diff,
        qtyAfter: item.counted_qty,
        reason: `جرد #${id}` + (item.note ? ` - ${item.note}` : ""),
        stocktakeId: id,
        createdBy: userId,
      });

      await db.insert(inventoryTransactions).values({
        date: todayStr,
        branchId: st.branchId,
        toLocationId: diff > 0 ? st.locationId : null,
        fromLocationId: diff < 0 ? st.locationId : null,
        productId: item.product_id,
        type: "stocktake_adjustment",
        qty: Math.abs(diff),
        refTable: "stocktakes",
        refId: id,
        note: `تسوية جرد: ${diff > 0 ? "+" : ""}${diff}`,
        createdBy: userId,
      });
    }

    const [updated] = await db.update(stocktakes)
      .set({ status: "completed", approvedBy: userId, completedAt: new Date() })
      .where(eq(stocktakes.id, id))
      .returning();
    return updated;
  }

  async createInventoryAdjustment(data: InsertInventoryAdjustment) {
    const [row] = await db.insert(inventoryAdjustments).values(data).returning();
    return row;
  }

  async getInventoryAdjustments(branchId?: number, locationId?: number) {
    let query = `
      SELECT ia.*, p.name as product_name, p.barcode,
             b.name as branch_name, l.name as location_name,
             u.name as creator_name
      FROM inventory_adjustments ia
      JOIN products p ON p.id = ia.product_id
      LEFT JOIN branches b ON b.id = ia.branch_id
      LEFT JOIN locations l ON l.id = ia.location_id
      LEFT JOIN users u ON u.id = ia.created_by
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;
    if (branchId) {
      query += ` AND ia.branch_id = $${idx++}`;
      params.push(branchId);
    }
    if (locationId) {
      query += ` AND ia.location_id = $${idx++}`;
      params.push(locationId);
    }
    query += ` ORDER BY ia.created_at DESC LIMIT 500`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  // ── Variants ──
  async createVariant(data: InsertProductVariant) {
    const [row] = await db.insert(productVariants).values(data).returning();
    return row;
  }
  async getVariantsByProduct(productId: number) {
    return db.select().from(productVariants).where(eq(productVariants.productId, productId)).orderBy(productVariants.id);
  }
  async getAllVariants() {
    const result = await pool.query(`
      SELECT pv.*, p.name as product_name, p.category_id, c.name as category_name
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY pv.id DESC
    `);
    return result.rows;
  }
  async getVariantByBarcode(barcode: string) {
    const result = await pool.query(`
      SELECT pv.*, p.name as product_name, p.category_id, c.name as category_name
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE pv.barcode = $1
      LIMIT 1
    `, [barcode]);
    return result.rows[0] || undefined;
  }
  async getVariantBySku(sku: string) {
    const [row] = await db.select().from(productVariants).where(eq(productVariants.sku, sku));
    return row;
  }
  async getVariant(id: number) {
    const [row] = await db.select().from(productVariants).where(eq(productVariants.id, id));
    return row;
  }
  async updateVariant(id: number, data: Partial<InsertProductVariant>) {
    const [row] = await db.update(productVariants).set(data).where(eq(productVariants.id, id)).returning();
    return row;
  }
  async deleteVariant(id: number) {
    await db.execute(sql`DELETE FROM inventory_ledger WHERE variant_id = ${id}`);
    await db.execute(sql`DELETE FROM stock_transfer_lines WHERE variant_id = ${id}`);
    await db.execute(sql`DELETE FROM inventory_balances WHERE variant_id = ${id}`);
    await db.delete(productVariants).where(eq(productVariants.id, id));
  }

  // ── Inventory Balances ──
  async getInventoryBalances(locationId?: number, branchId?: number) {
    let query = `
      SELECT ib.*, pv.barcode, pv.sku, pv.color, pv.size, pv.price,
             pv.last_purchase_price, pv.last_receipt_date,
             p.name as product_name, p.product_type, p.category_id, c.name as category_name,
             l.name as location_name, l.type as location_type,
             b.id as branch_id, b.name as branch_name,
             CASE WHEN l.is_central THEN l.name ELSE COALESCE(b.name || ' - ', '') || l.name END as full_location_name,
             COALESCE(li.reorder_level, 5) as reorder_level
      FROM inventory_balances ib
      JOIN product_variants pv ON pv.id = ib.variant_id
      JOIN products p ON p.id = pv.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      JOIN locations l ON l.id = ib.location_id
      LEFT JOIN branches b ON b.id = l.branch_id
      LEFT JOIN location_inventory li ON li.location_id = ib.location_id AND li.product_id = pv.product_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (locationId) {
      params.push(locationId);
      query += ` AND ib.location_id = $${params.length}`;
    }
    if (branchId) {
      params.push(branchId);
      query += ` AND b.id = $${params.length}`;
    }
    query += ` ORDER BY p.name, pv.color, pv.size`;
    const result = await pool.query(query, params);
    return result.rows;
  }
  async getBalanceByVariantLocation(variantId: number, locationId: number) {
    const [row] = await db.select().from(inventoryBalances)
      .where(and(eq(inventoryBalances.variantId, variantId), eq(inventoryBalances.locationId, locationId)));
    return row;
  }
  async upsertBalance(locationId: number, variantId: number, qtyChange: number) {
    const existing = await this.getBalanceByVariantLocation(variantId, locationId);
    if (existing) {
      const [row] = await db.update(inventoryBalances)
        .set({ qtyOnHand: existing.qtyOnHand + qtyChange })
        .where(eq(inventoryBalances.id, existing.id))
        .returning();
      return row;
    } else {
      const [row] = await db.insert(inventoryBalances)
        .values({ locationId, variantId, qtyOnHand: qtyChange, qtyReserved: 0 })
        .returning();
      return row;
    }
  }

  // ── Stock Transfers ──
  async createStockTransfer(data: InsertStockTransfer) {
    const [row] = await db.insert(stockTransfers).values(data).returning();
    return row;
  }
  async getStockTransfers() {
    const result = await pool.query(`
      SELECT st.*,
             CASE WHEN fl.is_central THEN fl.name ELSE COALESCE(fb.name, fl.name) END as from_location_name,
             CASE WHEN tl.is_central THEN tl.name ELSE COALESCE(tb.name, tl.name) END as to_location_name,
             u.name as creator_name
      FROM stock_transfers st
      JOIN locations fl ON fl.id = st.from_location_id
      LEFT JOIN branches fb ON fb.id = fl.branch_id
      JOIN locations tl ON tl.id = st.to_location_id
      LEFT JOIN branches tb ON tb.id = tl.branch_id
      LEFT JOIN users u ON u.id = st.created_by
      ORDER BY st.created_at DESC
    `);
    return result.rows;
  }
  async getStockTransfer(id: number) {
    const [row] = await db.select().from(stockTransfers).where(eq(stockTransfers.id, id));
    return row;
  }
  async getStockTransferLines(transferId: number) {
    const result = await pool.query(`
      SELECT stl.*, pv.barcode, pv.sku, pv.color, pv.size, pv.price,
             p.name as product_name
      FROM stock_transfer_lines stl
      JOIN product_variants pv ON pv.id = stl.variant_id
      JOIN products p ON p.id = pv.product_id
      WHERE stl.transfer_id = $1
      ORDER BY stl.id
    `, [transferId]);
    return result.rows;
  }
  async addStockTransferLine(data: InsertStockTransferLine) {
    const [row] = await db.insert(stockTransferLines).values(data).returning();
    return row;
  }
  async deleteStockTransferLine(id: number) {
    await db.delete(stockTransferLines).where(eq(stockTransferLines.id, id));
  }
  async approveStockTransfer(id: number, userId: number) {
    const transfer = await this.getStockTransfer(id);
    if (!transfer || transfer.status !== "draft") return undefined;
    const lines = await this.getStockTransferLines(id);
    if (lines.length === 0) return undefined;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const line of lines) {
        const balRes = await client.query(
          `SELECT qty_on_hand FROM inventory_balances WHERE location_id=$1 AND variant_id=$2`,
          [transfer.fromLocationId, line.variant_id]
        );
        const available = balRes.rows[0]?.qty_on_hand || 0;
        if (available < line.qty) {
          throw new Error(`الكمية غير كافية للصنف ${line.product_name || line.variant_id}`);
        }
        await client.query(
          `UPDATE inventory_balances SET qty_on_hand = qty_on_hand - $1 WHERE location_id=$2 AND variant_id=$3`,
          [line.qty, transfer.fromLocationId, line.variant_id]
        );
        await client.query(`
          INSERT INTO inventory_balances (location_id, variant_id, qty_on_hand, qty_reserved)
          VALUES ($1, $2, $3, 0)
          ON CONFLICT (location_id, variant_id) DO UPDATE SET qty_on_hand = inventory_balances.qty_on_hand + $3
        `, [transfer.toLocationId, line.variant_id, line.qty]);

        // Sync location_inventory for POS compatibility
        const prodRes = await client.query(
          `SELECT product_id FROM product_variants WHERE id = $1`, [line.variant_id]
        );
        const productId = prodRes.rows[0]?.product_id;
        if (productId) {
          await client.query(
            `UPDATE location_inventory SET qty_on_hand = GREATEST(0, qty_on_hand - $1), updated_at = now()
             WHERE location_id = $2 AND product_id = $3`,
            [line.qty, transfer.fromLocationId, productId]
          );
          await client.query(`
            INSERT INTO location_inventory (location_id, product_id, qty_on_hand, updated_at)
            VALUES ($1, $2, $3, now())
            ON CONFLICT (location_id, product_id) DO UPDATE SET qty_on_hand = location_inventory.qty_on_hand + $3, updated_at = now()
          `, [transfer.toLocationId, productId, line.qty]);
        }
        await client.query(`
          INSERT INTO inventory_ledger (variant_id, location_id, qty_change, reason, ref_table, ref_id, created_by)
          VALUES ($1, $2, $3, 'transfer_out', 'stock_transfers', $4, $5)
        `, [line.variant_id, transfer.fromLocationId, -line.qty, id, userId]);
        await client.query(`
          INSERT INTO inventory_ledger (variant_id, location_id, qty_change, reason, ref_table, ref_id, created_by)
          VALUES ($1, $2, $3, 'transfer_in', 'stock_transfers', $4, $5)
        `, [line.variant_id, transfer.toLocationId, line.qty, id, userId]);
      }
      const result = await client.query(
        `UPDATE stock_transfers SET status='approved', approved_at=now() WHERE id=$1 RETURNING *`,
        [id]
      );
      await client.query("COMMIT");
      return result.rows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Inventory Ledger ──
  async createLedgerEntry(data: InsertInventoryLedger) {
    const [row] = await db.insert(inventoryLedger).values(data).returning();
    return row;
  }
  async getInventoryLedgerEntries(filters?: { variantId?: number; locationId?: number; limit?: number }) {
    let query = `
      SELECT il.*, pv.barcode, pv.sku, pv.color, pv.size,
             p.name as product_name,
             CASE WHEN l.is_central THEN l.name ELSE COALESCE(b.name || ' - ', '') || l.name END as location_name,
             u.name as creator_name
      FROM inventory_ledger il
      JOIN product_variants pv ON pv.id = il.variant_id
      JOIN products p ON p.id = pv.product_id
      JOIN locations l ON l.id = il.location_id
      LEFT JOIN branches b ON b.id = l.branch_id
      LEFT JOIN users u ON u.id = il.created_by
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;
    if (filters?.variantId) {
      query += ` AND il.variant_id = $${idx++}`;
      params.push(filters.variantId);
    }
    if (filters?.locationId) {
      query += ` AND il.location_id = $${idx++}`;
      params.push(filters.locationId);
    }
    query += ` ORDER BY il.created_at DESC LIMIT $${idx++}`;
    params.push(filters?.limit || 500);
    const result = await pool.query(query, params);
    return result.rows;
  }

  async getSupplierOcrTemplate(supplierId: number): Promise<SupplierOcrTemplate | undefined> {
    const [row] = await db.select().from(supplierOcrTemplates).where(eq(supplierOcrTemplates.supplierId, supplierId));
    return row;
  }

  async upsertSupplierOcrTemplate(supplierId: number, data: { tableStartKeyword?: string | null; columnOrder?: string | null }): Promise<SupplierOcrTemplate> {
    const existing = await this.getSupplierOcrTemplate(supplierId);
    if (existing) {
      const [row] = await db.update(supplierOcrTemplates)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(supplierOcrTemplates.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db.insert(supplierOcrTemplates)
      .values({ supplierId, ...data })
      .returning();
    return row;
  }
  // ============ Chart of Accounts ============
  async getAccounts(): Promise<Account[]> {
    return db.select().from(accounts).orderBy(accounts.code);
  }

  async getAccount(id: number): Promise<Account | undefined> {
    const [row] = await db.select().from(accounts).where(eq(accounts.id, id));
    return row;
  }

  async createAccount(data: InsertAccount): Promise<Account> {
    const [row] = await db.insert(accounts).values(data).returning();
    return row;
  }

  async updateAccount(id: number, data: Partial<InsertAccount>): Promise<Account | undefined> {
    const [row] = await db.update(accounts).set(data).where(eq(accounts.id, id)).returning();
    return row;
  }

  async seedDefaultAccounts(): Promise<void> {
    const existing = await db.select().from(accounts);
    if (existing.length > 0) return;

    const defaults: InsertAccount[] = [
      { code: "1000", name: "الأصول", nameEn: "Assets", type: "asset", level: 1, isSystem: true },
      { code: "1100", name: "النقدية والبنوك", nameEn: "Cash & Banks", type: "asset", parentId: null, level: 2, isSystem: true },
      { code: "1101", name: "الصندوق", nameEn: "Cash in Hand", type: "asset", parentId: null, level: 3, isSystem: true },
      { code: "1102", name: "البنك", nameEn: "Bank Account", type: "asset", parentId: null, level: 3, isSystem: true },
      { code: "1200", name: "الذمم المدينة", nameEn: "Accounts Receivable", type: "asset", parentId: null, level: 2, isSystem: true },
      { code: "1201", name: "ذمم العملاء", nameEn: "Customer Receivables", type: "asset", parentId: null, level: 3, isSystem: true },
      { code: "1300", name: "المخزون", nameEn: "Inventory", type: "asset", parentId: null, level: 2, isSystem: true },
      { code: "1301", name: "بضاعة بالمخزن", nameEn: "Merchandise Inventory", type: "asset", parentId: null, level: 3, isSystem: true },
      { code: "2000", name: "الخصوم", nameEn: "Liabilities", type: "liability", level: 1, isSystem: true },
      { code: "2100", name: "الذمم الدائنة", nameEn: "Accounts Payable", type: "liability", parentId: null, level: 2, isSystem: true },
      { code: "2101", name: "ذمم الموردين", nameEn: "Supplier Payables", type: "liability", parentId: null, level: 3, isSystem: true },
      { code: "2200", name: "ضريبة القيمة المضافة", nameEn: "VAT Payable", type: "liability", parentId: null, level: 2, isSystem: true },
      { code: "3000", name: "حقوق الملكية", nameEn: "Equity", type: "equity", level: 1, isSystem: true },
      { code: "3100", name: "رأس المال", nameEn: "Capital", type: "equity", parentId: null, level: 2, isSystem: true },
      { code: "3200", name: "الأرباح المحتجزة", nameEn: "Retained Earnings", type: "equity", parentId: null, level: 2, isSystem: true },
      { code: "4000", name: "الإيرادات", nameEn: "Revenue", type: "revenue", level: 1, isSystem: true },
      { code: "4100", name: "إيرادات المبيعات", nameEn: "Sales Revenue", type: "revenue", parentId: null, level: 2, isSystem: true },
      { code: "4200", name: "مرتجعات المبيعات", nameEn: "Sales Returns", type: "revenue", parentId: null, level: 2, isSystem: true },
      { code: "5000", name: "المصروفات", nameEn: "Expenses", type: "expense", level: 1, isSystem: true },
      { code: "5100", name: "تكلفة البضاعة المباعة", nameEn: "Cost of Goods Sold", type: "expense", parentId: null, level: 2, isSystem: true },
      { code: "5200", name: "الرواتب والأجور", nameEn: "Salaries & Wages", type: "expense", parentId: null, level: 2, isSystem: true },
      { code: "5300", name: "الإيجارات", nameEn: "Rent", type: "expense", parentId: null, level: 2, isSystem: true },
      { code: "5400", name: "المصروفات العامة", nameEn: "General Expenses", type: "expense", parentId: null, level: 2, isSystem: true },
      { code: "5500", name: "مصروفات أخرى", nameEn: "Other Expenses", type: "expense", parentId: null, level: 2, isSystem: true },
    ];

    for (const acc of defaults) {
      await db.insert(accounts).values(acc).onConflictDoNothing();
    }

    const allAccounts = await db.select().from(accounts).orderBy(accounts.code);
    const codeToId: Record<string, number> = {};
    for (const a of allAccounts) codeToId[a.code] = a.id;

    const parentMap: Record<string, string> = {
      "1100": "1000", "1101": "1100", "1102": "1100",
      "1200": "1000", "1201": "1200",
      "1300": "1000", "1301": "1300",
      "2100": "2000", "2101": "2100",
      "2200": "2000",
      "3100": "3000", "3200": "3000",
      "4100": "4000", "4200": "4000",
      "5100": "5000", "5200": "5000", "5300": "5000", "5400": "5000", "5500": "5000",
    };

    for (const [childCode, parentCode] of Object.entries(parentMap)) {
      if (codeToId[childCode] && codeToId[parentCode]) {
        await db.update(accounts).set({ parentId: codeToId[parentCode] }).where(eq(accounts.id, codeToId[childCode]));
      }
    }
  }

  // ============ Journal Entries ============
  async getJournalEntries(filters?: { from?: string; to?: string; status?: string; sourceType?: string }): Promise<any[]> {
    let query = `
      SELECT je.*, u.name as created_by_name
      FROM journal_entries je
      LEFT JOIN users u ON u.id = je.created_by
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;
    if (filters?.from) {
      query += ` AND je.date >= $${idx++}`;
      params.push(filters.from);
    }
    if (filters?.to) {
      query += ` AND je.date <= $${idx++}`;
      params.push(filters.to);
    }
    if (filters?.status) {
      query += ` AND je.status = $${idx++}`;
      params.push(filters.status);
    }
    if (filters?.sourceType) {
      query += ` AND je.source_type = $${idx++}`;
      params.push(filters.sourceType);
    }
    query += ` ORDER BY je.date DESC, je.id DESC`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  async getJournalEntry(id: number): Promise<any> {
    const entryResult = await pool.query(`
      SELECT je.*, u.name as created_by_name
      FROM journal_entries je
      LEFT JOIN users u ON u.id = je.created_by
      WHERE je.id = $1
    `, [id]);
    if (entryResult.rows.length === 0) return null;

    const linesResult = await pool.query(`
      SELECT jel.*, a.code as account_code, a.name as account_name, a.name_en as account_name_en, a.type as account_type
      FROM journal_entry_lines jel
      JOIN accounts a ON a.id = jel.account_id
      WHERE jel.entry_id = $1
      ORDER BY jel.id
    `, [id]);

    return { ...entryResult.rows[0], lines: linesResult.rows };
  }

  async createJournalEntry(data: InsertJournalEntry, lines: InsertJournalEntryLine[]): Promise<JournalEntry> {
    const [entry] = await db.insert(journalEntries).values(data).returning();
    for (const line of lines) {
      await db.insert(journalEntryLines).values({ ...line, entryId: entry.id });
    }
    return entry;
  }

  async postJournalEntry(id: number): Promise<JournalEntry | undefined> {
    const entry = await this.getJournalEntry(id);
    if (!entry) return undefined;
    if (entry.status === "posted") return entry;

    const totalDebit = entry.lines.reduce((s: number, l: any) => s + parseFloat(l.debit || 0), 0);
    const totalCredit = entry.lines.reduce((s: number, l: any) => s + parseFloat(l.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error("القيد غير متوازن - المدين لا يساوي الدائن");
    }

    const [updated] = await db.update(journalEntries)
      .set({ status: "posted", postedAt: new Date(), totalDebit: totalDebit.toFixed(3), totalCredit: totalCredit.toFixed(3) })
      .where(eq(journalEntries.id, id))
      .returning();
    return updated;
  }

  async getNextEntryNumber(): Promise<string> {
    const result = await pool.query(`SELECT COUNT(*) as cnt FROM journal_entries`);
    const count = parseInt(result.rows[0].cnt) + 1;
    return `JE-${count.toString().padStart(5, "0")}`;
  }

  // ============ General Ledger ============
  async getGeneralLedger(accountId: number, from?: string, to?: string): Promise<any[]> {
    let query = `
      SELECT jel.id, jel.debit, jel.credit, jel.description as line_description,
             je.id as entry_id, je.entry_number, je.date, je.description, je.status, je.source_type
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.entry_id
      WHERE jel.account_id = $1 AND je.status = 'posted'
    `;
    const params: any[] = [accountId];
    let idx = 2;
    if (from) {
      query += ` AND je.date >= $${idx++}`;
      params.push(from);
    }
    if (to) {
      query += ` AND je.date <= $${idx++}`;
      params.push(to);
    }
    query += ` ORDER BY je.date ASC, je.id ASC`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  async getTrialBalance(from?: string, to?: string): Promise<any[]> {
    let query = `
      SELECT a.id, a.code, a.name, a.name_en, a.type, a.level, a.parent_id,
             COALESCE(SUM(CAST(jel.debit AS numeric)), 0) as total_debit,
             COALESCE(SUM(CAST(jel.credit AS numeric)), 0) as total_credit
      FROM accounts a
      LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jel.entry_id AND je.status = 'posted'
    `;
    const params: any[] = [];
    let idx = 1;
    if (from || to) {
      if (from) {
        query += ` AND je.date >= $${idx++}`;
        params.push(from);
      }
      if (to) {
        query += ` AND je.date <= $${idx++}`;
        params.push(to);
      }
    }
    query += ` GROUP BY a.id, a.code, a.name, a.name_en, a.type, a.level, a.parent_id
               HAVING COALESCE(SUM(CAST(jel.debit AS numeric)), 0) != 0 OR COALESCE(SUM(CAST(jel.credit AS numeric)), 0) != 0
               ORDER BY a.code`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  // ── Products (extended) ───────────────────────────────────────────────────

  async createProductWithVariants(
    productData: InsertProduct,
    variants: Omit<InsertProductVariant, "productId">[]
  ): Promise<{ product: Product; variants: ProductVariant[] }> {
    return db.transaction(async (tx) => {
      const [product] = await tx.insert(products).values(productData).returning();

      let createdVariants: ProductVariant[] = [];

      if (variants.length > 0) {
        createdVariants = await tx
          .insert(productVariants)
          .values(variants.map((v) => ({ ...v, productId: product.id })))
          .returning();
      } else if (productData.productType === "variable") {
        // auto-create a default variant for variable products with no variants supplied
        const sku = `SKU-${product.id}-${Date.now()}`;
        const [defaultVariant] = await tx
          .insert(productVariants)
          .values({
            productId: product.id,
            sku,
            price: productData.price,
            isDefault: true,
            active: true,
          })
          .returning();
        createdVariants = [defaultVariant];
      }

      return { product, variants: createdVariants };
    });
  }

  async getLocationInventoryByProduct(productId: number): Promise<any[]> {
    return db
      .select({
        locationId:   locationInventory.locationId,
        locationName: locations.name,
        locationCode: locations.code,
        branchId:     locations.branchId,
        branchName:   branches.name,
        qtyOnHand:    locationInventory.qtyOnHand,
        reorderLevel: locationInventory.reorderLevel,
        updatedAt:    locationInventory.updatedAt,
      })
      .from(locationInventory)
      .innerJoin(locations, eq(locationInventory.locationId, locations.id))
      .leftJoin(branches, eq(locations.branchId, branches.id))
      .where(eq(locationInventory.productId, productId))
      .orderBy(locations.name);
  }

  // ── Inventory Transactions (extended) ─────────────────────────────────────

  async getInventoryTransactions(filters?: {
    branchId?: number;
    productId?: number;
    type?: string;
    from?: string;
    to?: string;
    limit?: number;
  }): Promise<any[]> {
    const conditions: any[] = [];
    if (filters?.branchId)  conditions.push(eq(inventoryTransactions.branchId, filters.branchId));
    if (filters?.productId) conditions.push(eq(inventoryTransactions.productId, filters.productId));
    if (filters?.type)      conditions.push(eq(inventoryTransactions.type, filters.type));
    if (filters?.from)
      conditions.push(gte(inventoryTransactions.createdAt, new Date(filters.from + "T00:00:00")));
    if (filters?.to)
      conditions.push(lte(inventoryTransactions.createdAt, new Date(filters.to + "T23:59:59.999")));

    const cond = conditions.length > 0 ? and(...conditions) : undefined;

    return db
      .select({
        id:             inventoryTransactions.id,
        date:           inventoryTransactions.date,
        branchId:       inventoryTransactions.branchId,
        productId:      inventoryTransactions.productId,
        productName:    products.name,
        productBarcode: products.barcode,
        type:           inventoryTransactions.type,
        qty:            inventoryTransactions.qty,
        fromLocationId: inventoryTransactions.fromLocationId,
        toLocationId:   inventoryTransactions.toLocationId,
        refTable:       inventoryTransactions.refTable,
        refId:          inventoryTransactions.refId,
        note:           inventoryTransactions.note,
        createdBy:      inventoryTransactions.createdBy,
        createdByName:  users.name,
        createdAt:      inventoryTransactions.createdAt,
      })
      .from(inventoryTransactions)
      .innerJoin(products, eq(inventoryTransactions.productId, products.id))
      .leftJoin(users, eq(inventoryTransactions.createdBy, users.id))
      .where(cond)
      .orderBy(desc(inventoryTransactions.createdAt))
      .limit(filters?.limit ?? 200);
  }

  // ── Payroll UI helpers ─────────────────────────────────────────────────────

  async getPayrollEmployees(branchId?: number): Promise<any[]> {
    let query = `
      SELECT u.id, u.name, u.role, u.branch_id, b.name as branch_name,
             u.salary, u.salary_type, u.employment_status, u.commission_rate
      FROM users u
      LEFT JOIN branches b ON b.id = u.branch_id
      WHERE u.is_active = true AND u.employment_status != 'terminated'
    `;
    const params: any[] = [];
    if (branchId) {
      query += ` AND u.branch_id = $1`;
      params.push(branchId);
    }
    query += ` ORDER BY u.name`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  async getPayrollMovements(month: number, year: number, branchId?: number): Promise<any[]> {
    const paddedMonth = month.toString().padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    const dateFrom = `${year}-${paddedMonth}-01`;
    const dateTo   = `${year}-${paddedMonth}-${lastDay}`;
    const params: any[] = [dateFrom, dateTo, paddedMonth, year];
    let branchFilter = '';
    if (branchId) {
      branchFilter = `AND u.branch_id = $5`;
      params.push(branchId);
    }

    const result = await pool.query(`
      SELECT src.id, src.employee_id, u.name AS employee_name,
             src.source_table, src.type, src.amount::numeric AS amount,
             src.reason, src.date, src.created_by,
             uc.name AS created_by_name, src.status
      FROM (
        SELECT id, employee_id, 'advance'              AS type, amount, date,
               note                                    AS reason,
               created_by, 'employee_advances'         AS source_table,
               CASE WHEN settled THEN 'cancelled' ELSE 'active' END AS status
        FROM employee_advances
        WHERE date >= $1 AND date <= $2

        UNION ALL

        SELECT id, employee_id, 'deduction'            AS type, amount, date,
               reason, created_by, 'employee_deductions' AS source_table,
               CASE WHEN applied_in_payroll_id IS NOT NULL THEN 'cancelled' ELSE 'active' END AS status
        FROM employee_deductions
        WHERE date >= $1 AND date <= $2

        UNION ALL

        SELECT id, employee_id, 'commission'           AS type, amount, date,
               note                                    AS reason,
               created_by, 'employee_commissions'      AS source_table,
               status
        FROM employee_commissions
        WHERE month = $3 AND year = $4

        UNION ALL

        SELECT id, employee_id, 'bonus'                AS type, amount, date,
               note                                    AS reason,
               created_by, 'employee_entitlements'     AS source_table,
               status
        FROM employee_entitlements
        WHERE month = $3 AND year = $4
      ) src
      JOIN   users u  ON u.id  = src.employee_id
      LEFT JOIN users uc ON uc.id = src.created_by
      WHERE 1=1 ${branchFilter}
      ORDER BY src.date DESC
    `, params);

    return result.rows;
  }

  async getPayrollPayments(month: number, year: number, branchId?: number): Promise<any[]> {
    const paddedMonth = month.toString().padStart(2, '0');
    const params: any[] = [paddedMonth, year];
    let branchFilter = '';
    if (branchId) {
      branchFilter = `AND (sp.branch_id = $3 OR u.branch_id = $3)`;
      params.push(branchId);
    }

    const result = await pool.query(`
      SELECT sp.*, u.name AS employee_name, b.name AS branch_name,
             ub.name AS paid_by_name, pr.month, pr.year
      FROM salary_payments sp
      JOIN  payroll_runs pr ON pr.id  = sp.payroll_id
      JOIN  users u         ON u.id   = sp.employee_id
      LEFT JOIN branches b  ON b.id   = sp.branch_id
      LEFT JOIN users ub    ON ub.id  = sp.paid_by
      WHERE pr.month = $1 AND pr.year = $2
      ${branchFilter}
      ORDER BY sp.created_at DESC
    `, params);

    return result.rows;
  }

  async addPayrollPayment(data: {
    employeeId: number;
    month: number;
    year: number;
    amount: number | string;
    paymentMethod: string;
    paidBy: number;
    branchId?: number;
    note?: string;
    referenceNo?: string;
  }): Promise<any> {
    const paddedMonth = data.month.toString().padStart(2, '0');

    // 1. Find or create a payroll_run for this period
    const runResult = await pool.query(
      `SELECT id FROM payroll_runs WHERE month = $1 AND year = $2 AND status != 'cancelled' LIMIT 1`,
      [paddedMonth, data.year]
    );
    let payrollId: number;
    if (runResult.rows.length === 0) {
      const [newRun] = await db.insert(payrollRuns).values({
        month: paddedMonth,
        year: data.year,
        status: 'approved',
        createdBy: data.paidBy,
      }).returning();
      payrollId = newRun.id;
    } else {
      payrollId = runResult.rows[0].id;
    }

    // 2. Find or create a payroll_detail for this employee in this run
    const detailResult = await pool.query(
      `SELECT id FROM payroll_details WHERE payroll_id = $1 AND employee_id = $2 LIMIT 1`,
      [payrollId, data.employeeId]
    );
    let payrollDetailId: number;
    if (detailResult.rows.length === 0) {
      const empResult = await pool.query(
        `SELECT salary FROM users WHERE id = $1`,
        [data.employeeId]
      );
      const empSalary = parseFloat(empResult.rows[0]?.salary ?? '0');
      const [newDetail] = await db.insert(payrollDetails).values({
        payrollId,
        employeeId: data.employeeId,
        basicSalary: empSalary.toFixed(3),
        netSalary: empSalary.toFixed(3),
      }).returning();
      payrollDetailId = newDetail.id;
    } else {
      payrollDetailId = detailResult.rows[0].id;
    }

    // 3. Record the payment (handles ledger + run status update)
    return this.createSalaryPayment({
      payrollId,
      payrollDetailId,
      employeeId: data.employeeId,
      amount: typeof data.amount === 'number' ? data.amount.toFixed(3) : data.amount,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: data.paymentMethod,
      referenceNo: data.referenceNo ?? null,
      branchId: data.branchId ?? null,
      paidBy: data.paidBy,
      note: data.note ?? null,
    });
  }
}

export const storage = new DatabaseStorage();
