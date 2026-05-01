import Dexie, { type Table } from "dexie";

export interface PendingSale {
  id?: number;
  localId: string;
  body: Record<string, unknown>;
  status: "pending" | "syncing" | "failed";
  attempts: number;
  createdAt: string;
  error?: string;
}

export interface CachedProduct {
  id: number;
  name: string;
  barcode?: string;
  price: string | number;
  avgCost: string | number;
  stockQty: number;
  categoryId?: number;
  categoryName?: string;
  image?: string;
  cachedAt: number;
}

export interface CachedCustomer {
  id: number;
  name: string;
  phone?: string;
  city?: string;
  cachedAt: number;
}

export interface OfflineShift {
  id: string;            // UUID — primary key in IndexedDB
  shiftId?: number;      // server ID after sync
  branchId: number;
  userId: number;
  deviceId: string;
  openingCash: string;
  startedAt: string;     // ISO string
  endedAt?: string;
  closingCash?: string;
  expectedCash?: string;
  notes?: string;
  // status tracks the shift lifecycle
  status: "open" | "pending_close" | "closed" | "synced";
  // syncStatus tracks the network sync state
  syncStatus: "pending" | "syncing" | "synced" | "failed";
  syncAttempts: number;
  syncError?: string;
  createdAt: string;
}

class LamsaOfflineDB extends Dexie {
  pendingSales!: Table<PendingSale>;
  cachedProducts!: Table<CachedProduct>;
  cachedCustomers!: Table<CachedCustomer>;
  offlineShifts!: Table<OfflineShift>;

  constructor() {
    super("lamsa-pos-offline");
    // v1: initial schema
    this.version(1).stores({
      pendingSales: "++id, localId, status, createdAt",
      cachedProducts: "id, barcode, categoryId",
      cachedCustomers: "id, name",
    });
    // v2: add offlineShifts table (additive — no data loss)
    this.version(2).stores({
      pendingSales: "++id, localId, status, createdAt",
      cachedProducts: "id, barcode, categoryId",
      cachedCustomers: "id, name",
      offlineShifts: "id, status, syncStatus, userId, branchId, createdAt",
    });
  }
}

export const offlineDB = new LamsaOfflineDB();
