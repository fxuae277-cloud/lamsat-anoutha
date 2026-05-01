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

class LamsaOfflineDB extends Dexie {
  pendingSales!: Table<PendingSale>;
  cachedProducts!: Table<CachedProduct>;
  cachedCustomers!: Table<CachedCustomer>;

  constructor() {
    super("lamsa-pos-offline");
    this.version(1).stores({
      pendingSales: "++id, localId, status, createdAt",
      cachedProducts: "id, barcode, categoryId",
      cachedCustomers: "id, name",
    });
  }
}

export const offlineDB = new LamsaOfflineDB();
