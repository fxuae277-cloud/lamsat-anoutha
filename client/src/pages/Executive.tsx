import { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useLocation } from "wouter";
import {
  TrendingUp, TrendingDown, DollarSign, BarChart3, Receipt,
  Package, AlertTriangle, Warehouse, CreditCard, Banknote, Building2,
  Download, ArrowUpRight, ArrowDownRight, Minus, Info, CalendarIcon
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import type { Branch } from "@shared/schema";

function todayStr() { return new Date().toISOString().slice(0, 10); }

/** YYYY-MM-DD → DD/MM/YYYY */
function isoToDisplay(iso: string): string {
  if (!iso || iso.length !== 10) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** DD/MM/YYYY → YYYY-MM-DD, returns null if invalid */
function displayToIso(display: string): string | null {
  const match = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const date = new Date(`${y}-${m}-${d}`);
  if (isNaN(date.getTime())) return null;
  return `${y}-${m}-${d}`;
}

function omr(v: number | string | null) {
  if (v === null || v === undefined) return "0.000";
  return parseFloat(String(v)).toFixed(3);
}

function fmtDateTime(ts: string | null, _lang: string) {
  if (!ts) return "-";
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()} ${hours}:${mins}`;
}

function pct(a: number, b: number) {
  if (b === 0 && a === 0) return null;
  if (b === 0) return 100;
  return Math.round(((a - b) / Math.abs(b)) * 1000) / 10;
}

const PIE_COLORS = ["#22c55e", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"];

function pmLabel(m: string, t: (k: string) => string) {
  if (m === "cash") return t("payment_methods.cash");
  if (m === "card") return t("payment_methods.card");
  if (m === "bank_transfer") return t("payment_methods.bank_transfer");
  return m;
}

export default function Executive() {
  const { data: authData } = useAuth();
  const user = authData?.user;
  const { t, lang } = useI18n();
  const [, navigate] = useLocation();
  const isAdmin = user?.role === "owner" || user?.role === "admin";

  const [branchId, setBranchId] = useState<string>("all");
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [fromDisplay, setFromDisplay] = useState(() => isoToDisplay(todayStr()));
  const [toDisplay, setToDisplay] = useState(() => isoToDisplay(todayStr()));
  const fromPickerRef = useRef<HTMLInputElement>(null);
  const toPickerRef = useRef<HTMLInputElement>(null);
  const [productMode, setProductMode] = useState<"revenue" | "qty">("revenue");
  const [activePeriod, setActivePeriod] = useState<string>("today");

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  function setDateRange(from: string, to: string) {
    setFromDate(from); setToDate(to);
    setFromDisplay(isoToDisplay(from)); setToDisplay(isoToDisplay(to));
  }

  function applyQuick(preset: string) {
    setActivePeriod(preset);
    const now = new Date();
    const td = todayStr();
    switch (preset) {
      case "today": setDateRange(td, td); break;
      case "yesterday": {
        const y = new Date(); y.setDate(y.getDate() - 1);
        const ys = y.toISOString().slice(0, 10);
        setDateRange(ys, ys); break;
      }
      case "7d": {
        const d = new Date(); d.setDate(d.getDate() - 6);
        setDateRange(d.toISOString().slice(0, 10), td); break;
      }
      case "30d": {
        const d = new Date(); d.setDate(d.getDate() - 29);
        setDateRange(d.toISOString().slice(0, 10), td); break;
      }
      case "this_month": {
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        setDateRange(first.toISOString().slice(0, 10), td); break;
      }
      case "last_month": {
        const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const last = new Date(now.getFullYear(), now.getMonth(), 0);
        setDateRange(first.toISOString().slice(0, 10), last.toISOString().slice(0, 10)); break;
      }
    }
  }

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const qs = `from=${fromDate}&to=${toDate}${branchId !== "all" ? `&branch_id=${branchId}` : ""}`;
  const { data, isLoading, dataUpdatedAt } = useQuery<any>({
    queryKey: ["/api/dashboard/executive", fromDate, toDate, branchId],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/executive?${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: isAdmin,
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (dataUpdatedAt) setLastUpdated(new Date(dataUpdatedAt));
  }, [dataUpdatedAt]);

  const sortedProducts = useMemo(() => {
    if (!data?.topProducts) return [];
    return [...data.topProducts].sort((a: any, b: any) =>
      productMode === "revenue" ? b.revenue - a.revenue : b.qtySold - a.qtySold
    );
  }, [data?.topProducts, productMode]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground text-lg">{t("executive.unauthorized")}</p>
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const kpi = data?.kpi || {};
  const vs = data?.todayVsYesterday || { today: {}, yesterday: {}, prevFrom: "", prevTo: "" };
  const paymentSplit = data?.paymentSplit || [];
  const timeseries = data?.timeseries || [];
  const branchPerf = data?.branchPerformance || [];
  const recentExp = data?.recentExpenses || [];
  const lowStock = data?.lowStock || [];

  const hasData = kpi.revenue > 0 || kpi.totalExpenses > 0;
  const salesChange = pct(vs.today?.sales || 0, vs.yesterday?.sales || 0);
  const expChange = pct(vs.today?.expenses || 0, vs.yesterday?.expenses || 0);
  const netChange = pct(vs.today?.net || 0, vs.yesterday?.net || 0);

  const isToday = activePeriod === "today";
  const vsCardTitle = isToday ? t("executive.today_vs_yesterday") : t("executive.period_vs_prev");
  const currentLabel = isToday ? t("executive.today_label") : t("executive.current_period_label");
  const prevLabel = isToday ? t("executive.yesterday_label") : (vs.prevFrom && vs.prevTo ? `${isoToDisplay(vs.prevFrom)} - ${isoToDisplay(vs.prevTo)}` : t("executive.prev_period_label"));

  const payTotal = paymentSplit.reduce((s: number, p: any) => s + p.amount, 0);

  const quickButtons = [
    { id: "today", label: t("executive.quick_today") },
    { id: "yesterday", label: t("executive.quick_yesterday") },
    { id: "7d", label: t("executive.quick_7d") },
    { id: "30d", label: t("executive.quick_30d") },
    { id: "this_month", label: t("executive.quick_this_month") },
    { id: "last_month", label: t("executive.quick_last_month") },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4 -mt-4 pt-4 border-b">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-executive-title">{t("executive.title")}</h1>
            {lastUpdated && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {t("executive.last_updated")}: {lastUpdated.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
            )}
          </div>
          <div className="min-w-[180px] max-w-[220px] w-full sm:w-auto">
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger data-testid="select-exec-branch"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("executive.all_branches")}</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}{b.address ? " - " + b.address : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full">
          {quickButtons.map(q => (
            <Button
              key={q.id}
              variant={activePeriod === q.id ? "default" : "outline"}
              size="sm"
              className={`text-xs ${activePeriod === q.id ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
              onClick={() => applyQuick(q.id)}
              data-testid={`quick-${q.id}`}
            >
              {q.label}
            </Button>
          ))}
          <div className="flex items-center gap-2 ltr:ml-auto rtl:mr-auto flex-wrap sm:flex-nowrap w-full sm:w-auto mt-1 sm:mt-0">
            <div className="relative flex items-center">
              <Input
                type="text"
                inputMode="numeric"
                placeholder="DD/MM/YYYY"
                pattern="\d{2}/\d{2}/\d{4}"
                value={fromDisplay}
                onChange={e => {
                  setFromDisplay(e.target.value);
                  const iso = displayToIso(e.target.value);
                  if (iso) { setFromDate(iso); setActivePeriod(""); }
                }}
                className="w-32 h-8 text-xs pr-7"
                data-testid="input-exec-from"
              />
              <button
                type="button"
                onClick={() => { try { fromPickerRef.current?.showPicker?.(); } catch { fromPickerRef.current?.click(); } }}
                className="absolute ltr:right-1 rtl:left-1 text-muted-foreground hover:text-foreground"
              >
                <CalendarIcon className="w-3.5 h-3.5" />
              </button>
              <input
                ref={fromPickerRef}
                type="date"
                lang="en-US"
                value={fromDate}
                onChange={e => {
                  const iso = e.target.value;
                  if (iso) { setFromDate(iso); setFromDisplay(isoToDisplay(iso)); setActivePeriod(""); }
                }}
                className="absolute opacity-0 w-0 h-0 pointer-events-none"
                tabIndex={-1}
              />
            </div>
            <span className="text-xs text-muted-foreground">→</span>
            <div className="relative flex items-center">
              <Input
                type="text"
                inputMode="numeric"
                placeholder="DD/MM/YYYY"
                pattern="\d{2}/\d{2}/\d{4}"
                value={toDisplay}
                onChange={e => {
                  setToDisplay(e.target.value);
                  const iso = displayToIso(e.target.value);
                  if (iso) { setToDate(iso); setActivePeriod(""); }
                }}
                className="w-32 h-8 text-xs pr-7"
                data-testid="input-exec-to"
              />
              <button
                type="button"
                onClick={() => { try { toPickerRef.current?.showPicker?.(); } catch { toPickerRef.current?.click(); } }}
                className="absolute ltr:right-1 rtl:left-1 text-muted-foreground hover:text-foreground"
              >
                <CalendarIcon className="w-3.5 h-3.5" />
              </button>
              <input
                ref={toPickerRef}
                type="date"
                lang="en-US"
                value={toDate}
                onChange={e => {
                  const iso = e.target.value;
                  if (iso) { setToDate(iso); setToDisplay(isoToDisplay(iso)); setActivePeriod(""); }
                }}
                className="absolute opacity-0 w-0 h-0 pointer-events-none"
                tabIndex={-1}
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard icon={DollarSign} label={t("executive.revenue")} value={kpi.revenue} color="text-emerald-600" testId="kpi-revenue" hasData={hasData} />
        <KpiCard icon={Receipt} label={t("executive.invoice_count")} value={kpi.invoiceCount} isCount color="text-blue-600" testId="kpi-invoices" hasData={hasData} />
        <KpiCard icon={BarChart3} label={t("executive.avg_invoice")} value={kpi.avgInvoice} color="text-amber-600" testId="kpi-avg" hasData={hasData} />
        <KpiCard icon={TrendingUp} label={t("executive.gross_profit")} value={kpi.grossProfit} color="text-blue-700" testId="kpi-gross" hasData={hasData} note={t("executive.cogs_note")} />
        <KpiCard icon={BarChart3} label={t("executive.margin_pct")} value={kpi.marginPercent} isPct color="text-purple-600" testId="kpi-margin" hasData={hasData} />
        <KpiCard icon={TrendingDown} label={t("executive.total_expenses")} value={kpi.totalExpenses} color="text-red-600" testId="kpi-expenses" hasData={hasData} />
        <KpiCard icon={DollarSign} label={t("executive.net_profit")} value={kpi.netProfit} color={kpi.netProfit >= 0 ? "text-emerald-700" : "text-red-700"} testId="kpi-net" hasData={hasData} />
        <KpiCard icon={Banknote} label={t("executive.net_cash")} value={kpi.netCash} color={kpi.netCash >= 0 ? "text-green-600" : "text-red-600"} testId="kpi-cash" hasData={hasData} />
        <KpiCard icon={Warehouse} label={t("executive.inventory_value")} value={kpi.inventoryValue} color="text-indigo-600" testId="kpi-inv" hasData />
        <KpiCard icon={AlertTriangle} label={t("executive.low_stock_items")} value={kpi.lowStockCount} isCount color="text-red-600" testId="kpi-low" hasData />
      </div>

      {/* SALES TREND LINE CHART */}
      {timeseries.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              {t("executive.sales_trend")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={timeseries} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(d: string) => d.slice(5)}
                />
                <YAxis tick={{ fontSize: 11 }} width={55} tickFormatter={(v: number) => omr(v)} />
                <Tooltip
                  formatter={(v: number) => [`${omr(v)} OMR`, t("executive.sales_label")]}
                  labelFormatter={(d: string) => isoToDisplay(d)}
                />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#f43f5e"
                  strokeWidth={2.5}
                  dot={timeseries.length <= 14 ? { r: 3, fill: "#f43f5e" } : false}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* TODAY vs YESTERDAY */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            {vsCardTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <VsCard label={t("executive.sales_label")} today={vs.today?.sales} yesterday={vs.yesterday?.sales} change={salesChange} currentLabel={currentLabel} prevLabel={prevLabel} />
            <VsCard label={t("executive.expenses_label")} today={vs.today?.expenses} yesterday={vs.yesterday?.expenses} change={expChange} invert currentLabel={currentLabel} prevLabel={prevLabel} />
            <VsCard label={t("executive.net_label")} today={vs.today?.net} yesterday={vs.yesterday?.net} change={netChange} currentLabel={currentLabel} prevLabel={prevLabel} />
          </div>
        </CardContent>
      </Card>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial Trend Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("executive.financial_trend")}</CardTitle>
          </CardHeader>
          <CardContent>
            {timeseries.length > 1 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={timeseries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => `${omr(value)} OMR`}
                    labelFormatter={(d: string) => { const dt = new Date(d + "T00:00:00"); return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`; }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="sales" name={t("executive.sales_label")} stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.15} strokeWidth={2} />
                  <Area type="monotone" dataKey="expenses" name={t("executive.expenses_label")} stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} strokeWidth={2} />
                  <Area type="monotone" dataKey="net" name={t("executive.net_label")} stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">{t("executive.no_data")}</div>
            )}
          </CardContent>
        </Card>

        {/* Payment Distribution Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("executive.payment_distribution")}</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentSplit.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={260}>
                  <PieChart>
                    <Pie data={paymentSplit} dataKey="amount" nameKey="method" cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={3}>
                      {paymentSplit.map((_: any, i: number) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${omr(value)} OMR`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3 flex-1">
                  {paymentSplit.map((p: any, i: number) => {
                    const pctVal = payTotal > 0 ? ((p.amount / payTotal) * 100).toFixed(1) : "0";
                    return (
                      <div key={p.method} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{pmLabel(p.method, t)}</p>
                          <p className="text-xs text-muted-foreground">{p.count} | {pctVal}%</p>
                        </div>
                        <p className="font-mono font-bold text-sm">{omr(p.amount)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">{t("executive.no_sales")}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* TOP PRODUCTS BAR CHART */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-5 h-5" />
              {t("executive.top_products")}
            </CardTitle>
            <div className="flex gap-1">
              <Button variant={productMode === "revenue" ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setProductMode("revenue")} data-testid="btn-prod-revenue">
                {t("executive.by_revenue")}
              </Button>
              <Button variant={productMode === "qty" ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setProductMode("qty")} data-testid="btn-prod-qty">
                {t("executive.by_qty")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sortedProducts.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={sortedProducts} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => productMode === "revenue" ? `${omr(value)} OMR` : value} />
                <Bar dataKey={productMode === "revenue" ? "revenue" : "qtySold"} fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">{t("executive.no_sales")}</div>
          )}
        </CardContent>
      </Card>

      {/* BRANCH PERFORMANCE TABLE */}
      {branchPerf.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {t("executive.branch_performance")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>{t("executive.table_branch")}</TableHead>
                    <TableHead className="text-center">{t("executive.table_revenue")}</TableHead>
                    <TableHead className="text-center">{t("executive.table_expenses")}</TableHead>
                    <TableHead className="text-center">{t("executive.gross_profit")}</TableHead>
                    <TableHead className="text-center">{t("executive.table_net_profit")}</TableHead>
                    <TableHead className="text-center">{t("executive.table_invoices")}</TableHead>
                    <TableHead className="text-center">{t("executive.table_avg_invoice")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branchPerf.map((b: any) => (
                    <TableRow key={b.branchId} data-testid={`row-branch-${b.branchId}`}>
                      <TableCell className="font-medium">{b.branchName}</TableCell>
                      <TableCell className="text-center font-mono">{omr(b.revenue)}</TableCell>
                      <TableCell className="text-center font-mono text-red-500">{omr(b.expenses)}</TableCell>
                      <TableCell className="text-center font-mono text-blue-600">{omr(b.grossProfit)}</TableCell>
                      <TableCell className="text-center font-mono font-bold text-emerald-700">{omr(b.netProfit)}</TableCell>
                      <TableCell className="text-center">{b.invoiceCount}</TableCell>
                      <TableCell className="text-center font-mono">{omr(b.avgInvoice)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* RECENT EXPENSES + LOW STOCK */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-500" />
                {t("executive.recent_expenses")}
              </CardTitle>
              <Button variant="link" size="sm" className="text-xs" onClick={() => navigate("/expenses")} data-testid="link-all-expenses">
                {t("executive.view_all_expenses")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentExp.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>{t("executive.table_date")}</TableHead>
                      <TableHead>{t("executive.table_branch")}</TableHead>
                      <TableHead>{t("executive.table_category")}</TableHead>
                      <TableHead>{t("executive.table_description")}</TableHead>
                      <TableHead className="text-center">{t("executive.table_amount")}</TableHead>
                      <TableHead>{t("executive.table_user")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentExp.map((e: any) => (
                      <TableRow key={e.id} data-testid={`row-expense-${e.id}`}>
                        <TableCell className="text-sm">{fmtDateTime(e.createdAt, lang)}</TableCell>
                        <TableCell className="text-sm">{e.branchName}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{e.category}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{e.notes || "-"}</TableCell>
                        <TableCell className="text-center font-mono text-red-600 font-bold">{omr(e.amount)}</TableCell>
                        <TableCell className="text-sm">{e.createdByName || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">{t("executive.no_expenses")}</div>
            )}
          </CardContent>
        </Card>

        <Card className={lowStock.length > 0 ? "border-red-200" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-base flex items-center gap-2 ${lowStock.length > 0 ? "text-red-700" : ""}`}>
              <AlertTriangle className="w-5 h-5" />
              {t("executive.low_stock_title").replace("{0}", String(lowStock.length))}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {lowStock.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>{t("executive.table_product")}</TableHead>
                      <TableHead className="text-center">{t("executive.table_current_qty")}</TableHead>
                      <TableHead className="text-center">{t("executive.table_reorder_level")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStock.map((s: any) => (
                      <TableRow key={s.productId} data-testid={`row-low-stock-${s.productId}`}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="destructive" className="text-xs">{s.totalQty}</Badge>
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">{s.reorderLevel}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">{t("executive.no_low_stock")}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color, testId, hasData, isCount, isPct, note }: {
  icon: any; label: string; value: any; color: string; testId: string; hasData: boolean;
  isCount?: boolean; isPct?: boolean; note?: string;
}) {
  const { t } = useI18n();
  const displayVal = !hasData && !isCount
    ? t("executive.no_data")
    : isCount
      ? String(value ?? 0)
      : isPct
        ? `${(value || 0).toFixed(1)}%`
        : `${omr(value)} OMR`;

  return (
    <Card className="border-primary/10 hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color.replace("text-", "bg-")}/10`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className={`text-lg font-bold truncate ${!hasData && !isCount ? "text-muted-foreground text-sm" : ""}`} data-testid={testId}>{displayVal}</p>
          </div>
        </div>
        {note && hasData && (
          <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
            <Info className="w-3 h-3" />{note}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function VsCard({ label, today, yesterday, change, invert, currentLabel, prevLabel }: {
  label: string; today: number; yesterday: number; change: number | null; invert?: boolean;
  currentLabel: string; prevLabel: string;
}) {
  const isPositive = change !== null && (invert ? change < 0 : change > 0);
  const isNegative = change !== null && (invert ? change > 0 : change < 0);

  return (
    <div className="p-3 bg-muted/30 rounded-lg border text-center">
      <p className="text-xs text-muted-foreground mb-2 font-medium">{label}</p>
      <div className="grid grid-cols-2 gap-2 text-sm mb-2">
        <div>
          <p className="text-[10px] text-muted-foreground truncate">{currentLabel}</p>
          <p className="font-mono font-bold">{omr(today)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground truncate">{prevLabel}</p>
          <p className="font-mono">{omr(yesterday)}</p>
        </div>
      </div>
      {change !== null ? (
        <div className={`flex items-center justify-center gap-1 text-sm font-bold ${isPositive ? "text-green-600" : isNegative ? "text-red-600" : "text-muted-foreground"}`}>
          {isPositive ? <ArrowUpRight className="w-4 h-4" /> : isNegative ? <ArrowDownRight className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
          {change > 0 ? "+" : ""}{change.toFixed(1)}%
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">—</p>
      )}
    </div>
  );
}
