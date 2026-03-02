import { useState } from "react";
import { ArrowLeftRight, PackagePlus, AlertCircle, Search, Package, History, ArrowDown, ArrowUp, MapPin } from "lucide-react";
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
  purchase_receipt: "استلام مشتريات",
  sale: "بيع",
  sale_return: "مرتجع",
  internal_transfer: "نقل داخلي",
  manual_receipt: "استلام يدوي",
  adjustment: "تسوية",
};

const LOC_LABELS: Record<string, string> = {
  showroom: "صالة العرض",
  backstore: "المخزن",
};

function LocationInventoryTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canManage = user?.role === "owner" || user?.role === "admin" || user?.role === "manager";
  const isOwner = user?.role === "owner" || user?.role === "admin";
  const [selectedBranch, setSelectedBranch] = useState<string>(isOwner ? "all" : String(user?.branchId));
  const [selectedLocation, setSelectedLocation] = useState<string>(canManage ? "all" : "showroom");
  const [search, setSearch] = useState("");

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const params = new URLSearchParams();
  if (selectedBranch !== "all") params.set("branchId", selectedBranch);
  if (selectedLocation !== "all") params.set("locationCode", selectedLocation);
  const qs = params.toString() ? `?${params.toString()}` : "";

  const { data: inventory = [] } = useQuery<any[]>({
    queryKey: ["/api/location-inventory", selectedBranch, selectedLocation],
    queryFn: async () => {
      const res = await fetch(`/api/location-inventory${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  const filtered = inventory.filter(row => {
    if (!search) return true;
    return row.productName?.includes(search) || row.barcode?.includes(search);
  });

  const totalQty = filtered.reduce((s: number, r: any) => s + (r.qtyOnHand || 0), 0);
  const lowCount = filtered.filter((r: any) => r.qtyOnHand <= r.reorderLevel).length;

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
        {canManage ? (
          <div className="space-y-1 min-w-[180px]">
            <label className="text-sm font-medium">الموقع</label>
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger data-testid="select-inv-location"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="showroom">صالة العرض</SelectItem>
                <SelectItem value="backstore">المخزن</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-1">
            <label className="text-sm font-medium">الموقع</label>
            <Badge variant="outline" className="text-sm px-3 py-2">صالة العرض</Badge>
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
        <Card className="bg-red-50 border-red-100">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="text-red-400 w-6 h-6" />
            <div>
              <p className="text-sm text-red-600">أصناف تحت الحد</p>
              <p className="text-xl font-bold text-red-700" data-testid="text-loc-low-count">{lowCount}</p>
            </div>
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
                <TableHead>الموقع</TableHead>
                <TableHead className="text-center">الكمية المتاحة</TableHead>
                <TableHead className="text-center">حد إعادة الطلب</TableHead>
                <TableHead className="text-center">الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا توجد بيانات مخزون</TableCell></TableRow>
              ) : filtered.map((row: any) => {
                const isLow = row.qtyOnHand <= row.reorderLevel;
                return (
                  <TableRow key={row.id} data-testid={`row-loc-inv-${row.id}`} className={isLow ? "bg-red-50/50" : ""}>
                    <TableCell className="font-medium">{row.productName}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{row.barcode || "—"}</TableCell>
                    {selectedBranch === "all" && <TableCell>{row.branchName}</TableCell>}
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        <MapPin className="w-3 h-3 ml-1 inline" />
                        {LOC_LABELS[row.locationCode] || row.locationName}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-bold text-lg ${isLow ? "text-red-600" : "text-emerald-600"}`}>{row.qtyOnHand}</span>
                    </TableCell>
                    <TableCell className="text-center">{row.reorderLevel}</TableCell>
                    <TableCell className="text-center">
                      {isLow ? (
                        <Badge variant="destructive" className="text-xs">نقص</Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">متوفر</Badge>
                      )}
                    </TableCell>
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
  const isOwner = user?.role === "owner" || user?.role === "admin";
  const [selectedBranch, setSelectedBranch] = useState<string>(String(user?.branchId));
  const [transferData, setTransferData] = useState({ productId: "", quantity: "", note: "" });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: allLocations = [] } = useQuery<any[]>({
    queryKey: ["/api/locations", selectedBranch],
    queryFn: async () => {
      const res = await fetch(`/api/locations?branchId=${selectedBranch}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!selectedBranch,
  });

  const backstoreId = allLocations.find((l: any) => l.code === "backstore")?.id;
  const showroomId = allLocations.find((l: any) => l.code === "showroom")?.id;

  const backstoreParams = new URLSearchParams();
  backstoreParams.set("branchId", selectedBranch);
  backstoreParams.set("locationCode", "backstore");
  const { data: backstoreInv = [] } = useQuery<any[]>({
    queryKey: ["/api/location-inventory", selectedBranch, "backstore"],
    queryFn: async () => {
      const res = await fetch(`/api/location-inventory?${backstoreParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!selectedBranch,
  });

  const selectedProduct = backstoreInv.find((r: any) => String(r.productId) === transferData.productId);

  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!backstoreId || !showroomId) throw new Error("لم يتم العثور على المواقع");
      await apiRequest("POST", "/api/location-inventory/transfer", {
        fromLocationId: backstoreId,
        toLocationId: showroomId,
        productId: parseInt(transferData.productId),
        quantity: parseInt(transferData.quantity),
        note: transferData.note || "نقل من المخزن إلى صالة العرض",
      });
    },
    onSuccess: () => {
      toast({ title: "تم النقل بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/location-inventory"] });
      setTransferData({ productId: "", quantity: "", note: "" });
    },
    onError: (err: Error) => toast({ title: "خطأ", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary" />
            نقل من المخزن إلى صالة العرض
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isOwner && (
              <div className="space-y-2">
                <label className="text-sm font-medium">الفرع</label>
                <Select value={selectedBranch} onValueChange={v => { setSelectedBranch(v); setTransferData({ productId: "", quantity: "", note: "" }); }}>
                  <SelectTrigger data-testid="select-transfer-branch"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">المنتج (من المخزن)</label>
              <Select value={transferData.productId} onValueChange={v => setTransferData({ ...transferData, productId: v })}>
                <SelectTrigger data-testid="select-transfer-product"><SelectValue placeholder="اختر المنتج" /></SelectTrigger>
                <SelectContent>
                  {backstoreInv.filter((r: any) => r.qtyOnHand > 0).map((r: any) => (
                    <SelectItem key={r.productId} value={String(r.productId)}>
                      {r.productName} (متوفر: {r.qtyOnHand})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">الكمية</label>
              <Input
                type="number"
                min="1"
                max={selectedProduct?.qtyOnHand || 999}
                value={transferData.quantity}
                onChange={e => setTransferData({ ...transferData, quantity: e.target.value })}
                data-testid="input-transfer-qty"
              />
              {selectedProduct && (
                <p className="text-xs text-muted-foreground">المتوفر في المخزن: {selectedProduct.qtyOnHand}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">ملاحظة (اختياري)</label>
              <Input value={transferData.note} onChange={e => setTransferData({ ...transferData, note: e.target.value })} data-testid="input-transfer-note" />
            </div>
          </div>
          <Button
            className="mt-4 gap-2"
            onClick={() => transferMutation.mutate()}
            disabled={transferMutation.isPending || !transferData.productId || !transferData.quantity}
            data-testid="button-confirm-transfer"
          >
            <ArrowLeftRight className="w-4 h-4" />
            تنفيذ النقل
          </Button>
        </CardContent>
      </Card>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 border-b bg-muted/30">
          <h4 className="font-bold flex items-center gap-2">
            <Package className="w-4 h-4" />
            محتوى المخزن الخلفي — {branches.find(b => String(b.id) === selectedBranch)?.name || ""}
          </h4>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>المنتج</TableHead>
                <TableHead className="text-center">الكمية في المخزن</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backstoreInv.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-center py-6 text-muted-foreground">المخزن فارغ</TableCell></TableRow>
              ) : backstoreInv.map((r: any) => (
                <TableRow key={r.id} data-testid={`row-backstore-${r.id}`}>
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
        <p className="text-muted-foreground mt-1">تتبع الكميات وحركات المخزون لكل موقع (صالة عرض / مخزن) في كل فرع.</p>
      </div>

      <Tabs defaultValue="stock" dir="rtl">
        <TabsList className={`grid w-full max-w-lg ${canManage ? "grid-cols-3" : "grid-cols-1"}`}>
          <TabsTrigger value="stock" className="gap-1" data-testid="tab-location-stock">
            <MapPin className="w-4 h-4" />
            مخزون المواقع
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
          <LocationInventoryTab />
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
