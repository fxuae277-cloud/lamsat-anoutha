// Phase 8.5 — Edge case unit tests
// Covers boundary conditions, graceful degradation, and idempotency guards

import { describe, it, expect, vi, beforeEach } from "vitest";
import { orderItemSchema } from "../../server/validation";

// ── Pool mock ─────────────────────────────────────────────────────────────────
const { mockPoolQuery, mockPoolConnect } = vi.hoisted(() => ({
  mockPoolQuery: vi.fn(),
  mockPoolConnect: vi.fn(),
}));

vi.mock("../../server/db", () => ({
  pool: { query: mockPoolQuery, connect: mockPoolConnect },
  db: {
    select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }),
  },
}));

import { DatabaseStorage } from "../../server/storage";

// ── Fixtures ──────────────────────────────────────────────────────────────────
const ORDER = { id: 1, branchId: 1, status: "new" };
const ITEM = { id: 1, orderId: 1, productId: 5, variantId: null, quantity: 3, unitPrice: "25.000" };

// ── Guard logic (mirror of routes.ts — regression anchors) ────────────────────
function shouldDeductInventory(next: string, old: string) {
  return next === "completed" && old !== "completed";
}
function shouldRestoreInventory(next: string, old: string) {
  return next === "cancelled" && old === "completed";
}

// ── Test 1: Product with no variant → createOrder skips inventory lock ────────

describe("createOrder — product with no variant", () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new DatabaseStorage();
  });

  it("proceeds without FOR UPDATE lock when variant lookup returns no rows", async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })                // BEGIN
      .mockResolvedValueOnce({ rows: [] })                // variant lookup → no variant
      .mockResolvedValueOnce({ rows: [{ id: 1, order_number: "ORD-001" }] }) // INSERT orders
      .mockResolvedValueOnce({ rows: [] })                // INSERT order_items
      .mockResolvedValueOnce({ rows: [] });               // COMMIT
    const client = { query: clientQuery, release: vi.fn() };
    mockPoolConnect.mockResolvedValue(client);

    await storage.createOrder(
      { orderNumber: "ORD-001", customerName: "عميل", branchId: 1, total: "75" } as any,
      [{ productId: 5, quantity: 3, unitPrice: "25" } as any]
    );

    const forUpdateCall = clientQuery.mock.calls.find(
      ([sql]: [string]) => sql.includes("FOR UPDATE")
    );
    expect(forUpdateCall).toBeUndefined();

    const insertOrderCall = clientQuery.mock.calls.find(
      ([sql]: [string]) => sql.includes("INSERT INTO orders")
    );
    expect(insertOrderCall).toBeDefined();
  });
});

// ── Test 2: Boundary — qty = stock + 1 → deductOrderInventory throws ─────────

describe("deductOrderInventory — boundary: qty = available + 1", () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new DatabaseStorage();
  });

  it("throws Arabic insufficient-stock error when qty exceeds available by 1", async () => {
    vi.spyOn(storage, "getOrder").mockResolvedValue(ORDER as any);
    vi.spyOn(storage, "getOrderItems").mockResolvedValue(
      [{ ...ITEM, quantity: 6 }] as any   // need 6, only 5 available
    );

    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })                        // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 10 }] })              // branch location
      .mockResolvedValueOnce({ rows: [{ variant_id: 7 }] })       // variant
      .mockResolvedValueOnce({ rows: [] })                        // FOR UPDATE
      .mockResolvedValueOnce({ rows: [{ total_available: "5" }] }) // available=5, need 6
      .mockResolvedValueOnce({ rows: [{ name: "منتج حدود" }] })   // product name
      .mockResolvedValueOnce({ rows: [] });                       // ROLLBACK
    const client = { query: clientQuery, release: vi.fn() };
    mockPoolConnect.mockResolvedValue(client);

    await expect(storage.deductOrderInventory(1, 99)).rejects.toThrow(/المخزون غير كاف/);

    const rollbackCall = clientQuery.mock.calls.find(
      ([sql]: [string]) => sql === "ROLLBACK"
    );
    expect(rollbackCall).toBeDefined();
    expect(client.release).toHaveBeenCalled();
  });

  it("succeeds when qty equals available exactly (boundary: qty = stock)", async () => {
    vi.spyOn(storage, "getOrder").mockResolvedValue(ORDER as any);
    vi.spyOn(storage, "getOrderItems").mockResolvedValue(
      [{ ...ITEM, quantity: 5 }] as any  // need 5, exactly 5 available
    );

    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })                        // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 10 }] })              // branch location
      .mockResolvedValueOnce({ rows: [{ variant_id: 7 }] })       // variant
      .mockResolvedValueOnce({ rows: [] })                        // FOR UPDATE
      .mockResolvedValueOnce({ rows: [{ total_available: "5" }] }) // available=5, need 5 ✓
      .mockResolvedValueOnce({ rows: [{ qty_on_hand: "5" }] })    // balance row exists
      .mockResolvedValueOnce({ rows: [] })                        // UPDATE balance
      .mockResolvedValueOnce({ rows: [] })                        // ledger
      .mockResolvedValueOnce({ rows: [] })                        // location_inventory
      .mockResolvedValueOnce({ rows: [] });                       // COMMIT
    const client = { query: clientQuery, release: vi.fn() };
    mockPoolConnect.mockResolvedValue(client);

    await expect(storage.deductOrderInventory(1, 99)).resolves.not.toThrow();
  });
});

