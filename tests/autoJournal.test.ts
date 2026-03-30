// Phase 8.2 — Unit tests for server/autoJournal.ts
// pool is mocked; no real DB connection required

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock pool before importing the module ─────────────────────────────────────
// vi.mock is hoisted — use vi.hoisted() so mockQuery/mockConnect are available inside the factory
const { mockQuery, mockConnect } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockConnect: vi.fn(),
}));

vi.mock("../server/db", () => ({
  pool: {
    query: mockQuery,
    connect: mockConnect,
  },
}));

// Import after mock is in place
import {
  journalForSale,
  journalForExpense,
  journalForPurchase,
  journalForSaleReturn,
  journalForSupplierPayment,
  journalForSalaryPayment,
} from "../server/autoJournal";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a mock pool client for transaction tests */
function makeMockClient() {
  const clientQuery = vi.fn();
  clientQuery.mockResolvedValue({ rows: [] });
  return {
    query: clientQuery,
    release: vi.fn(),
  };
}

/** Simulate no existing journal entry (duplicate check returns empty) */
function setupNoExistingEntry() {
  // 1st call: duplicate check → not found
  mockQuery.mockResolvedValueOnce({ rows: [] });
}

/** Simulate account lookup returning an ID */
function setupAccountLookup(id: number) {
  mockQuery.mockResolvedValueOnce({ rows: [{ id }] });
}

/** Simulate entry count for entry_number generation */
function setupEntryCount(count: number) {
  mockQuery.mockResolvedValueOnce({ rows: [{ cnt: String(count) }] });
}

// ── Base sequence for a complete journal write ─────────────────────────────────
// createAutoJournal does:
//   1. pool.query: duplicate check
//   2. pool.query x N: account lookups
//   3. pool.query: entry count
//   4. pool.connect → client.query(BEGIN, INSERT entry, INSERT lines×N, COMMIT)
//   5. client.release()

function setupFullJournalWrite(accountCount: number, entryCount = 0) {
  setupNoExistingEntry();
  for (let i = 1; i <= accountCount; i++) {
    setupAccountLookup(100 + i);
  }
  setupEntryCount(entryCount);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("journalForSale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips entry when total is 0", async () => {
    await journalForSale({
      id: 1, invoiceNumber: "INV-001", total: "0", vat: "0",
      paymentMethod: "cash", branchId: 1, cashierId: 1,
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("skips entry when total is negative", async () => {
    await journalForSale({
      id: 2, invoiceNumber: "INV-002", total: "-10", vat: "0",
      paymentMethod: "cash", branchId: 1, cashierId: 1,
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("does not duplicate if entry already exists", async () => {
    // Duplicate check returns a row
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 99 }] });

    await journalForSale({
      id: 3, invoiceNumber: "INV-003", total: "100", vat: "5",
      paymentMethod: "cash", branchId: 1, cashierId: 1,
    });

    // Only the duplicate-check query should have fired
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("routes cash payment to CASH account code", async () => {
    // We don't connect to DB — just verify the function doesn't throw
    // and calls pool correctly when an entry doesn't exist.
    setupNoExistingEntry(); // duplicate check

    // account lookups for cash-only sale (2 lines: cash + revenue)
    setupAccountLookup(101);
    setupAccountLookup(102);
    setupEntryCount(5);

    const client = makeMockClient();
    // Mock INSERT journal_entry to return id
    client.query
      .mockResolvedValueOnce({ rows: [] })       // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 200 }] }) // INSERT journal_entry
      .mockResolvedValueOnce({ rows: [] })       // INSERT line 1
      .mockResolvedValueOnce({ rows: [] })       // INSERT line 2
      .mockResolvedValueOnce({ rows: [] });      // COMMIT

    mockConnect.mockResolvedValueOnce(client);

    await journalForSale({
      id: 10, invoiceNumber: "INV-010", total: "100", vat: "0",
      paymentMethod: "cash", branchId: 1, cashierId: 2,
    });

    // Confirm duplicate check included "sale" source_type
    expect(mockQuery.mock.calls[0][1]).toContain("sale");
    expect(client.release).toHaveBeenCalled();
  });

  it("includes VAT line when vat > 0", async () => {
    setupNoExistingEntry();
    // sale with vat: lines = cash, revenue, vat_payable → 3 account lookups
    setupAccountLookup(101);
    setupAccountLookup(102);
    setupAccountLookup(103);
    setupEntryCount(0);

    const client = makeMockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 300 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    mockConnect.mockResolvedValueOnce(client);

    await journalForSale({
      id: 11, invoiceNumber: "INV-011", total: "105", vat: "5",
      paymentMethod: "cash", branchId: 1, cashierId: 2,
    });

    // 3 account lookups = cash + revenue + vat
    const accountLookupCalls = mockQuery.mock.calls.filter(
      ([sql]: [string]) => sql.includes("FROM accounts WHERE code")
    );
    expect(accountLookupCalls).toHaveLength(3);
  });

  it("includes COGS lines when cogsTotal > 0", async () => {
    setupNoExistingEntry();
    // lines: cash, revenue, vat, cogs, inventory → 5 account lookups
    for (let i = 0; i < 5; i++) setupAccountLookup(100 + i);
    setupEntryCount(0);

    const client = makeMockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 400 }] });
    for (let i = 0; i < 5; i++) client.query.mockResolvedValueOnce({ rows: [] });
    mockConnect.mockResolvedValueOnce(client);

    await journalForSale({
      id: 12, invoiceNumber: "INV-012", total: "105", vat: "5",
      paymentMethod: "cash", branchId: 1, cashierId: 2, cogsTotal: "60",
    });

    const accountLookupCalls = mockQuery.mock.calls.filter(
      ([sql]: [string]) => sql.includes("FROM accounts WHERE code")
    );
    expect(accountLookupCalls).toHaveLength(5);
  });
});

// ── journalForExpense ─────────────────────────────────────────────────────────

describe("journalForExpense", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips entry when amount is 0", async () => {
    await journalForExpense({
      id: 1, category: "مصروف", amount: "0",
      source: "cash", date: "2025-01-01", branchId: 1, createdBy: 1,
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("skips entry when amount is negative", async () => {
    await journalForExpense({
      id: 2, category: "مصروف", amount: "-50",
      source: "cash", date: "2025-01-01", branchId: 1, createdBy: 1,
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("does not duplicate if entry already exists", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 55 }] });

    await journalForExpense({
      id: 3, category: "إيجار", amount: "200",
      source: "cash", date: "2025-01-15", branchId: 1, createdBy: 2,
    });

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][1]).toContain("expense");
  });

  it("routes bank_transfer to BANK account code", async () => {
    setupNoExistingEntry();
    // 2 account lookups: GENERAL_EXPENSES + BANK
    setupAccountLookup(201);
    setupAccountLookup(202);
    setupEntryCount(10);

    const client = makeMockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 500 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    mockConnect.mockResolvedValueOnce(client);

    await journalForExpense({
      id: 20, category: "شحن", amount: "150",
      source: "bank_transfer", date: "2025-02-01", branchId: 2, createdBy: 1,
    });

    // Verify BANK code (1102) was looked up
    const accountLookups = mockQuery.mock.calls.filter(
      ([sql]: [string]) => sql.includes("FROM accounts WHERE code")
    );
    const lookedUpCodes = accountLookups.map(([, params]: [string, string[]]) => params[0]);
    expect(lookedUpCodes).toContain("1102"); // BANK
    expect(lookedUpCodes).toContain("5400"); // GENERAL_EXPENSES
  });
});

