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
    b.productName?.toLowerCase().includes(search.toLowerCase()) || 
    b.barcode?.includes(search)
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
              <TableHead>{t("inv_balances.location")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((b, i) => (
              <TableRow key={i} className={b.qtyOnHand < 5 ? "bg-red-50" : ""}>
                <TableCell className="font-medium">{b.productName}</TableCell>
                <TableCell className="font-mono text-xs">{b.barcode}</TableCell>
                <TableCell>{b.color || "-"}</TableCell>
                <TableCell>{b.size || "-"}</TableCell>
                <TableCell className={`text-right font-bold ${b.qtyOnHand < 5 ? "text-red-600" : ""}`}>
                  {b.qtyOnHand}
                  {b.qtyOnHand < 5 && <Badge variant="destructive" className="ml-2 text-[10px] h-4">{t("inv_balances.low_stock")}</Badge>}
                </TableCell>
                <TableCell className="text-right font-mono">{Number(b.price).toFixed(3)}</TableCell>
                <TableCell>{b.full_location_name || b.locationName}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function TransfersTab() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);
  const [fromLoc, setFromLoc] = useState("");
  const [toLoc, setToLoc] = useState("");
  const [scanBarcode, setScanBarcode] = useState("");

  const { data: transfers = [], refetch: refetchTransfers } = useQuery<any[]>({
    queryKey: ["/api/stock-transfers"],
  });

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
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
      setSelectedTransfer(null);
    },
    onError: (err: any) => toast({ title: t("common.error"), description: err.message, variant: "destructive" })
  });

  const addLineMutation = useMutation({
    mutationFn: async ({ id, barcode, qty }: { id: number, barcode: string, qty: number }) => {
      const res = await fetch(`/api/variants/barcode/${barcode}`);
      if (!res.ok) throw new Error(t("pos.product_not_found"));
      const variant = await res.json();
      await apiRequest("POST", `/api/stock-transfers/${id}/lines`, { variantId: variant.id, qty });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock-transfers"] });
      setScanBarcode("");
    },
    onError: (err: any) => toast({ title: t("common.error"), description: err.message, variant: "destructive" })
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-transfer">
          <Plus className="w-4 h-4 mr-2" /> {t("transfers.create_transfer")}
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.date")}</TableHead>
              <TableHead>{t("transfers.from_location")}</TableHead>
              <TableHead>{t("transfers.to_location")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead>{t("common.employee")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transfers.map((tx) => (
              <TableRow key={tx.id} className="cursor-pointer" onClick={() => setSelectedTransfer(tx)}>
                <TableCell>{new Date(tx.createdAt).toLocaleDateString(lang === "ar" ? "ar-OM" : "en-US")}</TableCell>
                <TableCell>{tx.fromLocationName}</TableCell>
                <TableCell>{tx.toLocationName}</TableCell>
                <TableCell>
                  <Badge variant={tx.status === "approved" ? "outline" : tx.status === "cancelled" ? "destructive" : "secondary"} className={tx.status === "approved" ? "border-green-500 text-green-700 bg-green-50" : ""}>
                    {t(`transfers.status_${tx.status}`)}
                  </Badge>
                </TableCell>
                <TableCell>{tx.creatorName}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedTransfer(tx); }} data-testid={`button-view-transfer-${tx.id}`}>
                    <Search className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("transfers.create_transfer")}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("transfers.from_location")}</label>
              <Select value={fromLoc} onValueChange={setFromLoc}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {locations.map(l => <SelectItem key={l.id} value={String(l.id)}>{locLabel(l)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("transfers.to_location")}</label>
              <Select value={toLoc} onValueChange={setToLoc}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {locations.filter(l => String(l.id) !== fromLoc).map(l => <SelectItem key={l.id} value={String(l.id)}>{locLabel(l)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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

      <Dialog open={!!selectedTransfer} onOpenChange={(open) => !open && setSelectedTransfer(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("transfers.title")} #{selectedTransfer?.id}</DialogTitle>
            <DialogDescription>
              {selectedTransfer?.fromLocationName} <ArrowRightLeft className="inline w-3 h-3 mx-1" /> {selectedTransfer?.toLocationName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedTransfer?.status === "draft" && (
              <div className="flex gap-2 p-2 bg-muted rounded-md">
                <Input 
                  placeholder={t("transfers.scan_barcode")} 
                  value={scanBarcode} 
                  onChange={e => setScanBarcode(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addLineMutation.mutate({ id: selectedTransfer.id, barcode: scanBarcode, qty: 1 })}
                  data-testid="input-transfer-barcode"
                />
                <BarcodeScanButton onScan={code => addLineMutation.mutate({ id: selectedTransfer.id, barcode: code, qty: 1 })} />
              </div>
            )}

            <div className="border rounded-md max-h-60 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("inv_balances.product")}</TableHead>
                    <TableHead>{t("transfers.qty")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedTransfer?.lines?.map((line: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{line.productName} ({line.color}/{line.size})</TableCell>
                      <TableCell>{line.qty}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter className="flex justify-between items-center">
            <Badge variant={selectedTransfer?.status === "approved" ? "outline" : "secondary"} className={selectedTransfer?.status === "approved" ? "border-green-500 text-green-700 bg-green-50" : ""}>
              {t(`transfers.status_${selectedTransfer?.status}`)}
            </Badge>
            <div className="flex gap-2">
              {selectedTransfer?.status === "draft" && (
                <Button 
                  onClick={() => approveMutation.mutate(selectedTransfer.id)} 
                  disabled={approveMutation.isPending || !selectedTransfer.lines?.length}
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
              <TableHead>{t("inv_balances.product")}</TableHead>
              <TableHead>{t("products.barcode")}</TableHead>
              <TableHead>{t("inv_balances.location")}</TableHead>
              <TableHead className="text-right">{t("ledger.qty_change")}</TableHead>
              <TableHead>{t("ledger.reason")}</TableHead>
              <TableHead>{t("ledger.date")}</TableHead>
              <TableHead>{t("common.employee")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ledger.map((entry, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{entry.productName}</TableCell>
                <TableCell className="font-mono text-xs">{entry.barcode}</TableCell>
                <TableCell>{entry.locationName}</TableCell>
                <TableCell className={`text-right font-bold ${entry.qtyChange > 0 ? "text-green-600" : "text-red-600"}`}>
                  {entry.qtyChange > 0 ? `+${entry.qtyChange}` : entry.qtyChange}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={getReasonColor(entry.reason)}>
                    {t(`ledger.${entry.reason}`)}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{new Date(entry.createdAt).toLocaleString(lang === "ar" ? "ar-OM" : "en-US")}</TableCell>
                <TableCell>{entry.userName}</TableCell>
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
