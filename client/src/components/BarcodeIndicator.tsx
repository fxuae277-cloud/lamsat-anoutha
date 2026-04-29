import { ScanLine } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type BarcodeIndicatorState = "idle" | "success" | "error";

interface Props {
  state: BarcodeIndicatorState;
  lastScanned: string | null;
  enabled: boolean;
  /** When true (POS pink header) the icon uses light colors. */
  variant?: "default" | "onDark";
}

export function BarcodeIndicator({ state, lastScanned, enabled, variant = "default" }: Props) {
  if (!enabled) return null;

  const onDark = variant === "onDark";
  const dotColor =
    state === "success" ? "bg-emerald-400 animate-pulse" :
    state === "error"   ? "bg-red-500 animate-pulse"      :
    onDark ? "bg-white/40" : "bg-gray-300";

  const ringColor =
    state === "success" ? "ring-emerald-300" :
    state === "error"   ? "ring-red-300"     :
    "ring-transparent";

  const iconColor =
    onDark ? "text-white"
    : state === "success" ? "text-emerald-600"
    : state === "error"   ? "text-red-600"
    : "text-gray-500";

  const status =
    state === "success" ? "تم المسح بنجاح" :
    state === "error"   ? "فشل المسح" :
    "السكانر جاهز";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          data-testid="barcode-indicator"
          data-state={state}
          className={`relative inline-flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200 ${onDark ? "hover:bg-white/10" : "hover:bg-gray-100"} ring-2 ${ringColor}`}
        >
          <ScanLine className={`w-4 h-4 ${iconColor}`} />
          <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${dotColor}`} />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <div className="text-xs space-y-0.5" dir="rtl">
          <p className="font-semibold">{status}</p>
          {lastScanned && (
            <p className="text-muted-foreground font-mono">آخر مسح: {lastScanned}</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
