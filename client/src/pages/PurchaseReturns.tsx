import { PackageX } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function PurchaseReturns() {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <PackageX className="w-6 h-6" /> {t("nav.purchaseReturns")}
        </h1>
      </div>
      <div className="border rounded-lg bg-card p-16 flex flex-col items-center justify-center text-center gap-4">
        <PackageX className="w-16 h-16 text-muted-foreground/40" />
        <p className="text-xl font-semibold text-muted-foreground">{t("common.coming_soon") || "قريباً"}</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          {t("common.feature_under_development") || "هذه الميزة قيد التطوير وستكون متاحة قريباً"}
        </p>
      </div>
    </div>
  );
}
