import { useState, useEffect } from "react";
import { syncPending, getPendingCount } from "@/lib/sync-engine";

export interface NetworkStatus {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncResult: { synced: number; failed: number } | null;
}

let syncInProgress = false;

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{ synced: number; failed: number } | null>(null);

  const refreshCount = async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  };

  const triggerSync = async () => {
    if (syncInProgress) return;
    const count = await getPendingCount();
    if (count === 0) return;

    syncInProgress = true;
    setIsSyncing(true);
    try {
      const result = await syncPending();
      setLastSyncResult(result);
      await refreshCount();
    } finally {
      syncInProgress = false;
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    refreshCount();

    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const interval = setInterval(refreshCount, 10_000);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  return { isOnline, pendingCount, isSyncing, lastSyncResult };
}
