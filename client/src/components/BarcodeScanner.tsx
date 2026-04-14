import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, X, Keyboard } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const { t } = useI18n();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState("");

  useEffect(() => {
    if (!open) { setError(null); setManualMode(false); setManualValue(""); return; }

    const scannerId = "barcode-scanner-container";
    let scanner: Html5Qrcode | null = null;

    const startScanner = async () => {
      // جرّب الكاميرا الخلفية أولاً، ثم أي كاميرا متاحة
      const facingModes: Array<{ facingMode: string } | boolean> = [
        { facingMode: "environment" },
        { facingMode: "user" },
        true,
      ];
      for (const constraint of facingModes) {
        try {
          scanner = new Html5Qrcode(scannerId);
          scannerRef.current = scanner;
          setError(null);
          await scanner.start(
            constraint as any,
            { fps: 10, qrbox: { width: 250, height: 130 }, aspectRatio: 1.5 },
            (decodedText) => { onScan(decodedText); scanner?.stop().catch(() => {}); onClose(); },
            () => {}
          );
          return; // نجح
        } catch {
          try { await scanner?.stop(); } catch {}
          scanner = null;
          scannerRef.current = null;
        }
      }
      // كل المحاولات فشلت → وضع إدخال يدوي
      setError("تعذّر الوصول للكاميرا");
      setManualMode(true);
    };

    const timer = setTimeout(startScanner, 300);
    return () => {
      clearTimeout(timer);
      if (scannerRef.current) { scannerRef.current.stop().catch(() => {}); scannerRef.current = null; }
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            {t("pos.scan_barcode")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!manualMode && (
            <div id="barcode-scanner-container" className="w-full min-h-[220px] rounded-lg overflow-hidden bg-black" />
          )}
          {error && (
            <div className="text-sm text-amber-700 text-center p-3 bg-amber-50 border border-amber-200 rounded-lg">
              {error} — استخدم الإدخال اليدوي أدناه
            </div>
          )}
          {(manualMode || error) && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Keyboard className="w-4 h-4" /> أدخل الباركود يدوياً
              </p>
              <div className="flex gap-2">
                <Input
                  autoFocus
                  dir="ltr"
                  placeholder="الباركود..."
                  value={manualValue}
                  onChange={e => setManualValue(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && manualValue.trim()) { onScan(manualValue.trim()); onClose(); } }}
                  className="font-mono"
                />
                <Button
                  disabled={!manualValue.trim()}
                  onClick={() => { onScan(manualValue.trim()); onClose(); }}
                >
                  بحث
                </Button>
              </div>
            </div>
          )}
          <Button variant="outline" className="w-full gap-2" onClick={onClose}>
            <X className="w-4 h-4" /> {t("common.cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
