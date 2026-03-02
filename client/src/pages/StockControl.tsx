import { useState } from "react";
import { Plus, ClipboardCheck, Search, Package, ArrowUpDown, CheckCircle2, Eye, AlertTriangle, TrendingUp, TrendingDown, Minus, BarChart3, Building2, RefreshCw } from "lucide-react";
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
import type { Branch } from "@shared/schema";

function fmt(v: string | number | null | undefined) {
  return parseFloat(String(v || "0")).toFixed(0);
}

export default function StockControl() {
  const { toast } = useToast();

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
        <h1 className="text-2xl font-bold" data-testid="text-stock-control-title">الجرد والتسويات</h1>
        <p className="text-muted-foreground mt-1">جرد المخزون، تسويات الكميات، وتقارير الفروقات</p>
      </div>

      <Tabs defaultValue="stocktakes" dir="rtl">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="stocktakes" className="gap-1 text-xs">
            <ClipboardCheck className="w-4 h-4" />
            عمليات الجرد
          </TabsTrigger>
          <TabsTrigger value="adjustments" className="gap-1 text-xs">
            <ArrowUpDown className="w-4 h-4" />
            تسويات يدوية
          </TabsTrigger>
          <TabsTrigger value="report" className="gap-1 text-xs">
            <BarChart3 className="w-4 h-4" />
            تقرير الفروقات
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
      toast({ title: "تم إنشاء عملية الجرد" });
      queryClient.invalidateQueries({ queryKey: ["/api/stocktakes"] });
      setCreateOpen(false);
      setNewBranch(""); setNewLocation(""); setNewNote("");
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
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
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/stocktakes/${id}/approve`, {});
    },
    onSuccess: () => {
      toast({ title: "تم اعتماد الجرد وتطبيق التسويات" });
      queryClient.invalidateQueries({ queryKey: ["/api/stocktakes"] });
      setDetailsOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const filteredItems = items.filter((it: any) => {
    if (!itemSearch) return true;
    return (it.product_name || "").includes(itemSearch) || (it.barcode || "").includes(itemSearch);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">عمليات الجرد</h3>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-create-stocktake">
              <Plus className="w-4 h-4" />
              جرد جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>إنشاء عملية جرد</DialogTitle>
              <DialogDescription>اختر الفرع والموقع لبدء الجرد</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">الفرع *</label>
                <Select value={newBranch} onValueChange={v => { setNewBranch(v); setNewLocation(""); }}>
                  <SelectTrigger data-testid="select-st-branch"><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                  <SelectContent>
                    {branchesList.map(b => (
                      <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">الموقع *</label>
                <Select value={newLocation} onValueChange={setNewLocation}>
                  <SelectTrigger data-testid="select-st-location"><SelectValue placeholder="اختر الموقع" /></SelectTrigger>
                  <SelectContent>
                    {branchLocations.map((l: any) => (
                      <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">ملاحظات</label>
                <Input placeholder="ملاحظات اختيارية" value={newNote} onChange={e => setNewNote(e.target.value)} data-testid="input-st-note" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newBranch || !newLocation} data-testid="button-save-stocktake">
                {createMutation.isPending ? "جارِ الإنشاء..." : "بدء الجرد"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>الفرع</TableHead>
              <TableHead>الموقع</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>عدد الأصناف</TableHead>
              <TableHead>مطابق</TableHead>
              <TableHead>زيادة</TableHead>
              <TableHead>نقص</TableHead>
              <TableHead>أُنشئ بواسطة</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead className="w-[100px]">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stocktakes.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">لا توجد عمليات جرد</TableCell></TableRow>
            ) : stocktakes.map((st: any) => (
              <TableRow key={st.id} data-testid={`row-stocktake-${st.id}`}>
                <TableCell className="font-mono text-sm">#{st.id}</TableCell>
                <TableCell className="text-sm">{st.branch_name}</TableCell>
                <TableCell className="text-sm">{st.location_name}</TableCell>
                <TableCell>
                  {st.status === "draft" ? (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">جاري</Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">مكتمل</Badge>
                  )}
                </TableCell>
                <TableCell className="font-medium">{st.total_items}</TableCell>
                <TableCell className="text-green-600">{st.matched_items}</TableCell>
                <TableCell className="text-blue-600">{st.surplus_items}</TableCell>
                <TableCell className="text-red-600">{st.shortage_items}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{st.creator_name || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{st.created_at ? new Date(st.created_at).toLocaleDateString("ar-OM") : "—"}</TableCell>
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
              جرد #{selectedSt?.id} - {selectedSt?.location_name}
              {selectedSt?.status === "draft" && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs mr-2">جاري</Badge>
              )}
              {selectedSt?.status === "completed" && (
                <Badge className="bg-green-100 text-green-700 border-green-200 text-xs mr-2">مكتمل</Badge>
              )}
            </DialogTitle>
            <DialogDescription>{selectedSt?.branch_name}</DialogDescription>
          </DialogHeader>

          {selectedSt?.status === "draft" && (
            <div className="grid grid-cols-4 gap-3">
              <Card><CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">إجمالي الأصناف</p>
                <p className="text-lg font-bold">{selectedSt?.total_items}</p>
              </CardContent></Card>
              <Card><CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">مطابق</p>
                <p className="text-lg font-bold text-green-600">{selectedSt?.matched_items}</p>
              </CardContent></Card>
              <Card><CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">زيادة</p>
                <p className="text-lg font-bold text-blue-600">{selectedSt?.surplus_items}</p>
              </CardContent></Card>
              <Card><CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">نقص</p>
                <p className="text-lg font-bold text-red-600">{selectedSt?.shortage_items}</p>
              </CardContent></Card>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="بحث بالاسم أو الباركود..." className="pr-9" value={itemSearch} onChange={e => setItemSearch(e.target.value)} data-testid="input-st-item-search" />
            </div>
            {selectedSt?.status === "draft" && (
              <Button className="gap-2 bg-green-600 hover:bg-green-700" onClick={() => approveMutation.mutate(selectedSt.id)} disabled={approveMutation.isPending} data-testid="button-approve-stocktake">
                <CheckCircle2 className="w-4 h-4" />
                {approveMutation.isPending ? "جارِ الاعتماد..." : "اعتماد الجرد"}
              </Button>
            )}
          </div>

          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>المنتج</TableHead>
                <TableHead>الباركود</TableHead>
                <TableHead>كمية النظام</TableHead>
                <TableHead>الكمية المعدودة</TableHead>
                <TableHead>الفرق</TableHead>
                <TableHead>ملاحظة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">لا توجد أصناف</TableCell></TableRow>
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
            placeholder="ملاحظة"
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
      toast({ title: "تم تسجيل التسوية بنجاح" });
      queryClient.invalidateQueries({ queryKey: [adjUrl] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-adjustments"] });
      setAddOpen(false);
      setAdjBranch(""); setAdjLocation(""); setAdjProduct(""); setAdjQty(""); setAdjReason("");
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">تسويات يدوية (+/-)</h3>
        <div className="flex gap-2">
          <Select value={filterBranch} onValueChange={setFilterBranch}>
            <SelectTrigger className="w-48"><SelectValue placeholder="كل الفروع" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">كل الفروع</SelectItem>
              {branchesList.map(b => (
                <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-adjustment">
                <Plus className="w-4 h-4" />
                تسوية جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle>تسوية مخزون</DialogTitle>
                <DialogDescription>تعديل كمية منتج في موقع معين (+ زيادة / - نقص)</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">الفرع *</label>
                    <Select value={adjBranch} onValueChange={v => { setAdjBranch(v); setAdjLocation(""); }}>
                      <SelectTrigger data-testid="select-adj-branch"><SelectValue placeholder="اختر" /></SelectTrigger>
                      <SelectContent>
                        {branchesList.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">الموقع *</label>
                    <Select value={adjLocation} onValueChange={setAdjLocation}>
                      <SelectTrigger data-testid="select-adj-location"><SelectValue placeholder="اختر" /></SelectTrigger>
                      <SelectContent>
                        {adjBranchLocations.map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">المنتج *</label>
                  <Select value={adjProduct} onValueChange={setAdjProduct}>
                    <SelectTrigger data-testid="select-adj-product"><SelectValue placeholder="اختر المنتج" /></SelectTrigger>
                    <SelectContent>
                      {products.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name} {p.barcode ? `(${p.barcode})` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">الكمية (+/-) *</label>
                    <Input type="number" placeholder="5 أو -3" value={adjQty} onChange={e => setAdjQty(e.target.value)} data-testid="input-adj-qty" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">السبب *</label>
                  <Input placeholder="سبب التسوية" value={adjReason} onChange={e => setAdjReason(e.target.value)} data-testid="input-adj-reason" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !adjBranch || !adjLocation || !adjProduct || !adjQty || !adjReason} data-testid="button-save-adjustment">
                  {createMutation.isPending ? "جارِ الحفظ..." : "تنفيذ التسوية"}
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
              <TableHead>المنتج</TableHead>
              <TableHead>الفرع</TableHead>
              <TableHead>الموقع</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>قبل</TableHead>
              <TableHead>التغيير</TableHead>
              <TableHead>بعد</TableHead>
              <TableHead>السبب</TableHead>
              <TableHead>بواسطة</TableHead>
              <TableHead>التاريخ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adjustments.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">لا توجد تسويات</TableCell></TableRow>
            ) : adjustments.map((adj: any) => (
              <TableRow key={adj.id} data-testid={`row-adj-${adj.id}`}>
                <TableCell className="font-medium text-sm">{adj.product_name}</TableCell>
                <TableCell className="text-sm">{adj.branch_name}</TableCell>
                <TableCell className="text-sm">{adj.location_name}</TableCell>
                <TableCell>
                  {adj.type === "increase" || adj.type === "surplus" ? (
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs gap-1">
                      <TrendingUp className="w-3 h-3" /> زيادة
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700 border-red-200 text-xs gap-1">
                      <TrendingDown className="w-3 h-3" /> نقص
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{adj.qty_before}</TableCell>
                <TableCell className={`font-bold ${adj.qty_change > 0 ? "text-blue-600" : "text-red-600"}`}>
                  {adj.qty_change > 0 ? `+${adj.qty_change}` : adj.qty_change}
                </TableCell>
                <TableCell className="font-medium">{adj.qty_after}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={adj.reason}>{adj.reason}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{adj.creator_name || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{adj.created_at ? new Date(adj.created_at).toLocaleDateString("ar-OM") : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ReportTab({ branchesList }: { branchesList: any[] }) {
  const [filterBranch, setFilterBranch] = useState("__all__");

  const adjUrl = filterBranch !== "__all__" ? `/api/inventory-adjustments?branchId=${filterBranch}` : "/api/inventory-adjustments";
  const { data: adjustments = [] } = useQuery<any[]>({
    queryKey: [adjUrl],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const stUrl = filterBranch !== "__all__" ? `/api/stocktakes?branchId=${filterBranch}` : "/api/stocktakes";
  const { data: stocktakes = [] } = useQuery<any[]>({
    queryKey: [stUrl],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const completedStocktakes = stocktakes.filter((st: any) => st.status === "completed");
  const totalSurplus = adjustments.filter((a: any) => a.qty_change > 0).reduce((s: number, a: any) => s + a.qty_change, 0);
  const totalShortage = adjustments.filter((a: any) => a.qty_change < 0).reduce((s: number, a: any) => s + Math.abs(a.qty_change), 0);

  const productSummary: Record<string, { name: string; surplus: number; shortage: number; net: number }> = {};
  adjustments.forEach((a: any) => {
    if (!productSummary[a.product_id]) {
      productSummary[a.product_id] = { name: a.product_name, surplus: 0, shortage: 0, net: 0 };
    }
    if (a.qty_change > 0) productSummary[a.product_id].surplus += a.qty_change;
    else productSummary[a.product_id].shortage += Math.abs(a.qty_change);
    productSummary[a.product_id].net += a.qty_change;
  });

  const sortedProducts = Object.entries(productSummary).sort((a, b) => Math.abs(b[1].net) - Math.abs(a[1].net));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">تقرير فروقات الجرد</h3>
        <Select value={filterBranch} onValueChange={setFilterBranch}>
          <SelectTrigger className="w-48"><SelectValue placeholder="كل الفروع" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">كل الفروع</SelectItem>
            {branchesList.map(b => (
              <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <ClipboardCheck className="w-6 h-6 text-primary mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">عمليات جرد مكتملة</p>
            <p className="text-2xl font-bold">{completedStocktakes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <ArrowUpDown className="w-6 h-6 text-amber-600 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">إجمالي التسويات</p>
            <p className="text-2xl font-bold">{adjustments.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-6 h-6 text-blue-600 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">إجمالي الزيادات</p>
            <p className="text-2xl font-bold text-blue-600">+{totalSurplus}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingDown className="w-6 h-6 text-red-600 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">إجمالي النقص</p>
            <p className="text-2xl font-bold text-red-600">-{totalShortage}</p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <div className="p-3 border-b bg-muted/20">
          <h4 className="text-sm font-bold">ملخص الفروقات حسب المنتج</h4>
        </div>
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>المنتج</TableHead>
              <TableHead>زيادة</TableHead>
              <TableHead>نقص</TableHead>
              <TableHead>الصافي</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProducts.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">لا توجد فروقات مسجلة</TableCell></TableRow>
            ) : sortedProducts.map(([pid, data]) => (
              <TableRow key={pid}>
                <TableCell className="font-medium">{data.name}</TableCell>
                <TableCell className="text-blue-600 font-medium">{data.surplus > 0 ? `+${data.surplus}` : "0"}</TableCell>
                <TableCell className="text-red-600 font-medium">{data.shortage > 0 ? `-${data.shortage}` : "0"}</TableCell>
                <TableCell className={`font-bold ${data.net > 0 ? "text-blue-600" : data.net < 0 ? "text-red-600" : "text-green-600"}`}>
                  {data.net > 0 ? `+${data.net}` : data.net}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
