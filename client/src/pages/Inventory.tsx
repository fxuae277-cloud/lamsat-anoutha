import { useState, useMemo } from "react";
import { Package, Search, ArrowRightLeft, ArrowLeft, History, Plus, CheckCircle, Barcode, MapPin, AlertTriangle, TrendingUp, Layers, Printer, CheckCircle2, Clock, XCircle, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { BarcodeScanButton } from "@/components/BarcodeScanButton";
import { fmtDate } from "@/lib/formatters";

type Location = { id: number; name: string; type: string; code: string; branchId: number | null; isMain: boolean; isCentral: boolean; isBranchDefault: boolean; active: boolean; kind: string | null; branchName: string | null };

function locLabel(loc: Location) {
  if (loc.isCentral) return loc.name;
  return loc.branchName ? `${loc.branchName} - ${loc.name}` : loc.name;
}

function BalancesTab() {
  const { t, lang } = useI18n();
  // filter value: "all" | "central" | "branch:{id}"
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: transferLocs = [] } = useQuery<any[]>({
    queryKey: ["/api/transfer-locations"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // بناء URL الأرصدة بناءً على الفلتر
  const balancesUrl = (() => {
    if (filter === "all") return "/api/inventory-balances";
    if (filter === "central") {
      const central = (transferLocs as any[]).find(l => l.type === "central");
      return central ? `/api/inventory-balances?locationId=${central.location_id}` : "/api/inventory-balances";
    }
    const branchId = filter.replace("branch:", "");
    return `/api/inventory-balances?branchId=${branchId}`;
  })();

  const { data: balances = [] } = useQuery<any[]>({
    queryKey: [balancesUrl],
  });

  const filtered = balances.filter(b => {
    const q = search.toLowerCase();
    return (b.product_name || b.productName || "").toLowerCase().includes(q)
      || (b.barcode || "").toLowerCase().includes(q)
      || (b.sku || "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="w-full md:w-64">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger data-testid="select-location-filter">
              <SelectValue placeholder={t("inv_balances.all_locations")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("inv_balances.all_locations")}</SelectItem>
              {(transferLocs as any[]).map(loc => (
                <SelectItem
                  key={loc.location_id}
                  value={loc.type === "central" ? "central" : `branch:${loc.branch_id}`}
                >
                  {loc.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("products.search_placeholder")}
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="input-search-balances"
            />
          </div>
          <BarcodeScanButton onScan={(barcode) => setSearch(barcode)} />
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>{t("inv_balances.product")}</TableHead>
              <TableHead>{t("products.barcode")}</TableHead>
              <TableHead>{t("products.variant_color")}</TableHead>
              <TableHead>{t("products.variant_size")}</TableHead>
              <TableHead className="text-right">{t("inv_balances.qty_on_hand")}</TableHead>
              <TableHead className="text-right">{t("products.table_price")}</TableHead>
              <TableHead className="text-right">{t("products.last_purchase_price")}</TableHead>
              <TableHead>{t("inventory.last_receipt_date")}</TableHead>
              <TableHead>{t("inv_balances.location")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  {t("inv_balances.no_balances")}
                </TableCell>
              </TableRow>
            ) : filtered.map((b: any, i: number) => {
              const qty = b.qty_on_hand ?? b.qtyOnHand ?? 0;
              const pName = b.product_name || b.productName || "-";
              const lpp = b.last_purchase_price ?? b.lastPurchasePrice ?? 0;
              const lrd = b.last_receipt_date || b.lastReceiptDate;
              const loc = b.full_location_name || b.location_name || b.locationName || "-";
              return (
                <TableRow key={i} className={qty < 5 ? "bg-red-50" : ""}>
                  <TableCell className="font-medium">{pName}</TableCell>
                  <TableCell className="font-mono text-xs">{b.barcode || "-"}</TableCell>
                  <TableCell>{b.color || "-"}</TableCell>
                  <TableCell>{b.size || "-"}</TableCell>
                  <TableCell className={`text-right font-bold ${qty < 5 ? "text-red-600" : ""}`}>
                    {qty}
                    {qty < 5 && <Badge variant="destructive" className="ml-2 text-[10px] h-4">{t("inv_balances.low_stock")}</Badge>}
                  </TableCell>
                  <TableCell className="text-right font-mono">{Number(b.price || 0).toFixed(3)}</TableCell>
                  <TableCell className="text-right font-mono">{Number(lpp).toFixed(3)}</TableCell>
                  <TableCell className="text-xs">
                    {lrd ? fmtDate(lrd) : "-"}
                  </TableCell>
                  <TableCell>{loc}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

type TransferLocation = { type: string; location_id: number; label: string; branch_id: number | null };

function TransfersTab() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [mode, setMode] = useState<"list" | "create">("list");
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);
  const [txSearch, setTxSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [fromLoc, setFromLoc] = useState("");
  const [toLoc, setToLoc] = useState("");
  const [scanBarcode, setScanBarcode] = useState("");
  const [transferQtys, setTransferQtys] = useState<Record<number, number>>({});
  const [highlightedVariant, setHighlightedVariant] = useState<number | null>(null);

  const { data: transfers = [] } = useQuery<any[]>({
    queryKey: ["/api/stock-transfers"],
  });

  const { data: transferLocs = [] } = useQuery<TransferLocation[]>({
    queryKey: ["/api/transfer-locations"],
  });

  const { data: sourceStock = [], isLoading: stockLoading } = useQuery<any[]>({
    queryKey: [`/api/transfer-source-stock/${fromLoc}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!fromLoc,
  });

  const { data: transferDetail } = useQuery<any>({
    queryKey: [`/api/stock-transfers/${selectedTransfer?.id}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!selectedTransfer?.id,
  });

  const executeMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/stock-transfers/execute", data);
      return res.json();
    },
    onSuccess: (result) => {
      toast({ title: t("transfers.transfer_approved"), description: `${result.from_location_name} ← ${result.to_location_name}` });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-ledger"] });
      resetCreateForm();
      setMode("list");
    },
    onError: (err: any) => toast({ title: t("common.error"), description: err.message, variant: "destructive" })
  });

  const resetCreateForm = () => {
    setFromLoc("");
    setToLoc("");
    setScanBarcode("");
    setTransferQtys({});
    setHighlightedVariant(null);
  };

  const setQty = (variantId: number, qty: number, maxQty: number) => {
    const clamped = Math.max(0, Math.min(qty, maxQty));
    setTransferQtys(prev => {
      const next = { ...prev };
      if (clamped === 0) { delete next[variantId]; } else { next[variantId] = clamped; }
      return next;
    });
  };

  const handleBarcodeScan = (barcode: string) => {
    if (!barcode.trim()) return;
    const found = sourceStock.find((item: any) => item.barcode === barcode.trim());
    if (!found) {
      toast({ title: t("common.error"), description: t("transfers.item_not_in_source"), variant: "destructive" });
      setScanBarcode("");
      return;
    }
    const maxQty = Number(found.qty_on_hand);
    const current = transferQtys[found.variant_id] || 0;
    if (current < maxQty) {
      setQty(found.variant_id, current + 1, maxQty);
    } else {
      toast({ title: t("common.error"), description: t("transfers.insufficient_qty"), variant: "destructive" });
    }
    setHighlightedVariant(found.variant_id);
    setTimeout(() => setHighlightedVariant(null), 1500);
    setScanBarcode("");
    setTimeout(() => {
      const row = document.querySelector(`[data-testid="row-source-item-${found.variant_id}"]`);
      if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const totalItems = Object.values(transferQtys).filter(q => q > 0).length;
  const totalQty = Object.values(transferQtys).reduce((s, q) => s + q, 0);

  const handleExecute = () => {
    const lines = Object.entries(transferQtys)
      .filter(([, qty]) => qty > 0)
      .map(([variantId, qty]) => ({ variantId: Number(variantId), qty }));
    executeMutation.mutate({ fromLocationId: Number(fromLoc), toLocationId: Number(toLoc), lines });
  };

  if (mode === "create") {
    const fromLocLabel = transferLocs.find(tl => String(tl.location_id) === fromLoc)?.label;
    const toLocLabel = transferLocs.find(tl => String(tl.location_id) === toLoc)?.label;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t("transfers.create_transfer")}</h3>
          <Button variant="outline" onClick={() => { resetCreateForm(); setMode("list"); }}>{t("common.cancel")}</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">م</span>
              {t("transfers.from_location")}
            </label>
            <Select value={fromLoc} onValueChange={(v) => { setFromLoc(v); setTransferQtys({}); if (v === toLoc) setToLoc(""); }}>
              <SelectTrigger data-testid="select-from-location"><SelectValue placeholder={t("transfers.select_source")} /></SelectTrigger>
              <SelectContent>
                {transferLocs.map(tl => (
                  <SelectItem key={tl.location_id} value={String(tl.location_id)}>{tl.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-center pb-1">
            <div className="flex flex-col items-center gap-1">
              <ArrowLeft className="w-6 h-6 text-primary rotate-180" />
              <span className="text-[10px] text-muted-foreground">اتجاه</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold">و</span>
              {t("transfers.to_location")}
            </label>
            <Select value={toLoc} onValueChange={setToLoc}>
              <SelectTrigger data-testid="select-to-location"><SelectValue placeholder={t("transfers.select_destination")} /></SelectTrigger>
              <SelectContent>
                {transferLocs.filter(tl => String(tl.location_id) !== fromLoc).map(tl => (
                  <SelectItem key={tl.location_id} value={String(tl.location_id)}>{tl.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {fromLoc && sourceStock.length > 0 && (
          <div className="flex gap-2 p-3 bg-muted rounded-md items-center">
            <Barcode className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input 
              placeholder={t("transfers.scan_barcode")} 
              value={scanBarcode} 
              onChange={e => setScanBarcode(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleBarcodeScan(scanBarcode); }}
              data-testid="input-transfer-barcode"
              className="flex-1"
              autoFocus
            />
            <BarcodeScanButton onScan={handleBarcodeScan} />
          </div>
        )}

        {fromLoc && !stockLoading && sourceStock.length === 0 && (
          <div className="text-center py-8 text-muted-foreground bg-muted/50 rounded-md">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>{t("transfers.no_stock_at_source")}</p>
          </div>
        )}

        {fromLoc && sourceStock.length > 0 && (
          <div className="border rounded-md overflow-hidden">
            <div className="bg-muted/50 px-4 py-2 flex items-center justify-between text-sm border-b">
              <span className="font-medium">{t("transfers.available_items")} ({sourceStock.length})</span>
              {totalItems > 0 && (
                <span className="text-green-700 font-semibold">
                  {totalItems} {t("transfers.items_count")}، {totalQty} {t("transfers.total_qty")}
                </span>
              )}
            </div>
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>{t("inv_balances.product")}</TableHead>
                    <TableHead>{t("products.variant_color")}</TableHead>
                    <TableHead>{t("products.variant_size")}</TableHead>
                    <TableHead>{t("products.barcode")}</TableHead>
                    <TableHead className="text-center">{t("transfers.qty_available")}</TableHead>
                    <TableHead className="text-center w-[140px]">{t("transfers.qty_to_transfer")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sourceStock.map((item: any) => {
                    const maxQ = Number(item.qty_on_hand);
                    const curQ = transferQtys[item.variant_id] || 0;
                    const isHighlighted = highlightedVariant === item.variant_id;
                    return (
                      <TableRow key={item.variant_id} className={`transition-colors ${isHighlighted ? "bg-green-50" : curQ > 0 ? "bg-blue-50/40" : ""}`} data-testid={`row-source-item-${item.variant_id}`}>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell>{item.color || "-"}</TableCell>
                        <TableCell>{item.size || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{item.barcode || "-"}</TableCell>
                        <TableCell className="text-center font-semibold">{maxQ}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="outline" size="sm"
                              className="h-7 w-7 p-0"
                              disabled={curQ <= 0}
                              onClick={() => setQty(item.variant_id, curQ - 1, maxQ)}
                              data-testid={`btn-minus-${item.variant_id}`}
                            >-</Button>
                            <Input
                              type="number" min={0} max={maxQ}
                              value={curQ}
                              onChange={e => setQty(item.variant_id, Number(e.target.value) || 0, maxQ)}
                              className="w-16 h-7 text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              data-testid={`input-qty-${item.variant_id}`}
                            />
                            <Button
                              variant="outline" size="sm"
                              className="h-7 w-7 p-0"
                              disabled={curQ >= maxQ}
                              onClick={() => setQty(item.variant_id, curQ + 1, maxQ)}
                              data-testid={`btn-plus-${item.variant_id}`}
                            >+</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {totalItems > 0 && (
              <div className="px-4 py-3 bg-blue-50/60 border-t flex items-center gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("transfers.summary_items")}:</span>{" "}
                  <span className="font-bold text-blue-700">{totalItems}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("transfers.summary_total_qty")}:</span>{" "}
                  <span className="font-bold text-blue-700">{totalQty}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {fromLoc && toLoc && totalItems > 0 && (
          <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-md">
            <div className="text-sm flex items-center gap-2" dir="ltr">
              <span className="font-semibold">{fromLocLabel}</span>
              <ArrowLeft className="w-4 h-4 text-green-600 rotate-180" />
              <span className="font-semibold">{toLocLabel}</span>
              <span className="mx-2 text-muted-foreground">|</span>
              <span>{totalItems} {t("transfers.items_count")}, {totalQty} {t("transfers.total_qty")}</span>
            </div>
            <Button 
              onClick={handleExecute}
              disabled={executeMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-execute-transfer"
            >
              <CheckCircle className="w-4 h-4 mr-2" /> {t("transfers.approve")}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── KPI & chart data ─────────────────────────────────────────────────────
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const thisMonthTx  = (transfers as any[]).filter((tx: any) => {
    const d = new Date(tx.created_at || tx.createdAt);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === currentMonthKey;
  });
  const completedAll = (transfers as any[]).filter((tx: any) => tx.status === "approved").length;
  const pendingAll   = (transfers as any[]).filter((tx: any) => tx.status !== "approved" && tx.status !== "cancelled").length;
  const completionRate = (transfers as any[]).length > 0 ? Math.round((completedAll / (transfers as any[]).length) * 100) : 0;

  const MONTH_AR: Record<string,string> = {"01":"يناير","02":"فبراير","03":"مارس","04":"أبريل","05":"مايو","06":"يونيو","07":"يوليو","08":"أغسطس","09":"سبتمبر","10":"أكتوبر","11":"نوفمبر","12":"ديسمبر"};
  const monthlyMap: Record<string,number> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthlyMap[`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`] = 0;
  }
  (transfers as any[]).forEach((tx: any) => {
    const d = new Date(tx.created_at || tx.createdAt);
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (monthlyMap[k] !== undefined) monthlyMap[k]++;
  });
  const monthlyChartData = Object.entries(monthlyMap).map(([k,v]) => ({ name: MONTH_AR[k.slice(5)]||k.slice(5), تحويلات: v }));

  const statusPieData = [
    { name: "مكتملة", value: completedAll, color: "#10b981" },
    { name: "قيد التنفيذ", value: pendingAll, color: "#f59e0b" },
  ].filter(d => d.value > 0);

  const locCounts: Record<string,number> = {};
  (transfers as any[]).forEach((tx: any) => {
    const f = tx.from_location_name || tx.fromLocationName;
    const tl = tx.to_location_name || tx.toLocationName;
    if (f) locCounts[f] = (locCounts[f]||0)+1;
    if (tl) locCounts[tl] = (locCounts[tl]||0)+1;
  });
  const activeLocations = Object.entries(locCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);

  const filteredTransfers = (transfers as any[]).filter((tx: any) => {
    if (statusFilter !== "all" && tx.status !== statusFilter) return false;
    if (!txSearch.trim()) return true;
    const q = txSearch.toLowerCase();
    return (
      (tx.from_location_name || tx.fromLocationName || "").toLowerCase().includes(q) ||
      (tx.to_location_name || tx.toLocationName || "").toLowerCase().includes(q) ||
      (tx.creator_name || tx.creatorName || "").toLowerCase().includes(q) ||
      String(tx.id).includes(q)
    );
  });

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
            التحويلات بين المخازن
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">متابعة عمليات نقل المخزون بين المواقع</p>
        </div>
        <Button onClick={() => setMode("create")} className="gap-2" data-testid="button-create-transfer">
          <Plus className="w-4 h-4" /> {t("transfers.create_transfer")}
        </Button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "إجمالي هذا الشهر", value: thisMonthTx.length, icon: BarChart3, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
          { label: "مكتملة (الكل)", value: completedAll, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", border: "border-green-100" },
          { label: "قيد التنفيذ", value: pendingAll, icon: Clock, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
          { label: "معدل الإنجاز", value: `${completionRate}%`, icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100" },
        ].map((kpi, i) => (
          <Card key={i} className={`border ${kpi.border} shadow-sm hover:shadow-md transition-shadow`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
              </div>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Charts Row ── */}
      {(transfers as any[]).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Monthly bar chart */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-muted-foreground">التحويلات الشهرية (آخر 6 أشهر)</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={monthlyChartData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "#f9fafb" }} />
                  <Bar dataKey="تحويلات" fill="#3b82f6" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Status donut */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-muted-foreground">توزيع حالات التحويلات</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" paddingAngle={3}>
                      {statusPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`${v} تحويل`, ""]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3 flex-1">
                  {statusPieData.map((s, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                        <span className="text-sm text-muted-foreground">{s.name}</span>
                      </div>
                      <span className="font-bold text-sm">{s.value}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">الإجمالي</span>
                      <span className="font-bold text-sm">{(transfers as any[]).length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Active Locations + Quick Stats ── */}
      {(transfers as any[]).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Active locations */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-muted-foreground">أكثر المواقع نشاطاً</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {activeLocations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات</p>
              ) : activeLocations.map(([name, count], i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary/60" />
                    <span className="text-sm font-medium">{name}</span>
                  </div>
                  <Badge variant="outline" className="font-bold">{count} تحويل</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick stats */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-muted-foreground">إحصائيات سريعة</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {[
                { label: "إجمالي التحويلات (كل الوقت)", value: (transfers as any[]).length, color: "" },
                { label: "تحويلات هذا الشهر", value: thisMonthTx.length, color: "text-blue-600" },
                { label: "مكتملة هذا الشهر", value: thisMonthTx.filter((tx:any)=>tx.status==="approved").length, color: "text-green-600" },
                { label: "معدل إنجاز الكل", value: `${completionRate}%`, color: "text-purple-600" },
                { label: "عدد المواقع النشطة", value: Object.keys(locCounts).length, color: "text-amber-600" },
              ].map((stat, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                  <span className={`font-bold text-sm ${stat.color}`}>{stat.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Table ── */}
      <Card className="shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b bg-muted/30">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
            سجل التحويلات التفصيلي
          </h4>
          <div className="flex flex-wrap gap-2 items-center">
            {/* Filter pills */}
            <div className="flex gap-1">
              {[
                { key: "all", label: "الكل", count: (transfers as any[]).length },
                { key: "approved", label: "مكتمل", count: completedAll },
                { key: "pending", label: "قيد التنفيذ", count: pendingAll },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    statusFilter === f.key
                      ? "bg-primary text-white border-primary"
                      : "bg-transparent border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="بحث..."
                className="pr-9 h-8 w-44 text-sm"
                value={txSearch}
                onChange={e => setTxSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {filteredTransfers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ArrowRightLeft className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">{t("transfers.no_transfers")}</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/20">
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>{t("common.date")}</TableHead>
                <TableHead>{t("transfers.from_location")}</TableHead>
                <TableHead className="w-8"></TableHead>
                <TableHead>{t("transfers.to_location")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("common.employee")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransfers.map((tx: any) => (
                <TableRow key={tx.id} className="cursor-pointer hover:bg-primary/5 transition-colors" onClick={() => setSelectedTransfer(tx)} data-testid={`row-transfer-${tx.id}`}>
                  <TableCell className="font-mono text-xs text-muted-foreground">#{tx.id}</TableCell>
                  <TableCell className="text-sm">{fmtDate(tx.created_at || tx.createdAt)}</TableCell>
                  <TableCell>
                    <span className="inline-block bg-purple-50 text-purple-700 border border-purple-100 rounded-md px-2 py-0.5 text-xs font-semibold">
                      {tx.from_location_name || tx.fromLocationName}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <ArrowLeft className="w-3.5 h-3.5 inline text-muted-foreground rotate-180" />
                  </TableCell>
                  <TableCell>
                    <span className="inline-block bg-blue-50 text-blue-700 border border-blue-100 rounded-md px-2 py-0.5 text-xs font-semibold">
                      {tx.to_location_name || tx.toLocationName}
                    </span>
                  </TableCell>
                  <TableCell>
                    {tx.status === "approved" ? (
                      <Badge className="bg-green-50 text-green-700 border-green-200 text-xs gap-1">
                        <CheckCircle2 className="w-3 h-3" /> مكتمل
                      </Badge>
                    ) : tx.status === "cancelled" ? (
                      <Badge className="bg-red-50 text-red-700 border-red-200 text-xs gap-1">
                        <XCircle className="w-3 h-3" /> ملغي
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs gap-1">
                        <Clock className="w-3 h-3" /> قيد التنفيذ
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{tx.creator_name || tx.creatorName || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={!!selectedTransfer} onOpenChange={(open) => { if (!open) setSelectedTransfer(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("transfers.title")} #{selectedTransfer?.id}</DialogTitle>
            <DialogDescription className="flex items-center gap-2 text-base" dir="ltr">
              <span className="font-semibold">{transferDetail?.from_location_name || selectedTransfer?.from_location_name}</span>
              <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
              <span className="font-semibold">{transferDetail?.to_location_name || selectedTransfer?.to_location_name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-md max-h-72 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("inv_balances.product")}</TableHead>
                  <TableHead>{t("products.variant_color")}</TableHead>
                  <TableHead>{t("products.variant_size")}</TableHead>
                  <TableHead>{t("products.barcode")}</TableHead>
                  <TableHead className="text-right">{t("transfers.qty_to_transfer")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(transferDetail?.lines || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {t("transfers.no_items_yet")}
                    </TableCell>
                  </TableRow>
                ) : (
                  (transferDetail?.lines || []).map((line: any) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-medium">{line.product_name || line.productName}</TableCell>
                      <TableCell>{line.color || "-"}</TableCell>
                      <TableCell>{line.size || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{line.barcode || "-"}</TableCell>
                      <TableCell className="text-right font-semibold">{line.qty}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter className="gap-2">
            <Badge variant="outline" className="border-green-500 text-green-700 bg-green-50">
              {t(`transfers.status_${transferDetail?.status || selectedTransfer?.status}`)}
            </Badge>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                const fromName = transferDetail?.from_location_name || selectedTransfer?.from_location_name || "";
                const toName   = transferDetail?.to_location_name  || selectedTransfer?.to_location_name  || "";
                const lines    = transferDetail?.lines || [];
                const date     = selectedTransfer?.created_at || selectedTransfer?.createdAt || "";
                const rows = lines.map((l: any) => `
                  <tr>
                    <td>${l.product_name || l.productName || ""}</td>
                    <td>${l.color || "-"}</td>
                    <td>${l.size || "-"}</td>
                    <td style="font-family:monospace">${l.barcode || "-"}</td>
                    <td style="text-align:center;font-weight:bold">${l.qty}</td>
                  </tr>`).join("");
                const win = window.open("", "_blank", "width=900,height=700");
                if (!win) return;
                win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">
                  <title>تحويل #${selectedTransfer?.id}</title>
                  <style>
                    body{font-family:Arial,sans-serif;padding:20px;direction:rtl}
                    h2{margin-bottom:4px}
                    .meta{color:#666;margin-bottom:16px;font-size:14px}
                    table{width:100%;border-collapse:collapse;margin-top:12px}
                    th,td{border:1px solid #ddd;padding:8px 10px;text-align:right;font-size:13px}
                    th{background:#f5f5f5;font-weight:bold}
                    @media print{button{display:none}}
                  </style></head><body>
                  <h2>تحويل مخزون #${selectedTransfer?.id}</h2>
                  <div class="meta">
                    من: <strong>${fromName}</strong> &nbsp;→&nbsp; إلى: <strong>${toName}</strong>
                    &nbsp;|&nbsp; التاريخ: ${date ? new Date(date).toLocaleDateString("ar-OM") : ""}
                  </div>
                  <table>
                    <thead><tr><th>المنتج</th><th>اللون</th><th>المقاس</th><th>الباركود</th><th>الكمية</th></tr></thead>
                    <tbody>${rows}</tbody>
                  </table>
                  <br/><button onclick="window.print()">طباعة</button>
                  </body></html>`);
                win.document.close();
                win.focus();
                setTimeout(() => win.print(), 400);
              }}
            >
              <Printer className="w-4 h-4" />
              طباعة
            </Button>
            <Button variant="outline" onClick={() => setSelectedTransfer(null)}>{t("common.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LedgerTab() {
  const { t, lang } = useI18n();
  const [branchId, setBranchId] = useState<string>("all");
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerType, setLedgerType] = useState<string>("all");

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const ledgerUrl = branchId === "all" ? "/api/inventory-ledger" : `/api/inventory-ledger?branchId=${branchId}`;
  const { data: ledger = [] } = useQuery<any[]>({
    queryKey: [ledgerUrl],
  });

  const filteredLedger = ledger.filter((entry: any) => {
    if (ledgerType !== "all" && entry.reason !== ledgerType) return false;
    if (!ledgerSearch.trim()) return true;
    const q = ledgerSearch.toLowerCase();
    return (
      (entry.product_name || entry.productName || "").toLowerCase().includes(q) ||
      (entry.barcode || "").toLowerCase().includes(q) ||
      (entry.location_name || entry.locationName || "").toLowerCase().includes(q) ||
      (entry.creator_name || entry.userName || "").toLowerCase().includes(q)
    );
  });

  const getReasonColor = (reason: string) => {
    switch (reason) {
      case "sale": return "bg-blue-100 text-blue-700";
      case "purchase_posted": return "bg-green-100 text-green-700";
      case "transfer_in": return "bg-emerald-100 text-emerald-700";
      case "transfer_out": return "bg-orange-100 text-orange-700";
      case "adjustment": return "bg-purple-100 text-purple-700";
      case "sale_return": return "bg-yellow-100 text-yellow-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="w-full md:w-52">
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger data-testid="select-ledger-location">
              <SelectValue placeholder={t("inv_balances.all_locations")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("inv_balances.all_locations")}</SelectItem>
              {(branches as any[]).map(b => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name}{b.address ? ` - ${b.address}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full md:w-44">
          <Select value={ledgerType} onValueChange={setLedgerType}>
            <SelectTrigger data-testid="select-ledger-type">
              <SelectValue placeholder="كل الأنواع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأنواع</SelectItem>
              <SelectItem value="sale">{t("inv_ledger.sale")}</SelectItem>
              <SelectItem value="purchase_posted">{t("inv_ledger.purchase_posted")}</SelectItem>
              <SelectItem value="transfer_in">{t("inv_ledger.transfer_in")}</SelectItem>
              <SelectItem value="transfer_out">{t("inv_ledger.transfer_out")}</SelectItem>
              <SelectItem value="adjustment">{t("inv_ledger.adjustment")}</SelectItem>
              <SelectItem value="sale_return">{t("inv_ledger.sale_return")}</SelectItem>
              <SelectItem value="return">{t("inv_ledger.return")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("products.search_placeholder")}
            className="pl-9"
            value={ledgerSearch}
            onChange={e => setLedgerSearch(e.target.value)}
            data-testid="input-search-ledger"
          />
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.date")}</TableHead>
              <TableHead>{t("common.type")}</TableHead>
              <TableHead>{t("inv_balances.product")}</TableHead>
              <TableHead>{t("products.barcode")}</TableHead>
              <TableHead>{t("products.variant_color")}</TableHead>
              <TableHead>{t("products.variant_size")}</TableHead>
              <TableHead>{t("inv_balances.location")}</TableHead>
              <TableHead className="text-right">قبل</TableHead>
              <TableHead className="text-right">{t("inv_ledger.qty_change")}</TableHead>
              <TableHead className="text-right">بعد</TableHead>
              <TableHead>{t("common.employee")}</TableHead>
              <TableHead>{t("inv_ledger.reference")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLedger.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                  {t("inv_ledger.no_entries")}
                </TableCell>
              </TableRow>
            ) : filteredLedger.map((entry: any, i: number) => (
              <TableRow key={i}>
                <TableCell className="text-xs">{fmtDate(entry.created_at || entry.createdAt)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={getReasonColor(entry.reason)}>
                    {t(`inv_ledger.${entry.reason}`)}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{entry.product_name || entry.productName}</TableCell>
                <TableCell className="font-mono text-xs">{entry.barcode || "-"}</TableCell>
                <TableCell>{entry.color || "-"}</TableCell>
                <TableCell>{entry.size || "-"}</TableCell>
                <TableCell>{entry.location_name || entry.locationName}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground text-xs">
                  {entry.qty_before ?? "-"}
                </TableCell>
                <TableCell className={`text-right font-bold ${(entry.qty_change ?? entry.qtyChange) > 0 ? "text-green-600" : "text-red-600"}`}>
                  {(entry.qty_change ?? entry.qtyChange) > 0 ? `+${entry.qty_change ?? entry.qtyChange}` : (entry.qty_change ?? entry.qtyChange)}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground text-xs">
                  {entry.qty_after ?? "-"}
                </TableCell>
                <TableCell>{entry.creator_name || entry.userName || "-"}</TableCell>
                <TableCell className="text-xs font-mono">{entry.ref_id ? `${entry.ref_table || ""}#${entry.ref_id}` : (entry.reference || "-")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function InventoryKPIs() {
  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const { data: lowStock = [] } = useQuery<any[]>({
    queryKey: ["/api/inventory/low-stock"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const totalProducts = products.length;
  const inventoryValue = products.reduce((sum: number, p: any) => {
    const cost = parseFloat(p.avgCost || "0") || parseFloat(p.price || "0");
    return sum + cost * (p.totalStock ?? 0);
  }, 0);
  const lowStockCount = lowStock.length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" dir="rtl">
      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي المنتجات</CardTitle>
          <div className="p-2 bg-primary/10 rounded-full text-primary"><Layers className="w-4 h-4" /></div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalProducts}</div>
          <p className="text-xs text-muted-foreground mt-1">منتج مسجل</p>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">قيمة المخزون</CardTitle>
          <div className="p-2 bg-emerald-50 rounded-full text-emerald-600"><TrendingUp className="w-4 h-4" /></div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{inventoryValue.toFixed(3)}</div>
          <p className="text-xs text-muted-foreground mt-1">ريال عماني</p>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">منخفض المخزون</CardTitle>
          <div className="p-2 bg-red-50 rounded-full text-red-500"><AlertTriangle className="w-4 h-4" /></div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{lowStockCount}</div>
          <p className="text-xs text-muted-foreground mt-1">منتج تحت الحد الأدنى</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Inventory() {
  const { t } = useI18n();

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center gap-2">
        <Package className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold">{t("nav.inventory")}</h1>
      </div>

      <InventoryKPIs />

      <Tabs defaultValue="balances" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="balances" className="gap-2" data-testid="tab-balances">
            <Package className="w-4 h-4" /> {t("inv_balances.tab_balances")}
          </TabsTrigger>
          <TabsTrigger value="transfers" className="gap-2" data-testid="tab-transfers">
            <ArrowRightLeft className="w-4 h-4" /> {t("inv_balances.tab_transfers")}
          </TabsTrigger>
          <TabsTrigger value="ledger" className="gap-2" data-testid="tab-ledger">
            <History className="w-4 h-4" /> {t("inv_balances.tab_ledger")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="balances"><BalancesTab /></TabsContent>
        <TabsContent value="transfers"><TransfersTab /></TabsContent>
        <TabsContent value="ledger"><LedgerTab /></TabsContent>
      </Tabs>
    </div>
  );
}
