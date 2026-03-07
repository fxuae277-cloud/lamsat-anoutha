import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const PAYMENT_METHODS = ["cash", "card", "bank_transfer"] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

export const SALARY_TYPES = ["monthly", "daily", "commission"] as const;
export type SalaryType = typeof SALARY_TYPES[number];

export const branches = pgTable("branches", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  address: text("address"),
  isMain: boolean("is_main").default(false),
});
export const insertBranchSchema = createInsertSchema(branches).omit({ id: true });
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type Branch = typeof branches.$inferSelect;

export const cities = pgTable("cities", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  branchId: integer("branch_id").references(() => branches.id),
});
export const insertCitySchema = createInsertSchema(cities).omit({ id: true });
export type InsertCity = z.infer<typeof insertCitySchema>;
export type City = typeof cities.$inferSelect;

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("employee"),
  branchId: integer("branch_id").references(() => branches.id).notNull(),
  terminalName: text("terminal_name").notNull().default("T1"),
  isActive: boolean("is_active").notNull().default(true),
  pin: text("pin"),
  phone: text("phone"),
  salary: decimal("salary", { precision: 10, scale: 3 }).default("0"),
  salaryType: text("salary_type").default("monthly"),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default("0"),
  uiLanguage: text("ui_language").notNull().default("ar"),
});
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const categories = pgTable("categories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
});
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

export const products = pgTable("products", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  barcode: text("barcode").unique(),
  name: text("name").notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  branchId: integer("branch_id").references(() => branches.id),
  price: decimal("price", { precision: 10, scale: 3 }).notNull(),
  image: text("image"),
  active: boolean("active").default(true),
  avgCost: decimal("avg_cost", { precision: 10, scale: 3 }).default("0"),
  stockQty: integer("stock_qty").default(0),
});
export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export const warehouses = pgTable("warehouses", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  branchId: integer("branch_id").references(() => branches.id),
  isMain: boolean("is_main").default(false),
});
export const insertWarehouseSchema = createInsertSchema(warehouses).omit({ id: true });
export type InsertWarehouse = z.infer<typeof insertWarehouseSchema>;
export type Warehouse = typeof warehouses.$inferSelect;

export const inventory = pgTable("inventory", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  productId: integer("product_id").references(() => products.id).notNull(),
  warehouseId: integer("warehouse_id").references(() => warehouses.id).notNull(),
  quantity: integer("quantity").notNull().default(0),
  minQuantity: integer("min_quantity").default(5),
});
export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true });
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type Inventory = typeof inventory.$inferSelect;

export const inventoryTransfers = pgTable("inventory_transfers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  productId: integer("product_id").references(() => products.id).notNull(),
  fromWarehouseId: integer("from_warehouse_id").references(() => warehouses.id).notNull(),
  toWarehouseId: integer("to_warehouse_id").references(() => warehouses.id).notNull(),
  quantity: integer("quantity").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});
export const insertInventoryTransferSchema = createInsertSchema(inventoryTransfers).omit({ id: true, createdAt: true });
export type InsertInventoryTransfer = z.infer<typeof insertInventoryTransferSchema>;
export type InventoryTransfer = typeof inventoryTransfers.$inferSelect;

