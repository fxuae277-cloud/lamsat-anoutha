import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "lamsa-scanner-settings";

export interface ScannerSettings {
  enabled: boolean;
  soundEnabled: boolean;
  threshold: number; // ms — gap below which keypress is treated as scanner
}

export const DEFAULT_SCANNER_SETTINGS: ScannerSettings = {
  enabled: true,
  soundEnabled: true,
  threshold: 30,
};

function read(): ScannerSettings {
  if (typeof window === "undefined") return DEFAULT_SCANNER_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SCANNER_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      enabled:      typeof parsed.enabled === "boolean"      ? parsed.enabled      : DEFAULT_SCANNER_SETTINGS.enabled,
      soundEnabled: typeof parsed.soundEnabled === "boolean" ? parsed.soundEnabled : DEFAULT_SCANNER_SETTINGS.soundEnabled,
      threshold:    typeof parsed.threshold === "number" && parsed.threshold >= 10 && parsed.threshold <= 100
        ? parsed.threshold
        : DEFAULT_SCANNER_SETTINGS.threshold,
    };
  } catch {
    return DEFAULT_SCANNER_SETTINGS;
  }
}

export function useScannerSettings() {
  const [settings, setSettings] = useState<ScannerSettings>(read);

  // Cross-tab sync via the storage event.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setSettings(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((patch: Partial<ScannerSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { settings, update };
}
