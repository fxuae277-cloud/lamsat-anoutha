// Static in-memory test fixtures — no DB, no network
// Use these objects directly in unit tests or as seeds for integration tests (Phase 8.2+)

export const adminUser = {
  id: 1,
  username: "admin_test",
  password: "$2b$10$hashedpassword", // bcrypt hash placeholder
  name: "مدير النظام",
  role: "admin" as const,
  branchId: 1,
  isActive: true,
  createdAt: new Date("2025-01-01T00:00:00Z"),
};

export const staffUser = {
  id: 2,
  username: "staff_test",
  password: "$2b$10$hashedpassword",
  name: "موظف المبيعات",
  role: "employee" as const,
  branchId: 1,
  isActive: true,
  createdAt: new Date("2025-01-01T00:00:00Z"),
};

export const branch = {
  id: 1,
  name: "الفرع الرئيسي",
  address: "الرياض، حي العليا",
  phone: "0501234567",
  isActive: true,
  createdAt: new Date("2025-01-01T00:00:00Z"),
};

export const location = {
  id: 1,
  branchId: 1,
  name: "المستودع الرئيسي",
  isActive: true,
  createdAt: new Date("2025-01-01T00:00:00Z"),
};

export const product = {
  id: 1,
  name: "منتج تجريبي",
  sku: "TEST-001",
  barcode: "1234567890123",
  price: "50.00",
  cost: "30.00",
  categoryId: null,
  isActive: true,
  trackInventory: true,
  createdAt: new Date("2025-01-01T00:00:00Z"),
};

export const productVariant = {
  id: 1,
  productId: 1,
  name: "الحجم الكبير",
  sku: "TEST-001-L",
  barcode: "1234567890124",
  price: "60.00",
  isActive: true,
  createdAt: new Date("2025-01-01T00:00:00Z"),
};

export const inventory = {
  locationId: 1,
  productId: 1,
  qtyOnHand: 10,
  updatedAt: new Date("2025-01-01T00:00:00Z"),
};

export const sampleOrder = {
  id: 1,
  orderNumber: "ORD-2025-0001",
  branchId: 1,
  customerId: null,
  status: "pending" as const,
  total: "150.00",
  notes: null,
  createdBy: 1,
  createdAt: new Date("2025-01-15T10:00:00Z"),
  items: [
    {
      id: 1,
      orderId: 1,
      productId: 1,
      variantId: null,
      qty: 3,
      unitPrice: "50.00",
      total: "150.00",
    },
  ],
};
