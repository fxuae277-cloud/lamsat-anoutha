import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const PAYMENT_METHODS = ["cash", "card", "bank_transfer"] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

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
  name: text("name").notNull(),
  phone: text("phone"),
  city: text("city"),
  address: text("address"),
});
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true });
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
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true, createdAt: true });
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
  branchId: integer("branch_id").references(() => branches.id).notNull(),
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
});
export const insertPurchaseInvoiceSchema = createInsertSchema(purchaseInvoices).omit({ id: true, createdAt: true });
export type InsertPurchaseInvoice = z.infer<typeof insertPurchaseInvoiceSchema>;
export type PurchaseInvoice = typeof purchaseInvoices.$inferSelect;

export const purchaseItems = pgTable("purchase_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  purchaseId: integer("purchase_id").references(() => purchaseInvoices.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
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
});
export const insertLocationInventorySchema = createInsertSchema(locationInventory).omit({ id: true, updatedAt: true });
export type InsertLocationInventory = z.infer<typeof insertLocationInventorySchema>;
export type LocationInventory = typeof locationInventory.$inferSelect;

export const inventoryTransactions = pgTable("inventory_transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  date: date("date").notNull(),
  branchId: integer("branch_id").references(() => branches.id).notNull(),
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