export const customers = pgTable("customers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name"),
  phone: text("phone"),
  city: text("city"),
  address: text("address"),
  notes: text("notes"),
  active: boolean("active").default(true),
  branchId: integer("branch_id").references(() => branches.id),
  totalSpent: decimal("total_spent", { precision: 12, scale: 3 }).default("0"),
  visits: integer("visits").default(0),
  invoiceCount: integer("invoice_count").default(0),
  lastVisit: timestamp("last_visit"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, totalSpent: true, visits: true, invoiceCount: true, lastVisit: true, createdAt: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

export const suppliers = pgTable("suppliers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  taxNo: text("tax_no"),
  crNo: text("cr_no"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  totalPurchases: decimal("total_purchases", { precision: 12, scale: 3 }).default("0"),
  balance: decimal("balance", { precision: 12, scale: 3 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true, createdAt: true, totalPurchases: true, balance: true });
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;

export const sales = pgTable("sales", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  invoiceNumber: text("invoice_number").notNull(),
  branchId: integer("branch_id").references(() => branches.id).notNull(),
  shiftId: integer("shift_id").references(() => shifts.id),
  cashierId: integer("cashier_id").references(() => users.id),
  customerId: integer("customer_id").references(() => customers.id),
  subtotal: decimal("subtotal", { precision: 10, scale: 3 }).notNull(),
  discount: decimal("discount", { precision: 10, scale: 3 }).default("0"),
  discountType: text("discount_type").default("value"),
  vat: decimal("vat", { precision: 10, scale: 3 }).notNull(),
  total: decimal("total", { precision: 10, scale: 3 }).notNull(),
  paymentMethod: text("payment_method").notNull().default("cash"),
  bankTxnId: text("bank_txn_id"),
  bankReceiptImage: text("bank_receipt_image"),
  cogsTotal: decimal("cogs_total", { precision: 10, scale: 3 }).default("0"),
  grossProfit: decimal("gross_profit", { precision: 10, scale: 3 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertSaleSchema = createInsertSchema(sales).omit({ id: true, createdAt: true });
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof sales.$inferSelect;

export const saleItems = pgTable("sale_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  saleId: integer("sale_id").references(() => sales.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 3 }).notNull(),
  total: decimal("total", { precision: 10, scale: 3 }).notNull(),
  unitCostAtSale: decimal("unit_cost_at_sale", { precision: 10, scale: 3 }).default("0"),
  lineCogs: decimal("line_cogs", { precision: 10, scale: 3 }).default("0"),
});
export const insertSaleItemSchema = createInsertSchema(saleItems).omit({ id: true });
export type InsertSaleItem = z.infer<typeof insertSaleItemSchema>;
export type SaleItem = typeof saleItems.$inferSelect;

export const shifts = pgTable("shifts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  branchId: integer("branch_id").references(() => branches.id).notNull(),
  cashierId: integer("cashier_id").references(() => users.id).notNull(),
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
  totalSales: decimal("total_sales", { precision: 10, scale: 3 }).default("0"),
  totalCash: decimal("total_cash", { precision: 10, scale: 3 }).default("0"),
  totalBank: decimal("total_bank", { precision: 10, scale: 3 }).default("0"),
  openingCash: decimal("opening_cash", { precision: 12, scale: 3 }).default("0"),
  expectedCash: decimal("expected_cash", { precision: 12, scale: 3 }),
  actualCash: decimal("actual_cash", { precision: 12, scale: 3 }),
  difference: decimal("difference", { precision: 12, scale: 3 }),
  terminalName: text("terminal_name").notNull().default("UNKNOWN"),
  status: text("status").default("open"),
});
export const insertShiftSchema = createInsertSchema(shifts).omit({ id: true, startedAt: true });
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type Shift = typeof shifts.$inferSelect;

export const orders = pgTable("orders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  orderNumber: text("order_number").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  city: text("city"),
  address: text("address"),
  branchId: integer("branch_id").references(() => branches.id),
  shiftId: integer("shift_id").references(() => shifts.id),
  employeeId: integer("employee_id").references(() => users.id),
  deliveryType: text("delivery_type").default("pickup"),
  status: text("status").default("new"),
  paymentMethod: text("payment_method").default("cash"),
  bankTxnId: text("bank_txn_id"),
  total: decimal("total", { precision: 10, scale: 3 }),
  cogsTotal: decimal("cogs_total", { precision: 10, scale: 3 }).default("0"),
  grossProfit: decimal("gross_profit", { precision: 10, scale: 3 }).default("0"),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, paidAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export const orderItems = pgTable("order_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 3 }).notNull(),
  total: decimal("total", { precision: 10, scale: 3 }).notNull(),
  unitCostAtSale: decimal("unit_cost_at_sale", { precision: 10, scale: 3 }).default("0"),
  lineCogs: decimal("line_cogs", { precision: 10, scale: 3 }).default("0"),
});
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true });
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

export const expenses = pgTable("expenses", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  branchId: integer("branch_id").references(() => branches.id).notNull(),
  shiftId: integer("shift_id").references(() => shifts.id),
  category: text("category").notNull(),
  amount: decimal("amount", { precision: 10, scale: 3 }).notNull(),
  source: text("source").notNull().default("cash"),
  date: date("date").notNull(),
  notes: text("notes"),
  receiptImage: text("receipt_image"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

export const cashLedger = pgTable("cash_ledger", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  date: date("date").notNull(),
  branchId: integer("branch_id").references(() => branches.id).notNull(),
  shiftId: integer("shift_id").references(() => shifts.id),
  type: text("type").notNull(),
  amountIn: decimal("amount_in", { precision: 12, scale: 3 }).default("0"),
  amountOut: decimal("amount_out", { precision: 12, scale: 3 }).default("0"),
  category: text("category"),
  note: text("note"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertCashLedgerSchema = createInsertSchema(cashLedger).omit({ id: true, createdAt: true });
export type InsertCashLedger = z.infer<typeof insertCashLedgerSchema>;
export type CashLedger = typeof cashLedger.$inferSelect;

export const bankLedger = pgTable("bank_ledger", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  date: date("date").notNull(),
  branchId: integer("branch_id").references(() => branches.id).notNull(),
  shiftId: integer("shift_id").references(() => shifts.id),
  method: text("method").notNull(),
  amountIn: decimal("amount_in", { precision: 12, scale: 3 }).default("0"),
  amountOut: decimal("amount_out", { precision: 12, scale: 3 }).default("0"),
  refId: text("ref_id"),
  category: text("category"),
  note: text("note"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertBankLedgerSchema = createInsertSchema(bankLedger).omit({ id: true, createdAt: true });
export type InsertBankLedger = z.infer<typeof insertBankLedgerSchema>;
export type BankLedger = typeof bankLedger.$inferSelect;

export const employees = pgTable("employees", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  phone: text("phone"),
  branchId: integer("branch_id").references(() => branches.id),
  salary: decimal("salary", { precision: 10, scale: 3 }).notNull(),
  role: text("role"),
});
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;

export const purchaseInvoices = pgTable("purchase_invoices", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  invoiceNumber: text("invoice_number").notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id).notNull(),
  branchId: integer("branch_id").references(() => branches.id),
  invoiceDate: date("invoice_date").notNull(),
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 3 }).default("0"),
  customsCost: decimal("customs_cost", { precision: 10, scale: 3 }).default("0"),
  clearanceCost: decimal("clearance_cost", { precision: 10, scale: 3 }).default("0"),
  otherCost: decimal("other_cost", { precision: 10, scale: 3 }).default("0"),
  subtotal: decimal("subtotal", { precision: 10, scale: 3 }).default("0"),
  totalExtraCost: decimal("total_extra_cost", { precision: 10, scale: 3 }).default("0"),
  grandTotal: decimal("grand_total", { precision: 10, scale: 3 }).default("0"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 3 }).default("0"),
  receivedAt: timestamp("received_at"),
});
export const insertPurchaseInvoiceSchema = createInsertSchema(purchaseInvoices).omit({ id: true, createdAt: true, receivedAt: true });
export type InsertPurchaseInvoice = z.infer<typeof insertPurchaseInvoiceSchema>;
export type PurchaseInvoice = typeof purchaseInvoices.$inferSelect;

export const purchaseItems = pgTable("purchase_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  purchaseId: integer("purchase_id").references(() => purchaseInvoices.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  variantId: integer("variant_id"),
  qty: integer("qty").notNull(),
  unitCostBase: decimal("unit_cost_base", { precision: 10, scale: 3 }).notNull(),
  lineSubtotal: decimal("line_subtotal", { precision: 10, scale: 3 }).notNull(),
  allocatedExtraCost: decimal("allocated_extra_cost", { precision: 10, scale: 3 }).default("0"),
  unitCostFinal: decimal("unit_cost_final", { precision: 10, scale: 3 }).default("0"),
});
export const insertPurchaseItemSchema = createInsertSchema(purchaseItems).omit({ id: true });
export type InsertPurchaseItem = z.infer<typeof insertPurchaseItemSchema>;
export type PurchaseItem = typeof purchaseItems.$inferSelect;

export const locations = pgTable("locations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  branchId: integer("branch_id").references(() => branches.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().default("MAIN_WAREHOUSE"),
  isMain: boolean("is_main").notNull().default(false),
  kind: text("kind").default("BRANCH_STORE"),
  isCentral: boolean("is_central").notNull().default(false),
  isBranchDefault: boolean("is_branch_default").notNull().default(false),
  active: boolean("active").notNull().default(true),
});
export const insertLocationSchema = createInsertSchema(locations).omit({ id: true });
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locations.$inferSelect;

