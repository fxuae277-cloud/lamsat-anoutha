import { useState } from "react";
import { ArrowLeftRight, PackagePlus, AlertCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Product, Warehouse, Inventory as InventoryType } from "@shared/schema";

export default function Inventory() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [transferData, setTransferData] = useState({ productId: "", toWarehouseId: "", quantity: "" });
  const [receiveData, setReceiveData] = useState({ productId: "", warehouseId: "", quantity: "" });

  const { data: allInventory = [] } = useQuery<InventoryType[]>({ queryKey: ["/api/inventory"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: warehouses = [] } = useQuery<Warehouse[]>({ queryKey: ["/api/warehouses"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: lowStock = [] } = useQuery<any[]>({ queryKey: ["/api/inventory/low-stock"], queryFn: getQueryFn({ on401: "throw" }) });

  const mainWarehouse = warehouses.find(w => w.isMain);
  const branchWarehouses = warehouses.filter(w => !w.isMain);

  const productMap = Object.fromEntries(products.map(p => [p.id, p]));
  const warehouseMap = Object.fromEntries(warehouses.map(w => [w.id, w]));

  const inventoryByProduct: Record<number, Record<number, number>> = {};
  for (const inv of allInventory) {
    if (!inventoryByProduct[inv.productId]) inventoryByProduct[inv.productId] = {};
    inventoryByProduct[inv.productId][inv.warehouseId] = inv.quantity;
  }

  const productRows = products.filter(p => {
    if (!search) return true;
    return p.name.includes(search) || (p.barcode && p.barcode.includes(search));
  }).map(p => {
    const byWh = inventoryByProduct[p.id] || {};
    const mainQty = mainWarehouse ? (byWh[mainWarehouse.id] || 0) : 0;
    const branchQtys = branchWarehouses.map(w => ({ whId: w.id, whName: w.name, qty: byWh[w.id] || 0 }));
    const totalQty = Object.values(byWh).reduce((s, q) => s + q, 0);
    return { product: p, mainQty, branchQtys, totalQty };
  });

  const totalAll = productRows.reduce((s, r) => s + r.totalQty, 0);
  const totalMain = productRows.reduce((s, r) => s + r.mainQty, 0);

  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!mainWarehouse) throw new Error("لا يوجد مخزن رئيسي");
      await apiRequest("POST", "/api/inventory/transfer", {
        productId: parseInt(transferData.productId),
        fromWarehouseId: mainWarehouse.id,
        toWarehouseId: parseInt(transferData.toWarehouseId),
        quantity: parseInt(transferData.quantity),
      });
    },
    onSuccess: () => {
      toast({ title: "تم التحويل بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      setTransferOpen(false);
      setTransferData({ productId: "", toWarehouseId: "", quantity: "" });
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const receiveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/inventory/receive", {
        productId: parseInt(receiveData.productId),
        warehouseId: parseInt(receiveData.warehouseId),
        quantity: parseInt(receiveData.quantity),
      });
    },
    onSuccess: () => {
      toast({ title: "تم استلام البضاعة" });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/low-stock"] });
      setReceiveOpen(false);
      setReceiveData({ productId: "", warehouseId: "", quantity: "" });
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-inventory-title">إدارة المخزون</h1>
          <p className="text-muted-foreground mt-1">تتبع الكميات في المخزن الرئيسي وفروع البيع.</p>
        </div>
        
        <div className="flex gap-3">
          <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="button-receive-stock">
                <PackagePlus className="w-4 h-4" />
                استلام بضاعة
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>استلام بضاعة</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">المخزن</label>
                  <Select value={receiveData.warehouseId} onValueChange={v => setReceiveData({...receiveData, warehouseId: v})}>
                    <SelectTrigger><SelectValue placeholder="اختر المخزن" /></SelectTrigger>
                    <SelectContent>
                      {warehouses.map(w => <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">المنتج</label>
                  <Select value={receiveData.productId} onValueChange={v => setReceiveData({...receiveData, productId: v})}>
                    <SelectTrigger><SelectValue placeholder="اختر المنتج" /></SelectTrigger>
                    <SelectContent>
                      {products.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">الكمية</label>
                  <Input type="number" value={receiveData.quantity} onChange={e => setReceiveData({...receiveData, quantity: e.target.value})} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => receiveMutation.mutate()} disabled={receiveMutation.isPending} data-testid="button-confirm-receive">تأكيد الاستلام</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-transfer-stock">
                <ArrowLeftRight className="w-4 h-4" />
                تحويل مخزون لفرع
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>تحويل مخزون من الرئيسي إلى فرع</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">الفرع المستلم</label>
                  <Select value={transferData.toWarehouseId} onValueChange={v => setTransferData({...transferData, toWarehouseId: v})}>
                    <SelectTrigger><SelectValue placeholder="اختر المخزن" /></SelectTrigger>
                    <SelectContent>
                      {branchWarehouses.map(w => <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">المنتج</label>
                  <Select value={transferData.productId} onValueChange={v => setTransferData({...transferData, productId: v})}>
                    <SelectTrigger><SelectValue placeholder="اختر المنتج" /></SelectTrigger>
                    <SelectContent>
                      {products.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">الكمية المحولة</label>
                  <Input type="number" value={transferData.quantity} onChange={e => setTransferData({...transferData, quantity: e.target.value})} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => transferMutation.mutate()} disabled={transferMutation.isPending} data-testid="button-confirm-transfer">تأكيد التحويل</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-muted-foreground">إجمالي القطع</p>
            <h3 className="text-2xl font-bold mt-1" data-testid="text-total-stock">{totalAll}</h3>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium text-muted-foreground">المخزن الرئيسي</p>
            <h3 className="text-2xl font-bold mt-1">{totalMain}</h3>
          </CardContent>
        </Card>
        {branchWarehouses.slice(0, 1).map(w => {
          const qty = productRows.reduce((s, r) => s + (r.branchQtys.find(b => b.whId === w.id)?.qty || 0), 0);
          return (
            <Card key={w.id}>
              <CardContent className="p-4">
                <p className="text-sm font-medium text-muted-foreground">{w.name}</p>
                <h3 className="text-2xl font-bold mt-1">{qty}</h3>
              </CardContent>
            </Card>
          );
        })}
        <Card className="bg-red-50 border-red-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">نواقص تحتاج إعادة طلب</p>
              <h3 className="text-2xl font-bold text-red-700 mt-1" data-testid="text-low-stock-alerts">{lowStock.length}</h3>
            </div>
            <AlertCircle className="text-red-400 w-8 h-8 opacity-50" />
          </CardContent>
        </Card>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden mt-6">
        <div className="p-4 border-b flex items-center gap-4">
          <div className="relative w-72">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث في المخزون..." className="pr-9" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-inventory" />
          </div>
        </div>
        
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>المنتج</TableHead>
              <TableHead className="text-center bg-primary/5">المخزن الرئيسي</TableHead>
              {branchWarehouses.map(w => (
                <TableHead key={w.id} className="text-center">{w.name}</TableHead>
              ))}
              <TableHead className="text-center font-bold">الإجمالي</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productRows.length === 0 ? (
              <TableRow><TableCell colSpan={3 + branchWarehouses.length} className="text-center py-8 text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
            ) : productRows.map((row) => (
              <TableRow key={row.product.id}>
                <TableCell className="font-bold flex items-center gap-2">
                  {row.product.name}
                  {lowStock.some((l: any) => l.productId === row.product.id) && <span className="flex h-2 w-2 rounded-full bg-red-600"></span>}
                </TableCell>
                <TableCell className="text-center font-medium bg-primary/5">{row.mainQty}</TableCell>
                {row.branchQtys.map(bq => (
                  <TableCell key={bq.whId} className="text-center">
                    {bq.qty <= 5 ? <span className="text-red-500 font-bold">{bq.qty}</span> : bq.qty}
                  </TableCell>
                ))}
                <TableCell className="text-center font-bold text-lg">{row.totalQty}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
