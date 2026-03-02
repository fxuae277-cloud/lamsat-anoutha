import { useState } from "react";
import { ArrowLeftRight, PackagePlus, AlertCircle, Search, Package, History, ArrowDown, ArrowUp } from "lucide-react";
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
import type { Product, Branch } from "@shared/schema";

const TX_TYPE_LABELS: Record<string, string> = {
  PURCHASE: "مشتريات",
  purchase_receipt: "استلام مشتريات",
  TRANSFER_OUT: "صادر تحويل",
  TRANSFER_IN: "وارد تحويل",
  sale: "بيع",
  sale_return: "مرتجع",
  internal_transfer: "نقل داخلي",
  manual_receipt: "استلام يدوي",
  adjustment: "تسوية",
};

function BranchInventoryTab() {
  const { user } = useAuth();
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
    return row.productName?.includes(search) || row.barcode?.includes(search);
  });

  const totalQty = filtered.reduce((s: number, r: any) => s + Number(r.totalQty || 0), 0);
  const totalValue = filtered.reduce((s: number, r: any) => s + Number(r.totalQty || 0) * parseFloat(r.avgCost || "0"), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        {isOwner && (
          <div className="space-y-1 min-w-[200px]">
            <label className="text-sm font-medium">الفرع</label>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger data-testid="select-inv-branch"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفروع</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="relative min-w-[250px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="بحث بالاسم أو الباركود..." className="pr-9" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-loc-inv" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">إجمالي القطع</p>
            <p className="text-2xl font-bold mt-1" data-testid="text-loc-total-qty">{totalQty}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">عدد الأصناف</p>
            <p className="text-2xl font-bold mt-1">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">قيمة المخزون (تكلفة)</p>
            <p className="text-xl font-bold text-emerald-700">{totalValue.toFixed(3)} OMR</p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>المنتج</TableHead>
                <TableHead>الباركود</TableHead>
                {selectedBranch === "all" && <TableHead>الفرع</TableHead>}
                <TableHead className="text-center">الكمية</TableHead>
                <TableHead className="text-center">متوسط التكلفة</TableHead>
                <TableHead className="text-center">سعر البيع</TableHead>
                <TableHead className="text-center">قيمة المخزون</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا توجد بيانات مخزون</TableCell></TableRow>
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

const LOC_TYPE_LABELS: Record<string, string> = {
  MAIN_WAREHOUSE: "مخزن رئيسي",
  SUB_WAREHOUSE: "مخزن فرعي",
  SHOWROOM: "صالة عرض",
};

function InternalTransferTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isOwner = user?.role === "owner" || user?.role === "admin";
  const [selectedBranch, setSelectedBranch] = useState<string>(String(user?.branchId));
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [items, setItems] = useState<{ productId: string; qty: string }[]>([]);
  const [addProduct, setAddProduct] = useState("");
  const [addQty, setAddQty] = useState("");

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: branchLocations = [] } = useQuery<any[]>({
    queryKey: ["/api/locations", selectedBranch],
    queryFn: async () => {
      const res = await fetch(`/api/locations?branchId=${selectedBranch}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!selectedBranch,
  });

  const fromInvParams = new URLSearchParams();
  if (fromLocationId) {
    fromInvParams.set("branchId", selectedBranch);
  }
  const { data: fromInv = [] } = useQuery<any[]>({
    queryKey: ["/api/location-inventory", selectedBranch, fromLocationId],
    queryFn: async () => {
      const res = await fetch(`/api/location-inventory?branchId=${selectedBranch}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      const all = await res.json();
      return all.filter((r: any) => String(r.locationId) === fromLocationId);
    },
    enabled: !!selectedBranch && !!fromLocationId,
  });

  const productMap = Object.fromEntries(allProducts.map(p => [p.id, p.name]));
  const fromInvMap = Object.fromEntries(fromInv.map((r: any) => [String(r.productId), r.qtyOnHand]));

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
        fromLocationId: Number(fromLocationId),
        toLocationId: Number(toLocationId),
        items: items.map(i => ({ productId: Number(i.productId), qty: Number(i.qty) })),
      });
    },
    onSuccess: () => {
      toast({ title: "تم التحويل بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/location-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-transfers"] });
      setItems([]);
      setAddProduct(""); setAddQty("");
    },
    onError: (err: Error) => toast({ title: "خطأ", description: err.message, variant: "destructive" }),
  });

  function addItem() {
    if (!addProduct || !addQty || Number(addQty) <= 0) return;
    if (items.find(i => i.productId === addProduct)) {
      toast({ title: "الصنف مضاف مسبقاً", variant: "destructive" });
      return;
    }
    setItems([...items, { productId: addProduct, qty: addQty }]);
    setAddProduct(""); setAddQty("");
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  const mainLoc = branchLocations.find((l: any) => l.isMain);
  const otherLocs = branchLocations.filter((l: any) => !l.isMain);

  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary" />
            تحويل مخزون بين المواقع
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {isOwner && (
              <div className="space-y-2">
                <label className="text-sm font-medium">الفرع</label>
                <Select value={selectedBranch} onValueChange={v => { setSelectedBranch(v); setFromLocationId(""); setToLocationId(""); setItems([]); }}>
                  <SelectTrigger data-testid="select-transfer-branch"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">من موقع</label>
              <Select value={fromLocationId} onValueChange={v => { setFromLocationId(v); setItems([]); }}>
                <SelectTrigger data-testid="select-from-location"><SelectValue placeholder="اختر الموقع المصدر" /></SelectTrigger>
                <SelectContent>
                  {branchLocations.map((l: any) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.name} ({LOC_TYPE_LABELS[l.type] || l.type}){l.isMain ? " ★" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">إلى موقع</label>
              <Select value={toLocationId} onValueChange={setToLocationId}>
                <SelectTrigger data-testid="select-to-location"><SelectValue placeholder="اختر الوجهة" /></SelectTrigger>
                <SelectContent>
                  {branchLocations.filter((l: any) => String(l.id) !== fromLocationId).map((l: any) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.name} ({LOC_TYPE_LABELS[l.type] || l.type}){l.isMain ? " ★" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {fromLocationId && toLocationId && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-3 p-3 bg-muted/30 rounded-lg border">
                <div className="space-y-1 min-w-[200px] flex-1">
                  <label className="text-sm font-medium">الصنف</label>
                  <Select value={addProduct} onValueChange={setAddProduct}>
                    <SelectTrigger data-testid="select-transfer-product"><SelectValue placeholder="اختر صنف..." /></SelectTrigger>
                    <SelectContent>
                      {fromInv.filter((r: any) => r.qtyOnHand > 0).map((r: any) => (
                        <SelectItem key={r.productId} value={String(r.productId)}>
                          {r.productName} (متوفر: {r.qtyOnHand})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 w-28">
                  <label className="text-sm font-medium">الكمية</label>
                  <Input type="number" min="1" max={fromInvMap[addProduct] || 999} value={addQty} onChange={e => setAddQty(e.target.value)} data-testid="input-transfer-qty" />
                </div>
                <Button onClick={addItem} disabled={!addProduct || !addQty} data-testid="button-add-transfer-item">
                  <PackagePlus className="w-4 h-4 ml-1" /> إضافة
                </Button>
              </div>

              {items.length > 0 && (
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>الصنف</TableHead>
                      <TableHead className="text-center">الكمية</TableHead>
                      <TableHead className="text-center">المتوفر</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((it, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{productMap[Number(it.productId)] || it.productId}</TableCell>
                        <TableCell className="text-center font-bold">{it.qty}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{fromInvMap[it.productId] || 0}</TableCell>
                        <TableCell className="text-center">
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => removeItem(idx)}>حذف</Button>
                        </TableCell>
                      </TableRow>
                    ))}
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
                    تنفيذ التحويل ({items.length} صنف)
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {transfers.length > 0 && (
        <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
          <div className="p-4 border-b bg-muted/30">
            <h4 className="font-bold flex items-center gap-2">
              <History className="w-4 h-4" />
              سجل التحويلات
            </h4>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الفرع</TableHead>
                  <TableHead>من</TableHead>
                  <TableHead>إلى</TableHead>
                  <TableHead>ملاحظة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((tx: any) => (
                  <TableRow key={tx.id} data-testid={`row-transfer-${tx.id}`}>
                    <TableCell className="font-mono text-xs">{tx.id}</TableCell>
                    <TableCell className="text-sm">{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString("ar-OM") : "—"}</TableCell>
                    <TableCell className="text-sm">{tx.branchName}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{tx.fromLocationName}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{tx.toLocationName}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{tx.note || "—"}</TableCell>
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
            <label className="text-sm font-medium">الفرع</label>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger data-testid="select-tx-branch"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفروع</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1 min-w-[180px]">
          <label className="text-sm font-medium">نوع الحركة</label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger data-testid="select-tx-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              {Object.entries(TX_TYPE_LABELS).map(([k, v]) => (
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
                <TableHead>#</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>الفرع</TableHead>
                <TableHead>المنتج</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead className="text-center">الكمية</TableHead>
                <TableHead>ملاحظة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا توجد حركات مخزون</TableCell></TableRow>
              ) : transactions.map((tx: any) => {
                const isSale = tx.type === "sale";
                return (
                  <TableRow key={tx.id} data-testid={`row-tx-${tx.id}`}>
                    <TableCell className="font-mono text-xs">{tx.id}</TableCell>
                    <TableCell className="text-sm">{tx.date}</TableCell>
                    <TableCell className="text-sm">{tx.branchName}</TableCell>
                    <TableCell className="font-medium">{tx.productName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {TX_TYPE_LABELS[tx.type] || tx.type}
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
  const canManage = user?.role === "owner" || user?.role === "admin" || user?.role === "manager";
  const tabCount = canManage ? 3 : 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-inventory-title">إدارة المخزون</h1>
        <p className="text-muted-foreground mt-1">تتبع الكميات وحركات المخزون لكل فرع.</p>
      </div>

      <Tabs defaultValue="stock" dir="rtl">
        <TabsList className={`grid w-full max-w-lg ${canManage ? "grid-cols-3" : "grid-cols-1"}`}>
          <TabsTrigger value="stock" className="gap-1" data-testid="tab-location-stock">
            <Package className="w-4 h-4" />
            مخزون الفروع
          </TabsTrigger>
          {canManage && (
            <TabsTrigger value="transfer" className="gap-1" data-testid="tab-internal-transfer">
              <ArrowLeftRight className="w-4 h-4" />
              نقل داخلي
            </TabsTrigger>
          )}
          {canManage && (
            <TabsTrigger value="transactions" className="gap-1" data-testid="tab-transactions">
              <History className="w-4 h-4" />
              حركات المخزون
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