// ── Test 3: qty = 0 rejected by Zod (regression anchor) ──────────────────────

describe("orderItemSchema — qty = 0 regression anchor", () => {
  it("rejects quantity = 0", () => {
    expect(
      orderItemSchema.safeParse({ productId: 1, quantity: 0, unitPrice: 10 }).success
    ).toBe(false);
  });

  it("accepts quantity = 1 (minimum valid)", () => {
    expect(
      orderItemSchema.safeParse({ productId: 1, quantity: 1, unitPrice: 10 }).success
    ).toBe(true);
  });
});

// ── Test 4: Order with null customerPhone → accepted ─────────────────────────

describe("createOrder — null customerPhone is nullable", () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new DatabaseStorage();
  });

  it("INSERT orders params contain null at customerPhone position", async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })                            // BEGIN
      .mockResolvedValueOnce({ rows: [] })                            // variant lookup (no variant)
      .mockResolvedValueOnce({ rows: [{ id: 1, order_number: "ORD-002" }] }) // INSERT orders
      .mockResolvedValueOnce({ rows: [] })                            // INSERT order_items
      .mockResolvedValueOnce({ rows: [] });                           // COMMIT
    const client = { query: clientQuery, release: vi.fn() };
    mockPoolConnect.mockResolvedValue(client);

    await storage.createOrder(
      {
        orderNumber: "ORD-002",
        customerName: "عميل بدون هاتف",
        customerPhone: null,   // ← explicitly null
        branchId: 1,
        total: "50",
      } as any,
      [{ productId: 5, quantity: 1, unitPrice: "50" } as any]
    );

    const insertCall = clientQuery.mock.calls.find(
      ([sql]: [string]) => sql.includes("INSERT INTO orders")
    );
    expect(insertCall).toBeDefined();
    // customerPhone is param $4 (0-indexed: params[3])
    const params = insertCall![1] as unknown[];
    expect(params[3]).toBeNull();
  });
});

// ── Test 5: Duplicate deduction guard (regression anchor from Phase 8.3) ─────

describe("duplicate deduction prevention — regression anchor", () => {
  it("completed → completed: shouldDeductInventory returns false", () => {
    expect(shouldDeductInventory("completed", "completed")).toBe(false);
  });

  it("new → completed: shouldDeductInventory returns true (first time only)", () => {
    expect(shouldDeductInventory("completed", "new")).toBe(true);
  });
});

// ── Test 6: Double restore guard (regression anchor from Phase 8.3) ──────────

describe("double restore prevention — regression anchor", () => {
  it("cancelled → cancelled: shouldRestoreInventory returns false", () => {
    expect(shouldRestoreInventory("cancelled", "cancelled")).toBe(false);
  });

  it("new → cancelled: shouldRestoreInventory returns false (nothing was deducted)", () => {
    expect(shouldRestoreInventory("cancelled", "new")).toBe(false);
  });

  it("completed → cancelled: shouldRestoreInventory returns true", () => {
    expect(shouldRestoreInventory("cancelled", "completed")).toBe(true);
  });
});

// ── Test 7: Sale with no variant → skips inventory_balances, inserts sale_items

