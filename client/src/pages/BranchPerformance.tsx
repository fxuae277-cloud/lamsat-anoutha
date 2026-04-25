import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fmtDate, fmtTime } from "@/lib/formatters";
import { parseServerError } from "@/lib/queryClient";
import { GitBranch, Search, X } from "lucide-react";

function todayStr() { return new Date().toISOString().slice(0, 10); }
function startOfWeekStr() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
function startOfMonthStr() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}
function omr(v: any) { return parseFloat(String(v || "0")).toFixed(3); }

const PIE_COLORS = ["#10b981", "#3b82f6", "#8b5cf6"];

const PM_LABELS: Record<string, string> = {
  cash: "نقدي",
  card: "بطاقة",
  bank_transfer: "تحويل",
};
const PM_COLORS: Record<string, string> = {
  cash: "bg-green-100 text-green-700 border-green-200",
  card: "bg-blue-100 text-blue-700 border-blue-200",
  bank_transfer: "bg-purple-100 text-purple-700 border-purple-200",
};

type Period = "today" | "week" | "month" | "custom";

function KpiCard({ label, value, sub, color, border, icon }: {
  label: string; value: string; sub: string;
  color: string; border: string; icon: string;
}) {
  return (
    <Card className={`border ${border}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className={`text-lg font-bold mt-0.5 font-mono ${color}`}>{value}</p>
            <p className="text-[10px] text-muted-foreground">{sub}</p>
          </div>
          <span className="text-2xl shrink-0">{icon}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BranchPerformance() {
  const { data: authData } = useAuth();
  const user = authData?.user;
  const isOwner = user?.role === "owner" || user?.role === "admin";

  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState(startOfMonthStr());
  const [customTo, setCustomTo] = useState(todayStr());
  const [selectedBranch, setSelectedBranch] = useState<string>(
    isOwner ? "all" : (user?.branchId ? String(user.branchId) : "all")
  );

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPayment, setFilterPayment] = useState("all");
  const [filterEmployee, setFilterEmployee] = useState("all");

  const from =
    period === "today"  ? todayStr() :
    period === "week"   ? startOfWeekStr() :
    period === "month"  ? startOfMonthStr() :
    customFrom;

  const to =
    period === "custom" ? customTo : todayStr();

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches", { credentials: "include" });
      if (!res.ok) throw new Error(await parseServerError(res));
      return res.json();
    },
    staleTime: 300_000,
    enabled: isOwner,
  });

  const salesUrl = useMemo(() => {
    let url = `/api/sales?from=${from}&to=${to}`;
    if (selectedBranch !== "all") url += `&branchId=${selectedBranch}`;
    return url;
  }, [from, to, selectedBranch]);

  const { data: sales = [], isLoading } = useQuery<any[]>({
    queryKey: ["branch-perf-sales", from, to, selectedBranch],
    queryFn: async () => {
      const res = await fetch(salesUrl, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });

  const selectedBranchName = useMemo(() => {
    if (selectedBranch === "all") return null;
    const b = branches.find((b: any) => String(b.id) === selectedBranch);
    return b ? b.name + (b.address ? ` — ${b.address}` : "") : null;
  }, [selectedBranch, branches]);

  // Unique employees derived from loaded sales data
  const uniqueEmployees = useMemo(() => {
    const names = new Set<string>();
    for (const s of sales) {
      if (s.cashierName) names.add(s.cashierName);
    }
    return Array.from(names).sort();
  }, [sales]);

  // KPIs computed from the full sales list (unfiltered by search)
  const kpis = useMemo(() => {
    const cash     = sales.filter(x => x.paymentMethod === "cash").reduce((s, x) => s + parseFloat(x.total || "0"), 0);
    const card     = sales.filter(x => x.paymentMethod === "card").reduce((s, x) => s + parseFloat(x.total || "0"), 0);
    const transfer = sales.filter(x => x.paymentMethod === "bank_transfer").reduce((s, x) => s + parseFloat(x.total || "0"), 0);
    const total    = cash + card + transfer;
    const count    = sales.length;
    const avg      = count > 0 ? total / count : 0;
    const profit   = sales.reduce((s, x) => s + parseFloat(x.grossProfit || "0"), 0);
    return { total, cash, card, transfer, count, avg, profit };
  }, [sales]);

  const dailyData = useMemo(() => {
    const map: Record<string, { date: string; نقدي: number; بطاقة: number; تحويل: number }> = {};
    for (const s of sales) {
      const d = new Date(s.createdAt).toISOString().slice(0, 10);
      if (!map[d]) map[d] = { date: d, نقدي: 0, بطاقة: 0, تحويل: 0 };
      const v = parseFloat(s.total || "0");
      if (s.paymentMethod === "cash")          map[d]["نقدي"]   += v;
      else if (s.paymentMethod === "card")      map[d]["بطاقة"]  += v;
      else if (s.paymentMethod === "bank_transfer") map[d]["تحويل"] += v;
    }
    return Object.values(map)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(r => ({
        ...r,
        label: r.date.slice(5).replace("-", "/"),
        نقدي:   parseFloat(r["نقدي"].toFixed(3)),
        بطاقة:  parseFloat(r["بطاقة"].toFixed(3)),
        تحويل:  parseFloat(r["تحويل"].toFixed(3)),
      }));
  }, [sales]);

  const pieData = useMemo(() => [
    { name: "نقدي",    value: kpis.cash },
    { name: "بطاقة",   value: kpis.card },
    { name: "تحويل",   value: kpis.transfer },
  ].filter(x => x.value > 0), [kpis]);

  // Filtered sales for the invoices table
  const filteredSales = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...sales].reverse().filter(s => {
      // Text search
      if (q) {
        const haystack = [
          s.invoiceNumber || "",
          s.customerName  || "",
          s.customerPhone || "",
          s.paymentReference || "",
        ].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      // Payment method filter
      if (filterPayment !== "all" && s.paymentMethod !== filterPayment) return false;
      // Employee filter
      if (filterEmployee !== "all" && s.cashierName !== filterEmployee) return false;
      return true;
    });
  }, [sales, searchQuery, filterPayment, filterEmployee]);

  const hasActiveFilters = searchQuery.trim() !== "" || filterPayment !== "all" || filterEmployee !== "all";

  function clearFilters() {
    setSearchQuery("");
    setFilterPayment("all");
    setFilterEmployee("all");
  }

  const PERIOD_BTNS: { key: Period; label: string }[] = [
    { key: "today",  label: "اليوم" },
    { key: "week",   label: "هذا الأسبوع" },
    { key: "month",  label: "هذا الشهر" },
    { key: "custom", label: "مخصص" },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-300" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">مؤشرات أداء الفرع</h1>
          <p className="text-sm text-muted-foreground mt-0.5">متابعة المبيعات وتوزيع طرق الدفع</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {PERIOD_BTNS.map(({ key, label }) => (
            <Button
              key={key}
              size="sm"
              variant={period === key ? "default" : "outline"}
              className={`h-8 text-xs ${period === key ? "bg-pink-600 hover:bg-pink-700 text-white" : ""}`}
              onClick={() => setPeriod(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Filters row: branch (owner only) + custom date */}
      {(isOwner || period === "custom") && (
        <div className="flex items-center gap-3 flex-wrap p-3 bg-muted/30 rounded-lg border">
          {/* Branch selector — owners/admins only */}
          {isOwner && (
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-muted-foreground shrink-0" />
              <label className="text-xs font-medium text-gray-600 whitespace-nowrap">الفرع</label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="h-8 text-xs w-52">
                  <SelectValue placeholder="اختر الفرع..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل — جميع الفروع</SelectItem>
                  {branches.map((b: any) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name}{b.address ? ` — ${b.address}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Custom date range */}
          {period === "custom" && (
            <>
              {isOwner && <div className="w-px h-5 bg-border" />}
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600">من</label>
                <DateInput value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-36 h-8 text-xs" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600">إلى</label>
                <DateInput value={customTo} onChange={e => setCustomTo(e.target.value)} className="w-36 h-8 text-xs" />
              </div>
            </>
          )}
        </div>
      )}

      {/* Active branch badge — owner only (cashier always sees own branch) */}
      {isOwner && selectedBranchName && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-pink-700 border-pink-300 bg-pink-50 text-xs gap-1 py-1 px-2.5">
            <GitBranch className="w-3 h-3" />
            {selectedBranchName}
          </Badge>
          <span className="text-xs text-muted-foreground">البيانات مفلترة لهذا الفرع فقط</span>
        </div>
      )}

      {isLoading ? (
        <div className="py-24 text-center text-muted-foreground">جاري التحميل...</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard label="إجمالي المبيعات"  value={omr(kpis.total)}    sub="ر.ع"    color="text-pink-700"   border="border-pink-200"   icon="💰" />
            <KpiCard label="مبيعات نقدي"       value={omr(kpis.cash)}     sub="ر.ع"    color="text-emerald-700" border="border-emerald-200" icon="💵" />
            <KpiCard label="مبيعات بطاقة"      value={omr(kpis.card)}     sub="ر.ع"    color="text-blue-700"   border="border-blue-200"   icon="💳" />
            <KpiCard label="مبيعات تحويل"      value={omr(kpis.transfer)} sub="ر.ع"    color="text-purple-700" border="border-purple-200"  icon="🏦" />
            <KpiCard label="عدد الفواتير"      value={String(kpis.count)} sub="فاتورة" color="text-orange-700"  border="border-orange-200"  icon="🧾" />
            <KpiCard label="متوسط الفاتورة"    value={omr(kpis.avg)}      sub="ر.ع"    color="text-gray-700"   border="border-gray-200"   icon="📊" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Bar chart — daily breakdown */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  المبيعات اليومية
                  <span className="text-xs font-normal text-muted-foreground">— نقدي / بطاقة / تحويل</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-3">
                {dailyData.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">لا توجد مبيعات في هذه الفترة</div>
                ) : (
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={dailyData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} width={52} tickFormatter={v => parseFloat(v).toFixed(1)} />
                      <Tooltip formatter={(v: any) => parseFloat(v).toFixed(3) + " ر.ع"} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="نقدي"   fill="#10b981" stackId="a" radius={[0,0,0,0]} />
                      <Bar dataKey="بطاقة"  fill="#3b82f6" stackId="a" radius={[0,0,0,0]} />
                      <Bar dataKey="تحويل"  fill="#8b5cf6" stackId="a" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Pie chart — payment distribution */}
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">توزيع طرق الدفع</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-4">
                {pieData.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">لا توجد بيانات</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={170}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value"
                          label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                          labelLine={false}>
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => parseFloat(v).toFixed(3) + " ر.ع"} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 mt-1">
                      {pieData.map((item, i) => (
                        <div key={item.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="text-muted-foreground">{item.name}</span>
                          </div>
                          <span className="font-mono font-semibold">{omr(item.value)} ر.ع</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between text-xs border-t pt-1.5 mt-1">
                        <span className="font-medium">الإجمالي</span>
                        <span className="font-mono font-bold text-pink-700">{omr(kpis.total)} ر.ع</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Invoices section */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>الفواتير</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {hasActiveFilters
                    ? `${filteredSales.length} من ${sales.length} فاتورة`
                    : `${sales.length} فاتورة`}
                </span>
              </CardTitle>

              {/* Search & filter bar */}
              <div className="flex flex-wrap gap-2 mt-3">
                {/* Text search */}
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="بحث: رقم فاتورة، عميل، جوال، مرجع..."
                    className="h-8 text-xs pr-8 pl-3"
                  />
                </div>

                {/* Payment method filter */}
                <Select value={filterPayment} onValueChange={setFilterPayment}>
                  <SelectTrigger className="h-8 text-xs w-36">
                    <SelectValue placeholder="طريقة الدفع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل طرق الدفع</SelectItem>
                    <SelectItem value="cash">نقدي</SelectItem>
                    <SelectItem value="card">بطاقة</SelectItem>
                    <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                  </SelectContent>
                </Select>

                {/* Employee filter */}
                <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                  <SelectTrigger className="h-8 text-xs w-40">
                    <SelectValue placeholder="الموظف" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الموظفين</SelectItem>
                    {uniqueEmployees.map(name => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Clear filters button */}
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    onClick={clearFilters}
                  >
                    <X className="w-3 h-3" />
                    مسح الفلاتر
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {filteredSales.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">
                  {hasActiveFilters ? "لا توجد فواتير تطابق البحث" : "لا توجد فواتير في هذه الفترة"}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>رقم الفاتورة</TableHead>
                        {selectedBranch === "all" && <TableHead>الفرع</TableHead>}
                        <TableHead>العميل</TableHead>
                        <TableHead>الكاشير</TableHead>
                        <TableHead>طريقة الدفع</TableHead>
                        <TableHead>الرقم المرجعي</TableHead>
                        <TableHead className="text-center">الإجمالي</TableHead>
                        <TableHead className="text-center">التاريخ</TableHead>
                        <TableHead className="text-center">الوقت</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSales.map((s: any, i: number) => (
                        <TableRow key={s.id} className="hover:bg-muted/20">
                          <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-mono font-bold text-primary text-sm">
                            {s.invoiceNumber || `#${s.id}`}
                          </TableCell>
                          {selectedBranch === "all" && (
                            <TableCell className="text-xs text-muted-foreground">{s.branchName || "—"}</TableCell>
                          )}
                          <TableCell className="text-xs">
                            {s.customerName
                              ? <span className="font-medium">{s.customerName}</span>
                              : <span className="text-gray-300">—</span>}
                            {s.customerPhone && (
                              <span className="block text-muted-foreground font-mono" dir="ltr">{s.customerPhone}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {s.cashierName || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${PM_COLORS[s.paymentMethod] || ""}`}>
                              {PM_LABELS[s.paymentMethod] || s.paymentMethod}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {s.paymentReference
                              ? <span className="font-mono text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-0.5" dir="ltr">{s.paymentReference}</span>
                              : <span className="text-gray-300 text-xs">—</span>}
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold text-base">
                            {omr(s.total)}
                            <span className="text-[10px] font-normal text-muted-foreground mr-0.5">ر.ع</span>
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {fmtDate(s.createdAt)}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {fmtTime(s.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
