// Phase 8.3 — Unit tests for deductOrderInventory + restoreOrderInventory
// storage.getOrder / getOrderItems are spied on (they use Drizzle, not pool)
// pool is mocked via vi.hoisted() for the transaction client

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist mocks before vi.mock factory runs ───────────────────────────────────
const { mockPoolQuery, mockPoolConnect } = vi.hoisted(() => ({
  mockPoolQuery: vi.fn(),
  mockPoolConnect: vi.fn(),
}));

vi.mock("../../server/db", () => ({
  pool: { query: mockPoolQuery, connect: mockPoolConnect },
  // db (Drizzle) is used by getOrder/getOrderItems — we spy on those instead
  db: {},
}));

// Import storage after mock is set up
import { DatabaseStorage } from "../../server/storage";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeClient(overrides: Record<number, unknown> = {}) {
  let callIndex = 0;
  const clientQuery = vi.fn().mockImplementation(async (sql: string) => {
    const result = overrides[callIndex] ?? { rows: [] };
    callIndex++;
    return result;
  });
  return { query: clientQuery, release: vi.fn(), _getCalls: () => callIndex };
}

/** Standard order fixture */
const ORDER = { id: 1, branchId: 1, status: "new" };

/** Standard 1-item fixture: productId=5, quantity=3 */
const ITEMS = [{ id: 1, orderId: 1, productId: 5, variantId: null, quantity: 3, unitPrice: "25.000" }];

// ── deductOrderInventory ──────────────────────────────────────────────────────

