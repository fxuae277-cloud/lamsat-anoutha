import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";
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

  useEffect(() => {
    if (!open) return;

    const scannerId = "barcode-scanner-container";
    let scanner: Html5Qrcode | null = null;

    const startScanner = async () => {
      try {
        scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;
        setError(null);

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 280, height: 150 },
            aspectRatio: 1.5,
          },
          (decodedText) => {
            onScan(decodedText);
            scanner?.stop().catch(() => {});
            onClose();
          },
          () => {}
        );
      } catch (err: any) {
        setError(err?.message || t("pos.camera_error"));
      }
    };

    const timer = setTimeout(startScanner, 300);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            {t("pos.scan_barcode")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div
            id="barcode-scanner-container"
            className="w-full min-h-[250px] rounded-lg overflow-hidden bg-black"
          />
          {error && (
            <div className="text-sm text-destructive text-center p-3 bg-destructive/10 rounded-lg">
              {error}
            </div>
          )}
          <Button variant="outline" className="w-full gap-2" onClick={onClose}>
            <X className="w-4 h-4" />
            {t("common.cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
