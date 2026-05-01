import { WifiOff, Wifi, RefreshCw, AlertCircle } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing, lastSyncResult } = useNetworkStatus();

  if (isOnline && pendingCount === 0 && !lastSyncResult) return null;

  if (!isOnline) {
    return (
      <div className="fixed top-0 inset-x-0 z-50 bg-amber-500 text-white text-xs font-medium flex items-center justify-center gap-2 py-1.5 px-3">
        <WifiOff className="w-3.5 h-3.5 shrink-0" />
        <span>
          Offline mode
          {pendingCount > 0 && ` — ${pendingCount} sale(s) pending sync`}
        </span>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="fixed top-0 inset-x-0 z-50 bg-blue-500 text-white text-xs font-medium flex items-center justify-center gap-2 py-1.5 px-3">
        <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" />
        <span>Syncing {pendingCount} pending sale(s)…</span>
      </div>
    );
  }

  if (isOnline && pendingCount > 0) {
    return (
      <div className="fixed top-0 inset-x-0 z-50 bg-orange-500 text-white text-xs font-medium flex items-center justify-center gap-2 py-1.5 px-3">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span>{pendingCount} sale(s) waiting to sync</span>
      </div>
    );
  }

  if (lastSyncResult && lastSyncResult.synced > 0) {
    return (
      <div className="fixed top-0 inset-x-0 z-50 bg-emerald-500 text-white text-xs font-medium flex items-center justify-center gap-2 py-1.5 px-3">
        <Wifi className="w-3.5 h-3.5 shrink-0" />
        <span>Back online — {lastSyncResult.synced} sale(s) synced</span>
      </div>
    );
  }

  return null;
}
