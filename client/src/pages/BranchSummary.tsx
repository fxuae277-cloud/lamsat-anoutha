/**
 * BranchSummary.tsx — الملخص المالي للفرع
 * يعرض ملخص اليوم من خلال بيانات الورديات الفعلية والمبيعات
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  Banknote, CreditCard, ArrowDownUp, Clock, TrendingUp,
  RefreshCw, Calendar, CheckCircle2, AlertCircle, ReceiptText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShiftDetail {
  id: number;
  status: "open" | "closed";
  openingCash: number;
  actualCash: number | null;
  expectedCash: number | null;
  difference: number | null;
  startedAt: string;
  endedAt: string | null;
  cashierName: string;
  terminalName: string;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalTransfer: number;
  invoiceCount: number;
}

interface BranchSummaryData {
  date: string;
  branchName: string;
  currentShift: ShiftDetail | null;
  allShifts: ShiftDetail[];
  today: {
    totalSales: number;
    totalCash: number;
    totalCard: number;
    totalTransfer: number;
    invoiceCount: number;
    totalOpeningCash: number;
    totalClosingCash: number;
    shiftsCount: number;
    closedShiftsCount: number;
  };
}

interface Branch { id: number; name: string; address?: string | null; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString("ar-OM", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("ar-OM", { hour: "2-digit", minute: "2-digit" });

const OMR = "ر.ع";

function StatCard({
  label, value, icon: Icon, color, sub,
}: { label: string; value: string; icon: any; color: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-xl ${color} shrink-0`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground leading-none mb-1">{label}</p>
            <p className="text-xl font-bold leading-none">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Per-shift row ────────────────────────────────────────────────────────────

function ShiftRow({ s }: { s: ShiftDetail }) {
  const [expanded, setExpanded] = useState(false);
  const diffColor =
    s.difference == null ? ""
    : Math.abs(s.difference) < 0.001 ? "text-green-600"
    : s.difference > 0 ? "text-blue-600"
    : "text-red-600";

  return (
    <div className="border rounded-xl overflow-hidden">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-right hover:bg-muted/30 transition-colors"
      >
        <div className={`w-2 h-2 rounded-full shrink-0 ${s.status === "open" ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">الكاشير</p>
            <p className="font-semibold truncate">{s.cashierName}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">الوقت</p>
            <p className="font-semibold">
              {fmtTime(s.startedAt)}
              {s.endedAt ? ` ← ${fmtTime(s.endedAt)}` : " (مفتوحة)"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">المبيعات</p>
            <p className="font-bold text-emerald-600">{fmt(s.totalSales)} {OMR}</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-xs">الفواتير</p>
              <p className="font-semibold">{s.invoiceCount}</p>
            </div>
            <Badge
              variant={s.status === "open" ? "default" : "secondary"}
              className={s.status === "open" ? "bg-green-500 hover:bg-green-600 text-xs" : "text-xs"}
            >
              {s.status === "open" ? "مفتوحة" : "مغلقة"}
            </Badge>
          </div>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t bg-muted/20 px-4 py-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {[
            ["💰 نقد افتتاحي",    fmt(s.openingCash) + " " + OMR],
            ["💵 مستلم نقداً",    fmt(s.totalCash) + " " + OMR],
            ["💳 مستلم بطاقة",   fmt(s.totalCard) + " " + OMR],
            ["🏦 تحويل بنكي",    fmt(s.totalTransfer) + " " + OMR],
            ["📊 كاش متوقع",     s.expectedCash != null ? fmt(s.expectedCash) + " " + OMR : "—"],
            ["🧾 كاش فعلي",      s.actualCash != null ? fmt(s.actualCash) + " " + OMR : "لم يُغلق بعد"],
          ].map(([label, val]) => (
            <div key={label as string}>
              <p className="text-muted-foreground text-xs">{label as string}</p>
              <p className="font-semibold">{val as string}</p>
            </div>
          ))}
          {s.difference != null && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-muted-foreground text-xs">الفرق</p>
              <p className={`font-bold text-base ${diffColor}`}>
                {Math.abs(s.difference) < 0.001
                  ? "✅ متطابق"
                  : s.difference > 0
                  ? `⬆️ زيادة +${fmt(s.difference)} ${OMR}`
                  : `⬇️ عجز −${fmt(Math.abs(s.difference))} ${OMR}`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BranchSummary() {
  const { data: authData } = useAuth();
  const user = authData?.user;
  const isOwnerOrAdmin = user?.role === "owner" || user?.role === "admin";

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: () => fetch("/api/branches", { credentials: "include" }).then(r => r.json()),
    enabled: isOwnerOrAdmin,
  });

  // Effective branch: owner picks from dropdown, cashier uses their own
  const effectiveBranchId = isOwnerOrAdmin
    ? (selectedBranchId || branches[0]?.id?.toString() || "")
    : user?.branchId?.toString() || "";

  const { data, isLoading, refetch, dataUpdatedAt } = useQuery<BranchSummaryData>({
    queryKey: ["branch-summary", effectiveBranchId, date],
    queryFn: async () => {
      const p = new URLSearchParams({ date });
      if (effectiveBranchId) p.set("branchId", effectiveBranchId);
      const r = await fetch(`/api/branch-summary?${p}`, { credentials: "include" });
      if (!r.ok) throw new Error("فشل جلب البيانات");
      return r.json();
    },
    enabled: !!effectiveBranchId || !isOwnerOrAdmin,
    refetchInterval: 60_000, // auto-refresh every minute
    staleTime: 30_000,
  });

  const today = data?.today;
  const allShifts = data?.allShifts ?? [];
  const openShift = allShifts.find(s => s.status === "open") ?? null;

  const lastRefresh = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("ar-OM", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto" dir="rtl">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">الملخص المالي للفرع</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {data?.branchName ?? "جارٍ التحميل..."}
            {lastRefresh && <span className="mr-2 text-xs opacity-60">آخر تحديث {lastRefresh}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Branch picker (owner/admin only) */}
          {isOwnerOrAdmin && branches.length > 1 && (
            <Select value={selectedBranchId || String(branches[0]?.id ?? "")} onValueChange={setSelectedBranchId}>
              <SelectTrigger className="w-40 h-9 text-sm">
                <SelectValue placeholder="اختر الفرع" />
              </SelectTrigger>
              <SelectContent>
                {branches.map(b => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.address ? `${b.name} — ${b.address}` : b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {/* Date picker */}
          <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-white text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="outline-none bg-transparent text-sm"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            تحديث
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Open shift banner ── */}
          {openShift ? (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-green-800">وردية مفتوحة الآن</p>
                <p className="text-sm text-green-700">
                  {openShift.cashierName} — {openShift.terminalName} — بدأت{" "}
                  {fmtTime(openShift.startedAt)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">مبيعات الوردية</p>
                <p className="font-bold text-emerald-600">{fmt(openShift.totalSales)} {OMR}</p>
              </div>
            </div>
          ) : allShifts.length === 0 ? (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-sm">لا توجد ورديات لهذا اليوم — لم يُفتح نقطة البيع بعد</p>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-gray-50 border rounded-xl p-4 text-gray-700">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-gray-500" />
              <p className="text-sm">جميع الورديات مغلقة لهذا اليوم</p>
            </div>
          )}

          {/* ── Totals grid ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              label="نقد الافتتاح (بداية اليوم)"
              value={`${fmt(today?.totalOpeningCash ?? 0)} ${OMR}`}
              icon={Banknote}
              color="bg-blue-500"
              sub={`${today?.shiftsCount ?? 0} وردية — ${today?.closedShiftsCount ?? 0} مغلقة`}
            />
            <StatCard
              label="نقد الإغلاق (آخر وردية مغلقة)"
              value={`${fmt(today?.totalClosingCash ?? 0)} ${OMR}`}
              icon={Banknote}
              color="bg-indigo-500"
              sub={today?.closedShiftsCount ? `آخر إغلاق في اليوم` : "لا توجد وردية مغلقة"}
            />
            <StatCard
              label="إجمالي المبيعات"
              value={`${fmt(today?.totalSales ?? 0)} ${OMR}`}
              icon={TrendingUp}
              color="bg-emerald-500"
              sub={`${today?.invoiceCount ?? 0} فاتورة`}
            />
            <StatCard
              label="مستلم نقداً"
              value={`${fmt(today?.totalCash ?? 0)} ${OMR}`}
              icon={Banknote}
              color="bg-green-500"
            />
            <StatCard
              label="مستلم بطاقة"
              value={`${fmt(today?.totalCard ?? 0)} ${OMR}`}
              icon={CreditCard}
              color="bg-purple-500"
            />
            <StatCard
              label="تحويل بنكي"
              value={`${fmt(today?.totalTransfer ?? 0)} ${OMR}`}
              icon={ArrowDownUp}
              color="bg-orange-500"
            />
          </div>

          {/* ── Total summary bar ── */}
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap gap-6 justify-around text-center">
                <div>
                  <p className="text-xs text-muted-foreground">نقد + بطاقة + تحويل</p>
                  <p className="text-xl font-bold text-emerald-600">
                    {fmt((today?.totalCash ?? 0) + (today?.totalCard ?? 0) + (today?.totalTransfer ?? 0))} {OMR}
                  </p>
                </div>
                <div className="border-r" />
                <div>
                  <p className="text-xs text-muted-foreground">عدد الفواتير</p>
                  <p className="text-xl font-bold">{today?.invoiceCount ?? 0}</p>
                </div>
                <div className="border-r" />
                <div>
                  <p className="text-xs text-muted-foreground">عدد الورديات</p>
                  <p className="text-xl font-bold">{today?.shiftsCount ?? 0}</p>
                </div>
                <div className="border-r" />
                <div>
                  <p className="text-xs text-muted-foreground">ورديات مغلقة</p>
                  <p className="text-xl font-bold">{today?.closedShiftsCount ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Per-shift breakdown ── */}
          {allShifts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                تفصيل الورديات ({allShifts.length})
              </h2>
              {allShifts.map(s => <ShiftRow key={s.id} s={s} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
