import { useCallback, useEffect, useRef, useState } from "react";

/**
 * USB HID barcode scanner hook (keyboard-wedge mode).
 *
 * Detects scanner input by inter-key timing: when consecutive keypresses
 * arrive faster than `threshold` ms, the burst is treated as a barcode.
 * The scanner ends with Enter (or a 100 ms idle timeout). Manual typing
 * stays slower than the threshold and is ignored.
 *
 * Guards:
 *  - disabled while focus is on input/textarea/select/contenteditable
 *    (unless the element opts in via data-scanner-allowed="true")
 *  - ignores Arabic IME composition (isComposing / keyCode 229)
 *  - listens only when document.visibilityState === "visible"
 *  - rejects barcodes containing characters outside [A-Za-z0-9_-]
 */

const VALID_BARCODE = /^[A-Za-z0-9_\-]+$/;

interface UseBarcodeScannerOpts {
  enabled: boolean;
  threshold: number;
  onScan: (barcode: string) => void;
  onInvalid?: (raw: string) => void;
}

export function useBarcodeScanner({ enabled, threshold, onScan, onInvalid }: UseBarcodeScannerOpts) {
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  // Refs so that updating settings doesn't tear the listener down.
  const onScanRef     = useRef(onScan);
  const onInvalidRef  = useRef(onInvalid);
  const thresholdRef  = useRef(threshold);
  const enabledRef    = useRef(enabled);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);
  useEffect(() => { onInvalidRef.current = onInvalid; }, [onInvalid]);
  useEffect(() => { thresholdRef.current = threshold; }, [threshold]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const bufferRef    = useRef<string>("");
  const lastTsRef    = useRef<number>(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushBuffer = useCallback((preventDefaultEvent: KeyboardEvent | null) => {
    const buf = bufferRef.current;
    bufferRef.current = "";
    lastTsRef.current = 0;
    if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
    if (!buf) return;
    if (!VALID_BARCODE.test(buf)) {
      onInvalidRef.current?.(buf);
      return;
    }
    // Prevent the trailing Enter from submitting any nearby form.
    if (preventDefaultEvent) preventDefaultEvent.preventDefault();
    setLastScanned(buf);
    onScanRef.current(buf);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const onKeyPress = (e: KeyboardEvent) => {
      if (!enabledRef.current) return;
      if (document.visibilityState !== "visible") return;
      // IME composition (Arabic on Windows often emits keyCode 229).
      if ((e as any).isComposing || e.keyCode === 229) return;

      // Skip when the user is typing into a real input.
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        const editable = (target as any).isContentEditable === true;
        const allowed = target.getAttribute && target.getAttribute("data-scanner-allowed") === "true";
        if (!allowed && (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || editable)) {
          // Reset so a half-typed buffer doesn't contaminate the next real scan.
          bufferRef.current = "";
          lastTsRef.current = 0;
          return;
        }
      }

      const now = e.timeStamp || performance.now();
      const gap = lastTsRef.current ? now - lastTsRef.current : 0;

      // First char of a new burst, or fast-enough follow-up → keep buffering.
      // If the gap is too large the buffer is reset so manual typing never
      // gets reported as a scan.
      if (lastTsRef.current && gap > thresholdRef.current) {
        bufferRef.current = "";
      }
      lastTsRef.current = now;

      // Enter (CR/LF) terminates a scan.
      if (e.key === "Enter" || e.key === "\n" || e.key === "\r") {
        flushBuffer(e);
        return;
      }

      // Only printable single chars belong to a barcode burst.
      if (e.key.length === 1) {
        bufferRef.current += e.key;
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => flushBuffer(null), 100);
      }
    };

    document.addEventListener("keypress", onKeyPress, true);
    return () => {
      document.removeEventListener("keypress", onKeyPress, true);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      bufferRef.current = "";
      lastTsRef.current = 0;
    };
  }, [enabled, flushBuffer]);

  return { lastScanned };
}
