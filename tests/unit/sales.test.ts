// Phase 8.5 — Unit tests for storage.createSale()
// pool mocked via vi.hoisted(); db mocked as chainable stub for post-commit select

import { describe, it, expect, vi, beforeEach } from "vitest";
import { orderItemSchema } from "../../server/validation";

// ── Hoist pool mocks ──────────────────────────────────────────────────────────
const { mockPoolConnect } = vi.hoisted(() => ({
  mockPoolConnect: vi.fn(),
}));

// Sale fixture returned by the post-commit db.select()
const SALE_FIXTURE = {
  id: 1, invoiceNumber: "INV-001", branchId: 1, cashierId: 2,
  total: "105.000", vat: "5.000", subtotal: "100.000",
  paymentMethod: "cash", cogsTotal: "60.000", grossProfit: "40.000",
  createdAt: new Date("2025-01-15T10:00:00Z"),
};

vi.mock("../../server/db", () => ({
  pool: { connect: mockPoolConnect },
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve([SALE_FIXTURE]),
      }),
    }),
  },
  // eq is used in the where clause argument — just pass through
  eq: (_col: unknown, _val: unknown) => ({}),
}));

import { DatabaseStorage } from "../../server/storage";

// ── Shared sale data ──────────────────────────────────────────────────────────
const SALE_DATA = {
  branchId: 1,
  cashierId: 2,
  paymentMethod: "cash" as const,
  total: "105",
  vat: "5",
  subtotal: "100",
  shiftId: null,
  invoiceNumber: "INV-TEST",
} as any;

const SALE_ITEM = {
  productId: 5,
  quantity: 3,
  unitPrice: "35",
  total: "105",
} as any;

// ── Helper: build sequential client.query mock ────────────────────────────────
// Full sequence for a 1-item sale (variant exists, balance exists)
// avgCost = 20, qty = 3 → COGS = 60, grossProfit = total(105) - COGS(60) = 45

function makeHappyPathClient(opts: {
  paymentMethod?: "cash" | "card" | "bank_transfer";
  availableQty?: number;
  avgCost?: string;
  saleTotal?: string;
  itemQty?: number;
  shiftId?: number | null;
} = {}) {
  const {
    paymentMethod = "cash",
    availableQty = 10,
    avgCost = "20",
    saleTotal = "105",
    itemQty = 3,
    shiftId = null,
  } = opts;

  const saleRow = {
    id: 1,
    invoice_number: "INV-001",
    total: saleTotal,
    payment_method: paymentMethod,
    bank_txn_id: null,
  };

  const calls = vi.fn()
    .mockResolvedValueOnce({ rows: [] })                              // BEGIN
    .mockResolvedValueOnce({ rows: [{ id: 10 }] })                   // branch location
    .mockResolvedValueOnce({ rows: [saleRow] })                      // INSERT sales
    // ── item loop ──
    .mockResolvedValueOnce({ rows: [{ variant_id: 7 }] })            // variant
    .mockResolvedValueOnce({ rows: [] })                             // FOR UPDATE
    .mockResolvedValueOnce({ rows: [{ total_available: String(availableQty) }] }) // availability
    .mockResolvedValueOnce({ rows: [{ qty_on_hand: String(availableQty) }] })     // balance row
    .mockResolvedValueOnce({ rows: [] })                             // UPDATE balance -qty
    .mockResolvedValueOnce({ rows: [] })                             // INSERT ledger sale_out
    .mockResolvedValueOnce({ rows: [] })                             // SELECT unit_cost_final (none)
    .mockResolvedValueOnce({ rows: [{ avg_cost: avgCost }] })        // SELECT avg_cost
    .mockResolvedValueOnce({ rows: [] })                             // INSERT sale_items
    .mockResolvedValueOnce({ rows: [] });                            // INSERT inventory_transactions

  // If shiftId present, UPDATE shifts before ledger
  if (shiftId) {
    calls.mockResolvedValueOnce({ rows: [] });                       // UPDATE shifts
  }

  calls
    .mockResolvedValueOnce({ rows: [] })                             // UPDATE cogs_total/gross_profit
    .mockResolvedValueOnce({ rows: [] })                             // UPDATE products.stock_qty (ISS-006)
    .mockResolvedValueOnce({ rows: [] })                             // INSERT cash/bank_ledger
    .mockResolvedValueOnce({ rows: [] });                            // COMMIT

  return { query: calls, release: vi.fn() };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("createSale — inventory deduction", () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new DatabaseStorage();
  });

  it("deducts inventory_balances by correct quantity on valid sale", async () => {
    const client = makeHappyPathClient({ itemQty: 3 });
    mockPoolConnect.mockResolvedValue(client);

    await storage.createSale(SALE_DATA, [SALE_ITEM]);

    const updateCall = client.query.mock.calls.find(
      ([sql]: [string]) => sql.includes("qty_on_hand = qty_on_hand -")
    );
    expect(updateCall).toBeDefined();
    // params: [qty, locationId, variantId]
    expect(updateCall![1]).toEqual([3, 10, 7]);
  });

  it("inserts inventory_ledger entry with reason='sale_out' and negative qty_change", async () => {
    const client = makeHappyPathClient();
    mockPoolConnect.mockResolvedValue(client);

    await storage.createSale(SALE_DATA, [SALE_ITEM]);

    const ledgerCall = client.query.mock.calls.find(
      ([sql]: [string]) => sql.includes("inventory_ledger") && sql.includes("sale_out")
    );
    expect(ledgerCall).toBeDefined();
    const params = ledgerCall![1];
    expect(params[0]).toBe(7);   // variantId
    expect(params[1]).toBe(10);  // locationId
    expect(params[2]).toBe(-3);  // negative qty_change
  });
});

