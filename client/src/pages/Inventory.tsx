import { useState } from "react";
import { Package, Search, ArrowRightLeft, History, Plus, CheckCircle, Barcode, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { BarcodeScanButton } from "@/components/BarcodeScanButton";

type Location = { id: number; name: string; type: string; code: string; branchId: number | null; isMain: boolean; isCentral: boolean; isBranchDefault: boolean; active: boolean; kind: string | null; branchName: string | null };

function locLabel(loc: Location) {
  if (loc.isCentral) return loc.name;
  return loc.branchName ? `${loc.branchName} - ${loc.name}` : loc.name;
}

function BalancesTab() {
  const { t, lang } = useI18n();
  const [locationId, setLocationId] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const balancesUrl = locationId === "all" ? "/api/inventory-balances" : `/api/inventory-balances?locationId=${locationId}`;
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
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger data-testid="select-location-filter">
              <SelectValue placeholder={t("inv_balances.all_locations")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("inv_balances.all_locations")}</SelectItem>
              {locations.map(loc => (
                <SelectItem key={loc.id} value={String(loc.id)}>{locLabel(loc)}</SelectItem>
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
                    {lrd ? new Date(lrd).toLocaleDateString("en-US") : "-"}
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
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);
  const [fromLoc, setFromLoc] = useState("");
  const [toLoc, setToLoc] = useState("");
  const [scanBarcode, setScanBarcode] = useState("");

  const { data: transfers = [] } = useQuery<any[]>({
    queryKey: ["/api/stock-transfers"],
  });

  const { data: transferLocs = [] } = useQuery<TransferLocation[]>({
    queryKey: ["/api/transfer-locations"],
  });

  const { data: transferDetail } = useQuery<any>({
    queryKey: [`/api/stock-transfers/${selectedTransfer?.id}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!selectedTransfer?.id,
  });

  const { data: sourceStock = [] } = useQuery<any[]>({
    queryKey: [`/api/transfer-source-stock/${fromLoc}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!fromLoc,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/stock-transfers", data);
      return res.json();
    },
    onSuccess: (newTransfer) => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock-transfers"] });
      setIsCreateOpen(false);
      setSelectedTransfer(newTransfer);
      setFromLoc(""); setToLoc("");
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/stock-transfers/${id}/approve`);
    },
    onSuccess: () => {
      toast({ title: t("transfers.transfer_approved") });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-ledger"] });
      setSelectedTransfer(null);
    },
    onError: (err: any) => toast({ title: t("common.error"), description: err.message, variant: "destructive" })
  });

  const addLineMutation = useMutation({
    mutationFn: async ({ id, barcode, qty }: { id: number, barcode: string, qty: number }) => {
      const res = await fetch(`/api/variants/barcode/${barcode}`);
      if (!res.ok) throw new Error(t("transfers.item_not_in_source"));
      const variant = await res.json();
      await apiRequest("POST", `/api/stock-transfers/${id}/lines`, { variantId: variant.id, qty });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock-transfers"] });
      if (selectedTransfer?.id) queryClient.invalidateQueries({ queryKey: [`/api/stock-transfers/${selectedTransfer.id}`] });
      setScanBarcode("");
    },
    onError: (err: any) => toast({ title: t("common.error"), description: err.message, variant: "destructive" })
  });

  const deleteLineMutation = useMutation({
    mutationFn: async (lineId: number) => {
      await apiRequest("DELETE", `/api/stock-transfer-lines/${lineId}`);
    },
    onSuccess: () => {
      if (selectedTransfer?.id) queryClient.invalidateQueries({ queryKey: [`/api/stock-transfers/${selectedTransfer.id}`] });
    },
    onError: (err: any) => toast({ title: t("common.error"), description: err.message, variant: "destructive" })
  });

  const detailStatus = transferDetail?.status || selectedTransfer?.status;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-transfer">
          <Plus className="w-4 h-4 mr-2" /> {t("transfers.create_transfer")}
        </Button>
      </div>

      {transfers.length === 0 ? (
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
                <TableHead>{t("transfers.to_location")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("common.employee")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map((tx: any) => (
                <TableRow key={tx.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedTransfer(tx)} data-testid={`row-transfer-${tx.id}`}>
                  <TableCell className="font-mono text-xs">{tx.id}</TableCell>
                  <TableCell>{new Date(tx.created_at || tx.createdAt).toLocaleDateString("en-US")}</TableCell>
                  <TableCell className="font-medium">{tx.from_location_name || tx.fromLocationName}</TableCell>
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

      <Dialog open={isCreateOpen} onOpenChange={(open) => { if (!open) { setFromLoc(""); setToLoc(""); } setIsCreateOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("transfers.create_transfer")}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("transfers.from_location")}</label>
              <Select value={fromLoc} onValueChange={(v) => { setFromLoc(v); if (v === toLoc) setToLoc(""); }}>
                <SelectTrigger data-testid="select-from-location"><SelectValue placeholder={t("transfers.select_source")} /></SelectTrigger>
                <SelectContent>
                  {transferLocs.map(tl => (
                    <SelectItem key={tl.location_id} value={String(tl.location_id)}>
                      {tl.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("transfers.to_location")}</label>
              <Select value={toLoc} onValueChange={setToLoc}>
                <SelectTrigger data-testid="select-to-location"><SelectValue placeholder={t("transfers.select_destination")} /></SelectTrigger>
                <SelectContent>
                  {transferLocs
                    .filter(tl => String(tl.location_id) !== fromLoc)
                    .map(tl => (
                      <SelectItem key={tl.location_id} value={String(tl.location_id)}>
                        {tl.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {fromLoc && sourceStock.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t("transfers.available_items")} ({sourceStock.length})</label>
                <div className="border rounded-md max-h-40 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">{t("inv_balances.product")}</TableHead>
                        <TableHead className="text-xs">{t("products.variant_color")}</TableHead>
                        <TableHead className="text-xs">{t("products.variant_size")}</TableHead>
                        <TableHead className="text-xs text-right">{t("transfers.qty_available")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sourceStock.map((item: any, i: number) => (
                        <TableRow key={i} className="text-xs">
                          <TableCell>{item.product_name}</TableCell>
                          <TableCell>{item.color || "-"}</TableCell>
                          <TableCell>{item.size || "-"}</TableCell>
                          <TableCell className="text-right font-medium">{Number(item.qty_on_hand)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {fromLoc && sourceStock.length === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground bg-muted rounded-md">
                {t("transfers.no_stock_at_source")}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>{t("common.cancel")}</Button>
            <Button 
              onClick={() => createMutation.mutate({ fromLocationId: Number(fromLoc), toLocationId: Number(toLoc) })}
              disabled={!fromLoc || !toLoc || createMutation.isPending}
              data-testid="button-confirm-create-transfer"
            >
              {t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedTransfer} onOpenChange={(open) => { if (!open) { setSelectedTransfer(null); setScanBarcode(""); } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("transfers.title")} #{selectedTransfer?.id}</DialogTitle>
            <DialogDescription className="flex items-center gap-2 text-base">
              <span className="font-semibold">{transferDetail?.from_location_name || selectedTransfer?.from_location_name}</span>
              <ArrowRightLeft className="inline w-4 h-4 text-muted-foreground" />
              <span className="font-semibold">{transferDetail?.to_location_name || selectedTransfer?.to_location_name}</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {detailStatus === "draft" && (
              <div className="flex gap-2 p-3 bg-muted rounded-md">
                <Input 
                  placeholder={t("transfers.scan_barcode")} 
                  value={scanBarcode} 
                  onChange={e => setScanBarcode(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && scanBarcode.trim() && addLineMutation.mutate({ id: selectedTransfer.id, barcode: scanBarcode.trim(), qty: 1 })}
                  data-testid="input-transfer-barcode"
                />
                <BarcodeScanButton onScan={code => addLineMutation.mutate({ id: selectedTransfer.id, barcode: code, qty: 1 })} />
              </div>
            )}

            <div className="border rounded-md max-h-72 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("inv_balances.product")}</TableHead>
                    <TableHead>{t("products.variant_color")}</TableHead>
                    <TableHead>{t("products.variant_size")}</TableHead>
                    <TableHead>{t("products.barcode")}</TableHead>
                    <TableHead className="text-right">{t("transfers.qty_available")}</TableHead>
                    <TableHead className="text-right">{t("transfers.qty_to_transfer")}</TableHead>
                    {detailStatus === "draft" && <TableHead className="w-10"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(transferDetail?.lines || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={detailStatus === "draft" ? 7 : 6} className="text-center text-muted-foreground py-8">
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
                        <TableCell className="text-right text-muted-foreground">{line.available_qty ?? "-"}</TableCell>
                        <TableCell className="text-right font-semibold">{line.qty}</TableCell>
                        {detailStatus === "draft" && (
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteLineMutation.mutate(line.id)} data-testid={`button-delete-line-${line.id}`}>
                              ×
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter className="flex justify-between items-center">
            <Badge variant={detailStatus === "approved" ? "outline" : "secondary"} className={detailStatus === "approved" ? "border-green-500 text-green-700 bg-green-50" : ""}>
              {t(`transfers.status_${detailStatus}`)}
            </Badge>
            <div className="flex gap-2">
              {detailStatus === "draft" && (
                <Button 
                  onClick={() => approveMutation.mutate(selectedTransfer.id)} 
                  disabled={approveMutation.isPending || !(transferDetail?.lines?.length)}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="button-approve-transfer"
                >
                  <CheckCircle className="w-4 h-4 mr-2" /> {t("transfers.approve")}
                </Button>
              )}
              <Button variant="outline" onClick={() => setSelectedTransfer(null)}>{t("common.close")}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LedgerTab() {
  const { t, lang } = useI18n();
  const [locationId, setLocationId] = useState<string>("all");

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const ledgerUrl = locationId === "all" ? "/api/inventory-ledger" : `/api/inventory-ledger?locationId=${locationId}`;
  const { data: ledger = [] } = useQuery<any[]>({
    queryKey: [ledgerUrl],
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
      <div className="w-full md:w-64">
        <Select value={locationId} onValueChange={setLocationId}>
          <SelectTrigger data-testid="select-ledger-location">
            <SelectValue placeholder={t("inv_balances.all_locations")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("inv_balances.all_locations")}</SelectItem>
            {locations.map(loc => (
              <SelectItem key={loc.id} value={String(loc.id)}>{locLabel(loc)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            {ledger.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  {t("inv_ledger.no_entries")}
                </TableCell>
              </TableRow>
            ) : ledger.map((entry: any, i: number) => (
              <TableRow key={i}>
                <TableCell className="text-xs">{entry.created_at ? new Date(entry.created_at).toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" }) : (entry.createdAt ? new Date(entry.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" }) : "-")}</TableCell>
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

export default function Inventory() {
  const { t } = useI18n();

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center gap-2">
        <Package className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold">{t("nav.inventory")}</h1>
      </div>

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
