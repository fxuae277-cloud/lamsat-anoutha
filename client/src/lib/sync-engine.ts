import { offlineDB, type CachedProduct, type CachedCustomer, type OfflineShift } from "./offline-db";
import { apiRequest } from "./queryClient";

// ─── Pending Sales ─────────────────────────────────────────────────────────────

export async function queueSale(body: Record<string, unknown>): Promise<string> {
  const localId = crypto.randomUUID();
  await offlineDB.pendingSales.add({
    localId,
    body: { ...body, _offlineLocalId: localId },
    status: "pending",
    attempts: 0,
    createdAt: new Date().toISOString(),
  });
  return localId;
}

export async function getPendingCount(): Promise<number> {
  const pendingSales = await offlineDB.pendingSales
    .where("status")
    .anyOf(["pending", "failed"])
    .count();
  const pendingShifts = await offlineDB.offlineShifts
    .where("syncStatus")
    .anyOf(["pending", "failed"])
    .count();
  return pendingSales + pendingShifts;
}

// ─── Offline Shifts ────────────────────────────────────────────────────────────

export async function openOfflineShift(data: {
  branchId: number;
  userId: number;
  deviceId: string;
  openingCash: string;
}): Promise<OfflineShift> {
  const shift: OfflineShift = {
    id: crypto.randomUUID(),
    branchId: data.branchId,
    userId: data.userId,
    deviceId: data.deviceId,
    openingCash: data.openingCash,
    startedAt: new Date().toISOString(),
    status: "open",
    syncStatus: "pending",
    syncAttempts: 0,
    createdAt: new Date().toISOString(),
  };
  await offlineDB.offlineShifts.add(shift);
  return shift;
}

export async function getActiveOfflineShift(
  userId: number,
  branchId: number,
): Promise<OfflineShift | null> {
  const shift = await offlineDB.offlineShifts
    .where("status")
    .equals("open")
    .and((s) => s.userId === userId && s.branchId === branchId)
    .first();
  return shift ?? null;
}

export async function closeOfflineShift(
  localId: string,
  data: { closingCash: string; expectedCash?: string; notes?: string },
): Promise<void> {
  await offlineDB.offlineShifts.update(localId, {
    closingCash: data.closingCash,
    expectedCash: data.expectedCash,
    notes: data.notes,
    endedAt: new Date().toISOString(),
    status: "pending_close",
  });
}

// ─── Sync: Shift Opens ────────────────────────────────────────────────────────

async function syncPendingShiftOpens(): Promise<{ synced: number; failed: number }> {
  const pending = await offlineDB.offlineShifts
    .where("syncStatus")
    .anyOf(["pending", "failed"])
    .and((s) => s.status === "open" || s.status === "pending_close")
    .toArray();

  let synced = 0;
  let failed = 0;

  for (const shift of pending) {
    await offlineDB.offlineShifts.update(shift.id, { syncStatus: "syncing" });
    try {
      const res = await apiRequest("POST", "/api/shifts/from-offline", {
        offline_id: shift.id,
        openingCash: shift.openingCash,
        startedAt: shift.startedAt,
        branchId: shift.branchId,
      });
      const data = await res.json();
      await offlineDB.offlineShifts.update(shift.id, {
        shiftId: data.shiftId,
        syncStatus: "synced",
      });
      synced++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await offlineDB.offlineShifts.update(shift.id, {
        syncStatus: "failed",
        syncAttempts: (shift.syncAttempts || 0) + 1,
        syncError: msg,
      });
      failed++;
    }
  }

  return { synced, failed };
}

// ─── Sync: Shift Closes ───────────────────────────────────────────────────────

async function syncPendingShiftCloses(): Promise<{ synced: number; failed: number }> {
  const pending = await offlineDB.offlineShifts
    .where("status")
    .equals("pending_close")
    .toArray();

  let synced = 0;
  let failed = 0;

  for (const shift of pending) {
    // Shift open must be synced first to get server ID
    if (!shift.shiftId) continue;

    try {
      await apiRequest("PATCH", `/api/shifts/${shift.shiftId}/close-from-offline`, {
        actualCash: shift.closingCash,
        endedAt: shift.endedAt,
        expectedCash: shift.expectedCash,
        notes: shift.notes,
      });
      await offlineDB.offlineShifts.update(shift.id, { status: "synced" });
      synced++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await offlineDB.offlineShifts.update(shift.id, {
        syncAttempts: (shift.syncAttempts || 0) + 1,
        syncError: msg,
      });
      failed++;
    }
  }

  return { synced, failed };
}

// ─── Sync: Sales (with offline shift ID resolution) ───────────────────────────

async function syncPendingSales(): Promise<{ synced: number; failed: number }> {
  const pending = await offlineDB.pendingSales
    .where("status")
    .anyOf(["pending", "failed"])
    .toArray();

  let synced = 0;
  let failed = 0;

  for (const sale of pending) {
    if (!sale.id) continue;

    // Resolve offline shift ID → server shift ID
    let body = { ...sale.body };
    if (body._offlineShiftId) {
      const offlineShift = await offlineDB.offlineShifts.get(body._offlineShiftId as string);
      if (!offlineShift?.shiftId) {
        // Shift open hasn't been synced yet — skip, will retry next cycle
        continue;
      }
      body = { ...body, shiftId: offlineShift.shiftId };
      delete body._offlineShiftId;
    }

    await offlineDB.pendingSales.update(sale.id, { status: "syncing" });
    try {
      await apiRequest("POST", "/api/sales", body);
      await offlineDB.pendingSales.delete(sale.id);
      synced++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await offlineDB.pendingSales.update(sale.id, {
        status: "failed",
        attempts: (sale.attempts || 0) + 1,
        error: msg,
      });
      failed++;
    }
  }

  return { synced, failed };
}

// ─── Main Sync (ordered) ──────────────────────────────────────────────────────
// Order matters:
// 1. Shift opens  (sales need a server shiftId)
// 2. Sales        (use resolved shiftId)
// 3. Shift closes (all sales must be recorded first)

export async function syncPending(): Promise<{ synced: number; failed: number }> {
  let totalSynced = 0;
  let totalFailed = 0;

  const openResult = await syncPendingShiftOpens();
  totalSynced += openResult.synced;
  totalFailed += openResult.failed;

  const salesResult = await syncPendingSales();
  totalSynced += salesResult.synced;
  totalFailed += salesResult.failed;

  const closeResult = await syncPendingShiftCloses();
  totalSynced += closeResult.synced;
  totalFailed += closeResult.failed;

  return { synced: totalSynced, failed: totalFailed };
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

export async function refreshProductCache(products: CachedProduct[]): Promise<void> {
  const now = Date.now();
  await offlineDB.cachedProducts.clear();
  await offlineDB.cachedProducts.bulkPut(products.map((p) => ({ ...p, cachedAt: now })));
}

export async function refreshCustomerCache(customers: CachedCustomer[]): Promise<void> {
  const now = Date.now();
  await offlineDB.cachedCustomers.clear();
  await offlineDB.cachedCustomers.bulkPut(customers.map((c) => ({ ...c, cachedAt: now })));
}

export async function getCachedProducts(): Promise<CachedProduct[]> {
  return offlineDB.cachedProducts.toArray();
}

export async function getCachedCustomers(): Promise<CachedCustomer[]> {
  return offlineDB.cachedCustomers.toArray();
}
