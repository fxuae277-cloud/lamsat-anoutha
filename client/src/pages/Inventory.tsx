import { useState } from "react";
import { ArrowLeftRight, PackagePlus, AlertCircle, Search, Package, History, ArrowDown, ArrowUp, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import type { Product, Branch } from "@shared/schema";

function BranchInventoryTab() {
  const { user } = useAuth();
  const { t } = useI18n();
  const isOwner = user?.role === "owner" || user?.role === "admin";
  const [selectedBranch, setSelectedBranch] = useState<string>(isOwner ? "all" : String(user?.branchId));
  const [search, setSearch] = useState("");

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const params = new URLSearchParams();
  if (selectedBranch !== "all") params.set("branchId", selectedBranch);
  const qs = params.toString() ? `?${params.toString()}` : "";

  const { data: inventory = [] } = useQuery<any[]>({
    queryKey: ["/api/branch-inventory", selectedBranch],
    queryFn: async () => {
      const res = await fetch(`/api/branch-inventory${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  const filtered = inventory.filter(row => {
    if (!search) return true;
    return row.productName?.toLowerCase().includes(search.toLowerCase()) || row.barcode?.includes(search);
  });

  const totalQty = filtered.reduce((s: number, r: any) => s + Number(r.totalQty || 0), 0);
  const totalValue = filtered.reduce((s: number, r: any) => s + Number(r.totalQty || 0) * parseFloat(r.avgCost || "0"), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        {isOwner && (
          <div className="space-y-1 min-w-[200px]">
            <label className="text-sm font-medium">{t("inventory_page.table_branch")}</label>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger data-testid="select-inv-branch"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("inventory_page.all_branches")}</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="relative min-w-[250px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t("inventory_page.search_placeholder_inv")} className="pr-9" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-loc-inv" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("inventory_page.total_items_qty")}</p>
            <p className="text-2xl font-bold mt-1" data-testid="text-loc-total-qty">{totalQty}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("inventory_page.number_of_items")}</p>
            <p className="text-2xl font-bold mt-1">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("inventory_page.inventory_value_cost")}</p>
            <p className="text-xl font-bold text-emerald-700">{totalValue.toFixed(3)} OMR</p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>{t("inventory_page.table_product")}</TableHead>
                <TableHead>{t("inventory_page.table_barcode")}</TableHead>
                {selectedBranch === "all" && <TableHead>{t("inventory_page.table_branch")}</TableHead>}
                <TableHead className="text-center">{t("inventory_page.table_quantity")}</TableHead>
                <TableHead className="text-center">{t("inventory_page.table_avg_cost")}</TableHead>
                <TableHead className="text-center">{t("inventory_page.table_sale_price")}</TableHead>
                <TableHead className="text-center">{t("inventory_page.table_inventory_value")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("inventory_page.no_inventory_data")}</TableCell></TableRow>
              ) : filtered.map((row: any, idx: number) => {
                const qty = Number(row.totalQty || 0);
                const cost = parseFloat(row.avgCost || "0");
                const val = qty * cost;
                return (
                  <TableRow key={`${row.branchId}-${row.productId}`} data-testid={`row-branch-inv-${idx}`}>
                    <TableCell className="font-medium">{row.productName}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{row.barcode || "—"}</TableCell>
                    {selectedBranch === "all" && <TableCell>{row.branchName}</TableCell>}
                    <TableCell className="text-center">
                      <span className={`font-bold text-lg ${qty <= 0 ? "text-red-600" : "text-emerald-600"}`}>{qty}</span>
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">{cost.toFixed(3)}</TableCell>
                    <TableCell className="text-center font-mono text-sm">{parseFloat(row.price || "0").toFixed(3)}</TableCell>
                    <TableCell className="text-center font-mono text-sm font-medium">{val.toFixed(3)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function InternalTransferTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useI18n();
  const isOwner = user?.role === "owner" || user?.role === "admin";
  const [selectedBranch, setSelectedBranch] = useState<string>(String(user?.branchId));
  const [items, setItems] = useState<{ productId: string; qty: string }[]>([]);
  const [addProduct, setAddProduct] = useState("");
  const [addQty, setAddQty] = useState("");

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: centralInv = [] } = useQuery<any[]>({
    queryKey: ["/api/central-inventory"],
    queryFn: async () => {
      const res = await fetch("/api/central-inventory", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  const centralInvMap = Object.fromEntries(centralInv.map((r: any) => [String(r.productId), r.qtyOnHand]));

  const { data: transfers = [] } = useQuery<any[]>({
    queryKey: ["/api/inventory-transfers", selectedBranch],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (selectedBranch !== "all") p.set("branchId", selectedBranch);
      const qs = p.toString() ? `?${p.toString()}` : "";
      const res = await fetch(`/api/inventory-transfers${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  const transferMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/inventory-transfers", {
        branchId: Number(selectedBranch),
        items: items.map(i => ({ productId: Number(i.productId), qty: Number(i.qty) })),
      });
    },
    onSuccess: () => {
      toast({ title: t("inventory_page.transfer_success") });
      queryClient.invalidateQueries({ queryKey: ["/api/central-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/location-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-transfers"] });
      setItems([]);
      setAddProduct(""); setAddQty("");
    },
    onError: (err: Error) => toast({ title: t("common.error"), description: err.message, variant: "destructive" }),
  });

  function addItem() {
    if (!addProduct || !addQty || Number(addQty) <= 0) return;
    if (items.find(i => i.productId === addProduct)) {
      toast({ title: t("inventory_page.item_already_added"), variant: "destructive" });
      return;
    }
    setItems([...items, { productId: addProduct, qty: addQty }]);
    setAddProduct(""); setAddQty("");
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary" />
            {t("inventory_page.transfer_central_to_branch")}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">{t("inventory_page.transfer_desc")}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("inventory_page.receiving_branch")}</label>
              <Select value={selectedBranch} onValueChange={v => { setSelectedBranch(v); setItems([]); }}>
                <SelectTrigger data-testid="select-transfer-branch"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-3 p-3 bg-muted/30 rounded-lg border">
              <div className="space-y-1 min-w-[200px] flex-1">
                <label className="text-sm font-medium">{t("inventory_page.item_from_central")}</label>
                <Select value={addProduct} onValueChange={setAddProduct}>
                  <SelectTrigger data-testid="select-transfer-product"><SelectValue placeholder={t("inventory_page.select_item_placeholder")} /></SelectTrigger>
                  <SelectContent>
                    {centralInv.filter((r: any) => r.qtyOnHand > 0).map((r: any) => (
                      <SelectItem key={r.productId} value={String(r.productId)}>
                        {t("inventory_page.available_qty", [r.productName, r.qtyOnHand])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 w-28">
                <label className="text-sm font-medium">{t("inventory_page.table_quantity")}</label>
                <Input type="number" min="1" max={centralInvMap[addProduct] || 999} value={addQty} onChange={e => setAddQty(e.target.value)} data-testid="input-transfer-qty" />
              </div>
              <Button onClick={addItem} disabled={!addProduct || !addQty} data-testid="button-add-transfer-item">
                <PackagePlus className="w-4 h-4 ml-1" /> {t("inventory_page.add_item")}
              </Button>
            </div>

            {items.length > 0 && (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>{t("inventory_page.table_product")}</TableHead>
                    <TableHead className="text-center">{t("inventory_page.requested_qty")}</TableHead>
                    <TableHead className="text-center">{t("inventory_page.available_in_central")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it, idx) => {
                    const inv = centralInv.find((r: any) => String(r.productId) === it.productId);
                    return (
                      <TableRow key={idx}>
                        <TableCell>{inv?.productName || it.productId}</TableCell>
                        <TableCell className="text-center font-bold">{it.qty}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{centralInvMap[it.productId] || 0}</TableCell>
                        <TableCell className="text-center">
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => removeItem(idx)}>{t("inventory_page.remove")}</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {items.length > 0 && (
              <div className="flex justify-end">
                <Button
                  className="gap-2"
                  onClick={() => transferMutation.mutate()}
                  disabled={transferMutation.isPending}
                  data-testid="button-confirm-transfer"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  {t("inventory_page.transfer_confirm_btn", [items.length])}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {centralInv.length > 0 && (
        <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
          <div className="p-4 border-b bg-muted/30">
            <h4 className="font-bold flex items-center gap-2">
              <Package className="w-4 h-4" />
              {t("inventory_page.central_inventory_stock")}
            </h4>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>{t("inventory_page.table_product")}</TableHead>
                  <TableHead className="text-center">{t("inventory_page.table_quantity")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {centralInv.map((r: any) => (
                  <TableRow key={r.id} data-testid={`row-central-${r.id}`}>
                    <TableCell className="font-medium">{r.productName}</TableCell>
                    <TableCell className="text-center">
                      <span className={`font-bold text-lg ${r.qtyOnHand > 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {r.qtyOnHand}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {transfers.length > 0 && (
        <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
          <div className="p-4 border-b bg-muted/30">
            <h4 className="font-bold flex items-center gap-2">
              <History className="w-4 h-4" />
              {t("inventory_page.transfer_history")}
            </h4>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>{t("inventory_page.table_id")}</TableHead>
                  <TableHead>{t("inventory_page.table_date")}</TableHead>
                  <TableHead>{t("inventory_page.table_branch")}</TableHead>
                  <TableHead>{t("inventory_page.table_from")}</TableHead>
                  <TableHead>{t("inventory_page.table_to")}</TableHead>
                  <TableHead>{t("inventory_page.table_items")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((tx: any) => (
                  <TableRow key={tx.id} data-testid={`row-transfer-${tx.id}`}>
                    <TableCell className="font-mono text-xs">{tx.id}</TableCell>
                    <TableCell className="text-sm">{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString(t("lang") === "ar" ? "ar-OM" : "en-US") : "—"}</TableCell>
                    <TableCell className="text-sm font-medium">{tx.branchName}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{tx.fromLocationName}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{tx.toLocationName}</Badge></TableCell>
                    <TableCell className="text-xs">
                      {tx.items && Array.isArray(tx.items) ? tx.items.map((it: any, i: number) => (
                        <span key={i} className="inline-block bg-muted rounded px-2 py-0.5 ml-1 mb-1">
                          {it.productName} × {it.qty}
                        </span>
                      )) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

function TransactionsTab() {
  const { user } = useAuth();
  const { t } = useI18n();
  const isOwner = user?.role === "owner" || user?.role === "admin";
  const [selectedBranch, setSelectedBranch] = useState<string>(isOwner ? "all" : String(user?.branchId));
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const params = new URLSearchParams();
  if (selectedBranch !== "all") params.set("branchId", selectedBranch);
  if (typeFilter !== "all") params.set("type", typeFilter);
  const qs = params.toString() ? `?${params.toString()}` : "";

  const { data: transactions = [] } = useQuery<any[]>({
    queryKey: ["/api/location-inventory/transactions", selectedBranch, typeFilter],
    queryFn: async () => {
      const res = await fetch(`/api/location-inventory/transactions${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        {isOwner && (
          <div className="space-y-1 min-w-[200px]">
            <label className="text-sm font-medium">{t("inventory_page.table_branch")}</label>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger data-testid="select-tx-branch"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("inventory_page.all_branches")}</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1 min-w-[180px]">
          <label className="text-sm font-medium">{t("inventory_page.transaction_type")}</label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger data-testid="select-tx-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {Object.entries(t("inventory_page.tx_type_labels") as unknown as Record<string, string>).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>{t("inventory_page.table_id")}</TableHead>
                <TableHead>{t("inventory_page.table_date")}</TableHead>
                <TableHead>{t("inventory_page.table_branch")}</TableHead>
                <TableHead>{t("inventory_page.table_product")}</TableHead>
                <TableHead>{t("common.type")}</TableHead>
                <TableHead className="text-center">{t("inventory_page.table_quantity")}</TableHead>
                <TableHead>{t("inventory_page.note")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("inventory_page.no_transactions")}</TableCell></TableRow>
              ) : transactions.map((tx: any) => {
                const isSale = tx.type === "sale";
                const labels = t("inventory_page.tx_type_labels") as unknown as Record<string, string>;
                return (
                  <TableRow key={tx.id} data-testid={`row-tx-${tx.id}`}>
                    <TableCell className="font-mono text-xs">{tx.id}</TableCell>
                    <TableCell className="text-sm">{tx.date ? new Date(tx.date).toLocaleDateString(t("lang") === "ar" ? "ar-OM" : "en-US") : "—"}</TableCell>
                    <TableCell className="text-sm">{tx.branchName}</TableCell>
                    <TableCell className="font-medium">{tx.productName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {labels[tx.type] || tx.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {isSale ? (
                        <span className="text-red-600 font-bold flex items-center justify-center gap-1">
                          <ArrowUp className="w-3 h-3" />-{tx.qty}
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-bold flex items-center justify-center gap-1">
                          <ArrowDown className="w-3 h-3" />+{tx.qty}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{tx.note || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

export default function Inventory() {
  const { user } = useAuth();
  const { t } = useI18n();
  const canManage = user?.role === "owner" || user?.role === "admin" || user?.role === "manager";

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-inventory-title">{t("inventory_page.inventory_management")}</h1>
        <p className="text-muted-foreground mt-1">{t("inventory_page.track_inventory_desc")}</p>
      </div>
      <div className="flex justify-end">
        <Button variant="outline" className="gap-2" onClick={() => window.open("/api/exports/inventory.xlsx", "_blank")} data-testid="button-export-inventory-xlsx">
          <FileSpreadsheet className="w-4 h-4" />
          {t("inventory_page.export_inventory_excel")}
        </Button>
      </div>

      <Tabs defaultValue="stock" dir={t("dir")}>
        <TabsList className={`grid w-full max-w-lg ${canManage ? "grid-cols-3" : "grid-cols-1"}`}>
          <TabsTrigger value="stock" className="gap-1" data-testid="tab-location-stock">
            <Package className="w-4 h-4" />
            {t("inventory_page.tab_branch_stock")}
          </TabsTrigger>
          {canManage && (
            <TabsTrigger value="transfer" className="gap-1" data-testid="tab-internal-transfer">
              <ArrowLeftRight className="w-4 h-4" />
              {t("inventory_page.tab_transfer")}
            </TabsTrigger>
          )}
          {canManage && (
            <TabsTrigger value="transactions" className="gap-1" data-testid="tab-transactions">
              <History className="w-4 h-4" />
              {t("inventory_page.tab_transactions")}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="stock">
          <BranchInventoryTab />
        </TabsContent>
        {canManage && (
          <TabsContent value="transfer">
            <InternalTransferTab />
          </TabsContent>
        )}
        {canManage && (
          <TabsContent value="transactions">
            <TransactionsTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
