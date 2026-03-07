import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, PlayCircle, StopCircle, DollarSign, Loader2, CheckCircle2, AlertTriangle, ReceiptText } from "lucide-react";

export default function MobileShift() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [openingCash, setOpeningCash] = useState("");
  const [actualCash, setActualCash] = useState("");

  const { data: currentShift, isLoading } = useQuery<any>({
    queryKey: ["/api/shifts/current"],
    queryFn: getQueryFn({ on401: "throw" }),
    refetchInterval: 15000,
  });

  const { data: homeData } = useQuery<any>({
    queryKey: ["/api/mobile/employee/home"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const openShiftMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/mobile/shift/open", { openingCash: openingCash || "0" });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("mobile.shift_opened") });
      setOpeningCash("");
      queryClient.invalidateQueries({ queryKey: ["/api/shifts/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/employee/home"] });
    },
    onError: (err: Error) => {
      toast({ title: t("mobile.error"), description: err.message, variant: "destructive" });
    },
  });

  const closeShiftMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/mobile/shift/close", { actualCash: actualCash || "0" });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: t("mobile.shift_closed_success") });
      setActualCash("");
      queryClient.invalidateQueries({ queryKey: ["/api/shifts/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/employee/home"] });
    },
    onError: (err: Error) => {
      toast({ title: t("mobile.error"), description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const shiftOpen = currentShift?.status === "open";

  if (!shiftOpen) {
    return (
      <div className="p-4 pb-24 space-y-4" dir="rtl">
        <div className="text-center pt-8 pb-4">
          <Clock className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold">{t("mobile.no_active_shift")}</h2>
          <p className="text-muted-foreground mt-1">{t("mobile.open_shift_desc")}</p>
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <Label className="text-base">{t("mobile.opening_cash")}</Label>
              <Input
                type="number"
                step="0.001"
                placeholder="0.000"
                value={openingCash}
                onChange={e => setOpeningCash(e.target.value)}
                className="mt-2 h-14 text-xl text-center"
                data-testid="input-opening-cash"
              />
            </div>
            <Button
              className="w-full h-14 text-lg gap-2 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => openShiftMutation.mutate()}
              disabled={openShiftMutation.isPending}
              data-testid="button-confirm-open-shift"
            >
              {openShiftMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
              {t("mobile.open_shift")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const expectedCash = parseFloat(currentShift.openingCash || "0") + (homeData?.todaySales || 0);
  const diff = actualCash ? parseFloat(actualCash) - expectedCash : 0;

  return (
    <div className="p-4 pb-24 space-y-4" dir="rtl">
      <Card className="border-emerald-500 border-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            {t("mobile.active_shift")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 p-3 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">{t("mobile.started_at")}</p>
              <p className="font-bold" data-testid="text-shift-start">
                {currentShift.startedAt ? new Date(currentShift.startedAt).toLocaleTimeString("ar-OM", { hour: "2-digit", minute: "2-digit" }) : "--"}
              </p>
            </div>
            <div className="bg-muted/50 p-3 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">{t("mobile.opening_cash")}</p>
              <p className="font-bold" data-testid="text-opening-cash">{parseFloat(currentShift.openingCash || "0").toFixed(3)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary/10 p-3 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">{t("mobile.shift_sales")}</p>
              <p className="font-bold text-lg text-primary" data-testid="text-shift-sales">{(homeData?.todaySales || 0).toFixed(3)}</p>
            </div>
            <div className="bg-primary/10 p-3 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">{t("mobile.invoice_count")}</p>
              <p className="font-bold text-lg text-primary" data-testid="text-shift-invoices">{homeData?.todayCount || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-orange-500 border-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <StopCircle className="w-5 h-5 text-orange-600" />
            {t("mobile.close_shift")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="flex justify-between">
              <span className="text-sm">{t("mobile.expected_cash")}</span>
              <span className="font-bold">{expectedCash.toFixed(3)}</span>
            </div>
          </div>

          <div>
            <Label className="text-base">{t("mobile.actual_cash")}</Label>
            <Input
              type="number"
              step="0.001"
              placeholder="0.000"
              value={actualCash}
              onChange={e => setActualCash(e.target.value)}
              className="mt-2 h-14 text-xl text-center"
              data-testid="input-actual-cash"
            />
          </div>

          {actualCash && (
            <div className={`p-3 rounded-lg text-center ${diff >= 0 ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-red-50 dark:bg-red-950/20"}`}>
              <p className="text-sm text-muted-foreground">{t("mobile.cash_difference")}</p>
              <p className={`text-xl font-bold ${diff >= 0 ? "text-emerald-600" : "text-red-600"}`} data-testid="text-cash-diff">
                {diff >= 0 ? "+" : ""}{diff.toFixed(3)}
              </p>
            </div>
          )}

          <Button
            className="w-full h-14 text-lg gap-2 bg-orange-600 hover:bg-orange-700"
            onClick={() => closeShiftMutation.mutate()}
            disabled={closeShiftMutation.isPending || !actualCash}
            data-testid="button-confirm-close-shift"
          >
            {closeShiftMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <StopCircle className="w-5 h-5" />}
            {t("mobile.close_shift")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
