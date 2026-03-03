import { useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { useI18n } from "@/lib/i18n";

interface BarcodeScanButtonProps {
  onScan: (barcode: string) => void;
  size?: "default" | "sm" | "icon";
  className?: string;
}

export function BarcodeScanButton({ onScan, size = "icon", className = "" }: BarcodeScanButtonProps) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        className={className}
        onClick={() => setOpen(true)}
        title={t("pos.scan_barcode")}
        data-testid="button-scan-barcode"
      >
        <Camera className="w-4 h-4" />
      </Button>
      <BarcodeScanner
        open={open}
        onClose={() => setOpen(false)}
        onScan={(barcode) => {
          onScan(barcode);
          setOpen(false);
        }}
      />
    </>
  );
}
