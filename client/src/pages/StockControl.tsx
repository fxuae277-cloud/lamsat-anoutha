import { useState } from "react";
import { Plus, ClipboardCheck, Search, Package, ArrowUpDown, CheckCircle2, Eye, AlertTriangle, TrendingUp, TrendingDown, Minus, BarChart3, Building2, RefreshCw } from "lucide-react";
import { BarcodeScanButton } from "@/components/BarcodeScanButton";
import { fmtDate } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import type { Branch } from "@shared/schema";

function fmt(v: string | number | null | undefined) {
  return parseFloat(String(v || "0")).toFixed(0);
}

export default function StockControl() {
  const { toast } = useToast();
  const { t } = useI18n();

  const { data: branchesList = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const { data: locationsList = [] } = useQuery<any[]>({
    queryKey: ["/api/locations"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-stock-control-title">{t("stock_control.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("stock_control.subtitle")}</p>
      </div>

      <Tabs defaultValue="stocktakes" dir={t("dir") as "ltr" | "rtl"}>
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="stocktakes" className="gap-1 text-xs">
            <ClipboardCheck className="w-4 h-4" />
            {t("stock_control.tab_stocktakes")}
          </TabsTrigger>
          <TabsTrigger value="adjustments" className="gap-1 text-xs">
            <ArrowUpDown className="w-4 h-4" />
            {t("stock_control.tab_adjustments")}
          </TabsTrigger>
          <TabsTrigger value="report" className="gap-1 text-xs">
            <BarChart3 className="w-4 h-4" />
            {t("stock_control.tab_report")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stocktakes">
          <StocktakesTab branchesList={branchesList} locationsList={locationsList} />
        </TabsContent>

        <TabsContent value="adjustments">
          <AdjustmentsTab branchesList={branchesList} locationsList={locationsList} />
        </TabsContent>

        <TabsContent value="report">
          <ReportTab branchesList={branchesList} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StocktakesTab({ branchesList, locationsList }: { branchesList: any[]; locationsList: any[] }) {
  const { toast } = useToast();
  const { t, lang } = useI18n();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedSt, setSelectedSt] = useState<any>(null);
  const [newBranch, setNewBranch] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newNote, setNewNote] = useState("");
  const [itemSearch, setItemSearch] = useState("");

  const { data: stocktakes = [] } = useQuery<any[]>({
    queryKey: ["/api/stocktakes"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: items = [] } = useQuery<any[]>({
    queryKey: [`/api/stocktakes/${selectedSt?.id}/items`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!selectedSt,
  });

  const branchLocations = locationsList.filter((l: any) =>
    newBranch ? l.branchId === Number(newBranch) || l.isCentral : true
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/stocktakes", {
        branchId: Number(newBranch), locationId: Number(newLocation), note: newNote,
      });
    },
    onSuccess: () => {
      toast({ title: t("stock_control.stocktake_created_success") });
      queryClient.invalidateQueries({ queryKey: ["/api/stocktakes"] });
      setCreateOpen(false);
      setNewBranch(""); setNewLocation(""); setNewNote("");
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, countedQty, note }: { id: number; countedQty: number; note?: string }) => {
      await apiRequest("PATCH", `/api/stocktake-items/${id}`, { countedQty, note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stocktakes/${selectedSt?.id}/items`] });
      queryClient.invalidateQueries({ queryKey: ["/api/stocktakes"] });
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/stocktakes/${id}/approve`, {});
    },
    onSuccess: () => {
      toast({ title: t("stock_control.stocktake_approved_success") });
      queryClient.invalidateQueries({ queryKey: ["/api/stocktakes"] });
      setDetailsOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const filteredItems = items.filter((it: any) => {
    if (!itemSearch) return true;
    return (it.product_name || "").toLowerCase().includes(itemSearch.toLowerCase()) || (it.barcode || "").includes(itemSearch);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">{t("stock_control.tab_stocktakes")}</h3>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-create-stocktake">
              <Plus className="w-4 h-4" />
              {t("stock_control.new_stocktake")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>{t("stock_control.create_stocktake_title")}</DialogTitle>
              <DialogDescription>{t("stock_control.create_stocktake_desc")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("stock_control.branch_label")}</label>
                <Select value={newBranch} onValueChange={v => { setNewBranch(v); setNewLocation(""); }}>
                  <SelectTrigger data-testid="select-st-branch"><SelectValue placeholder={t("stock_control.select_branch_placeholder")} /></SelectTrigger>
                  <SelectContent>
                    {branchesList.map(b => (
                      <SelectItem key={b.id} value={String(b.id)}>{b.name}{b.address ? " - " + b.address : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("stock_control.location_label")}</label>
                <Select value={newLocation} onValueChange={setNewLocation}>
                  <SelectTrigger data-testid="select-st-location"><SelectValue placeholder={t("stock_control.select_location_placeholder")} /></SelectTrigger>
                  <SelectContent>
                    {branchLocations.map((l: any) => (
                      <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("stock_control.notes_label")}</label>
                <Input placeholder={t("stock_control.optional_notes")} value={newNote} onChange={e => setNewNote(e.target.value)} data-testid="input-st-note" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newBranch || !newLocation} data-testid="button-save-stocktake">
                {createMutation.isPending ? t("stock_control.creating_stocktake") : t("stock_control.start_stocktake_btn")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>{t("stock_control.table_id")}</TableHead>
              <TableHead>{t("stock_control.table_branch")}</TableHead>
              <TableHead>{t("stock_control.table_location")}</TableHead>
              <TableHead>{t("stock_control.table_status")}</TableHead>
              <TableHead>{t("stock_control.table_items_count")}</TableHead>
              <TableHead>{t("stock_control.table_matched")}</TableHead>
              <TableHead>{t("stock_control.table_surplus")}</TableHead>
              <TableHead>{t("stock_control.table_shortage")}</TableHead>
              <TableHead>{t("stock_control.table_created_by")}</TableHead>
              <TableHead>{t("stock_control.table_date")}</TableHead>
              <TableHead className="w-[100px]">{t("stock_control.table_actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stocktakes.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">{t("stock_control.no_stocktakes")}</TableCell></TableRow>
            ) : stocktakes.map((st: any) => (
              <TableRow key={st.id} data-testid={`row-stocktake-${st.id}`}>
                <TableCell className="font-mono text-sm">#{st.id}</TableCell>
                <TableCell className="text-sm">{st.branch_name}</TableCell>
                <TableCell className="text-sm">{st.location_name}</TableCell>
                <TableCell>
                  {st.status === "draft" ? (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">{t("common.open")}</Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">{t("common.completed")}</Badge>
                  )}
                </TableCell>
                <TableCell className="font-medium">{st.total_items}</TableCell>
                <TableCell className="text-green-600">{st.matched_items}</TableCell>
                <TableCell className="text-blue-600">{st.surplus_items}</TableCell>
                <TableCell className="text-red-600">{st.shortage_items}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{st.creator_name || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{fmtDate(st.created_at)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setSelectedSt(st); setDetailsOpen(true); }} data-testid={`button-st-details-${st.id}`}>
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-primary" />
              {t("stock_control.stocktake_details_title")}
              {selectedSt?.status === "draft" && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs mr-2">{t("common.open")}</Badge>
              )}
              {selectedSt?.status === "completed" && (
                <Badge className="bg-green-100 text-green-700 border-green-200 text-xs mr-2">{t("common.completed")}</Badge>
              )}
            </DialogTitle>
            <DialogDescription>{selectedSt?.branch_name}</DialogDescription>
          </DialogHeader>

          {selectedSt?.status === "draft" && (
            <div className="grid grid-cols-4 gap-3">
              <Card><CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("stock_control.total_items")}</p>
                <p className="text-lg font-bold">{selectedSt?.total_items}</p>
              </CardContent></Card>
              <Card><CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("stock_control.table_matched")}</p>
                <p className="text-lg font-bold text-green-600">{selectedSt?.matched_items}</p>
              </CardContent></Card>
              <Card><CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("stock_control.table_surplus")}</p>
                <p className="text-lg font-bold text-blue-600">{selectedSt?.surplus_items}</p>
              </CardContent></Card>
              <Card><CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("stock_control.table_shortage")}</p>
                <p className="text-lg font-bold text-red-600">{selectedSt?.shortage_items}</p>
              </CardContent></Card>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={t("stock_control.search_items_placeholder")} className="pr-9" value={itemSearch} onChange={e => setItemSearch(e.target.value)} data-testid="input-st-item-search" />
            </div>
            <BarcodeScanButton onScan={(barcode) => setItemSearch(barcode)} />
            {selectedSt?.status === "draft" && (
              <Button className="gap-2 bg-green-600 hover:bg-green-700" onClick={() => approveMutation.mutate(selectedSt.id)} disabled={approveMutation.isPending} data-testid="button-approve-stocktake">
                <CheckCircle2 className="w-4 h-4" />
                {approveMutation.isPending ? t("stock_control.approving_stocktake") : t("stock_control.approve_stocktake_btn")}
              </Button>
            )}
          </div>

          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>{t("stock_control.table_product")}</TableHead>
                <TableHead>{t("stock_control.table_barcode")}</TableHead>
                <TableHead>{t("stock_control.table_system_qty")}</TableHead>
                <TableHead>{t("stock_control.table_counted_qty")}</TableHead>
                <TableHead>{t("stock_control.table_difference")}</TableHead>
                <TableHead>{t("stock_control.table_note")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">{t("stock_control.no_items_found")}</TableCell></TableRow>
              ) : filteredItems.map((it: any) => (
                <StocktakeItemRow
                  key={it.id}
                  item={it}
                  isDraft={selectedSt?.status === "draft"}
                  onUpdate={(countedQty: number, note?: string) => {
                    updateItemMutation.mutate({ id: it.id, countedQty, note });
                  }}
                />
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StocktakeItemRow({ item, isDraft, onUpdate }: { item: any; isDraft: boolean; onUpdate: (qty: number, note?: string) => void }) {
  const { t } = useI18n();
  const [qty, setQty] = useState(item.counted_qty !== null ? String(item.counted_qty) : "");
  const [note, setNote] = useState(item.note || "");
  const diff = item.counted_qty !== null ? item.counted_qty - item.system_qty : null;

  return (
    <TableRow data-testid={`row-st-item-${item.id}`} className={diff !== null && diff !== 0 ? (diff > 0 ? "bg-blue-50/50" : "bg-red-50/50") : ""}>
      <TableCell className="font-medium text-sm">{item.product_name}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{item.barcode || "—"}</TableCell>
      <TableCell className="font-medium">{item.system_qty}</TableCell>
      <TableCell>
        {isDraft ? (
          <Input
            type="number"
            className="w-20 h-8 text-center"
            value={qty}
            onChange={e => setQty(e.target.value)}
            onBlur={() => {
              if (qty !== "" && Number(qty) !== item.counted_qty) {
                onUpdate(Number(qty), note);
              }
            }}
            data-testid={`input-counted-${item.id}`}
          />
        ) : (
          <span className="font-medium">{item.counted_qty !== null ? item.counted_qty : "—"}</span>
        )}
      </TableCell>
      <TableCell>
        {diff !== null ? (
          <Badge variant="outline" className={`text-xs ${diff === 0 ? "bg-green-50 text-green-700" : diff > 0 ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"}`}>
            {diff > 0 ? `+${diff}` : diff}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      <TableCell>
        {isDraft ? (
          <Input
            className="w-32 h-8 text-xs"
            placeholder={t("stock_control.note_placeholder")}
            value={note}
            onChange={e => setNote(e.target.value)}
            onBlur={() => {
              if (qty !== "" && note !== item.note) {
                onUpdate(Number(qty), note);
              }
            }}
          />
        ) : (
          <span className="text-sm text-muted-foreground">{item.note || "—"}</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function AdjustmentsTab({ branchesList, locationsList }: { branchesList: any[]; locationsList: any[] }) {
  const { toast } = useToast();
  const { t, lang } = useI18n();
  const [addOpen, setAddOpen] = useState(false);
  const [adjBranch, setAdjBranch] = useState("");
  const [adjLocation, setAdjLocation] = useState("");
  const [adjProduct, setAdjProduct] = useState("");
  const [adjQty, setAdjQty] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [filterBranch, setFilterBranch] = useState("__all__");

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const adjUrl = filterBranch !== "__all__" ? `/api/inventory-adjustments?branchId=${filterBranch}` : "/api/inventory-adjustments";
  const { data: adjustments = [] } = useQuery<any[]>({
    queryKey: [adjUrl],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const adjBranchLocations = locationsList.filter((l: any) =>
    adjBranch ? l.branchId === Number(adjBranch) || l.isCentral : true
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/inventory-adjustments", {
        branchId: Number(adjBranch),
        locationId: Number(adjLocation),
        productId: Number(adjProduct),
        qtyChange: Number(adjQty),
        reason: adjReason,
      });
    },
    onSuccess: () => {
      toast({ title: t("stock_control.adjustment_success") });
      queryClient.invalidateQueries({ queryKey: [adjUrl] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-adjustments"] });
      setAddOpen(false);
      setAdjBranch(""); setAdjLocation(""); setAdjProduct(""); setAdjQty(""); setAdjReason("");
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">{t("stock_control.manual_adjustments_title")}</h3>
        <div className="flex gap-2">
          <Select value={filterBranch} onValueChange={setFilterBranch}>
            <SelectTrigger className="w-48"><SelectValue placeholder={t("stock_control.all_branches")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("stock_control.all_branches")}</SelectItem>
              {branchesList.map(b => (
                <SelectItem key={b.id} value={String(b.id)}>{b.name}{b.address ? " - " + b.address : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-adjustment">
                <Plus className="w-4 h-4" />
                {t("stock_control.new_adjustment")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle>{t("stock_control.adjustment_dialog_title")}</DialogTitle>
                <DialogDescription>{t("stock_control.adjustment_dialog_desc")}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t("stock_control.branch_field")}</label>
                    <Select value={adjBranch} onValueChange={v => { setAdjBranch(v); setAdjLocation(""); }}>
                      <SelectTrigger data-testid="select-adj-branch"><SelectValue placeholder={t("stock_control.select_placeholder")} /></SelectTrigger>
                      <SelectContent>
                        {branchesList.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}{b.address ? " - " + b.address : ""}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t("stock_control.location_field")}</label>
                    <Select value={adjLocation} onValueChange={setAdjLocation}>
                      <SelectTrigger data-testid="select-adj-location"><SelectValue placeholder={t("stock_control.select_placeholder")} /></SelectTrigger>
                      <SelectContent>
                        {adjBranchLocations.map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("stock_control.product_field")}</label>
                  <Select value={adjProduct} onValueChange={setAdjProduct}>
                    <SelectTrigger data-testid="select-adj-product"><SelectValue placeholder={t("stock_control.select_product_placeholder")} /></SelectTrigger>
                    <SelectContent>
                      {products.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name} {p.barcode ? `(${p.barcode})` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t("stock_control.qty_change_field")}</label>
                    <Input type="number" placeholder={t("stock_control.qty_change_placeholder")} value={adjQty} onChange={e => setAdjQty(e.target.value)} data-testid="input-adj-qty" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("stock_control.reason_field")}</label>
                  <Input placeholder={t("stock_control.reason_placeholder")} value={adjReason} onChange={e => setAdjReason(e.target.value)} data-testid="input-adj-reason" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !adjBranch || !adjLocation || !adjProduct || !adjQty || !adjReason} data-testid="button-save-adjustment">
                  {createMutation.isPending ? t("stock_control.saving_adjustment") : t("stock_control.save_adjustment_btn")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>{t("stock_control.table_id")}</TableHead>
              <TableHead>{t("stock_control.table_date")}</TableHead>
              <TableHead>{t("stock_control.table_branch")}</TableHead>
              <TableHead>{t("stock_control.table_location")}</TableHead>
              <TableHead>{t("stock_control.table_product")}</TableHead>
              <TableHead>{t("stock_control.table_qty_change")}</TableHead>
              <TableHead>{t("stock_control.table_reason")}</TableHead>
              <TableHead>{t("stock_control.table_created_by")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adjustments.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("stock_control.no_adjustments")}</TableCell></TableRow>
            ) : adjustments.map((adj: any) => (
              <TableRow key={adj.id} data-testid={`row-adj-${adj.id}`}>
                <TableCell className="font-mono text-sm">#{adj.id}</TableCell>
                <TableCell className="text-sm">{fmtDate(adj.createdAt)}</TableCell>
                <TableCell className="text-sm">{adj.branchName}</TableCell>
                <TableCell className="text-sm">{adj.locationName}</TableCell>
                <TableCell className="text-sm font-medium">{adj.productName}</TableCell>
                <TableCell className={Number(adj.qtyChange) > 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                  {Number(adj.qtyChange) > 0 ? `+${adj.qtyChange}` : adj.qtyChange}
                </TableCell>
                <TableCell className="text-sm">{adj.reason}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{adj.creatorName || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ReportTab({ branchesList }: { branchesList: any[] }) {
  const { t, lang } = useI18n();
  const [selectedBranch, setSelectedBranch] = useState("__all__");

  const reportUrl = selectedBranch !== "__all__" ? `/api/inventory-discrepancy-report?branchId=${selectedBranch}` : "/api/inventory-discrepancy-report";
  const { data: report = [] } = useQuery<any[]>({
    queryKey: [reportUrl],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const totalDiscrepancies = report.length;
  const netAdjustmentValue = report.reduce((sum, item) => sum + parseFloat(item.estimated_value_impact || "0"), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">{t("stock_control.discrepancy_report_title")}</h3>
        <Select value={selectedBranch} onValueChange={setSelectedBranch}>
          <SelectTrigger className="w-48"><SelectValue placeholder={t("stock_control.all_branches")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("stock_control.all_branches")}</SelectItem>
            {branchesList.map(b => (
              <SelectItem key={b.id} value={String(b.id)}>{b.name}{b.address ? " - " + b.address : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-primary/10 rounded-lg"><AlertTriangle className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">{t("stock_control.total_discrepancies")}</p>
              <p className="text-xl font-bold">{totalDiscrepancies}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={netAdjustmentValue < 0 ? "bg-red-50 border-red-100" : "bg-green-50 border-green-100"}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`p-2 rounded-lg ${netAdjustmentValue < 0 ? "bg-red-100" : "bg-green-100"}`}>
              {netAdjustmentValue < 0 ? <TrendingDown className="w-5 h-5 text-red-600" /> : <TrendingUp className="w-5 h-5 text-green-600" />}
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">{t("stock_control.net_adjustment_value")}</p>
              <p className={`text-xl font-bold ${netAdjustmentValue < 0 ? "text-red-600" : "text-green-600"}`}>
                {netAdjustmentValue.toFixed(3)} OMR
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>{t("stock_control.table_date")}</TableHead>
              <TableHead>{t("stock_control.table_branch")}</TableHead>
              <TableHead>{t("stock_control.table_product")}</TableHead>
              <TableHead>{t("stock_control.table_type")}</TableHead>
              <TableHead>{t("stock_control.table_qty_change")}</TableHead>
              <TableHead>{t("stock_control.table_value")}</TableHead>
              <TableHead>{t("stock_control.table_reason")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("stock_control.no_adjustments")}</TableCell></TableRow>
            ) : report.map((item: any, idx: number) => (
              <TableRow key={idx}>
                <TableCell className="text-sm">{fmtDate(item.date)}</TableCell>
                <TableCell className="text-sm">{item.branch_name}</TableCell>
                <TableCell className="text-sm font-medium">{item.product_name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {item.adjustment_type === "stocktake" ? t("stock_control.tab_stocktakes") : t("stock_control.tab_adjustments")}
                  </Badge>
                </TableCell>
                <TableCell className={Number(item.qty_change) > 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                  {Number(item.qty_change) > 0 ? `+${item.qty_change}` : item.qty_change}
                </TableCell>
                <TableCell className="text-sm font-mono">{parseFloat(item.estimated_value_impact || "0").toFixed(3)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{item.reason || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