export const locationInventory = pgTable("location_inventory", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  locationId: integer("location_id").references(() => locations.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  qtyOnHand: integer("qty_on_hand").notNull().default(0),
  reorderLevel: integer("reorder_level").notNull().default(5),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  uniqueIndex("uq_location_product").on(t.locationId, t.productId),
]);
export const insertLocationInventorySchema = createInsertSchema(locationInventory).omit({ id: true, updatedAt: true });
export type InsertLocationInventory = z.infer<typeof insertLocationInventorySchema>;
export type LocationInventory = typeof locationInventory.$inferSelect;

export const inventoryTransactions = pgTable("inventory_transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  date: date("date").notNull(),
  branchId: integer("branch_id").references(() => branches.id),
  fromLocationId: integer("from_location_id").references(() => locations.id),
  toLocationId: integer("to_location_id").references(() => locations.id),
  productId: integer("product_id").references(() => products.id).notNull(),
  type: text("type").notNull(),
  qty: integer("qty").notNull().default(0),
  refTable: text("ref_table"),
  refId: integer("ref_id"),
  note: text("note"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertInventoryTransactionSchema = createInsertSchema(inventoryTransactions).omit({ id: true, createdAt: true });
export type InsertInventoryTransaction = z.infer<typeof insertInventoryTransactionSchema>;
export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;

export const locationTransfers = pgTable("location_transfers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  branchId: integer("branch_id").references(() => branches.id).notNull(),
  fromLocationId: integer("from_location_id").references(() => locations.id).notNull(),
  toLocationId: integer("to_location_id").references(() => locations.id).notNull(),
  note: text("note"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertLocationTransferSchema = createInsertSchema(locationTransfers).omit({ id: true, createdAt: true });
export type InsertLocationTransfer = z.infer<typeof insertLocationTransferSchema>;
export type LocationTransfer = typeof locationTransfers.$inferSelect;

export const locationTransferItems = pgTable("location_transfer_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  transferId: integer("transfer_id").references(() => locationTransfers.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  qty: integer("qty").notNull(),
});
export const insertLocationTransferItemSchema = createInsertSchema(locationTransferItems).omit({ id: true });
export type InsertLocationTransferItem = z.infer<typeof insertLocationTransferItemSchema>;
export type LocationTransferItem = typeof locationTransferItems.$inferSelect;

export const saleReturns = pgTable("sale_returns", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  returnNumber: text("return_number").notNull(),
  saleId: integer("sale_id").references(() => sales.id).notNull(),
  branchId: integer("branch_id").references(() => branches.id).notNull(),
  shiftId: integer("shift_id").references(() => shifts.id),
  refundAmount: decimal("refund_amount", { precision: 10, scale: 3 }).notNull(),
  refundMethod: text("refund_method").notNull().default("cash"),
  cogsReturned: decimal("cogs_returned", { precision: 10, scale: 3 }).default("0"),
  reason: text("reason"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertSaleReturnSchema = createInsertSchema(saleReturns).omit({ id: true, createdAt: true });
export type InsertSaleReturn = z.infer<typeof insertSaleReturnSchema>;
export type SaleReturn = typeof saleReturns.$inferSelect;

export const saleReturnItems = pgTable("sale_return_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  returnId: integer("return_id").references(() => saleReturns.id).notNull(),
  saleItemId: integer("sale_item_id").references(() => saleItems.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 3 }).notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 3 }).default("0"),
  lineTotal: decimal("line_total", { precision: 10, scale: 3 }).notNull(),
  lineCogs: decimal("line_cogs", { precision: 10, scale: 3 }).default("0"),
});
export const insertSaleReturnItemSchema = createInsertSchema(saleReturnItems).omit({ id: true });
export type InsertSaleReturnItem = z.infer<typeof insertSaleReturnItemSchema>;
export type SaleReturnItem = typeof saleReturnItems.$inferSelect;

export const auditLog = pgTable("audit_log", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  branchId: integer("branch_id").references(() => branches.id),
  userId: integer("user_id").references(() => users.id),
  userName: text("user_name"),
  details: text("details"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertAuditLogSchema = createInsertSchema(auditLog).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLog.$inferSelect;

export const payrollRuns = pgTable("payroll_runs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  month: text("month").notNull(),
  year: integer("year").notNull(),
  status: text("status").notNull().default("draft"),
  totalBasic: decimal("total_basic", { precision: 12, scale: 3 }).default("0"),
  totalCommission: decimal("total_commission", { precision: 12, scale: 3 }).default("0"),
  totalDeductions: decimal("total_deductions", { precision: 12, scale: 3 }).default("0"),
  totalAdvances: decimal("total_advances", { precision: 12, scale: 3 }).default("0"),
  totalNet: decimal("total_net", { precision: 12, scale: 3 }).default("0"),
  note: text("note"),
  createdBy: integer("created_by").references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
});
export const insertPayrollRunSchema = createInsertSchema(payrollRuns).omit({ id: true, createdAt: true, approvedAt: true });
export type InsertPayrollRun = z.infer<typeof insertPayrollRunSchema>;
export type PayrollRun = typeof payrollRuns.$inferSelect;

export const payrollDetails = pgTable("payroll_details", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  payrollId: integer("payroll_id").references(() => payrollRuns.id).notNull(),
  employeeId: integer("employee_id").references(() => users.id).notNull(),
  basicSalary: decimal("basic_salary", { precision: 10, scale: 3 }).notNull(),
  commission: decimal("commission", { precision: 10, scale: 3 }).default("0"),
  deductions: decimal("deductions", { precision: 10, scale: 3 }).default("0"),
  advances: decimal("advances", { precision: 10, scale: 3 }).default("0"),
  bonus: decimal("bonus", { precision: 10, scale: 3 }).default("0"),
  netSalary: decimal("net_salary", { precision: 10, scale: 3 }).notNull(),
  note: text("note"),
});
export const insertPayrollDetailSchema = createInsertSchema(payrollDetails).omit({ id: true });
export type InsertPayrollDetail = z.infer<typeof insertPayrollDetailSchema>;
export type PayrollDetail = typeof payrollDetails.$inferSelect;

export const employeeAdvances = pgTable("employee_advances", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  employeeId: integer("employee_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 3 }).notNull(),
  date: date("date").notNull(),
  note: text("note"),
  settled: boolean("settled").notNull().default(false),
  settledInPayrollId: integer("settled_in_payroll_id").references(() => payrollRuns.id),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertEmployeeAdvanceSchema = createInsertSchema(employeeAdvances).omit({ id: true, createdAt: true });
export type InsertEmployeeAdvance = z.infer<typeof insertEmployeeAdvanceSchema>;
export type EmployeeAdvance = typeof employeeAdvances.$inferSelect;

export const employeeDeductions = pgTable("employee_deductions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  employeeId: integer("employee_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 3 }).notNull(),
  reason: text("reason").notNull(),
  date: date("date").notNull(),
  appliedInPayrollId: integer("applied_in_payroll_id").references(() => payrollRuns.id),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertEmployeeDeductionSchema = createInsertSchema(employeeDeductions).omit({ id: true, createdAt: true });
export type InsertEmployeeDeduction = z.infer<typeof insertEmployeeDeductionSchema>;
export type EmployeeDeduction = typeof employeeDeductions.$inferSelect;

export const stocktakes = pgTable("stocktakes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  branchId: integer("branch_id").references(() => branches.id).notNull(),
  locationId: integer("location_id").references(() => locations.id).notNull(),
  status: text("status").notNull().default("draft"),
  note: text("note"),
  totalItems: integer("total_items").default(0),
  matchedItems: integer("matched_items").default(0),
  surplusItems: integer("surplus_items").default(0),
  shortageItems: integer("shortage_items").default(0),
  createdBy: integer("created_by").references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});
export const insertStocktakeSchema = createInsertSchema(stocktakes).omit({ id: true, createdAt: true, completedAt: true });
export type InsertStocktake = z.infer<typeof insertStocktakeSchema>;
export type Stocktake = typeof stocktakes.$inferSelect;

export const stocktakeItems = pgTable("stocktake_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  stocktakeId: integer("stocktake_id").references(() => stocktakes.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  systemQty: integer("system_qty").notNull().default(0),
  countedQty: integer("counted_qty"),
  difference: integer("difference").default(0),
  note: text("note"),
});
export const insertStocktakeItemSchema = createInsertSchema(stocktakeItems).omit({ id: true });
export type InsertStocktakeItem = z.infer<typeof insertStocktakeItemSchema>;
export type StocktakeItem = typeof stocktakeItems.$inferSelect;