describe("deductOrderInventory", () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new DatabaseStorage();
  });

  // ── Helper: wire up spies + client responses for a standard deduct ──────────
  function setupDeductSuccess(availableQty = 10, balanceExists = true) {
    vi.spyOn(storage, "getOrder").mockResolvedValue(ORDER as any);
    vi.spyOn(storage, "getOrderItems").mockResolvedValue(ITEMS as any);

    // Client query call sequence (per item, qty=3):
    // 0: BEGIN
    // 1: SELECT id FROM locations (branch default) → { id: 10 }
    // 2: SELECT pv.id as variant_id → { variant_id: 7 }
    // 3: SELECT id FROM inventory_balances FOR UPDATE → []
    // 4: SELECT COALESCE(SUM...) total_available → availableQty
    // 5: SELECT qty_on_hand FROM inventory_balances → exists or not
    // 6: UPDATE inventory_balances -qty  (or INSERT)
    // 7: INSERT inventory_ledger
    // 8: INSERT location_inventory ON CONFLICT
    // 9: COMMIT

    const client = makeClient({
      0: { rows: [] },                                          // BEGIN
      1: { rows: [{ id: 10 }] },                               // branch location
      2: { rows: [{ variant_id: 7 }] },                        // variant lookup
      3: { rows: [] },                                          // FOR UPDATE lock
      4: { rows: [{ total_available: String(availableQty) }] }, // availability check
      5: balanceExists ? { rows: [{ qty_on_hand: String(availableQty) }] } : { rows: [] }, // balance row
      6: { rows: [] },                                          // UPDATE/INSERT balance
      7: { rows: [] },                                          // ledger insert
      8: { rows: [] },                                          // location_inventory
      9: { rows: [] },                                          // COMMIT
    });
    mockPoolConnect.mockResolvedValue(client);
    return client;
  }

  it("returns early if order has no branchId", async () => {
    vi.spyOn(storage, "getOrder").mockResolvedValue({ id: 1, branchId: null } as any);
    vi.spyOn(storage, "getOrderItems").mockResolvedValue(ITEMS as any);

    await storage.deductOrderInventory(1, 99);

    expect(mockPoolConnect).not.toHaveBeenCalled();
  });

  it("returns early if order has no items", async () => {
    vi.spyOn(storage, "getOrder").mockResolvedValue(ORDER as any);
    vi.spyOn(storage, "getOrderItems").mockResolvedValue([]);

    await storage.deductOrderInventory(1, 99);

    expect(mockPoolConnect).not.toHaveBeenCalled();
  });

  it("updates inventory_balances by subtracting quantity", async () => {
    const client = setupDeductSuccess();
    await storage.deductOrderInventory(1, 99);

    const updateCall = client.query.mock.calls.find(
      ([sql]: [string]) => sql.includes("qty_on_hand = qty_on_hand -")
    );
    expect(updateCall).toBeDefined();
    // Params: [qty, locationId, variantId]
    expect(updateCall![1]).toEqual([3, 10, 7]);
  });

  it("inserts inventory_ledger with reason='order_completed' and negative qty_change", async () => {
    const client = setupDeductSuccess();
    await storage.deductOrderInventory(1, 99);

    const ledgerCall = client.query.mock.calls.find(
      ([sql]: [string]) => sql.includes("inventory_ledger") && sql.includes("order_completed")
    );
    expect(ledgerCall).toBeDefined();
    // Params: [variantId, locationId, qty_change, orderId, changedBy]
    const params = ledgerCall![1];
    expect(params[0]).toBe(7);   // variantId
    expect(params[1]).toBe(10);  // locationId
    expect(params[2]).toBe(-3);  // negative qty_change
    expect(params[3]).toBe(1);   // orderId
    expect(params[4]).toBe(99);  // changedBy
  });

  it("upserts location_inventory (product-level) by subtracting quantity", async () => {
    const client = setupDeductSuccess();
    await storage.deductOrderInventory(1, 99);

    const locInvCall = client.query.mock.calls.find(
      ([sql]: [string]) =>
        sql.includes("location_inventory") && sql.includes("qty_on_hand -")
    );
    expect(locInvCall).toBeDefined();
    // Params: [locationId, productId, qty]
    const params = locInvCall![1];
    expect(params[0]).toBe(10); // locationId
    expect(params[1]).toBe(5);  // productId
    expect(params[2]).toBe(3);  // quantity
  });

  it("throws if available stock is less than required quantity", async () => {
    vi.spyOn(storage, "getOrder").mockResolvedValue(ORDER as any);
    vi.spyOn(storage, "getOrderItems").mockResolvedValue(ITEMS as any);

    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })                       // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 10 }] })            // branch location
      .mockResolvedValueOnce({ rows: [{ variant_id: 7 }] })     // variant
      .mockResolvedValueOnce({ rows: [] })                       // FOR UPDATE
      .mockResolvedValueOnce({ rows: [{ total_available: "1" }] }) // only 1 available, need 3
      .mockResolvedValueOnce({ rows: [{ name: "حقيبة جلد" }] }) // product name for error msg
      .mockResolvedValueOnce({ rows: [] });                      // ROLLBACK
    const client = { query: clientQuery, release: vi.fn() };
    mockPoolConnect.mockResolvedValue(client);

    await expect(storage.deductOrderInventory(1, 99)).rejects.toThrow(
      /المخزون غير كاف/
    );
  });

  it("calls ROLLBACK and releases client on error", async () => {
    vi.spyOn(storage, "getOrder").mockResolvedValue(ORDER as any);
    vi.spyOn(storage, "getOrderItems").mockResolvedValue(ITEMS as any);

    // Client throws on branch location lookup
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })      // BEGIN
      .mockRejectedValueOnce(new Error("DB down")); // branch location → throws
    const client = { query: clientQuery, release: vi.fn() };
    mockPoolConnect.mockResolvedValue(client);

    // Re-mock ROLLBACK after the throw
    clientQuery.mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(storage.deductOrderInventory(1, 99)).rejects.toThrow("DB down");

    const rollbackCall = clientQuery.mock.calls.find(
      ([sql]: [string]) => sql === "ROLLBACK"
    );
    expect(rollbackCall).toBeDefined();
    expect(client.release).toHaveBeenCalled();
  });

  it("uses INSERT (not UPDATE) for inventory_balances when balance row doesn't exist", async () => {
    const client = setupDeductSuccess(10, false); // balanceExists = false
    await storage.deductOrderInventory(1, 99);

    const insertBalCall = client.query.mock.calls.find(
      ([sql]: [string]) =>
        sql.includes("INSERT INTO inventory_balances") && sql.includes("0 -")
    );
    expect(insertBalCall).toBeDefined();
    expect(insertBalCall![1]).toEqual([10, 7, 3]); // locationId, variantId, qty
  });

  it("commits transaction on success", async () => {
    const client = setupDeductSuccess();
    await storage.deductOrderInventory(1, 99);

    const commitCall = client.query.mock.calls.find(
      ([sql]: [string]) => sql === "COMMIT"
    );
    expect(commitCall).toBeDefined();
  });

  it("releases client after successful deduction", async () => {
    const client = setupDeductSuccess();
    await storage.deductOrderInventory(1, 99);
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});

// ── restoreOrderInventory ─────────────────────────────────────────────────────

