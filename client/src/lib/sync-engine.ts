import { offlineDB, type CachedProduct, type CachedCustomer } from "./offline-db";
import { apiRequest } from "./queryClient";

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
  return offlineDB.pendingSales
    .where("status")
    .anyOf(["pending", "failed"])
    .count();
}

export async function syncPending(): Promise<{ synced: number; failed: number }> {
  const pending = await offlineDB.pendingSales
    .where("status")
    .anyOf(["pending", "failed"])
    .toArray();

  let synced = 0;
  let failed = 0;

  for (const sale of pending) {
    if (!sale.id) continue;
    await offlineDB.pendingSales.update(sale.id, { status: "syncing" });
    try {
      await apiRequest("POST", "/api/sales", sale.body);
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
