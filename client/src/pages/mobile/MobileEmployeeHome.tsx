import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  ShoppingCart, ReceiptText, Clock, Camera, DollarSign, FileText, 
  PlayCircle, StopCircle, Loader2
} from "lucide-react";

type HomeData = {
  user: { id: number; name: string; role: string; branchId: number; terminalName: string };
  branch: { id: number; name: string } | null;
  shift: { id: number; status: string; startedAt: string; openingCash: string } | null;
  todaySales: number;
  todayCount: number;
};

export default function MobileEmployeeHome() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();

  const { data, isLoading } = useQuery<HomeData>({
    queryKey: ["/api/mobile/employee/home"],
    queryFn: getQueryFn({ on401: "throw" }),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const shiftOpen = data?.shift?.status === "open";

  return (
    <div className="p-4 pb-24 space-y-4" dir="rtl">
      <div className="text-center space-y-1 pt-2">
        <h1 className="text-xl font-bold" data-testid="text-employee-name">{data?.user?.name}</h1>
        <p className="text-sm text-muted-foreground" data-testid="text-branch-name">{data?.branch?.name}</p>
      </div>

      <Card className={`border-2 ${shiftOpen ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : "border-orange-500 bg-orange-50 dark:bg-orange-950/20"}`}>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className={`w-6 h-6 ${shiftOpen ? "text-emerald-600" : "text-orange-600"}`} />
            <div>
              <p className="font-semibold text-sm">{t("mobile.shift_status")}</p>
              <p className={`text-lg font-bold ${shiftOpen ? "text-emerald-600" : "text-orange-600"}`} data-testid="text-shift-status">
                {shiftOpen ? t("mobile.shift_open") : t("mobile.shift_closed")}
              </p>
            </div>
          </div>
          {shiftOpen && data?.shift?.startedAt && (
            <span className="text-xs text-muted-foreground">
              {new Date(data.shift.startedAt).toLocaleTimeString("ar-OM", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="w-8 h-8 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold" data-testid="text-today-sales">{(data?.todaySales || 0).toFixed(3)}</p>
            <p className="text-xs text-muted-foreground">{t("mobile.today_sales")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <FileText className="w-8 h-8 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold" data-testid="text-today-invoices">{data?.todayCount || 0}</p>
            <p className="text-xs text-muted-foreground">{t("mobile.today_invoices")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {!shiftOpen ? (
          <Button
            className="h-16 text-base gap-2 col-span-2 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => setLocation("/shift")}
            data-testid="button-open-shift"
          >
            <PlayCircle className="w-6 h-6" />
            {t("mobile.open_shift")}
          </Button>
        ) : (
          <>
            <Button
              className="h-16 text-base gap-2 bg-primary"
              onClick={() => setLocation("/pos")}
              data-testid="button-new-sale"
            >
              <ShoppingCart className="w-6 h-6" />
              {t("mobile.new_sale")}
            </Button>
            <Button
              className="h-16 text-base gap-2"
              variant="outline"
              onClick={() => setLocation("/invoices")}
              data-testid="button-view-invoices"
            >
              <ReceiptText className="w-6 h-6" />
              {t("mobile.my_invoices")}
            </Button>
            <Button
              className="h-16 text-base gap-2"
              variant="outline"
              onClick={() => setLocation("/pos")}
              data-testid="button-scan-barcode"
            >
              <Camera className="w-6 h-6" />
              {t("mobile.scan_barcode")}
            </Button>
            <Button
              className="h-16 text-base gap-2 bg-orange-600 hover:bg-orange-700 text-white"
              onClick={() => setLocation("/shift")}
              data-testid="button-close-shift"
            >
              <StopCircle className="w-6 h-6" />
              {t("mobile.close_shift")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
