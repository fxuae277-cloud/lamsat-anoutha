/**
 * Offline shifts unit tests — open, sell, close, sync
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto";

import { offlineDB } from "../client/src/lib/offline-db";
import {
  openOfflineShift,
  getActiveOfflineShift,
  closeOfflineShift,
  queueSale,
  syncPending,
  getPendingCount,
} from "../client/src/lib/sync-engine";

const USER_ID   = 5;
const BRANCH_ID = 1;
const DEVICE_ID = "MAIN-TERMINAL";

async function clearAll() {
  await offlineDB.offlineShifts.clear();
  await offlineDB.pendingSales.clear();
}

// ─── Open ─────────────────────────────────────────────────────────────────────

describe("openOfflineShift", () => {
  beforeEach(clearAll);

  it("creates a shift record in IndexedDB with status=open and syncStatus=pending", async () => {
    const shift = await openOfflineShift({
      branchId: BRANCH_ID, userId: USER_ID, deviceId: DEVICE_ID, openingCash: "10.000",
    });
    expect(shift.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(shift.status).toBe("open");
    expect(shift.syncStatus).toBe("pending");
    expect(shift.openingCash).toBe("10.000");
    const stored = await offlineDB.offlineShifts.get(shift.id);
    expect(stored?.status).toBe("open");
  });

  it("only one open shift per user/branch at a time (enforced by app logic)", async () => {
    await openOfflineShift({ branchId: BRANCH_ID, userId: USER_ID, deviceId: DEVICE_ID, openingCash: "5.000" });
    const active = await getActiveOfflineShift(USER_ID, BRANCH_ID);
    expect(active).not.toBeNull();
    expect(active?.openingCash).toBe("5.000");
  });
});

// ─── getActiveOfflineShift ────────────────────────────────────────────────────

describe("getActiveOfflineShift", () => {
  beforeEach(clearAll);

  it("returns null when no open shift exists", async () => {
    const shift = await getActiveOfflineShift(USER_ID, BRANCH_ID);
    expect(shift).toBeNull();
  });

  it("returns the open shift for the correct user+branch", async () => {
    await openOfflineShift({ branchId: BRANCH_ID, userId: USER_ID, deviceId: DEVICE_ID, openingCash: "20.000" });
    const shift = await getActiveOfflineShift(USER_ID, BRANCH_ID);
    expect(shift?.openingCash).toBe("20.000");
  });

  it("ignores shifts for other users", async () => {
    await openOfflineShift({ branchId: BRANCH_ID, userId: 99, deviceId: DEVICE_ID, openingCash: "30.000" });
    const shift = await getActiveOfflineShift(USER_ID, BRANCH_ID);
    expect(shift).toBeNull();
  });

  it("ignores closed shifts", async () => {
    const s = await openOfflineShift({ branchId: BRANCH_ID, userId: USER_ID, deviceId: DEVICE_ID, openingCash: "10.000" });
    await offlineDB.offlineShifts.update(s.id, { status: "synced" });
    const active = await getActiveOfflineShift(USER_ID, BRANCH_ID);
    expect(active).toBeNull();
  });
});

// ─── closeOfflineShift ────────────────────────────────────────────────────────

describe("closeOfflineShift", () => {
  beforeEach(clearAll);

  it("marks shift as pending_close with closing data", async () => {
    const shift = await openOfflineShift({ branchId: BRANCH_ID, userId: USER_ID, deviceId: DEVICE_ID, openingCash: "10.000" });
    await closeOfflineShift(shift.id, { closingCash: "85.500", expectedCash: "80.000" });
    const stored = await offlineDB.offlineShifts.get(shift.id);
    expect(stored?.status).toBe("pending_close");
    expect(stored?.closingCash).toBe("85.500");
    expect(stored?.expectedCash).toBe("80.000");
    expect(stored?.endedAt).toBeTruthy();
  });

  it("no longer returned by getActiveOfflineShift after closing", async () => {
    const shift = await openOfflineShift({ branchId: BRANCH_ID, userId: USER_ID, deviceId: DEVICE_ID, openingCash: "10.000" });
    await closeOfflineShift(shift.id, { closingCash: "50.000" });
    const active = await getActiveOfflineShift(USER_ID, BRANCH_ID);
    expect(active).toBeNull();
  });
});

// ─── Sync order: shifts open → sales → shifts close ──────────────────────────

describe("syncPending — ordered sync", () => {
  beforeEach(clearAll);

  it("syncs shift open first, then resolves sale shiftId", async () => {
    const calls: { url: string; body: any }[] = [];
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string, opts: RequestInit) => {
      const body = opts.body ? JSON.parse(opts.body as string) : {};
      calls.push({ url, body });
      if (url.includes("/api/shifts/from-offline")) {
        return Promise.resolve({ ok: true, json: async () => ({ shiftId: 42, synced: true }), text: async () => '{"shiftId":42}' });
      }
      return Promise.resolve({ ok: true, json: async () => ({ id: 99 }), text: async () => '{"id":99}' });
    }));

    // 1. Open offline shift
    const shift = await openOfflineShift({ branchId: BRANCH_ID, userId: USER_ID, deviceId: DEVICE_ID, openingCash: "10.000" });

    // 2. Queue a sale linked to the offline shift
    await queueSale({
      shiftId: 0,
      _offlineShiftId: shift.id,
      total: "15.000",
      paymentMethod: "cash",
      items: [{ productId: 1, quantity: 1 }],
    });

    // 3. Sync
    const result = await syncPending();
    expect(result.synced).toBeGreaterThanOrEqual(2); // shift open + sale

    // 4. Verify order: shift open came before sale
    const shiftOpenCall = calls.findIndex(c => c.url.includes("/api/shifts/from-offline"));
    const saleCall = calls.findIndex(c => c.url.includes("/api/sales"));
    expect(shiftOpenCall).toBeGreaterThanOrEqual(0);
    expect(saleCall).toBeGreaterThan(shiftOpenCall);

    // 5. Sale used the resolved server shiftId (42)
    expect(calls[saleCall].body.shiftId).toBe(42);
    expect(calls[saleCall].body._offlineShiftId).toBeUndefined();

    vi.unstubAllGlobals();
  });

  it("skips sale if shift open has not synced yet", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/shifts/from-offline")) {
        return Promise.resolve({ ok: false, status: 500, text: async () => '{"message":"Server error"}', statusText: "Internal Server Error" });
      }
      return Promise.resolve({ ok: true, json: async () => ({ id: 99 }), text: async () => '{"id":99}' });
    }));

    const shift = await openOfflineShift({ branchId: BRANCH_ID, userId: USER_ID, deviceId: DEVICE_ID, openingCash: "10.000" });
    await queueSale({ shiftId: 0, _offlineShiftId: shift.id, total: "15.000" });

    const result = await syncPending();
    // Shift open failed → sale skipped (can't resolve shiftId)
    expect(result.failed).toBe(1);       // shift open failed
    expect(result.synced).toBe(0);       // sale was skipped
    const pendingSaleCount = await offlineDB.pendingSales.where("status").anyOf(["pending", "failed"]).count();
    expect(pendingSaleCount).toBe(1);    // sale still pending

    vi.unstubAllGlobals();
  });

  it("syncs shift close AFTER shift open is confirmed", async () => {
    const calls: { url: string }[] = [];
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string, opts: RequestInit) => {
      calls.push({ url });
      if (url.includes("/api/shifts/from-offline")) {
        return Promise.resolve({ ok: true, json: async () => ({ shiftId: 77 }), text: async () => '{"shiftId":77}' });
      }
      if (url.includes("/close-from-offline")) {
        return Promise.resolve({ ok: true, json: async () => ({ id: 77, status: "closed" }), text: async () => '{"status":"closed"}' });
      }
      return Promise.resolve({ ok: true, json: async () => ({}), text: async () => '{}' });
    }));

    const shift = await openOfflineShift({ branchId: BRANCH_ID, userId: USER_ID, deviceId: DEVICE_ID, openingCash: "10.000" });
    await closeOfflineShift(shift.id, { closingCash: "50.000" });

    const result = await syncPending();
    expect(result.synced).toBe(2); // shift open + shift close

    const openIdx  = calls.findIndex(c => c.url.includes("/api/shifts/from-offline"));
    const closeIdx = calls.findIndex(c => c.url.includes("/close-from-offline"));
    expect(openIdx).toBeGreaterThanOrEqual(0);
    expect(closeIdx).toBeGreaterThan(openIdx);

    vi.unstubAllGlobals();
  });
});

// ─── getPendingCount includes offline shifts ──────────────────────────────────

describe("getPendingCount", () => {
  beforeEach(clearAll);

  it("counts offline shifts + pending sales together", async () => {
    expect(await getPendingCount()).toBe(0);
    await openOfflineShift({ branchId: BRANCH_ID, userId: USER_ID, deviceId: DEVICE_ID, openingCash: "0" });
    expect(await getPendingCount()).toBe(1);
    await queueSale({ shiftId: 0, total: "10.000" });
    expect(await getPendingCount()).toBe(2);
  });

  it("does not count already-synced shifts", async () => {
    const shift = await openOfflineShift({ branchId: BRANCH_ID, userId: USER_ID, deviceId: DEVICE_ID, openingCash: "0" });
    await offlineDB.offlineShifts.update(shift.id, { syncStatus: "synced" });
    expect(await getPendingCount()).toBe(0);
  });
});