export const inventoryAdjustments = pgTable("inventory_adjustments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  branchId: integer("branch_id").references(() => branches.id).notNull(),
  locationId: integer("location_id").references(() => locations.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  type: text("type").notNull(),
  qtyBefore: integer("qty_before").notNull(),
  qtyChange: integer("qty_change").notNull(),
  qtyAfter: integer("qty_after").notNull(),
  reason: text("reason").notNull(),
  stocktakeId: integer("stocktake_id").references(() => stocktakes.id),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertInventoryAdjustmentSchema = createInsertSchema(inventoryAdjustments).omit({ id: true, createdAt: true });
export type InsertInventoryAdjustment = z.infer<typeof insertInventoryAdjustmentSchema>;
export type InventoryAdjustment = typeof inventoryAdjustments.$inferSelect;

export const productVariants = pgTable("product_variants", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  productId: integer("product_id").references(() => products.id).notNull(),
  sku: text("sku").unique(),
  barcode: text("barcode").unique(),
  color: text("color"),
  size: text("size"),
  costDefault: decimal("cost_default", { precision: 10, scale: 3 }),
  price: decimal("price", { precision: 10, scale: 3 }).notNull(),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertProductVariantSchema = createInsertSchema(productVariants).omit({ id: true, createdAt: true });
export type InsertProductVariant = z.infer<typeof insertProductVariantSchema>;
export type ProductVariant = typeof productVariants.$inferSelect;

export const inventoryBalances = pgTable("inventory_balances", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  locationId: integer("location_id").references(() => locations.id).notNull(),
  variantId: integer("variant_id").references(() => productVariants.id).notNull(),
  qtyOnHand: integer("qty_on_hand").notNull().default(0),
  qtyReserved: integer("qty_reserved").notNull().default(0),
});
export const insertInventoryBalanceSchema = createInsertSchema(inventoryBalances).omit({ id: true });
export type InsertInventoryBalance = z.infer<typeof insertInventoryBalanceSchema>;
export type InventoryBalance = typeof inventoryBalances.$inferSelect;

export const stockTransfers = pgTable("stock_transfers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  fromLocationId: integer("from_location_id").references(() => locations.id).notNull(),
  toLocationId: integer("to_location_id").references(() => locations.id).notNull(),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
});
export const insertStockTransferSchema = createInsertSchema(stockTransfers).omit({ id: true, createdAt: true, approvedAt: true });
export type InsertStockTransfer = z.infer<typeof insertStockTransferSchema>;
export type StockTransfer = typeof stockTransfers.$inferSelect;

export const stockTransferLines = pgTable("stock_transfer_lines", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  transferId: integer("transfer_id").references(() => stockTransfers.id).notNull(),
  variantId: integer("variant_id").references(() => productVariants.id).notNull(),
  qty: integer("qty").notNull(),
});
export const insertStockTransferLineSchema = createInsertSchema(stockTransferLines).omit({ id: true });
export type InsertStockTransferLine = z.infer<typeof insertStockTransferLineSchema>;
export type StockTransferLine = typeof stockTransferLines.$inferSelect;