describe("createSale — insufficient stock", () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new DatabaseStorage();
  });

  it("throws Arabic error and rolls back when stock < quantity", async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })                             // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 10 }] })                  // branch location
      .mockResolvedValueOnce({ rows: [{ id: 1, invoice_number: "INV-F", total: "150", payment_method: "cash" }] }) // INSERT sales
      .mockResolvedValueOnce({ rows: [{ variant_id: 7 }] })           // variant
      .mockResolvedValueOnce({ rows: [] })                            // FOR UPDATE
      .mockResolvedValueOnce({ rows: [{ total_available: "2", tracked_rows: "1" }] }) // only 2 available (tracked)
      .mockResolvedValueOnce({ rows: [{ name: "حقيبة جلد" }] })      // product name for error
      .mockResolvedValueOnce({ rows: [] });                           // ROLLBACK
    const client = { query: clientQuery, release: vi.fn() };
    mockPoolConnect.mockResolvedValue(client);

    await expect(
      storage.createSale(
        SALE_DATA,
        [{ productId: 5, quantity: 5, unitPrice: "30", total: "150" } as any]
      )
    ).rejects.toThrow(/المخزون غير كاف/);

    const rollback = clientQuery.mock.calls.find(
      ([sql]: [string]) => sql === "ROLLBACK"
    );
    expect(rollback).toBeDefined();
    expect(client.release).toHaveBeenCalled();
  });
});

describe("createSale — Zod quantity validation (regression anchor)", () => {
  it("rejects negative quantity via orderItemSchema", () => {
    expect(
      orderItemSchema.safeParse({ productId: 1, quantity: -1, unitPrice: 10 }).success
    ).toBe(false);
  });

  it("rejects quantity = 0 via orderItemSchema", () => {
    expect(
      orderItemSchema.safeParse({ productId: 1, quantity: 0, unitPrice: 10 }).success
    ).toBe(false);
  });

  it("accepts quantity = 1", () => {
    expect(
      orderItemSchema.safeParse({ productId: 1, quantity: 1, unitPrice: 10 }).success
    ).toBe(true);
  });
});

describe("createSale — COGS calculation", () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new DatabaseStorage();
  });

  it("UPDATE sales cogs_total = unitCost × qty and gross_profit = total - cogs", async () => {
    // avg_cost=20, qty=3 → cogs=60; sale.total=105 → grossProfit=45
    const client = makeHappyPathClient({ avgCost: "20", saleTotal: "105" });
    mockPoolConnect.mockResolvedValue(client);

    await storage.createSale(
      { ...SALE_DATA, total: "105" },
      [{ ...SALE_ITEM, quantity: 3 }]
    );

    const cogsUpdate = client.query.mock.calls.find(
      ([sql]: [string]) => sql.includes("cogs_total") && sql.includes("gross_profit")
    );
    expect(cogsUpdate).toBeDefined();
    const params = cogsUpdate![1];
    expect(params[0]).toBe("60.000");  // cogs_total
    expect(params[1]).toBe("45.000");  // gross_profit = 105 - 60
  });
});

describe("createSale — payment ledger routing", () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new DatabaseStorage();
  });

  it("cash payment → INSERT cash_ledger, no bank_ledger", async () => {
    const client = makeHappyPathClient({ paymentMethod: "cash" });
    mockPoolConnect.mockResolvedValue(client);

    await storage.createSale({ ...SALE_DATA, paymentMethod: "cash" }, [SALE_ITEM]);

    const cashLedger = client.query.mock.calls.find(
      ([sql]: [string]) => sql.includes("INSERT INTO cash_ledger")
    );
    const bankLedger = client.query.mock.calls.find(
      ([sql]: [string]) => sql.includes("INSERT INTO bank_ledger")
    );
    expect(cashLedger).toBeDefined();
    expect(bankLedger).toBeUndefined();
  });

  it("card payment → INSERT bank_ledger, no cash_ledger", async () => {
    const saleRow = {
      id: 1, invoice_number: "INV-002", total: "105", payment_method: "card", bank_txn_id: null,
    };
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 10 }] })
      .mockResolvedValueOnce({ rows: [saleRow] })
      .mockResolvedValueOnce({ rows: [{ variant_id: 7 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total_available: "10" }] })
      .mockResolvedValueOnce({ rows: [{ qty_on_hand: "10" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })                             // UPDATE balance
      .mockResolvedValueOnce({ rows: [] })                             // INSERT ledger
      .mockResolvedValueOnce({ rows: [] })                             // SELECT unit_cost_final
      .mockResolvedValueOnce({ rows: [{ avg_cost: "20" }] })          // SELECT avg_cost
      .mockResolvedValueOnce({ rows: [] })                             // INSERT sale_items
      .mockResolvedValueOnce({ rows: [] })                             // INSERT inventory_transactions
      .mockResolvedValueOnce({ rows: [] })                             // UPDATE cogs
      .mockResolvedValueOnce({ rows: [] })                             // UPDATE products.stock_qty (ISS-006)
      .mockResolvedValueOnce({ rows: [] })                             // INSERT bank_ledger
      .mockResolvedValueOnce({ rows: [] });                            // COMMIT
    const client = { query: clientQuery, release: vi.fn() };
    mockPoolConnect.mockResolvedValue(client);

    await storage.createSale({ ...SALE_DATA, paymentMethod: "card" }, [SALE_ITEM]);

    const bankLedger = clientQuery.mock.calls.find(
      ([sql]: [string]) => sql.includes("INSERT INTO bank_ledger")
    );
    const cashLedger = clientQuery.mock.calls.find(
      ([sql]: [string]) => sql.includes("INSERT INTO cash_ledger")
    );
    expect(bankLedger).toBeDefined();
    expect(cashLedger).toBeUndefined();
  });
});