describe("restoreOrderInventory", () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new DatabaseStorage();
  });

  function setupRestoreSuccess() {
    vi.spyOn(storage, "getOrder").mockResolvedValue(ORDER as any);
    vi.spyOn(storage, "getOrderItems").mockResolvedValue(ITEMS as any);

    // Client query call sequence (per item):
    // 0: BEGIN
    // 1: SELECT id FROM locations (branch default) → { id: 10 }
    // 2: SELECT pv.id as variant_id → { variant_id: 7 }
    // 3: UPDATE inventory_balances +qty
    // 4: INSERT inventory_ledger
    // 5: INSERT location_inventory ON CONFLICT
    // 6: COMMIT

    const client = makeClient({
      0: { rows: [] },             // BEGIN
      1: { rows: [{ id: 10 }] },  // branch location
      2: { rows: [{ variant_id: 7 }] }, // variant
      3: { rows: [] },             // UPDATE balance
      4: { rows: [] },             // ledger
      5: { rows: [] },             // location_inventory
      6: { rows: [] },             // COMMIT
    });
    mockPoolConnect.mockResolvedValue(client);
    return client;
  }

  it("returns early if order has no branchId", async () => {
    vi.spyOn(storage, "getOrder").mockResolvedValue({ id: 1, branchId: null } as any);
    vi.spyOn(storage, "getOrderItems").mockResolvedValue(ITEMS as any);

    await storage.restoreOrderInventory(1, 99);

    expect(mockPoolConnect).not.toHaveBeenCalled();
  });

  it("returns early if order has no items", async () => {
    vi.spyOn(storage, "getOrder").mockResolvedValue(ORDER as any);
    vi.spyOn(storage, "getOrderItems").mockResolvedValue([]);

    await storage.restoreOrderInventory(1, 99);

    expect(mockPoolConnect).not.toHaveBeenCalled();
  });

  it("updates inventory_balances by ADDING quantity back", async () => {
    const client = setupRestoreSuccess();
    await storage.restoreOrderInventory(1, 99);

    const updateCall = client.query.mock.calls.find(
      ([sql]: [string]) => sql.includes("qty_on_hand = qty_on_hand +")
    );
    expect(updateCall).toBeDefined();
    expect(updateCall![1]).toEqual([3, 10, 7]); // qty, locationId, variantId
  });

  it("inserts inventory_ledger with reason='order_cancelled' and positive qty_change", async () => {
    const client = setupRestoreSuccess();
    await storage.restoreOrderInventory(1, 99);

    const ledgerCall = client.query.mock.calls.find(
      ([sql]: [string]) => sql.includes("inventory_ledger") && sql.includes("order_cancelled")
    );
    expect(ledgerCall).toBeDefined();
    const params = ledgerCall![1];
    expect(params[0]).toBe(7);   // variantId
    expect(params[1]).toBe(10);  // locationId
    expect(params[2]).toBe(3);   // POSITIVE qty_change (restore)
    expect(params[3]).toBe(1);   // orderId
    expect(params[4]).toBe(99);  // changedBy
  });

  it("upserts location_inventory (product-level) by ADDING quantity back", async () => {
    const client = setupRestoreSuccess();
    await storage.restoreOrderInventory(1, 99);

    const locInvCall = client.query.mock.calls.find(
      ([sql]: [string]) =>
        sql.includes("location_inventory") && sql.includes("qty_on_hand + $3")
    );
    expect(locInvCall).toBeDefined();
    const params = locInvCall![1];
    expect(params[0]).toBe(10); // locationId
    expect(params[1]).toBe(5);  // productId
    expect(params[2]).toBe(3);  // quantity
  });

  it("does NOT perform a stock availability check (no FOR UPDATE)", async () => {
    const client = setupRestoreSuccess();
    await storage.restoreOrderInventory(1, 99);

    const forUpdateCall = client.query.mock.calls.find(
      ([sql]: [string]) => sql.includes("FOR UPDATE")
    );
    expect(forUpdateCall).toBeUndefined();
  });

  it("commits transaction on success", async () => {
    const client = setupRestoreSuccess();
    await storage.restoreOrderInventory(1, 99);

    const commitCall = client.query.mock.calls.find(
      ([sql]: [string]) => sql === "COMMIT"
    );
    expect(commitCall).toBeDefined();
  });

  it("calls ROLLBACK and releases client on error", async () => {
    vi.spyOn(storage, "getOrder").mockResolvedValue(ORDER as any);
    vi.spyOn(storage, "getOrderItems").mockResolvedValue(ITEMS as any);

    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })       // BEGIN
      .mockRejectedValueOnce(new Error("lock timeout")); // branch location → throws
    const client = { query: clientQuery, release: vi.fn() };
    mockPoolConnect.mockResolvedValue(client);

    clientQuery.mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(storage.restoreOrderInventory(1, 99)).rejects.toThrow("lock timeout");

    const rollbackCall = clientQuery.mock.calls.find(
      ([sql]: [string]) => sql === "ROLLBACK"
    );
    expect(rollbackCall).toBeDefined();
    expect(client.release).toHaveBeenCalled();
  });

  it("releases client after successful restore", async () => {
    const client = setupRestoreSuccess();
    await storage.restoreOrderInventory(1, 99);
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
