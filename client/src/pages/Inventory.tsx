import { useState } from "react";
import { ArrowLeftRight, PackagePlus, AlertCircle, Search, Package, History, ArrowDown, ArrowUp, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  transfer_in: "تحويل وارد",
  transfer_out: "تحويل صادر",
  manual_receipt: "استلام يدوي",
  adjustment: "تسوية",
};

function BranchInventoryTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isOwner = user?.role === "owner" || user?.role === "admin";
  const [selectedBranch, setSelectedBranch] = useState<string>(isOwner ? "all" : String(user?.branchId));
  const [search, setSearch] = useState("");
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [receiveData, setReceiveData] = useState({ branchId: "", productId: "", quantity: "", note: "" });
  const [transferData, setTransferData] = useState({ fromBranchId: "", toBranchId: "", productId: "", quantity: "" });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const branchParam = selectedBranch !== "all" ? `?branchId=${selectedBranch}` : "";
  const { data: inventory = [] } = useQuery<any[]>({
    queryKey: ["/api/branch-inventory", selectedBranch],
    queryFn: async () => {
      const res = await fetch(`/api/branch-inventory${branchParam}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  const filtered = inventory.filter(row => {
    if (!search) return true;
    return row.productName?.includes(search) || row.barcode?.includes(search);
  });

  const totalQty = filtered.reduce((s, r) => s + (r.qtyOnHand || 0), 0);

  const receiveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/branch-inventory/receive", {
        branchId: parseInt(receiveData.branchId),
        productId: parseInt(receiveData.productId),
        quantity: parseInt(receiveData.quantity),
        note: receiveData.note || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "تم استلام البضاعة بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/branch-inventory"] });
      setReceiveOpen(false);
      setReceiveData({ branchId: "", productId: "", quantity: "", note: "" });
    },
    onError: (err: Error) => toast({ title: "خطأ", description: err.message, variant: "destructive" }),
  });

  const transferMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/branch-inventory/transfer", {
        fromBranchId: parseInt(transferData.fromBranchId),
        toBranchId: parseInt(transferData.toBranchId),
        productId: parseInt(transferData.productId),
        quantity: parseInt(transferData.quantity),
      });
    },
    onSuccess: () => {
      toast({ title: "تم التحويل بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/branch-inventory"] });
      setTransferOpen(false);
      setTransferData({ fromBranchId: "", toBranchId: "", productId: "", quantity: "" });
    },
    onError: (err: Error) => toast({ title: "خطأ", description: err.message, variant: "destructive" }),
  });

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
          <Input placeholder="بحث بالاسم أو الباركود..." className="pr-9" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-branch-inv" />
        </div>
        <div className="flex gap-2 mr-auto">
          <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="button-branch-receive">
                <PackagePlus className="w-4 h-4" />
                استلام بضاعة
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>استلام بضاعة يدوي</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">الفرع</label>
                  <Select value={receiveData.branchId} onValueChange={v => setReceiveData({ ...receiveData, branchId: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                    <SelectContent>
                      {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">المنتج</label>
                  <Select value={receiveData.productId} onValueChange={v => setReceiveData({ ...receiveData, productId: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر المنتج" /></SelectTrigger>
                    <SelectContent>
                      {products.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">الكمية</label>
                  <Input type="number" min="1" value={receiveData.quantity} onChange={e => setReceiveData({ ...receiveData, quantity: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">ملاحظة</label>
                  <Input value={receiveData.note} onChange={e => setReceiveData({ ...receiveData, note: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => receiveMutation.mutate()} disabled={receiveMutation.isPending} data-testid="button-confirm-branch-receive">تأكيد الاستلام</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-branch-transfer">
                <ArrowLeftRight className="w-4 h-4" />
                تحويل بين الفروع
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>تحويل مخزون بين الفروع</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">من فرع</label>
                  <Select value={transferData.fromBranchId} onValueChange={v => setTransferData({ ...transferData, fromBranchId: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر الفرع المرسل" /></SelectTrigger>
                    <SelectContent>
                      {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">إلى فرع</label>
                  <Select value={transferData.toBranchId} onValueChange={v => setTransferData({ ...transferData, toBranchId: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر الفرع المستلم" /></SelectTrigger>
                    <SelectContent>
                      {branches.filter(b => String(b.id) !== transferData.fromBranchId).map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">المنتج</label>
                  <Select value={transferData.productId} onValueChange={v => setTransferData({ ...transferData, productId: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر المنتج" /></SelectTrigger>
                    <SelectContent>
                      {products.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">الكمية</label>
                  <Input type="number" min="1" value={transferData.quantity} onChange={e => setTransferData({ ...transferData, quantity: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => transferMutation.mutate()} disabled={transferMutation.isPending} data-testid="button-confirm-branch-transfer">تأكيد التحويل</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">إجمالي القطع</p>
            <p className="text-2xl font-bold mt-1" data-testid="text-branch-total-qty">{totalQty}</p>
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
              <p className="text-xl font-bold text-red-700" data-testid="text-branch-low-count">
                {filtered.filter(r => r.qtyOnHand <= r.reorderLevel).length}
              </p>
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
                <TableHead className="text-center">الكمية المتاحة</TableHead>
                <TableHead className="text-center">المحجوز</TableHead>
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
                  <TableRow key={row.id} data-testid={`row-branch-inv-${row.id}`} className={isLow ? "bg-red-50/50" : ""}>
                    <TableCell className="font-medium">{row.productName}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{row.barcode || "—"}</TableCell>
                    {selectedBranch === "all" && <TableCell>{row.branchName}</TableCell>}
                    <TableCell className="text-center">
                      <span className={`font-bold text-lg ${isLow ? "text-red-600" : "text-emerald-600"}`}>{row.qtyOnHand}</span>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">{row.qtyReserved}</TableCell>
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
    queryKey: ["/api/branch-inventory/transactions", selectedBranch, typeFilter],
    queryFn: async () => {
      const res = await fetch(`/api/branch-inventory/transactions${qs}`, { credentials: "include" });
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
                <TableHead className="text-center">وارد</TableHead>
                <TableHead className="text-center">صادر</TableHead>
                <TableHead>ملاحظة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">لا توجد حركات مخزون</TableCell></TableRow>
              ) : transactions.map((tx: any) => (
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
                    {tx.qtyIn > 0 ? (
                      <span className="text-emerald-600 font-bold flex items-center justify-center gap-1">
                        <ArrowDown className="w-3 h-3" />+{tx.qtyIn}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {tx.qtyOut > 0 ? (
                      <span className="text-red-600 font-bold flex items-center justify-center gap-1">
                        <ArrowUp className="w-3 h-3" />-{tx.qtyOut}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{tx.note || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function LowStockTab() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner" || user?.role === "admin";
  const [selectedBranch, setSelectedBranch] = useState<string>(isOwner ? "all" : String(user?.branchId));

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const branchParam = selectedBranch !== "all" ? `?branchId=${selectedBranch}` : "";
  const { data: lowStock = [] } = useQuery<any[]>({
    queryKey: ["/api/branch-inventory/low-stock", selectedBranch],
    queryFn: async () => {
      const res = await fetch(`/api/branch-inventory/low-stock${branchParam}`, { credentials: "include" });
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
              <SelectTrigger data-testid="select-low-branch"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفروع</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {lowStock.length === 0 ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-8 text-center">
            <Package className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-lg font-medium text-emerald-700">جميع الأصناف فوق حد إعادة الطلب</p>
            <p className="text-sm text-emerald-600 mt-1">لا توجد نواقص حالياً</p>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
          <div className="p-4 border-b bg-red-50">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="font-bold text-red-700">{lowStock.length} صنف يحتاج إعادة طلب</span>
            </div>
          </div>
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>المنتج</TableHead>
                <TableHead>الفرع</TableHead>
                <TableHead className="text-center">الكمية المتاحة</TableHead>
                <TableHead className="text-center">حد إعادة الطلب</TableHead>
                <TableHead className="text-center">النقص</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lowStock.map((item: any) => {
                const deficit = Math.max(0, item.reorderLevel - item.qtyOnHand);
                return (
                  <TableRow key={item.id} className="bg-red-50/30" data-testid={`row-low-${item.id}`}>
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell>{item.branchName}</TableCell>
                    <TableCell className="text-center">
                      <span className="text-red-600 font-bold text-lg">{item.qtyOnHand}</span>
                    </TableCell>
                    <TableCell className="text-center">{item.reorderLevel}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="destructive">{deficit} قطعة</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default function Inventory() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-inventory-title">إدارة المخزون</h1>
        <p className="text-muted-foreground mt-1">تتبع الكميات وحركات المخزون لكل فرع مع تنبيهات النواقص.</p>
      </div>

      <Tabs defaultValue="stock" dir="rtl">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="stock" className="gap-1" data-testid="tab-branch-stock">
            <Package className="w-4 h-4" />
            مخزون الفرع
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-1" data-testid="tab-transactions">
            <History className="w-4 h-4" />
            حركات المخزون
          </TabsTrigger>
          <TabsTrigger value="low-stock" className="gap-1" data-testid="tab-low-stock">
            <AlertCircle className="w-4 h-4" />
            النواقص
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <BranchInventoryTab />
        </TabsContent>
        <TabsContent value="transactions">
          <TransactionsTab />
        </TabsContent>
        <TabsContent value="low-stock">
          <LowStockTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
