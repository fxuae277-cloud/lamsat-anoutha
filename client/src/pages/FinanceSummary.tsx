import { useState, useMemo } from "react";
import {
  TrendingUp, TrendingDown, Wallet, ShoppingCart,
  ReceiptText, Minus, RefreshCw, Banknote, CreditCard, Building2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useI18n } from "@/lib/i18n";

// ─── helpers ──────────────────────────────────────────────────────────────────
function n(v: any) { return parseFloat(String(v || "0")); }
function fmtOMR(v: any) {
  const val = n(v);
  return val.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " ر.ع";
}
function pct(part: number, total: number) {
  if (!total) return "0.0";
  return ((part / total) * 100).toFixed(1);
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function monthStart() {
  const d = new Date(); d.setDate(1);
  return d.toISOString().slice(0, 10);
}
function lastMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const to   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
  return { from, to };
}
function yearStart() {
  return new Date().getFullYear() + "-01-01";
}

const PIE_COLORS = [
  "#f43f5e","#f97316","#eab308","#22c55e",
  "#3b82f6","#8b5cf6","#ec4899","#14b8a6","#6366f1","#84cc16",
];

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, colorClass, positive }: {
  label: string; value: string; sub?: string; icon: any;
  colorClass: string; positive?: boolean | null;
}) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
            <p className={`font-bold text-xl leading-tight ${colorClass}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>}
          </div>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${colorClass.replace("text-", "bg-").replace("-700","-100").replace("-600","-100").replace("-500","-100")}`}>
            <Icon className={`h-5 w-5 ${colorClass}`} />
          </div>
        </div>
        {positive !== null && positive !== undefined && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            {positive === true  && <TrendingUp  className="w-3 h-3 text-green-600" />}
            {positive === false && <TrendingDown className="w-3 h-3 text-red-600"   />}
            {positive === null  && <Minus        className="w-3 h-3 text-gray-400"  />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── P&L Row ──────────────────────────────────────────────────────────────────
function PlRow({ label, value, sub, bold, color, indent }: {
  label: string; value: string; sub?: string;
  bold?: boolean; color?: string; indent?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center py-2 border-b last:border-0 ${indent ? "pe-4" : ""}`}>
      <span className={`text-sm ${bold ? "font-semibold" : "text-muted-foreground"} ${color ?? ""}`}>
        {label}
        {sub && <span className="text-xs text-muted-foreground me-1">({sub})</span>}
      </span>
      <span className={`text-sm font-mono ${bold ? "font-bold" : ""} ${color ?? ""}`} dir="ltr">
        {value}
      </span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FinanceSummary() {
  const { t, lang } = useI18n();

  const today      = todayISO();
  const thisMonth  = monthStart();

  const [preset,     setPreset]     = useState("this_month");
  const [customFrom, setCustomFrom] = useState(thisMonth);
  const [customTo,   setCustomTo]   = useState(today);

  const PRESETS = [
    { key: "today",      label: t("finance_summary.preset_today") },
    { key: "this_month", label: t("finance_summary.preset_this_month") },
    { key: "last_month", label: t("finance_summary.preset_last_month") },
    { key: "this_year",  label: t("finance_summary.preset_this_year") },
    { key: "custom",     label: t("finance_summary.preset_custom") },
  ];

  const CAT_NAMES: Record<string, string> = {
    supplies:    t("finance_summary.cat_supplies"),
    rent:        t("finance_summary.cat_rent"),
    salary:      t("finance_summary.cat_salary"),
    transport:   t("finance_summary.cat_transport"),
    maintenance: t("finance_summary.cat_maintenance"),
    electricity: t("finance_summary.cat_electricity"),
    phone:       t("finance_summary.cat_phone"),
    marketing:   t("finance_summary.cat_marketing"),
    shipping:    t("finance_summary.cat_shipping"),
    taxes:       t("finance_summary.cat_taxes"),
    other:       t("finance_summary.cat_other"),
  };

  // حساب نطاق التاريخ بناءً على الـ preset
  const { from, to } = useMemo(() => {
    if (preset === "today")      return { from: today,     to: today };
    if (preset === "this_month") return { from: thisMonth, to: today };
    if (preset === "last_month") return lastMonthRange();
    if (preset === "this_year")  return { from: yearStart(), to: today };
    return { from: customFrom, to: customTo };
  }, [preset, customFrom, customTo, today, thisMonth]);

  // ─── Queries ──────────────────────────────────────────────────────────────
  const { data: plRaw, isLoading: plLoading, refetch: refetchPl } = useQuery<any>({
    queryKey: [`/api/reports/income-statement?from=${from}&to=${to}`],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: cashRaw, isLoading: cashLoading } = useQuery<any>({
    queryKey: [`/api/cash-ledger/summary?date=${today}`],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const isLoading = plLoading || cashLoading;

  // ─── Derived values ───────────────────────────────────────────────────────
  const pl = plRaw ?? {};
  const revenue      = n(pl.revenue?.total);
  const returns      = n(pl.revenue?.returns);
  const netRevenue   = n(pl.revenue?.netRevenue);
  const cogs         = n(pl.cogs?.total);
  const grossProfit  = n(pl.grossProfit);
  const totalExpenses= n(pl.expenses?.total);
  const netProfit    = n(pl.netProfit);
  const netMargin    = pl.netMargin ?? "0.0";

  const cashSales    = n(pl.revenue?.cashSales);
  const cardSales    = n(pl.revenue?.cardSales);
  const bankSales    = n(pl.revenue?.bankSales);
  const invoiceCount = pl.revenue?.invoiceCount ?? 0;

  // بيانات الفطيرة — المصروفات حسب الفئة
  const expCats: { name: string; value: number }[] = Array.isArray(pl.expenses?.byCategory)
    ? pl.expenses.byCategory
        .filter((c: any) => n(c.total) > 0)
        .map((c: any) => ({ name: CAT_NAMES[c.category] ?? c.category, value: n(c.total) }))
    : [];

  const netCash = n(cashRaw?.netCash);

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("finance_summary.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {from === to ? from : `${from} — ${to}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchPl()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ms-1.5 ${isLoading ? "animate-spin" : ""}`} />
          {t("finance_summary.refresh")}
        </Button>
      </div>

      {/* ── Period Presets ── */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(p => (
          <Button
            key={p.key}
            variant={preset === p.key ? "default" : "outline"}
            size="sm"
            onClick={() => setPreset(p.key)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* ── Custom Date Range ── */}
      {preset === "custom" && (
        <Card className="p-4">
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t("finance_summary.date_from")}</span>
              <DateInput value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-36" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t("finance_summary.date_to")}</span>
              <DateInput value={customTo} onChange={e => setCustomTo(e.target.value)} className="w-36" />
            </div>
          </div>
        </Card>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label={t("finance_summary.kpi_net_profit")}
          value={fmtOMR(netProfit)}
          sub={`${t("finance_summary.kpi_margin")} ${netMargin}%`}
          icon={TrendingUp}
          colorClass={netProfit >= 0 ? "text-green-600" : "text-red-600"}
          positive={netProfit >= 0 ? true : false}
        />
        <KpiCard
          label={t("finance_summary.kpi_total_sales")}
          value={fmtOMR(revenue)}
          sub={`${invoiceCount} ${t("finance_summary.kpi_invoices")}`}
          icon={ShoppingCart}
          colorClass="text-blue-600"
          positive={null}
        />
        <KpiCard
          label={t("finance_summary.kpi_total_expenses")}
          value={fmtOMR(totalExpenses)}
          icon={ReceiptText}
          colorClass="text-orange-600"
          positive={null}
        />
        <KpiCard
          label={t("finance_summary.kpi_cash_balance")}
          value={fmtOMR(netCash)}
          icon={Wallet}
          colorClass={netCash >= 0 ? "text-emerald-600" : "text-red-600"}
          positive={null}
        />
      </div>

      {/* ── Main Content: P&L + Pie ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* P&L Breakdown */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("finance_summary.pl_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <PlRow label={t("finance_summary.pl_gross_sales")}  value={fmtOMR(revenue)} bold />
            {returns > 0 && (
              <PlRow label={t("finance_summary.pl_returns")} value={`(${fmtOMR(returns)})`} indent color="text-red-500" />
            )}
            <PlRow
              label={t("finance_summary.pl_net_sales")}
              value={fmtOMR(netRevenue)}
              indent
              color="text-muted-foreground"
            />
            <PlRow label={t("finance_summary.pl_cogs")} value={`(${fmtOMR(cogs)})`} color="text-orange-600" />

            <div className="flex justify-between items-center py-2.5 border-b bg-green-50 rounded px-2 my-1">
              <span className="text-sm font-semibold text-green-700">
                {t("finance_summary.pl_gross_profit")}
                <span className="text-xs text-muted-foreground me-1.5">
                  ({pct(grossProfit, netRevenue)}%)
                </span>
              </span>
              <span className="text-sm font-bold text-green-700 font-mono" dir="ltr">
                {fmtOMR(grossProfit)}
              </span>
            </div>

            <PlRow label={t("finance_summary.pl_total_expenses")} value={`(${fmtOMR(totalExpenses)})`} color="text-red-600" bold />

            <div className={`flex justify-between items-center py-3 px-2 rounded mt-1 ${netProfit >= 0 ? "bg-primary/10" : "bg-red-50"}`}>
              <span className={`text-base font-bold ${netProfit >= 0 ? "text-primary" : "text-red-700"}`}>
                {t("finance_summary.pl_net_profit")}
                <span className="text-xs font-normal text-muted-foreground me-1.5">
                  ({netMargin}%)
                </span>
              </span>
              <span className={`text-base font-bold font-mono ${netProfit >= 0 ? "text-primary" : "text-red-700"}`} dir="ltr">
                {fmtOMR(netProfit)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Expenses Donut */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("finance_summary.expenses_chart_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {expCats.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                {t("finance_summary.no_expenses")}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={expCats}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {expCats.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [fmtOMR(val), ""]}
                    contentStyle={{ direction: lang === "ar" ? "rtl" : "ltr", fontFamily: "inherit", fontSize: 12 }}
                  />
                  <Legend
                    formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>}
                    iconSize={10}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Payment Methods Breakdown ── */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("finance_summary.payment_methods_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[
              { labelKey: "finance_summary.pay_cash",    value: cashSales, icon: Banknote,  color: "text-green-600", bg: "bg-green-50" },
              { labelKey: "finance_summary.pay_card",    value: cardSales, icon: CreditCard, color: "text-blue-600",  bg: "bg-blue-50"  },
              { labelKey: "finance_summary.pay_bank",    value: bankSales, icon: Building2, color: "text-purple-600", bg: "bg-purple-50" },
            ].map(m => (
              <div key={m.labelKey} className={`rounded-xl p-4 ${m.bg} flex flex-col gap-2`}>
                <div className="flex items-center gap-2">
                  <m.icon className={`h-4 w-4 ${m.color}`} />
                  <span className="text-sm text-muted-foreground">{t(m.labelKey)}</span>
                </div>
                <p className={`font-bold text-lg font-mono ${m.color}`} dir="ltr">
                  {fmtOMR(m.value)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {pct(m.value, revenue)}% {t("finance_summary.of_total")}
                </p>
                {/* Progress bar */}
                <div className="h-1.5 bg-white/70 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${m.color.replace("text-","bg-")}`}
                    style={{ width: `${Math.min(100, n(pct(m.value, revenue)))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
