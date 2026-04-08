import { useState } from "react";
import { Package, Search, ArrowRightLeft, ArrowLeft, History, Plus, CheckCircle, Barcode, MapPin, AlertTriangle, TrendingUp, Layers } from "lucide-react";
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
  const [branchId, setBranchId] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const balancesUrl = branchId === "all" ? "/api/inventory-balances" : `/api/inventory-balances?branchId=${branchId}`;
  const { data: balances = [] } = useQuery<any[]>({
    queryKey: [balancesUrl],
  });

  const filtered = balances.filter(b => 
    (b.product_name || b.productName || "").toLowerCase().includes(search.toLowerCase()) || 
    (b.barcode || "").includes(search)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="w-full md:w-64">
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger data-testid="select-location-filter">
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
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder={t("products.search_placeholder")} 
            className="pl-9" 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            data-testid="input-search-balances"
          />
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
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
                <TableHeader>
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

  const filteredTransfers = transfers.filter((tx: any) => {
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
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[200px] md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالموقع أو الموظف..."
            className="pl-9"
            value={txSearch}
            onChange={e => setTxSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => setMode("create")} data-testid="button-create-transfer">
          <Plus className="w-4 h-4 mr-2" /> {t("transfers.create_transfer")}
        </Button>
      </div>

      {filteredTransfers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ArrowRightLeft className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{t("transfers.no_transfers")}</p>
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{t("common.date")}</TableHead>
                <TableHead>{t("transfers.from_location")}</TableHead>
                <TableHead></TableHead>
                <TableHead>{t("transfers.to_location")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("common.employee")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransfers.map((tx: any) => (
                <TableRow key={tx.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedTransfer(tx)} data-testid={`row-transfer-${tx.id}`}>
                  <TableCell className="font-mono text-xs">{tx.id}</TableCell>
                  <TableCell>{fmtDate(tx.created_at || tx.createdAt)}</TableCell>
                  <TableCell className="font-medium">{tx.from_location_name || tx.fromLocationName}</TableCell>
                  <TableCell className="text-center text-muted-foreground"><ArrowLeft className="w-4 h-4 inline rotate-180" /></TableCell>
                  <TableCell className="font-medium">{tx.to_location_name || tx.toLocationName}</TableCell>
                  <TableCell>
                    <Badge variant={tx.status === "approved" ? "outline" : tx.status === "cancelled" ? "destructive" : "secondary"} className={tx.status === "approved" ? "border-green-500 text-green-700 bg-green-50" : ""}>
                      {t(`transfers.status_${tx.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>{tx.creator_name || tx.creatorName}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

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
          <DialogFooter>
            <Badge variant="outline" className="border-green-500 text-green-700 bg-green-50">
              {t(`transfers.status_${transferDetail?.status || selectedTransfer?.status}`)}
            </Badge>
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
              <TableHead className="text-right">{t("inv_ledger.qty_change")}</TableHead>
              <TableHead>{t("common.employee")}</TableHead>
              <TableHead>{t("inv_ledger.reference")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLedger.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
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
                <TableCell className={`text-right font-bold ${(entry.qty_change ?? entry.qtyChange) > 0 ? "text-green-600" : "text-red-600"}`}>
                  {(entry.qty_change ?? entry.qtyChange) > 0 ? `+${entry.qty_change ?? entry.qtyChange}` : (entry.qty_change ?? entry.qtyChange)}
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