export const inventoryLedger = pgTable("inventory_ledger", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  variantId: integer("variant_id").references(() => productVariants.id).notNull(),
  locationId: integer("location_id").references(() => locations.id).notNull(),
  qtyChange: integer("qty_change").notNull(),
  reason: text("reason").notNull(),
  refTable: text("ref_table"),
  refId: integer("ref_id"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertInventoryLedgerSchema = createInsertSchema(inventoryLedger).omit({ id: true, createdAt: true });
export type InsertInventoryLedger = z.infer<typeof insertInventoryLedgerSchema>;
export type InventoryLedger = typeof inventoryLedger.$inferSelect;

export const purchaseExtraCosts = pgTable("purchase_extra_costs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  purchaseInvoiceId: integer("purchase_invoice_id").references(() => purchaseInvoices.id).notNull(),
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 3 }).notNull(),
  notes: text("notes"),
});
export const insertPurchaseExtraCostSchema = createInsertSchema(purchaseExtraCosts).omit({ id: true });
export type InsertPurchaseExtraCost = z.infer<typeof insertPurchaseExtraCostSchema>;
export type PurchaseExtraCost = typeof purchaseExtraCosts.$inferSelect;

export const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"] as const;
export type AccountType = typeof ACCOUNT_TYPES[number];

