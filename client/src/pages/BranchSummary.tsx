/**
 * BranchSummary.tsx — الملخص المالي للفرع
 * يعرض ملخص اليوم من خلال بيانات الورديات الفعلية والمبيعات وحركات الصندوق
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  Banknote, CreditCard, ArrowDownUp, Clock, TrendingUp,
  RefreshCw, Calendar, CheckCircle2, AlertCircle, ReceiptText,
  PlusCircle, HandCoins, Building2, ShoppingBag, Wallet,
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
    totalOutflows: number;
    outflowByType: Record<string, number>;
    actualCashInDrawer: number;
  };
}

interface CashMovement {
  id: number;
  type: string;
  amount_out: number;
  note: string | null;
  created_at: string;
  created_by_name: string | null;
}

interface Branch { id: number; name: string; address?: string | null; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString("ar-OM", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("ar-OM", { hour: "2-digit", minute: "2-digit" });

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
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const diffColor =
    s.difference == null ? ""
    : Math.abs(s.difference) < 0.001 ? "text-green-600"
    : s.difference > 0 ? "text-blue-600"
    : "text-red-600";

  const omr = t("branch_summary.omr");

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

      {/* Expanded details */}
      {expanded && (
        <div className="border-t bg-muted/20 px-4 py-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {[
            [`💰 ${t("branch_summary.opening_cash_lbl")}`, fmt(s.openingCash) + " " + omr],
            [`💵 ${t("branch_summary.cash_sales")}`,       fmt(s.totalCash) + " " + omr],
            [`💳 ${t("branch_summary.card_sales")}`,       fmt(s.totalCard) + " " + omr],
            [`🏦 ${t("branch_summary.bank_sales")}`,       fmt(s.totalTransfer) + " " + omr],
            [`📊 ${t("branch_summary.expected_cash")}`,    s.expectedCash != null ? fmt(s.expectedCash) + " " + omr : "—"],
            [`🧾 ${t("branch_summary.actual_cash")}`,      s.actualCash != null ? fmt(s.actualCash) + " " + omr : t("branch_summary.not_closed")],
          ].map(([label, val]) => (
            <div key={label as string}>
              <p className="text-muted-foreground text-xs">{label as string}</p>
              <p className="font-semibold">{val as string}</p>
            </div>
          ))}
          {s.difference != null && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-muted-foreground text-xs">{t("branch_summary.shift_diff")}</p>
              <p className={`font-bold text-base ${diffColor}`}>
                {Math.abs(s.difference) < 0.001
                  ? t("branch_summary.diff_match")
                  : s.difference > 0
                  ? `${t("branch_summary.diff_surplus")} +${fmt(s.difference)} ${omr}`
                  : `${t("branch_summary.diff_deficit")} −${fmt(Math.abs(s.difference))} ${omr}`}
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
  const { t, lang } = useI18n();
  const { data: authData } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = authData?.user;
  const isOwnerOrAdmin = user?.role === "owner" || user?.role === "admin";

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  // ── Cash Movement Dialog ─────────────────────────────────────────
  const [movOpen, setMovOpen] = useState(false);
  const [movType, setMovType] = useState<"owner_handover" | "bank_deposit" | "expense">("owner_handover");
  const [movAmount, setMovAmount] = useState("");
  const [movNote, setMovNote] = useState("");

  const movTypes = [
    { value: "owner_handover", label: "تسليم للمالك", icon: HandCoins, color: "text-blue-600" },
    { value: "bank_deposit",   label: "إيداع بنكي",   icon: Building2,  color: "text-purple-600" },
    { value: "expense",        label: "مصروف نقدي",   icon: ShoppingBag, color: "text-red-600" },
  ] as const;

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
      toast({ title: "تم تسجيل الحركة" });
      setMovOpen(false); setMovAmount(""); setMovNote("");
      queryClient.invalidateQueries({ queryKey: ["branch-summary"] });
      queryClient.invalidateQueries({ queryKey: ["cash-movements"] });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

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

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto" dir={lang === "ar" ? "rtl" : "ltr"}>

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("branch_summary.title")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {data?.branchName ?? "جارٍ التحميل..."}
            {lastRefresh && (
              <span className="mr-2 text-xs opacity-60">
                {t("branch_summary.last_refresh")} {lastRefresh}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Branch picker (owner/admin only) */}
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
            {t("branch_summary.refresh")}
          </Button>
          <Button size="sm" className="gap-1 bg-pink-600 hover:bg-pink-700" onClick={() => setMovOpen(true)}>
            <PlusCircle className="h-3.5 w-3.5" />
            تسجيل حركة نقدية
          </Button>
        </div>
      </div>

      {/* ── Cash Movement Dialog ── */}
      <Dialog open={movOpen} onOpenChange={setMovOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-4 h-4" /> تسجيل حركة نقدية
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {/* نوع الحركة */}
            <div className="grid grid-cols-3 gap-2">
              {movTypes.map(({ value, label, icon: Icon, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMovType(value)}
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
              <label className="text-sm font-medium">المبلغ (ر.ع)</label>
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
              <label className="text-sm font-medium">ملاحظة (اختياري)</label>
              <Input value={movNote} onChange={e => setMovNote(e.target.value)} placeholder="مثال: تسليم وردية الصباح" />
            </div>
            <Button
              className="w-full bg-pink-600 hover:bg-pink-700"
              onClick={() => addMovementMutation.mutate()}
              disabled={!movAmount || parseFloat(movAmount) <= 0 || addMovementMutation.isPending}
            >
              {addMovementMutation.isPending ? "جارٍ الحفظ..." : "تسجيل الحركة"}
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
              <div className="text-right">
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

          {/* ── Totals grid ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              label={t("branch_summary.opening_cash")}
              value={`${fmt(today?.totalOpeningCash ?? 0)} ${omr}`}
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
          </div>

          {/* ── الكاش الفعلي في الصندوق ── */}
          <Card className="border-2 border-emerald-200 bg-emerald-50/30">
            <CardContent className="pt-5 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-3 rounded-xl bg-emerald-500 shrink-0">
                    <Wallet className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-0.5">الكاش الفعلي في الصندوق</p>
                    <p className="text-2xl font-bold text-emerald-700">
                      {fmt(today?.actualCashInDrawer ?? 0)} {omr}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {fmt(today?.totalOpeningCash ?? 0)} افتتاح
                      {" + "}{fmt(today?.totalCash ?? 0)} مبيعات نقدية
                      {" − "}{fmt(today?.totalOutflows ?? 0)} مخرجات
                    </p>
                  </div>
                </div>
                {(today?.totalOutflows ?? 0) > 0 && (
                  <div className="flex gap-3 text-sm">
                    {today?.outflowByType?.["owner_handover"] != null && today.outflowByType["owner_handover"] > 0 && (
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center"><HandCoins className="w-3 h-3" /> تسليم مالك</p>
                        <p className="font-semibold text-blue-600">−{fmt(today.outflowByType["owner_handover"])} {omr}</p>
                      </div>
                    )}
                    {today?.outflowByType?.["bank_deposit"] != null && today.outflowByType["bank_deposit"] > 0 && (
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center"><Building2 className="w-3 h-3" /> إيداع بنكي</p>
                        <p className="font-semibold text-purple-600">−{fmt(today.outflowByType["bank_deposit"])} {omr}</p>
                      </div>
                    )}
                    {today?.outflowByType?.["expense"] != null && today.outflowByType["expense"] > 0 && (
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center"><ShoppingBag className="w-3 h-3" /> مصروفات</p>
                        <p className="font-semibold text-red-600">−{fmt(today.outflowByType["expense"])} {omr}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── حركات الصندوق اليوم ── */}
          {movements.length > 0 && (
            <Card>
              <CardHeader className="pb-3 pt-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
                  حركات الصندوق ({movements.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="space-y-2">
                  {movements.map(m => {
                    const movMeta = movTypes.find(x => x.value === m.type);
                    const Icon = movMeta?.icon ?? ArrowDownUp;
                    return (
                      <div key={m.id} className="flex items-center gap-3 rounded-lg border px-3 py-2 bg-muted/20">
                        <Icon className={`w-4 h-4 shrink-0 ${movMeta?.color ?? ""}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{movMeta?.label ?? m.type}</p>
                          {m.note && <p className="text-xs text-muted-foreground truncate">{m.note}</p>}
                          <p className="text-xs text-muted-foreground">{m.created_by_name ?? "—"} • {new Date(m.created_at).toLocaleTimeString("ar-OM", { hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                        <p className="font-bold text-red-600 shrink-0">−{fmt(m.amount_out)} {omr}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Total summary bar ── */}
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

          {/* ── Per-shift breakdown ── */}
          {allShifts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {t("branch_summary.shift_detail")} ({allShifts.length})
              </h2>
              {allShifts.map(s => <ShiftRow key={s.id} s={s} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