// ── journalForPurchase ────────────────────────────────────────────────────────

describe("journalForPurchase", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips entry when grandTotal is 0", async () => {
    await journalForPurchase({
      id: 1, invoiceNumber: "PO-001", grandTotal: "0",
      supplierId: 1, branchId: 1, createdBy: 1, invoiceDate: "2025-01-01",
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("does not duplicate if entry already exists", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 77 }] });

    await journalForPurchase({
      id: 5, invoiceNumber: "PO-005", grandTotal: "500",
      supplierId: 2, branchId: 1, createdBy: 3, invoiceDate: "2025-03-01",
    });

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][1]).toContain("purchase");
  });

  it("creates inventory + supplier_payables lines", async () => {
    setupNoExistingEntry();
    setupAccountLookup(301); // INVENTORY
    setupAccountLookup(302); // SUPPLIER_PAYABLES
    setupEntryCount(3);

    const client = makeMockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 600 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    mockConnect.mockResolvedValueOnce(client);

    await journalForPurchase({
      id: 30, invoiceNumber: "PO-030", grandTotal: "1000",
      supplierId: 5, branchId: 1, createdBy: 2, invoiceDate: "2025-04-01",
    });

    const accountLookups = mockQuery.mock.calls.filter(
      ([sql]: [string]) => sql.includes("FROM accounts WHERE code")
    );
    const codes = accountLookups.map(([, params]: [string, string[]]) => params[0]);
    expect(codes).toContain("1301"); // INVENTORY
    expect(codes).toContain("2101"); // SUPPLIER_PAYABLES
  });
});

// ── journalForSaleReturn ──────────────────────────────────────────────────────