describe("createSale — product with no variant", () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new DatabaseStorage();
  });

  it("skips inventory_balances UPDATE but still inserts sale_items and location_inventory", async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })                            // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 10 }] })                  // branch location
      .mockResolvedValueOnce({ rows: [{ id: 1, invoice_number: "INV-NV", total: "50", payment_method: "cash" }] }) // INSERT sales
      .mockResolvedValueOnce({ rows: [] })                            // variant lookup → no variant
      // variantId is undefined → if(variantId) block skipped entirely, if(!variantId) runs:
      .mockResolvedValueOnce({ rows: [] })                            // SELECT qty_on_hand FROM location_inventory
      .mockResolvedValueOnce({ rows: [] })                            // INSERT location_inventory (ON CONFLICT)
      .mockResolvedValueOnce({ rows: [] })                            // SELECT unit_cost_final (no purchase cost)
      .mockResolvedValueOnce({ rows: [{ avg_cost: "0" }] })           // SELECT avg_cost
      .mockResolvedValueOnce({ rows: [] })                            // INSERT sale_items
      .mockResolvedValueOnce({ rows: [] })                            // INSERT inventory_transactions
      .mockResolvedValueOnce({ rows: [] })                            // UPDATE sales cogs/profit
      .mockResolvedValueOnce({ rows: [] })                            // UPDATE products.stock_qty (ISS-006)
      .mockResolvedValueOnce({ rows: [] })                            // INSERT cash_ledger
      .mockResolvedValueOnce({ rows: [] });                           // COMMIT

    const client = { query: clientQuery, release: vi.fn() };
    mockPoolConnect.mockResolvedValue(client);

    await storage.createSale(
      { branchId: 1, paymentMethod: "cash", total: "50", vat: "0", invoiceNumber: "INV-NV" } as any,
      [{ productId: 5, quantity: 1, unitPrice: "50", total: "50" } as any]
    );

    // inventory_balances UPDATE/INSERT NOT called
    const balanceUpdate = clientQuery.mock.calls.find(
      ([sql]: [string]) => sql.includes("inventory_balances") && (sql.includes("UPDATE") || sql.includes("INSERT INTO inventory_balances"))
    );
    expect(balanceUpdate).toBeUndefined();

    // FOR UPDATE lock NOT called
    const forUpdate = clientQuery.mock.calls.find(
      ([sql]: [string]) => sql.includes("FOR UPDATE")
    );
    expect(forUpdate).toBeUndefined();

    // sale_items INSERT IS called
    const saleItemsInsert = clientQuery.mock.calls.find(
      ([sql]: [string]) => sql.includes("INSERT INTO sale_items")
    );
    expect(saleItemsInsert).toBeDefined();

    // location_inventory INSERT IS called (product-level still deducts)
    const locInvInsert = clientQuery.mock.calls.find(
      ([sql]: [string]) => sql.includes("INSERT INTO location_inventory")
    );
    expect(locInvInsert).toBeDefined();
  });
});

// ── Test 8: Availability check scoped to correct branchId ─────────────────────

describe("createSale — availability check uses correct branchId", () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new DatabaseStorage();
  });

  it("COALESCE availability query is called with branchId=1, not branchId=2", async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })                             // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 10 }] })                   // branch location
      .mockResolvedValueOnce({ rows: [{ id: 1, invoice_number: "INV-B", total: "75", payment_method: "cash" }] }) // INSERT sales
      .mockResolvedValueOnce({ rows: [{ variant_id: 7 }] })            // variant
      .mockResolvedValueOnce({ rows: [] })                             // FOR UPDATE
      .mockResolvedValueOnce({ rows: [{ total_available: "20" }] })    // availability check
      .mockResolvedValueOnce({ rows: [{ qty_on_hand: "20" }] })        // balance row
      .mockResolvedValueOnce({ rows: [] })                             // UPDATE balance
      .mockResolvedValueOnce({ rows: [] })                             // ledger
      .mockResolvedValueOnce({ rows: [] })                             // unit_cost_final (no purchase)
      .mockResolvedValueOnce({ rows: [{ avg_cost: "25" }] })           // avg_cost
      .mockResolvedValueOnce({ rows: [] })                             // sale_items
      .mockResolvedValueOnce({ rows: [] })                             // inventory_transactions
      .mockResolvedValueOnce({ rows: [] })                             // UPDATE cogs
      .mockResolvedValueOnce({ rows: [] })                             // UPDATE products.stock_qty (ISS-006)
      .mockResolvedValueOnce({ rows: [] })                             // cash_ledger
      .mockResolvedValueOnce({ rows: [] });                            // COMMIT
    const client = { query: clientQuery, release: vi.fn() };
    mockPoolConnect.mockResolvedValue(client);

    await storage.createSale(
      { branchId: 1, paymentMethod: "cash", total: "75", vat: "0", invoiceNumber: "INV-B" } as any,
      [{ productId: 5, quantity: 3, unitPrice: "25", total: "75" } as any]
    );

    // Find the COALESCE availability SUM query
    const availCheck = clientQuery.mock.calls.find(
      ([sql]: [string]) => sql.includes("COALESCE(SUM") && sql.includes("total_available")
    );
    expect(availCheck).toBeDefined();
    // params: [branchId, variantId]
    expect(availCheck![1][0]).toBe(1);  // branchId = 1, not 2
    expect(availCheck![1][1]).toBe(7);  // variantId
  });
});
