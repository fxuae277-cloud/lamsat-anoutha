import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  Banknote,
  CreditCard,
  ArrowDownUp,
  Clock,
  TrendingUp,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BranchSummaryData {
  date: string;
  branchName: string;
  currentShift: {
    id: number;
    status: "open" | "closed";
    openingCash: number;
    actualCash: number | null;
    startedAt: string;
    endedAt: string | null;
    cashierName: string;
    terminalName: string;
  } | null;
  today: {
    totalSales: number;
    totalCash: number;
    totalCard: number;
    totalTransfer: number;
    totalOpeningCash: number;
    totalClosingCash: number;
    shiftsCount: number;
    closedShiftsCount: number;
  };
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string;
  value: string;
  icon: any;
  color: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-0.5 leading-none">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BranchSummary() {
  const { t } = useI18n();
  const { data: authData } = useAuth();
  const user = authData?.user;
  const [date, setDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  const { data, isLoading, refetch } = useQuery<BranchSummaryData>({
    queryKey: ["branch-summary", user?.branchId ?? "all", date],
    queryFn: async () => {
      const params = new URLSearchParams({ date });
      if (user?.branchId) params.set("branchId", String(user.branchId));
      const r = await fetch(`/api/branch-summary?${params}`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("فشل جلب بيانات الملخص");
      return r.json();
    },
    staleTime: 30_000,
  });

  const fmt = (v: number) =>
    v.toLocaleString("ar-OM", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  const currency = "ر.ع";

  const today = data?.today;
  const shift = data?.currentShift;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">الملخص المالي للفرع</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {data?.branchName ?? "جاري التحميل..."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-white">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-sm outline-none bg-transparent"
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Current Shift Card */}
          {shift ? (
            <Card className="border-2 border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    الوردية الحالية
                  </CardTitle>
                  <Badge
                    variant={shift.status === "open" ? "default" : "secondary"}
                    className={
                      shift.status === "open"
                        ? "bg-green-500 hover:bg-green-600"
                        : ""
                    }
                  >
                    {shift.status === "open" ? "مفتوحة" : "مغلقة"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">الكاشير</p>
                    <p className="font-semibold">{shift.cashierName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">الجهاز</p>
                    <p className="font-semibold">{shift.terminalName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">بدأت في</p>
                    <p className="font-semibold">
                      {new Date(shift.startedAt).toLocaleTimeString("ar-OM", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {shift.endedAt && (
                    <div>
                      <p className="text-muted-foreground">انتهت في</p>
                      <p className="font-semibold">
                        {new Date(shift.endedAt).toLocaleTimeString("ar-OM", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-2">
              <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
                لا توجد وردية نشطة اليوم
              </CardContent>
            </Card>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              label="رصيد الصندوق — بداية الوردية"
              value={`${fmt(today?.totalOpeningCash ?? 0)} ${currency}`}
              icon={Banknote}
              color="bg-blue-500"
              sub={`${today?.shiftsCount ?? 0} وردية اليوم`}
            />
            <StatCard
              label="رصيد الصندوق — نهاية الوردية"
              value={`${fmt(today?.totalClosingCash ?? 0)} ${currency}`}
              icon={Banknote}
              color="bg-indigo-500"
              sub={
                today?.closedShiftsCount
                  ? `${today.closedShiftsCount} وردية مغلقة`
                  : "لا توجد وردية مغلقة"
              }
            />
            <StatCard
              label="إجمالي المبيعات اليوم"
              value={`${fmt(today?.totalSales ?? 0)} ${currency}`}
              icon={TrendingUp}
              color="bg-emerald-500"
            />
            <StatCard
              label="المستلم نقداً"
              value={`${fmt(today?.totalCash ?? 0)} ${currency}`}
              icon={Banknote}
              color="bg-green-500"
            />
            <StatCard
              label="المستلم بالبطاقة"
              value={`${fmt(today?.totalCard ?? 0)} ${currency}`}
              icon={CreditCard}
              color="bg-purple-500"
            />
            <StatCard
              label="المستلم تحويل بنكي"
              value={`${fmt(today?.totalTransfer ?? 0)} ${currency}`}
              icon={ArrowDownUp}
              color="bg-orange-500"
            />
          </div>

          {/* Summary Bar */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap gap-6 justify-around text-center">
                <div>
                  <p className="text-xs text-muted-foreground">نقد + بطاقة + تحويل</p>
                  <p className="text-lg font-bold text-emerald-600">
                    {fmt(
                      (today?.totalCash ?? 0) +
                        (today?.totalCard ?? 0) +
                        (today?.totalTransfer ?? 0)
                    )}{" "}
                    {currency}
                  </p>
                </div>
                <div className="border-r" />
                <div>
                  <p className="text-xs text-muted-foreground">الورديات اليوم</p>
                  <p className="text-lg font-bold">{today?.shiftsCount ?? 0}</p>
                </div>
                <div className="border-r" />
                <div>
                  <p className="text-xs text-muted-foreground">الورديات المغلقة</p>
                  <p className="text-lg font-bold">{today?.closedShiftsCount ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
