import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Banknote, CreditCard, Building2, TrendingUp, Package, Wallet,
  ArrowDownToLine, ArrowUpFromLine, RefreshCw, Plus, AlertTriangle,
  BarChart2, ShieldCheck, DollarSign,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { parseServerError } from "@/lib/queryClient";

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtOMR(v: string | number | null | undefined) {
  const n = parseFloat(String(v ?? "0"));
  return `${isNaN(n) ? "0.000" : n.toFixed(3)} ر.ع`;
}
function fmtNum(v: string | number | null | undefined) {
  return parseFloat(String(v ?? "0")).toFixed(3);
}
function pct(profit: string | number, selling: string | number) {
  const s = parseFloat(String(selling));
  const p = parseFloat(String(profit));
  if (!s) return "0.00";
  return ((p / s) * 100).toFixed(2);
}
function branchCity(address?: string | null) {
  if (!address) return "";
  return address.split("،")[0].replace("ولاية", "").trim();
}
function branchLabel(name: string, address?: string | null) {
  const city = branchCity(address);
  if (!city || name.includes(city)) return name;
  return `${name} - ${city}`;
}

const TXN_TYPES: Record<string, { label: string; color: string; icon: any }> = {
  BRANCH_CASH_TRANSFER_TO_OWNER: { label: "استلام نقدي من فرع",   color: "bg-green-100 text-green-800",  icon: ArrowDownToLine },
  OWNER_DEPOSIT_TO_BANK:         { label: "إيداع بنكي",            color: "bg-blue-100 text-blue-800",    icon: Building2 },
  OWNER_WITHDRAWAL:              { label: "سحب المالك",            color: "bg-red-100 text-red-800",      icon: ArrowUpFromLine },
  MANUAL_ADJUSTMENT_IN:          { label: "تعديل يدوي (إضافة)",    color: "bg-purple-100 text-purple-800", icon: Plus },
  MANUAL_ADJUSTMENT_OUT:         { label: "تعديل يدوي (خصم)",     color: "bg-orange-100 text-orange-800", icon: RefreshCw },
};

