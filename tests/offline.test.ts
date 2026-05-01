/**
 * Offline mode unit tests — sync engine + offline DB
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── Minimal IndexedDB shim for Node/Vitest ───────────────────────────────────
import "fake-indexeddb/auto";

import { offlineDB } from "../client/src/lib/offline-db";
import {
  queueSale,
  getPendingCount,
  syncPending,
  refreshProductCache,
  refreshCustomerCache,
  getCachedProducts,
  getCachedCustomers,
} from "../client/src/lib/sync-engine";

const mockSaleBody = {
  invoiceNumber: "",
  subtotal: "10.000",
  discount: "0.000",
  vat: "0",
  total: "10.000",
  amountPaid: "10.000",
  changeAmount: "0.000",
  paymentMethod: "cash",
  paymentReference: null,
  customerId: null,
  shiftId: 1,
  items: [{ productId: 1, quantity: 1, unitPrice: "10.000", total: "10.000", unitCostAtSale: "7.000", lineCogs: "7.000", color: null, size: null }],
};

describe("Offline DB — pendingSales", () => {
  beforeEach(async () => {
    await offlineDB.pendingSales.clear();
    await offlineDB.cachedProducts.clear();
    await offlineDB.cachedCustomers.clear();
  });

  it("queueSale stores a record with status=pending", async () => {
    const localId = await queueSale(mockSaleBody);
    expect(localId).toMatch(/^[0-9a-f-]{36}$/);
    const count = await offlineDB.pendingSales.count();
    expect(count).toBe(1);
    const record = await offlineDB.pendingSales.toCollection().first();
    expect(record?.status).toBe("pending");
    expect(record?.attempts).toBe(0);
  });

  it("getPendingCount returns correct count", async () => {
    expect(await getPendingCount()).toBe(0);
    await queueSale(mockSaleBody);
    expect(await getPendingCount()).toBe(1);
    await queueSale(mockSaleBody);
    expect(await getPendingCount()).toBe(2);
  });

  it("queueSale embeds _offlineLocalId in body", async () => {
    const localId = await queueSale(mockSaleBody);
    const record = await offlineDB.pendingSales.toCollection().first();
    expect(record?.body._offlineLocalId).toBe(localId);
  });
});

describe("syncPending — online success path", () => {
  beforeEach(async () => {
    await offlineDB.pendingSales.clear();
  });

  it("removes record after successful sync", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 99 }), text: async () => '{"id":99}' }));
    await queueSale(mockSaleBody);
    const result = await syncPending();
    expect(result.synced).toBe(1);
    expect(result.failed).toBe(0);
    expect(await getPendingCount()).toBe(0);
    vi.unstubAllGlobals();
  });

  it("marks record as failed when server returns error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => '{"message":"Server error"}', statusText: "Internal Server Error" }));
    await queueSale(mockSaleBody);
    const result = await syncPending();
    expect(result.synced).toBe(0);
    expect(result.failed).toBe(1);
    const record = await offlineDB.pendingSales.toCollection().first();
    expect(record?.status).toBe("failed");
    expect(record?.attempts).toBe(1);
    vi.unstubAllGlobals();
  });

  it("syncs multiple pending sales in order", async () => {
    const calls: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
      calls.push(JSON.parse(opts.body as string));
      return Promise.resolve({ ok: true, json: async () => ({ id: calls.length }), text: async () => `{"id":${calls.length}}` });
    }));
    await queueSale({ ...mockSaleBody, total: "5.000" });
    await queueSale({ ...mockSaleBody, total: "15.000" });
    const result = await syncPending();
    expect(result.synced).toBe(2);
    expect(calls).toHaveLength(2);
    expect(await getPendingCount()).toBe(0);
    vi.unstubAllGlobals();
  });
});

describe("Product + Customer cache", () => {
  beforeEach(async () => {
    await offlineDB.cachedProducts.clear();
    await offlineDB.cachedCustomers.clear();
  });

  it("refreshProductCache stores and getCachedProducts retrieves", async () => {
    const products = [
      { id: 1, name: "Ring A", price: "10.000", avgCost: "7.000", stockQty: 5 },
      { id: 2, name: "Bracelet B", price: "25.000", avgCost: "18.000", stockQty: 3 },
    ];
    await refreshProductCache(products as any);
    const cached = await getCachedProducts();
    expect(cached).toHaveLength(2);
    expect(cached[0].name).toBe("Ring A");
    expect(cached[1].name).toBe("Bracelet B");
  });

  it("refreshProductCache replaces previous cache", async () => {
    await refreshProductCache([{ id: 1, name: "Old", price: "5.000", avgCost: "3.000", stockQty: 10 }] as any);
    await refreshProductCache([{ id: 2, name: "New", price: "8.000", avgCost: "5.000", stockQty: 7 }] as any);
    const cached = await getCachedProducts();
    expect(cached).toHaveLength(1);
    expect(cached[0].name).toBe("New");
  });

  it("refreshCustomerCache stores and retrieves", async () => {
    const customers = [{ id: 1, name: "Fatima", phone: "96899001122" }];
    await refreshCustomerCache(customers as any);
    const cached = await getCachedCustomers();
    expect(cached).toHaveLength(1);
    expect(cached[0].name).toBe("Fatima");
  });

  it("cachedAt is set on all records", async () => {
    const before = Date.now();
    await refreshProductCache([{ id: 1, name: "A", price: "1.000", avgCost: "0.500", stockQty: 1 }] as any);
    const cached = await getCachedProducts();
    expect(cached[0].cachedAt).toBeGreaterThanOrEqual(before);
  });
});

describe("Pending sales — status transitions", () => {
  beforeEach(async () => {
    await offlineDB.pendingSales.clear();
  });

  it("failed records are retried on next syncPending call", async () => {
    await offlineDB.pendingSales.add({
      localId: "test-retry",
      body: mockSaleBody,
      status: "failed",
      attempts: 2,
      createdAt: new Date().toISOString(),
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 55 }), text: async () => '{"id":55}' }));
    const result = await syncPending();
    expect(result.synced).toBe(1);
    expect(await getPendingCount()).toBe(0);
    vi.unstubAllGlobals();
  });

  it("pending count excludes syncing records (edge case)", async () => {
    await offlineDB.pendingSales.add({
      localId: "syncing-test",
      body: mockSaleBody,
      status: "syncing",
      attempts: 0,
      createdAt: new Date().toISOString(),
    });
    expect(await getPendingCount()).toBe(0);
  });
});
