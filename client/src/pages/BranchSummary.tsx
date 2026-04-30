/**
 * BranchSummary.tsx — الملخص المالي للفرع
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  Banknote, CreditCard, ArrowDownUp, Clock, TrendingUp,
  RefreshCw, Calendar, CheckCircle2, AlertCircle,
  PlusCircle, HandCoins, Building2, ShoppingBag, Wallet,
  ArrowUpCircle, ArrowDownCircle, ArrowUp, ArrowDown, XCircle,
  Plus, Minus, User, Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShiftDetail {
  id: number;
  status: "open" | "closed";
  cashierId?: number | null;
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

interface CustodyData {
  employeeId: number | null;
  branchId: number | null;
  currentShiftId: number | null;
  totalEmployeeCashCustody: number;
  drawerCash: number;
  outsideDrawerCash: number;
  todayCashSales: number;
  ownerInflows: number;
  ownerOutflows: number;
  cashExpenses: number;
  adjustments: number;
  cumulativeCashSales: number;
  cumulativeOwnerInflows: number;
  cumulativeOwnerOutflows: number;
  cumulativeAdjustments: number;
  cumulativeCashExpenses: number;
  formulaBreakdown: {
    cashSales: number;
    ownerInflows: number;
    adjustmentsIn: number;
    ownerOutflows: number;
    adjustmentsOut: number;
    cashExpenses: number;
    total: number;
  };
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
    totalOutflows: number;
    outflowByType: Record<string, number>;
    totalInflows: number;
    inflowByType: Record<string, number>;
    actualCashInDrawer: number;
    carryForward: number;
    baseBalance: number;
  };
  custody: CustodyData;
}

interface CashMovement {
  id: number;
  type: string;
  amount_in: number;
  amount_out: number;
  note: string | null;
  created_at: string;
  created_by_name: string | null;
}

interface Branch { id: number; name: string; address?: string | null; }

// ─── Movement Definitions ─────────────────────────────────────────────────────

// للعرض في بطاقة المخرجات (تشمل expense من جدول expenses)
const OUTFLOW_TYPES = [
  { value: "owner_handover",  label: "تسليم للمالك",     icon: HandCoins,   color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-200",   dot: "bg-blue-500"   },
  { value: "bank_deposit",    label: "إيداع بنكي",       icon: Building2,   color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200", dot: "bg-purple-500" },
  { value: "expense",         label: "مصروفات نقدية",    icon: ShoppingBag, color: "text-red-600",    bg: "bg-red-50",    border: "border-red-200",    dot: "bg-red-500"    },
  { value: "adjustment_out",  label: "تسوية سالبة",      icon: Minus,       color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", dot: "bg-orange-500" },
] as const;

// للـ dialog فقط — لا نسمح بإدخال مصروف هنا (يُدخل من صفحة المصروفات)
const DIALOG_OUTFLOW_TYPES = [
  { value: "owner_handover",  label: "تسليم للمالك",     icon: HandCoins,   color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-200",   dot: "bg-blue-500"   },
  { value: "bank_deposit",    label: "إيداع بنكي",       icon: Building2,   color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200", dot: "bg-purple-500" },
  { value: "adjustment_out",  label: "تسوية سالبة",      icon: Minus,       color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", dot: "bg-orange-500" },
] as const;

const INFLOW_TYPES = [
  { value: "owner_cash_in",      label: "استلم نقد من المالك",     icon: Banknote,        color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
  { value: "owner_transfer_in",  label: "استلم تحويل من المالك",   icon: ArrowDownCircle, color: "text-teal-600",    bg: "bg-teal-50",    border: "border-teal-200",    dot: "bg-teal-500"    },
  { value: "adjustment_in",      label: "تسوية موجبة",             icon: Plus,            color: "text-orange-600",  bg: "bg-orange-50",  border: "border-orange-200",  dot: "bg-orange-500"  },
] as const;

type OutflowType = typeof OUTFLOW_TYPES[number]["value"];
type InflowType  = typeof INFLOW_TYPES[number]["value"];
type MovDir = "out" | "in";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString("ar-OM", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("ar-OM", { hour: "2-digit", minute: "2-digit" });

function allMovTypes() {
  return [...OUTFLOW_TYPES, ...INFLOW_TYPES];
}

function getMovMeta(type: string) {
  return allMovTypes().find(m => m.value === type);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function ShiftRow({ s, omr, t }: { s: ShiftDetail; omr: string; t: (k: string) => string }) {
  const [expanded, setExpanded] = useState(false);
  const diffColor =
    s.difference == null ? ""
    : Math.abs(s.difference) < 0.001 ? "text-green-600"
    : s.difference > 0 ? "text-blue-600"
    : "text-red-600";

  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-start hover:bg-muted/30 transition-colors"
      >
        <div className={`w-2 h-2 rounded-full shrink-0 ${s.status === "open" ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">{t("branch_summary.cashier")}</p>
            <p className="font-semibold truncate">{s.cashierName}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t("branch_summary.time_range")}</p>
            <p className="font-semibold">
              {fmtTime(s.startedAt)}
              {s.endedAt ? ` ← ${fmtTime(s.endedAt)}` : ` (${t("branch_summary.status_open")})`}
            </p>
          </div>
          {/* نقد الافتتاح ← الاختتام */}
          <div>
            <p className="text-muted-foreground text-xs">{t("branchSummary.shift_start_end")}</p>
            <p className="font-semibold text-blue-700 text-xs leading-snug">
              {fmt(s.openingCash)}
              {s.actualCash != null
                ? <span> ← <span className="text-emerald-700">{fmt(s.actualCash)}</span></span>
                : <span className="text-muted-foreground"> {t("branchSummary.shift_still_open")}</span>
              }
              <span className="text-muted-foreground me-0.5"> {omr}</span>
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t("branch_summary.sales_shift")}</p>
            <p className="font-bold text-emerald-600">{fmt(s.totalSales)} {omr}</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-xs">{t("branch_summary.invoices")}</p>
              <p className="font-semibold">{s.invoiceCount}</p>
            </div>
            <Badge
              variant={s.status === "open" ? "default" : "secondary"}
              className={s.status === "open" ? "bg-green-500 hover:bg-green-600 text-xs" : "text-xs"}
            >
              {s.status === "open" ? t("branch_summary.status_open") : t("branch_summary.status_closed")}
            </Badge>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t bg-muted/20 px-4 py-4 space-y-3">

          {/* حركة الصندوق النقدي */}
          <div className="flex items-center gap-3 rounded-xl bg-white border px-4 py-3">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-0.5">{t("branchSummary.drawer_start")}</p>
              <p className="text-base font-bold text-blue-700">{fmt(s.openingCash)}</p>
              <p className="text-xs text-muted-foreground">{omr}</p>
            </div>
            <div className="flex-1 text-center text-muted-foreground text-lg">→</div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-0.5">{t("branchSummary.drawer_end")}</p>
              {s.actualCash != null ? (
                <>
                  <p className="text-base font-bold text-emerald-700">{fmt(s.actualCash)}</p>
                  <p className="text-xs text-muted-foreground">{omr}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground italic">{t("branch_summary.not_closed")}</p>
              )}
            </div>
            {s.difference != null && (
              <>
                <div className="flex-1 text-center text-muted-foreground text-lg">→</div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-0.5">{t("branch_summary.shift_diff")}</p>
                  <p className={`text-base font-bold ${diffColor}`}>
                    {Math.abs(s.difference) < 0.001
                      ? t("branchSummary.diff_matched")
                      : `${s.difference > 0 ? "+" : "−"}${fmt(Math.abs(s.difference))}`}
                  </p>
                  {Math.abs(s.difference) >= 0.001 && <p className="text-xs text-muted-foreground">{omr}</p>}
                </div>
              </>
            )}
          </div>

          {/* تفاصيل المبيعات */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {[
              [`💵 ${t("branch_summary.cash_sales")}`,     fmt(s.totalCash) + " " + omr],
              [`💳 ${t("branch_summary.card_sales")}`,     fmt(s.totalCard) + " " + omr],
              [`🏦 ${t("branch_summary.bank_sales")}`,     fmt(s.totalTransfer) + " " + omr],
              [`📊 ${t("branch_summary.expected_cash")}`,  s.expectedCash != null ? fmt(s.expectedCash) + " " + omr : "—"],
            ].map(([label, val]) => (
              <div key={label as string}>
                <p className="text-muted-foreground text-xs">{label as string}</p>
                <p className="font-semibold">{val as string}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BranchSummary() {
  const { t, lang } = useI18n();
  const { data: authData } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = authData?.user;
  const isOwnerOrAdmin = user?.role === "owner" || user?.role === "admin";

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  // ── Close Shift Dialog ───────────────────────────────────────────
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeActualCash, setCloseActualCash] = useState("");
  const [closeError, setCloseError] = useState<string | null>(null);

  const closeShiftMutation = useMutation({
    mutationFn: async (shiftId: number) => {
      if (!closeActualCash || parseFloat(closeActualCash) < 0)
        throw new Error(t("branchSummary.close_shift_error_amount"));
      const res = await fetch(`/api/shifts/${shiftId}/close`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ actualCash: parseFloat(closeActualCash) }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("branchSummary.close_shift_success") });
      setCloseOpen(false); setCloseActualCash(""); setCloseError(null);
      queryClient.invalidateQueries({ queryKey: ["branch-summary"] });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
    onError: (e: Error) => { setCloseError(e.message); },
  });

  // ── Cash Movement Dialog ─────────────────────────────────────────
  const [movOpen, setMovOpen] = useState(false);
  const [movDir, setMovDir] = useState<MovDir>("out");
  const [movType, setMovType] = useState<OutflowType | InflowType>("owner_handover");
  const [movAmount, setMovAmount] = useState("");
  const [movNote, setMovNote] = useState("");

  const handleDirChange = (dir: MovDir) => {
    setMovDir(dir);
    setMovType(dir === "out" ? DIALOG_OUTFLOW_TYPES[0].value : INFLOW_TYPES[0].value);
  };

  const addMovementMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/cash-movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type: movType, amount: movAmount, note: movNote || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("branchSummary.movement_recorded") });
      setMovOpen(false); setMovAmount(""); setMovNote("");
      queryClient.invalidateQueries({ queryKey: ["branch-summary"] });
      queryClient.invalidateQueries({ queryKey: ["cash-movements"] });
    },
    onError: (e: Error) => toast({ title: t("branchSummary.error_label"), description: e.message, variant: "destructive" }),
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: () => fetch("/api/branches", { credentials: "include" }).then(r => r.json()),
    enabled: isOwnerOrAdmin,
  });

  const effectiveBranchId = isOwnerOrAdmin
    ? (selectedBranchId || branches[0]?.id?.toString() || "")
    : user?.branchId?.toString() || "";

  const { data, isLoading, refetch, dataUpdatedAt } = useQuery<BranchSummaryData>({
    queryKey: ["branch-summary", effectiveBranchId, date],
    queryFn: async () => {
      const p = new URLSearchParams({ date });
      if (effectiveBranchId) p.set("branchId", effectiveBranchId);
      const r = await fetch(`/api/branch-summary?${p}`, { credentials: "include" });
      if (!r.ok) throw new Error(t("branchSummary.fetch_error"));
      return r.json();
    },
    enabled: !!effectiveBranchId || !isOwnerOrAdmin,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: movements = [] } = useQuery<CashMovement[]>({
    queryKey: ["cash-movements", effectiveBranchId, date],
    queryFn: async () => {
      const p = new URLSearchParams({ date });
      if (effectiveBranchId) p.set("branchId", effectiveBranchId);
      const r = await fetch(`/api/cash-movements?${p}`, { credentials: "include" });
      return r.json();
    },
    enabled: !!effectiveBranchId || !isOwnerOrAdmin,
    refetchInterval: 60_000,
  });

  const today = data?.today;
  const allShifts = data?.allShifts ?? [];
  const openShift = allShifts.find(s => s.status === "open") ?? null;

  const lastRefresh = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("ar-OM", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  const omr = t("branch_summary.omr");

  const outMovements = movements.filter(m => (m.amount_out ?? 0) > 0);
  const inMovements  = movements.filter(m => (m.amount_in  ?? 0) > 0);

  const activeTypes = movDir === "out" ? DIALOG_OUTFLOW_TYPES : INFLOW_TYPES;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto" dir={lang === "ar" ? "rtl" : "ltr"}>

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("branch_summary.title")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {data?.branchName ?? t("branchSummary.loading")}
            {lastRefresh && (
              <span className="me-2 text-xs opacity-60">
                {t("branch_summary.last_refresh")} {lastRefresh}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isOwnerOrAdmin && branches.length > 1 && (
            <Select value={selectedBranchId || String(branches[0]?.id ?? "")} onValueChange={setSelectedBranchId}>
              <SelectTrigger className="w-40 h-9 text-sm">
                <SelectValue placeholder={t("branch_summary.select_branch")} />
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
            {t("branch_summary.refresh")}
          </Button>
          {openShift && (
            <Button
              size="sm"
              className="gap-1 bg-red-600 hover:bg-red-700"
              onClick={() => {
                const suggested = today?.actualCashInDrawer;
                setCloseActualCash(suggested != null && suggested >= 0 ? suggested.toFixed(3) : "");
                setCloseError(null);
                setCloseOpen(true);
              }}
            >
              <XCircle className="h-3.5 w-3.5" />
              {t("branchSummary.close_shift_btn")}
            </Button>
          )}
          <Button size="sm" className="gap-1 bg-pink-600 hover:bg-pink-700" onClick={() => setMovOpen(true)}>
            <PlusCircle className="h-3.5 w-3.5" />
            {t("branchSummary.record_movement_btn")}
          </Button>
        </div>
      </div>

      {/* ── Close Shift Dialog ── */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <XCircle className="w-4 h-4" /> {t("branchSummary.close_shift_dialog_title")}
            </DialogTitle>
          </DialogHeader>
          {openShift && (
            <div className="space-y-4 pt-1">
              {/* معلومات الوردية */}
              <div className="rounded-xl border bg-muted/30 px-4 py-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("branchSummary.close_shift_cashier_label")}</span>
                  <span className="font-medium">{openShift.cashierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("branchSummary.close_shift_started_label")}</span>
                  <span className="font-medium">{fmtTime(openShift.startedAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("branchSummary.close_shift_sales_label")}</span>
                  <span className="font-bold text-emerald-600">{fmt(openShift.totalSales)} {omr}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("branchSummary.close_shift_drawer_label")}</span>
                  <span className="font-bold text-blue-600">
                    {today?.actualCashInDrawer != null
                      ? `${fmt(today.actualCashInDrawer)} ${omr}`
                      : "—"}
                  </span>
                </div>
              </div>

              {/* رسالة خطأ */}
              {closeError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {closeError}
                </div>
              )}

              {/* المبلغ الفعلي */}
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  {t("branchSummary.close_shift_amount_label")}
                </label>
                <p className="text-xs text-muted-foreground">{t("branchSummary.close_shift_amount_hint")}</p>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={closeActualCash}
                  onChange={e => { setCloseActualCash(e.target.value); setCloseError(null); }}
                  placeholder="0.000"
                  autoFocus
                />
                {closeActualCash && today?.actualCashInDrawer != null && (
                  <p className={`text-xs font-medium mt-1 ${
                    Math.abs(parseFloat(closeActualCash) - today.actualCashInDrawer) < 0.001
                      ? "text-green-600"
                      : parseFloat(closeActualCash) > today.actualCashInDrawer
                      ? "text-blue-600"
                      : "text-red-600"
                  }`}>
                    {(() => {
                      const diff = parseFloat(closeActualCash) - today.actualCashInDrawer;
                      if (Math.abs(diff) < 0.001) return t("branchSummary.close_shift_matched");
                      return `${t("branchSummary.close_shift_diff_prefix")} ${diff > 0 ? "+" : ""}${fmt(diff)} ${omr}`;
                    })()}
                  </p>
                )}
              </div>

              <Button
                className="w-full bg-red-600 hover:bg-red-700"
                onClick={() => closeShiftMutation.mutate(openShift.id)}
                disabled={!closeActualCash || parseFloat(closeActualCash) < 0 || closeShiftMutation.isPending}
              >
                {closeShiftMutation.isPending ? t("branchSummary.close_shift_submitting") : t("branchSummary.close_shift_confirm")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Cash Movement Dialog ── */}
      <Dialog open={movOpen} onOpenChange={setMovOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-4 h-4" /> {t("branchSummary.record_movement_dialog_title")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">

            {/* اتجاه الحركة */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDirChange("out")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                  movDir === "out"
                    ? "border-red-400 bg-red-50 text-red-700"
                    : "border-border text-muted-foreground hover:border-red-200"
                }`}
              >
                <ArrowUp className="w-4 h-4" />
                {t("branchSummary.movement_out_label")}
              </button>
              <button
                type="button"
                onClick={() => handleDirChange("in")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                  movDir === "in"
                    ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                    : "border-border text-muted-foreground hover:border-emerald-200"
                }`}
              >
                <ArrowDown className="w-4 h-4" />
                {t("branchSummary.movement_in_label")}
              </button>
            </div>

            {/* نوع الحركة */}
            <div className={`grid gap-2 ${(activeTypes.length as number) <= 2 ? "grid-cols-2" : "grid-cols-3"}`}>
              {activeTypes.map(({ value, label, icon: Icon, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMovType(value as OutflowType | InflowType)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-medium transition-all ${
                    movType === value ? "border-pink-400 bg-pink-50" : "border-border hover:border-pink-200"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${color}`} />
                  {label}
                </button>
              ))}
            </div>

            {/* المبلغ */}
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("branchSummary.movement_amount_label")}</label>
              <Input
                type="number" step="0.001" min="0.001"
                value={movAmount}
                onChange={e => setMovAmount(e.target.value)}
                placeholder="0.000"
                autoFocus
              />
            </div>

            {/* ملاحظة */}
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("branchSummary.movement_note_label")}</label>
              <Input
                value={movNote}
                onChange={e => setMovNote(e.target.value)}
                placeholder={t("branchSummary.movement_note_placeholder")}
              />
            </div>

            <Button
              className="w-full bg-pink-600 hover:bg-pink-700"
              onClick={() => addMovementMutation.mutate()}
              disabled={!movAmount || parseFloat(movAmount) <= 0 || addMovementMutation.isPending}
            >
              {addMovementMutation.isPending ? t("branchSummary.movement_saving") : t("branchSummary.movement_submit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
                <p className="font-semibold text-green-800">{t("branch_summary.open_shift_banner")}</p>
                <p className="text-sm text-green-700">
                  {openShift.cashierName} — {openShift.terminalName} — {t("branch_summary.started_at")}{" "}
                  {fmtTime(openShift.startedAt)}
                </p>
              </div>
              <div className="text-start">
                <p className="text-xs text-muted-foreground">{t("branch_summary.sales_shift")}</p>
                <p className="font-bold text-emerald-600">{fmt(openShift.totalSales)} {omr}</p>
              </div>
            </div>
          ) : allShifts.length === 0 ? (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-sm">{t("branch_summary.no_shifts")}</p>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-gray-50 border rounded-xl p-4 text-gray-700">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-gray-500" />
              <p className="text-sm">{t("branch_summary.all_closed")}</p>
            </div>
          )}

          {/* ── 💼 بطاقة عُهدة الموظف الرئيسية ── */}
          {/*
            إجمالي النقد بعهدة الموظف = ما هو فعلياً في يد الكاشير،
            سواء داخل الدرج أو محتفظ به خارج الصندوق.
            معادلة (تراكمية):
              + مبيعات نقدية + استلامات من المالك + تسويات موجبة
              − تسليمات للمالك − إيداعات بنكية − تسويات سالبة − مصروفات نقدية
            فتح الدرج بمبلغ من العُهدة = حركة محايدة (نقل من العُهدة إلى الدرج).
          */}
          <Card className="border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white overflow-hidden">
            <CardContent className="pt-5 pb-5">
              <div className="flex flex-col gap-4">

                {/* الرقم الرئيسي */}
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-emerald-500 shrink-0">
                    <User className="h-7 w-7 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground font-medium">{t("branchSummary.custody_title")}</p>
                    <p className="text-3xl font-bold text-emerald-700 leading-none mt-0.5">
                      {fmt(data?.custody?.totalEmployeeCashCustody ?? 0)}
                      <span className="text-lg font-medium text-emerald-600 me-1">{omr}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {t("branchSummary.custody_subtitle")}
                    </p>
                  </div>
                </div>

                {/* تقسيم: درج + خارج الدرج */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Briefcase className="w-4 h-4 text-blue-600" />
                      <p className="text-xs text-blue-700 font-semibold">{t("branchSummary.custody_drawer_title")}</p>
                    </div>
                    <p className="text-2xl font-bold text-blue-700">
                      {fmt(data?.custody?.drawerCash ?? 0)}
                      <span className="text-sm font-medium text-blue-600 me-1">{omr}</span>
                    </p>
                    {(data?.custody?.currentShiftId ?? null) === null && (
                      <p className="text-xs text-muted-foreground mt-1">{t("branchSummary.custody_no_open_shift")}</p>
                    )}
                  </div>
                  <div className="rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <HandCoins className="w-4 h-4 text-amber-600" />
                      <p className="text-xs text-amber-700 font-semibold">{t("branchSummary.custody_outside_title")}</p>
                    </div>
                    <p className="text-2xl font-bold text-amber-700">
                      {fmt(data?.custody?.outsideDrawerCash ?? 0)}
                      <span className="text-sm font-medium text-amber-600 me-1">{omr}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{t("branchSummary.custody_outside_sub")}</p>
                  </div>
                </div>

                {/* معادلة الحساب التراكمية */}
                <div className="bg-white/70 rounded-xl border border-emerald-100 px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">{t("branchSummary.custody_formula_title")}</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    <span className="font-semibold text-emerald-700">{fmt(data?.custody?.cumulativeCashSales ?? 0)}</span>
                    <span className="text-xs text-muted-foreground">{t("branchSummary.custody_cash_sales")}</span>
                    <span className="text-emerald-500 font-bold">+</span>
                    <span className="font-semibold text-teal-700">{fmt(data?.custody?.cumulativeOwnerInflows ?? 0)}</span>
                    <span className="text-xs text-muted-foreground">{t("branchSummary.custody_owner_inflows")}</span>
                    <span className="text-red-500 font-bold">−</span>
                    <span className="font-semibold text-red-700">{fmt(data?.custody?.cumulativeOwnerOutflows ?? 0)}</span>
                    <span className="text-xs text-muted-foreground">{t("branchSummary.custody_owner_outflows")}</span>
                    {(data?.custody?.cumulativeCashExpenses ?? 0) > 0 && (
                      <>
                        <span className="text-red-500 font-bold">−</span>
                        <span className="font-semibold text-red-700">{fmt(data!.custody.cumulativeCashExpenses)}</span>
                        <span className="text-xs text-muted-foreground">{t("branchSummary.custody_cash_expenses")}</span>
                      </>
                    )}
                    {Math.abs(data?.custody?.cumulativeAdjustments ?? 0) > 0.001 && (
                      <>
                        <span className={`font-bold ${(data?.custody?.cumulativeAdjustments ?? 0) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                          {(data?.custody?.cumulativeAdjustments ?? 0) >= 0 ? "+" : "−"}
                        </span>
                        <span className="font-semibold text-orange-700">{fmt(Math.abs(data!.custody.cumulativeAdjustments))}</span>
                        <span className="text-xs text-muted-foreground">{t("branchSummary.custody_adjustments")}</span>
                      </>
                    )}
                    <span className="text-muted-foreground">=</span>
                    <span className="font-bold text-emerald-700">{fmt(data?.custody?.totalEmployeeCashCustody ?? 0)}</span>
                  </div>
                </div>

                {/* بطاقات تفاصيل اليوم */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                      <p className="text-xs text-emerald-700 font-medium">{t("branchSummary.custody_today_cash_sales")}</p>
                    </div>
                    <p className="text-base font-bold text-emerald-700">+{fmt(data?.custody?.todayCashSales ?? 0)} {omr}</p>
                  </div>

                  <div className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <ArrowDownCircle className="w-3.5 h-3.5 text-teal-600" />
                      <p className="text-xs text-teal-700 font-medium">{t("branchSummary.custody_today_inflows")}</p>
                    </div>
                    <p className="text-base font-bold text-teal-700">+{fmt(data?.custody?.ownerInflows ?? 0)} {omr}</p>
                  </div>

                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <HandCoins className="w-3.5 h-3.5 text-blue-600" />
                      <p className="text-xs text-blue-700 font-medium">{t("branchSummary.custody_today_outflows")}</p>
                    </div>
                    <p className="text-base font-bold text-blue-700">−{fmt(data?.custody?.ownerOutflows ?? 0)} {omr}</p>
                  </div>

                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-red-600" />
                      <p className="text-xs text-red-700 font-medium">{t("branchSummary.custody_today_expenses")}</p>
                    </div>
                    <p className="text-base font-bold text-red-700">−{fmt(data?.custody?.cashExpenses ?? 0)} {omr}</p>
                  </div>

                  <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {(data?.custody?.adjustments ?? 0) >= 0
                        ? <Plus className="w-3.5 h-3.5 text-orange-600" />
                        : <Minus className="w-3.5 h-3.5 text-orange-600" />}
                      <p className="text-xs text-orange-700 font-medium">{t("branchSummary.custody_today_adjustments")}</p>
                    </div>
                    <p className="text-base font-bold text-orange-700">
                      {(data?.custody?.adjustments ?? 0) >= 0 ? "+" : "−"}
                      {fmt(Math.abs(data?.custody?.adjustments ?? 0))} {omr}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── إجماليات المبيعات ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              label={t("branch_summary.total_sales")}
              value={`${fmt(today?.totalSales ?? 0)} ${omr}`}
              icon={TrendingUp}
              color="bg-emerald-500"
              sub={`${today?.invoiceCount ?? 0} ${t("branch_summary.invoices")}`}
            />
            <StatCard
              label={t("branch_summary.cash_received")}
              value={`${fmt(today?.totalCash ?? 0)} ${omr}`}
              icon={Banknote}
              color="bg-green-500"
            />
            <StatCard
              label={t("branch_summary.card_received")}
              value={`${fmt(today?.totalCard ?? 0)} ${omr}`}
              icon={CreditCard}
              color="bg-purple-500"
            />
            <StatCard
              label={t("branch_summary.bank_received")}
              value={`${fmt(today?.totalTransfer ?? 0)} ${omr}`}
              icon={ArrowDownUp}
              color="bg-orange-500"
            />
            <StatCard
              label={t("branch_summary.opening_cash")}
              value={`${fmt(data?.currentShift?.openingCash ?? today?.totalOpeningCash ?? 0)} ${omr}`}
              icon={Banknote}
              color="bg-blue-500"
              sub={`${today?.shiftsCount ?? 0} ${t("branch_summary.shifts_count")} — ${today?.closedShiftsCount ?? 0} ${t("branch_summary.closed_shifts")}`}
            />
            <StatCard
              label={t("branch_summary.closing_cash")}
              value={`${fmt(today?.totalClosingCash ?? 0)} ${omr}`}
              icon={Banknote}
              color="bg-indigo-500"
              sub={today?.closedShiftsCount ? t("branch_summary.closed_shifts") : t("branch_summary.not_closed")}
            />
          </div>

          {/* ── حركات الصندوق ── */}
          {movements.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
                  {t("branchSummary.movements_title")} ({movements.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 space-y-4">

                {/* واردات */}
                {inMovements.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-teal-700 flex items-center gap-1.5">
                      <ArrowDownCircle className="w-3.5 h-3.5" /> {t("branchSummary.inflows_label")} ({inMovements.length})
                    </p>
                    {inMovements.map(m => {
                      const meta = getMovMeta(m.type);
                      const Icon = meta?.icon ?? ArrowDownCircle;
                      return (
                        <div key={m.id} className="flex items-center gap-3 rounded-lg border px-3 py-2 bg-teal-50/50">
                          <Icon className={`w-4 h-4 shrink-0 ${meta?.color ?? "text-teal-600"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{meta?.label ?? m.type}</p>
                            {m.note && <p className="text-xs text-muted-foreground truncate">{m.note}</p>}
                            <p className="text-xs text-muted-foreground">
                              {m.created_by_name ?? "—"} • {new Date(m.created_at).toLocaleTimeString("ar-OM", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <p className="font-bold text-teal-600 shrink-0">+{fmt(m.amount_in)} {omr}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* مخرجات */}
                {outMovements.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
                      <ArrowUpCircle className="w-3.5 h-3.5" /> {t("branchSummary.outflows_label")} ({outMovements.length})
                    </p>
                    {outMovements.map(m => {
                      const meta = getMovMeta(m.type);
                      const Icon = meta?.icon ?? ArrowUpCircle;
                      return (
                        <div key={m.id} className="flex items-center gap-3 rounded-lg border px-3 py-2 bg-red-50/50">
                          <Icon className={`w-4 h-4 shrink-0 ${meta?.color ?? "text-red-600"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{meta?.label ?? m.type}</p>
                            {m.note && <p className="text-xs text-muted-foreground truncate">{m.note}</p>}
                            <p className="text-xs text-muted-foreground">
                              {m.created_by_name ?? "—"} • {new Date(m.created_at).toLocaleTimeString("ar-OM", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <p className="font-bold text-red-600 shrink-0">−{fmt(m.amount_out)} {omr}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── شريط الملخص ── */}
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap gap-6 justify-around text-center">
                <div>
                  <p className="text-xs text-muted-foreground">{t("branch_summary.grand_total")}</p>
                  <p className="text-xl font-bold text-emerald-600">
                    {fmt((today?.totalCash ?? 0) + (today?.totalCard ?? 0) + (today?.totalTransfer ?? 0))} {omr}
                  </p>
                </div>
                <div className="border-r" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("branch_summary.invoice_count")}</p>
                  <p className="text-xl font-bold">{today?.invoiceCount ?? 0}</p>
                </div>
                <div className="border-r" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("branch_summary.shifts_count")}</p>
                  <p className="text-xl font-bold">{today?.shiftsCount ?? 0}</p>
                </div>
                <div className="border-r" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("branch_summary.closed_shifts")}</p>
                  <p className="text-xl font-bold">{today?.closedShiftsCount ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── تفاصيل الورديات ── */}
          {allShifts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {t("branch_summary.shift_detail")} ({allShifts.length})
              </h2>
              {allShifts.map(s => (
                <ShiftRow key={s.id} s={s} omr={omr} t={t} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