export const accounts = pgTable("accounts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  type: text("type").notNull(),
  parentId: integer("parent_id"),
  level: integer("level").default(1),
  isSystem: boolean("is_system").default(false),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true, createdAt: true });
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accounts.$inferSelect;

export const journalEntries = pgTable("journal_entries", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  entryNumber: text("entry_number").notNull(),
  date: date("date").notNull(),
  description: text("description").notNull(),
  status: text("status").default("draft"),
  sourceType: text("source_type"),
  sourceId: integer("source_id"),
  totalDebit: decimal("total_debit", { precision: 12, scale: 3 }).default("0"),
  totalCredit: decimal("total_credit", { precision: 12, scale: 3 }).default("0"),
  branchId: integer("branch_id").references(() => branches.id),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  postedAt: timestamp("posted_at"),
});
export const insertJournalEntrySchema = createInsertSchema(journalEntries).omit({ id: true, createdAt: true, postedAt: true });
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalEntry = typeof journalEntries.$inferSelect;

export const journalEntryLines = pgTable("journal_entry_lines", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  entryId: integer("entry_id").references(() => journalEntries.id).notNull(),
  accountId: integer("account_id").references(() => accounts.id).notNull(),
  debit: decimal("debit", { precision: 12, scale: 3 }).default("0"),
  credit: decimal("credit", { precision: 12, scale: 3 }).default("0"),
  description: text("description"),
});
export const insertJournalEntryLineSchema = createInsertSchema(journalEntryLines).omit({ id: true });
export type InsertJournalEntryLine = z.infer<typeof insertJournalEntryLineSchema>;
export type JournalEntryLine = typeof journalEntryLines.$inferSelect;

export const supplierOcrTemplates = pgTable("supplier_ocr_templates", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  supplierId: integer("supplier_id").references(() => suppliers.id).notNull(),
  invoiceNoPattern: text("invoice_no_pattern"),
  datePattern: text("date_pattern"),
  tableStartKeyword: text("table_start_keyword"),
  columnOrder: text("column_order"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertSupplierOcrTemplateSchema = createInsertSchema(supplierOcrTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSupplierOcrTemplate = z.infer<typeof insertSupplierOcrTemplateSchema>;
export type SupplierOcrTemplate = typeof supplierOcrTemplates.$inferSelect;