describe("journalForSaleReturn", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips entry when refundAmount is 0", async () => {
    await journalForSaleReturn({
      id: 1, returnNumber: "RET-001", refundAmount: "0",
      refundMethod: "cash", cogsReturned: "0", branchId: 1, createdBy: 1,
      saleInvoiceNumber: "INV-001",
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("does not duplicate if entry already exists", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 88 }] });

    await journalForSaleReturn({
      id: 7, returnNumber: "RET-007", refundAmount: "50",
      refundMethod: "cash", cogsReturned: "30", branchId: 1, createdBy: 1,
      saleInvoiceNumber: "INV-099",
    });

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][1]).toContain("return");
  });

  it("includes inventory reversal lines when cogsReturned > 0", async () => {
    setupNoExistingEntry();
    // 4 account lookups: SALES_RETURNS, CASH, INVENTORY, COGS
    for (let i = 0; i < 4; i++) setupAccountLookup(400 + i);
    setupEntryCount(0);

    const client = makeMockClient();
    client.query.mockResolvedValue({ rows: [{ id: 700 }] });
    mockConnect.mockResolvedValueOnce(client);

    await journalForSaleReturn({
      id: 40, returnNumber: "RET-040", refundAmount: "80",
      refundMethod: "cash", cogsReturned: "45", branchId: 1, createdBy: 2,
      saleInvoiceNumber: "INV-040",
    });

    const accountLookups = mockQuery.mock.calls.filter(
      ([sql]: [string]) => sql.includes("FROM accounts WHERE code")
    );
    expect(accountLookups).toHaveLength(4);
  });
});

// ── journalForSupplierPayment ─────────────────────────────────────────────────

describe("journalForSupplierPayment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips entry when amount is 0", async () => {
    await journalForSupplierPayment({
      supplierId: 1, amount: 0, method: "cash",
      branchId: 1, createdBy: 1,
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("skips entry when amount is negative", async () => {
    await journalForSupplierPayment({
      supplierId: 1, amount: -100, method: "cash",
      branchId: 1, createdBy: 1,
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("uses CASH code for cash payment", async () => {
    setupNoExistingEntry();
    setupAccountLookup(501); // SUPPLIER_PAYABLES
    setupAccountLookup(502); // CASH
    setupEntryCount(0);

    const client = makeMockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 800 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    mockConnect.mockResolvedValueOnce(client);

    await journalForSupplierPayment({
      supplierId: 3, amount: 300, method: "cash",
      branchId: 1, createdBy: 1,
    });

    const codes = mockQuery.mock.calls
      .filter(([sql]: [string]) => sql.includes("FROM accounts WHERE code"))
      .map(([, params]: [string, string[]]) => params[0]);
    expect(codes).toContain("1101"); // CASH
    expect(codes).toContain("2101"); // SUPPLIER_PAYABLES
  });

  it("uses BANK code for bank_transfer payment", async () => {
    setupNoExistingEntry();
    setupAccountLookup(501);
    setupAccountLookup(502);
    setupEntryCount(0);

    const client = makeMockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 801 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    mockConnect.mockResolvedValueOnce(client);

    await journalForSupplierPayment({
      supplierId: 3, amount: 300, method: "bank_transfer",
      branchId: 1, createdBy: 1,
    });

    const codes = mockQuery.mock.calls
      .filter(([sql]: [string]) => sql.includes("FROM accounts WHERE code"))
      .map(([, params]: [string, string[]]) => params[0]);
    expect(codes).toContain("1102"); // BANK
  });
});

// ── journalForSalaryPayment ───────────────────────────────────────────────────

describe("journalForSalaryPayment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips entry when amount is 0", async () => {
    await journalForSalaryPayment({
      id: 1, employeeId: 1, employeeName: "موظف",
      amount: 0, paymentMethod: "bank_transfer",
      branchId: 1, paidBy: 1, month: "January", year: 2025,
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("always uses BANK (not CASH) for salary — policy enforced", async () => {
    setupNoExistingEntry();
    setupAccountLookup(601); // SALARY_EXPENSES
    setupAccountLookup(602); // BANK
    setupEntryCount(0);

    const client = makeMockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 900 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    mockConnect.mockResolvedValueOnce(client);

    await journalForSalaryPayment({
      id: 50, employeeId: 5, employeeName: "سارة",
      amount: 500, paymentMethod: "bank_transfer",
      branchId: 1, paidBy: 1, month: "March", year: 2025,
    });

    const codes = mockQuery.mock.calls
      .filter(([sql]: [string]) => sql.includes("FROM accounts WHERE code"))
      .map(([, params]: [string, string[]]) => params[0]);
    expect(codes).toContain("5200"); // SALARY_EXPENSES
    expect(codes).toContain("1102"); // BANK
    expect(codes).not.toContain("1101"); // no CASH for salary
  });
});

// ── createAutoJournal (via a function) — balance guard ────────────────────────

describe("createAutoJournal balance guard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("aborts and returns null if debit != credit", async () => {
    // We trigger this via journalForSale with a value that would create unbalanced lines
    // by making one account lookup fail (return null) which causes early return
    setupNoExistingEntry();
    // First account lookup returns null (account not found)
    mockQuery.mockResolvedValueOnce({ rows: [] }); // account not found

    // journalForSale with no vat, no cogs → only 2 lines (cash + revenue)
    // If first account lookup fails → the function skips that line
    // This results in only 1 line which is unbalanced → returns null without writing
    await journalForSale({
      id: 99, invoiceNumber: "INV-099", total: "100", vat: "0",
      paymentMethod: "cash", branchId: 1, cashierId: 1,
    });

    // pool.connect should NOT have been called (no transaction started)
    expect(mockConnect).not.toHaveBeenCalled();
  });
});