interface KpiProps { title: string; value: string; icon: any; color: string; sub?: string; }
function KpiCard({ title, value, icon: Icon, color, sub }: KpiProps) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <Icon className={`w-8 h-8 ${color} opacity-80`} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── main component ────────────────────────────────────────────────────────────
export default function OwnerFinancialSummary() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // filters for transactions
  const [txnBranch, setTxnBranch] = useState("all");
  const [txnFrom,   setTxnFrom]   = useState("");
  const [txnTo,     setTxnTo]     = useState("");

  // new transaction dialog
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: "BRANCH_CASH_TRANSFER_TO_OWNER",
    branchId: "",
    amount: "",
    paymentMethod: "cash",
    referenceNo: "",
    note: "",
  });

  // ── queries ──────────────────────────────────────────────────────────────
  const { data: summary, isLoading } = useQuery<any>({
    queryKey: ["/api/owner/financial-summary"],
    queryFn: async () => {
      const r = await fetch("/api/owner/financial-summary", { credentials: "include" });
      if (!r.ok) throw new Error(await parseServerError(r));
      return r.json();
    },
  });

  const txnParams = new URLSearchParams({ limit: "200" });
  if (txnBranch !== "all") txnParams.set("branchId", txnBranch);
  if (txnFrom) txnParams.set("from", txnFrom);
  if (txnTo)   txnParams.set("to", txnTo);

  const { data: transactions = [], isLoading: txnLoading } = useQuery<any[]>({
    queryKey: ["/api/owner/transactions", txnBranch, txnFrom, txnTo],
    queryFn: async () => {
      const r = await fetch(`/api/owner/transactions?${txnParams}`, { credentials: "include" });
      if (!r.ok) throw new Error(await parseServerError(r));
      return r.json();
    },
  });

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const r = await fetch("/api/branches", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  // ── mutation ──────────────────────────────────────────────────────────────
  const createTxn = useMutation({
    mutationFn: async (body: any) => {
      const r = await fetch("/api/owner/transactions", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await parseServerError(r));
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/owner/financial-summary"] });
      qc.invalidateQueries({ queryKey: ["/api/owner/transactions"] });
      setShowDialog(false);
      setForm({ date: new Date().toISOString().slice(0, 10), type: "BRANCH_CASH_TRANSFER_TO_OWNER", branchId: "", amount: "", paymentMethod: "cash", referenceNo: "", note: "" });
      toast({ title: "تم تسجيل المعاملة بنجاح" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast({ title: "خطأ", description: "أدخل مبلغاً صحيحاً", variant: "destructive" }); return;
    }
    createTxn.mutate({
      date: form.date, type: form.type,
      branchId: form.branchId || undefined,
      amount: parseFloat(form.amount),
      paymentMethod: form.paymentMethod,
      referenceNo: form.referenceNo || undefined,
      note: form.note || undefined,
    });
  };

  const s = summary?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-primary" />
            الملخص المالي للمالك
          </h1>
          <p className="text-muted-foreground text-sm mt-1">نظرة شاملة على المركز المالي للشركة</p>
        </div>
        <Button onClick={() => setShowDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" /> تسجيل معاملة مالية
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">جاري التحميل...</div>
      ) : (
        <Tabs defaultValue="overview">
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
            <TabsTrigger value="branches">أرصدة الفروع</TabsTrigger>
            <TabsTrigger value="inventory">قيمة المخزون</TabsTrigger>
            <TabsTrigger value="ledger">سجل المعاملات</TabsTrigger>
          </TabsList>

          {/* ── Overview ──────────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-4">

            {/* Row 1: Cash side */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">💵 الجانب النقدي</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard title="نقد الفروع"          value={fmtOMR((summary?.branches ?? []).reduce((s: number, b: any) => s + Math.max(0, parseFloat(b.currentCash)), 0))}
                  icon={Banknote}   color="text-green-600" sub="مجموع أرصدة الفروع النقدية" />
                <KpiCard title="نقد المالك (بيده)"   value={fmtOMR(s?.ownerCash)}
                  icon={Wallet}     color="text-emerald-600"
                  sub={s?.receivedFromBranches !== "0.000" ? `استلم من الفروع ${fmtOMR(s?.receivedFromBranches)}` : "لم يستلم كاش من الفروع"} />
                <KpiCard title="إجمالي المصروفات"   value={fmtOMR(s?.totalExpenses)}
                  icon={ArrowUpFromLine} color="text-red-500" sub="جميع الفروع - جميع طرق الدفع" />
                <KpiCard title="إجمالي السحوبات"    value={fmtOMR(s?.totalWithdrawals)}
                  icon={ArrowUpFromLine} color="text-orange-500" sub="سحوبات شخصية للمالك" />
              </div>
            </div>

            {/* Row 2: Bank side */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">🏦 الجانب البنكي</p>
              <Card className="border-blue-200 dark:border-blue-800">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm text-muted-foreground">الرصيد البنكي للمالك</p>
                      <p className="text-2xl font-bold text-blue-600">{fmtOMR(s?.ownerBankBalance)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">مبيعات البطاقة + التحويلات البنكية + الإيداعات اليدوية</p>
                    </div>
                    <Building2 className="w-10 h-10 text-blue-400" />
                  </div>
                  <div className="grid grid-cols-3 gap-3 border-t pt-3">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><CreditCard className="w-3 h-3" />مبيعات البطاقة</p>
                      <p className="font-bold text-purple-600 text-sm">{fmtOMR(s?.bankFromCard)}</p>
                      <p className="text-xs text-muted-foreground">تذهب للبنك مباشرة</p>
                    </div>
                    <div className="text-center border-x">
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Building2 className="w-3 h-3" />التحويلات البنكية</p>
                      <p className="font-bold text-indigo-600 text-sm">{fmtOMR(s?.bankFromTransfer)}</p>
                      <p className="text-xs text-muted-foreground">تذهب للبنك مباشرة</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><ArrowDownToLine className="w-3 h-3" />إيداعات يدوية</p>
                      <p className="font-bold text-blue-600 text-sm">{fmtOMR(s?.bankFromDeposits)}</p>
                      <p className="text-xs text-muted-foreground">أودعها المالك</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Row 3: Final balance */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">الرصيد الكلي للشركة</p>
                    <p className="text-3xl font-bold text-primary">{fmtOMR(s?.totalAvailable)}</p>
                  </div>
                  <DollarSign className="w-10 h-10 text-primary/50" />
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  <span className="text-green-700 font-medium">نقد ({fmtOMR(s?.totalCashOnHand)})</span>
                  {" + "}<span className="text-blue-700 font-medium">بنك ({fmtOMR(s?.ownerBankBalance)})</span>
                  {" − "}<span className="text-red-700 font-medium">مصروفات ({fmtOMR(s?.totalExpenses)})</span>
                  {" − "}<span className="text-orange-700 font-medium">سحوبات ({fmtOMR(s?.totalWithdrawals)})</span>
                  {" = "}<span className="text-primary font-bold">{fmtOMR(s?.totalAvailable)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Owner cash detail */}
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  حساب المالك النقدي — عند استلام كاش من الفروع
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="bg-green-50 dark:bg-green-950/30 rounded p-3">
                    <p className="text-muted-foreground text-xs">استلم كاش من الفروع</p>
                    <p className="font-bold text-green-600 text-base">{fmtOMR(s?.receivedFromBranches)}</p>
                    <p className="text-xs text-muted-foreground mt-1">يُسجَّل بـ "تسجيل معاملة مالية"</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded p-3">
                    <p className="text-muted-foreground text-xs">أودع في البنك</p>
                    <p className="font-bold text-blue-600 text-base">{fmtOMR(s?.depositedToBank)}</p>
                    <p className="text-xs text-muted-foreground mt-1">من النقد → للبنك</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-950/30 rounded p-3">
                    <p className="text-muted-foreground text-xs">سحوبات شخصية</p>
                    <p className="font-bold text-red-600 text-base">{fmtOMR(s?.totalWithdrawals)}</p>
                    <p className="text-xs text-muted-foreground mt-1">خصم من نقد المالك</p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded p-3">
                    <p className="text-muted-foreground text-xs">نقد بيد المالك الآن</p>
                    <p className="font-bold text-emerald-600 text-base">{fmtOMR(s?.ownerCash)}</p>
                    <p className="text-xs text-muted-foreground mt-1">استلم − أودع − سحب</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Branch Cash Balances ───────────────────────────────────── */}
          <TabsContent value="branches" className="space-y-4">
            <div className="grid gap-4">
              {(summary?.branches ?? []).map((b: any) => {
                const current = parseFloat(b.currentCash);
                return (
                  <Card key={b.id}>
                    <CardHeader className="pb-2 pt-4">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span>{branchLabel(b.name, b.address)}</span>
                        <Badge variant={current >= 0 ? "outline" : "destructive"}
                          className={current >= 0 ? "text-green-700 border-green-400" : ""}>
                          الرصيد: {fmtOMR(b.currentCash)}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                        <div className="bg-blue-50 dark:bg-blue-950/30 rounded p-2">
                          <p className="text-muted-foreground text-xs">رصيد الافتتاح</p>
                          <p className="font-bold">{fmtOMR(b.openingCash)}</p>
                        </div>
                        <div className="bg-green-50 dark:bg-green-950/30 rounded p-2">
                          <p className="text-muted-foreground text-xs">مبيعات نقدية</p>
                          <p className="font-bold text-green-700">{fmtOMR(b.cashSales)}</p>
                        </div>
                        <div className="bg-red-50 dark:bg-red-950/30 rounded p-2">
                          <p className="text-muted-foreground text-xs">مصروفات نقدية</p>
                          <p className="font-bold text-red-600">{fmtOMR(b.cashExpenses)}</p>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-950/30 rounded p-2">
                          <p className="text-muted-foreground text-xs">حُوِّل للمالك</p>
                          <p className="font-bold text-orange-600">{fmtOMR(b.transferredToOwner)}</p>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded p-2">
                          <p className="text-muted-foreground text-xs">الرصيد الحالي</p>
                          <p className={`font-bold ${current >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmtOMR(b.currentCash)}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm mt-2">
                        <div className="bg-purple-50 dark:bg-purple-950/30 rounded p-2">
                          <p className="text-muted-foreground text-xs">مبيعات بطاقة</p>
                          <p className="font-bold text-purple-700">{fmtOMR(b.cardSales)}</p>
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded p-2">
                          <p className="text-muted-foreground text-xs">مبيعات تحويل بنكي</p>
                          <p className="font-bold text-indigo-700">{fmtOMR(b.bankTransferSales)}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        المعادلة: الافتتاح ({fmtOMR(b.openingCash)}) + نقد ({fmtOMR(b.cashSales)}) − مصروفات ({fmtOMR(b.cashExpenses)}) − محول ({fmtOMR(b.transferredToOwner)}) = <strong>{fmtOMR(b.currentCash)}</strong>
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ── Inventory Value ────────────────────────────────────────── */}
          <TabsContent value="inventory" className="space-y-4">
            {/* Top summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard title="إجمالي الكميات"         value={fmtNum(summary?.inventory?.totalQty)} icon={Package} color="text-blue-600" />
              <KpiCard title="قيمة التكلفة الكلية"    value={fmtOMR(summary?.inventory?.totalCost)} icon={Banknote} color="text-orange-600" />
              <KpiCard title="قيمة البيع الكلية"      value={fmtOMR(summary?.inventory?.totalSelling)} icon={TrendingUp} color="text-green-600" />
              <KpiCard title="ربح متوقع من المخزون"   value={fmtOMR(summary?.inventory?.expectedProfit)} icon={DollarSign} color="text-primary"
                sub={`هامش ${summary?.inventory?.profitMargin ?? 0}%`} />
            </div>

            {/* By branch */}
            <Card>
              <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">قيمة المخزون حسب الفرع</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الفرع</TableHead>
                      <TableHead className="text-center">الكمية</TableHead>
                      <TableHead className="text-center">قيمة التكلفة</TableHead>
                      <TableHead className="text-center">قيمة البيع</TableHead>
                      <TableHead className="text-center">الربح المتوقع</TableHead>
                      <TableHead className="text-center">الهامش</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(summary?.inventoryByBranch ?? []).map((r: any) => {
                      const profit  = parseFloat(r.expectedProfit);
                      const selling = parseFloat(r.sellingValue);
                      return (
                        <TableRow key={r.branchId}>
                          <TableCell className="font-medium">{r.branchName}</TableCell>
                          <TableCell className="text-center">{fmtNum(r.qty)}</TableCell>
                          <TableCell className="text-center">{fmtOMR(r.costValue)}</TableCell>
                          <TableCell className="text-center">{fmtOMR(r.sellingValue)}</TableCell>
                          <TableCell className="text-center">
                            <span className={profit >= 0 ? "text-green-600" : "text-red-600"}>{fmtOMR(r.expectedProfit)}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{pct(profit, selling)}%</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Ledger ────────────────────────────────────────────────── */}
          <TabsContent value="ledger" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <Label className="text-xs">الفرع</Label>
                <Select value={txnBranch} onValueChange={setTxnBranch}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الفروع</SelectItem>
                    {branches.map((b: any) => (
                      <SelectItem key={b.id} value={String(b.id)}>{branchLabel(b.name, b.address)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">من</Label>
                <Input type="date" value={txnFrom} onChange={e => setTxnFrom(e.target.value)} className="w-36" />
              </div>
              <div>
                <Label className="text-xs">إلى</Label>
                <Input type="date" value={txnTo} onChange={e => setTxnTo(e.target.value)} className="w-36" />
              </div>
              <Button variant="outline" size="sm" onClick={() => { setTxnBranch("all"); setTxnFrom(""); setTxnTo(""); }}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>الفرع</TableHead>
                      <TableHead>طريقة الدفع</TableHead>
                      <TableHead>من</TableHead>
                      <TableHead>إلى</TableHead>
                      <TableHead className="text-center">المبلغ</TableHead>
                      <TableHead>المرجع</TableHead>
                      <TableHead>الملاحظات</TableHead>
                      <TableHead>المستخدم</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {txnLoading ? (
                      <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                    ) : transactions.length === 0 ? (
                      <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">لا توجد معاملات مسجلة</TableCell></TableRow>
                    ) : transactions.map((t: any) => {
                      const meta = TXN_TYPES[t.type] ?? { label: t.type, color: "bg-gray-100 text-gray-800", icon: AlertTriangle };
                      const Icon = meta.icon;
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="text-sm whitespace-nowrap">{t.date}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${meta.color}`}>
                              <Icon className="w-3 h-3" />{meta.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">{t.branch_name ?? "—"}</TableCell>
                          <TableCell className="text-sm">{
                            t.payment_method === "cash" ? "نقدي" :
                            t.payment_method === "card" ? "بطاقة" :
                            t.payment_method === "bank_transfer" ? "تحويل بنكي" : t.payment_method
                          }</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{t.from_account ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{t.to_account ?? "—"}</TableCell>
                          <TableCell className="text-center font-bold">{fmtOMR(t.amount)}</TableCell>
                          <TableCell className="text-xs">{t.reference_no ?? "—"}</TableCell>
                          <TableCell className="text-xs max-w-32 truncate">{t.note ?? "—"}</TableCell>
                          <TableCell className="text-xs">{t.created_by_name ?? "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* ── New Transaction Dialog ─────────────────────────────────────── */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تسجيل معاملة مالية جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>التاريخ</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <Label>نوع المعاملة</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TXN_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(form.type === "BRANCH_CASH_TRANSFER_TO_OWNER") && (
              <div>
                <Label>الفرع</Label>
                <Select value={form.branchId} onValueChange={v => setForm(f => ({ ...f, branchId: v }))}>
                  <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b: any) => (
                      <SelectItem key={b.id} value={String(b.id)}>{branchLabel(b.name, b.address)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>المبلغ (ر.ع)</Label>
                <Input type="number" step="0.001" min="0" placeholder="0.000"
                  value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <Label>طريقة الدفع</Label>
                <Select value={form.paymentMethod} onValueChange={v => setForm(f => ({ ...f, paymentMethod: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقدي</SelectItem>
                    <SelectItem value="card">بطاقة</SelectItem>
                    <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>الرقم المرجعي (اختياري)</Label>
              <Input placeholder="رقم الإيصال أو التحويل..."
                value={form.referenceNo} onChange={e => setForm(f => ({ ...f, referenceNo: e.target.value }))} />
            </div>
            <div>
              <Label>ملاحظات (اختياري)</Label>
              <Input placeholder="أي ملاحظات..."
                value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>

            {/* Preview of what will happen */}
            {form.type === "BRANCH_CASH_TRANSFER_TO_OWNER" && form.amount && (
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-3 text-sm space-y-1">
                <p className="font-medium text-green-800">ما سيحدث:</p>
                <p className="text-green-700">✓ يُخصم {fmtOMR(form.amount)} من رصيد الفرع النقدي</p>
                <p className="text-green-700">✓ يُضاف {fmtOMR(form.amount)} إلى نقد المالك</p>
                <p className="text-green-700">✓ يُسجَّل في سجل المعاملات</p>
              </div>
            )}
            {form.type === "OWNER_DEPOSIT_TO_BANK" && form.amount && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-sm space-y-1">
                <p className="font-medium text-blue-800">ما سيحدث:</p>
                <p className="text-blue-700">✓ يُخصم {fmtOMR(form.amount)} من نقد المالك</p>
                <p className="text-blue-700">✓ يُضاف {fmtOMR(form.amount)} إلى الرصيد البنكي</p>
              </div>
            )}
            {form.type === "OWNER_WITHDRAWAL" && form.amount && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-sm space-y-1">
                <p className="font-medium text-red-800">ما سيحدث:</p>
                <p className="text-red-700">✓ يُخصم {fmtOMR(form.amount)} من رصيد المالك (سحب شخصي)</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>إلغاء</Button>
            <Button onClick={handleSubmit} disabled={createTxn.isPending}>
              {createTxn.isPending ? "جاري الحفظ..." : "حفظ المعاملة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
