import { useState } from "react";
import { RotateCcw, Search, Plus, Package, Calendar, Eye, FileText, ShoppingBag, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Branch } from "@shared/schema";

function fmt(v: string | number | null | undefined) {
  return parseFloat(String(v || "0")).toFixed(3);
}

export default function Returns() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isManagerPlus = ["owner", "admin", "manager"].includes(user?.role || "");

  const [newReturnOpen, setNewReturnOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<any>(null);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [foundSale, setFoundSale] = useState<any>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [returnItems, setReturnItems] = useState<Record<number, number>>({});
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("cash");
  const [branchFilter, setBranchFilter] = useState("all");

  const { data: returnsList = [] } = useQuery<any[]>({
    queryKey: ["/api/sale-returns"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const { data: branchesList = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const searchSaleMutation = useMutation({
    mutationFn: async () => {
      const searchVal = invoiceSearch.trim();
      const isNumeric = /^\d+$/.test(searchVal);
      if (isNumeric) {
        const res = await fetch(`/api/sales/${searchVal}`, { credentials: "include" });
        if (res.ok) return res.json();
      }
      const listRes = await fetch(`/api/sales?invoiceNumber=${encodeURIComponent(searchVal)}`, { credentials: "include" });
      if (!listRes.ok) throw new Error("الفاتورة غير موجودة");
      const list = await listRes.json();
      if (Array.isArray(list) && list.length > 0) {
        const match = list.find((s: any) => (s.invoiceNumber || s.invoice_number) === searchVal) || list[0];
        const detailRes = await fetch(`/api/sales/${match.id}`, { credentials: "include" });
        if (detailRes.ok) return detailRes.json();
      }
      throw new Error("الفاتورة غير موجودة");
    },
    onSuccess: (data) => {
      setFoundSale(data);
      setSaleItems(data.items || []);
      setReturnItems({});
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
      setFoundSale(null);
      setSaleItems([]);
    },
  });

  const createReturnMutation = useMutation({
    mutationFn: async () => {
      if (!foundSale) throw new Error("لم يتم تحديد الفاتورة");
      const items = Object.entries(returnItems)
        .filter(([_, qty]) => qty > 0)
        .map(([saleItemId, qty]) => {
          const si = saleItems.find((s: any) => s.id === Number(saleItemId));
          return {
            saleItemId: Number(saleItemId),
            productId: si.product_id || si.productId,
            quantity: qty,
            unitPrice: si.unit_price || si.unitPrice,
          };
        });
      if (items.length === 0) throw new Error("يجب تحديد عنصر واحد على الأقل");

      await apiRequest("POST", `/api/sales/${foundSale.id}/return`, {
        items,
        reason,
        refundMethod,
      });
    },
    onSuccess: () => {
      toast({ title: "تم إنشاء المرتجع بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/sale-returns"] });
      resetForm();
      setNewReturnOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setInvoiceSearch("");
    setFoundSale(null);
    setSaleItems([]);
    setReturnItems({});
    setReason("");
    setRefundMethod("cash");
  }

  const filteredReturns = branchFilter === "all" ? returnsList : returnsList.filter((r: any) => String(r.branch_id) === branchFilter);

  const totalRefunds = filteredReturns.reduce((s: number, r: any) => s + parseFloat(r.refund_amount || "0"), 0);

  const refundTotal = Object.entries(returnItems).reduce((total, [saleItemId, qty]) => {
    const si = saleItems.find((s: any) => s.id === Number(saleItemId));
    if (!si || qty <= 0) return total;
    return total + parseFloat(si.unit_price || si.unitPrice || "0") * qty;
  }, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-returns-title">المرتجعات</h1>
          <p className="text-muted-foreground mt-1">إدارة مرتجعات المبيعات مع إعادة المخزون وتسجيل القيود المالية</p>
        </div>
        {isManagerPlus && (
          <Button className="gap-2" onClick={() => { resetForm(); setNewReturnOpen(true); }} data-testid="button-new-return">
            <Plus className="w-4 h-4" />
            مرتجع جديد
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <RotateCcw className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">عدد المرتجعات</p>
              <p className="text-xl font-bold" data-testid="text-returns-count">{filteredReturns.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي المبالغ المستردة</p>
              <p className="text-lg font-bold text-red-600">{totalRefunds.toFixed(3)} <span className="text-xs font-normal">ر.ع</span></p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">أعادت مخزون</p>
              <p className="text-xl font-bold text-blue-600">
                {filteredReturns.reduce((s: number, r: any) => s + (r.items?.length || 0), 0)} عنصر
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 border-b flex items-center gap-4 bg-muted/20">
          {(user?.role === "owner" || user?.role === "admin") && (
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-48 bg-background" data-testid="select-returns-branch">
                <SelectValue placeholder="كل الفروع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الفروع</SelectItem>
                {branchesList.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>رقم المرتجع</TableHead>
              <TableHead>رقم الفاتورة</TableHead>
              <TableHead>الفرع</TableHead>
              <TableHead>المبلغ المسترد</TableHead>
              <TableHead>تكلفة المرتجع</TableHead>
              <TableHead>طريقة الاسترداد</TableHead>
              <TableHead>السبب</TableHead>
              <TableHead>بواسطة</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead className="w-[60px]">عرض</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReturns.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">لا توجد مرتجعات</TableCell></TableRow>
            ) : filteredReturns.map((ret: any) => (
              <TableRow key={ret.id} data-testid={`row-return-${ret.id}`}>
                <TableCell>
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                    {ret.return_number}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium text-primary">{ret.invoice_number}</TableCell>
                <TableCell className="text-sm">{ret.branch_name}</TableCell>
                <TableCell className="font-bold text-red-600">{fmt(ret.refund_amount)}</TableCell>
                <TableCell className="text-amber-600">{fmt(ret.cogs_returned)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {ret.refund_method === "cash" ? "نقد" : ret.refund_method === "card" ? "بطاقة" : "تحويل"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{ret.reason || "—"}</TableCell>
                <TableCell className="text-sm">{ret.created_by_name || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {ret.created_at ? new Date(ret.created_at).toLocaleDateString("ar-OM") : "—"}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                    onClick={() => { setSelectedReturn(ret); setDetailOpen(true); }}
                    data-testid={`button-view-return-${ret.id}`}>
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filteredReturns.length > 0 && (
          <div className="p-3 border-t bg-muted/30 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{filteredReturns.length} مرتجع</span>
            <span className="font-bold text-red-600">إجمالي: {totalRefunds.toFixed(3)} ر.ع</span>
          </div>
        )}
      </div>

      <Dialog open={newReturnOpen} onOpenChange={setNewReturnOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-red-600" />
              إنشاء مرتجع جديد
            </DialogTitle>
            <DialogDescription>ابحث عن الفاتورة ثم حدد العناصر المراد إرجاعها</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-1">
                <label className="text-sm font-medium">رقم الفاتورة أو البحث</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="أدخل رقم الفاتورة..."
                    value={invoiceSearch}
                    onChange={e => setInvoiceSearch(e.target.value)}
                    data-testid="input-return-invoice"
                    onKeyDown={e => { if (e.key === "Enter") searchSaleMutation.mutate(); }}
                  />
                  <Button onClick={() => searchSaleMutation.mutate()} disabled={!invoiceSearch || searchSaleMutation.isPending} data-testid="button-search-invoice">
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {foundSale && (
              <>
                <div className="border rounded-lg p-3 bg-muted/30 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">فاتورة: {foundSale.invoice_number || foundSale.invoiceNumber}</span>
                    <span className="text-muted-foreground">{foundSale.created_at ? new Date(foundSale.created_at).toLocaleDateString("ar-OM") : ""}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>إجمالي الفاتورة: <span className="font-bold text-primary">{fmt(foundSale.total)} ر.ع</span></span>
                    <span>الدفع: {foundSale.payment_method === "cash" || foundSale.paymentMethod === "cash" ? "نقد" : "بطاقة/تحويل"}</span>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/30 px-4 py-2 font-bold border-b text-sm flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    عناصر الفاتورة — حدد الكمية المراد إرجاعها
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>المنتج</TableHead>
                        <TableHead>الكمية المباعة</TableHead>
                        <TableHead>سعر الوحدة</TableHead>
                        <TableHead>كمية الإرجاع</TableHead>
                        <TableHead>المبلغ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {saleItems.map((si: any) => {
                        const itemId = si.id;
                        const qty = returnItems[itemId] || 0;
                        const maxQty = si.quantity;
                        const unitPrice = parseFloat(si.unit_price || si.unitPrice || "0");
                        const lineRefund = unitPrice * qty;
                        return (
                          <TableRow key={itemId}>
                            <TableCell className="font-medium">{si.product_name || si.productName || `#${si.product_id || si.productId}`}</TableCell>
                            <TableCell>{maxQty}</TableCell>
                            <TableCell>{fmt(unitPrice)}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                max={maxQty}
                                className="w-20"
                                value={qty || ""}
                                onChange={e => {
                                  const val = Math.min(Number(e.target.value), maxQty);
                                  setReturnItems({ ...returnItems, [itemId]: Math.max(0, val) });
                                }}
                                data-testid={`input-return-qty-${itemId}`}
                              />
                            </TableCell>
                            <TableCell className={qty > 0 ? "font-bold text-red-600" : "text-muted-foreground"}>
                              {lineRefund > 0 ? lineRefund.toFixed(3) : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {refundTotal > 0 && (
                  <div className="border rounded-lg p-3 bg-red-50 border-red-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-red-700">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="font-bold">إجمالي المبلغ المسترد:</span>
                    </div>
                    <span className="text-xl font-bold text-red-700">{refundTotal.toFixed(3)} ر.ع</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">طريقة الاسترداد</label>
                    <Select value={refundMethod} onValueChange={setRefundMethod}>
                      <SelectTrigger data-testid="select-refund-method"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">نقد</SelectItem>
                        <SelectItem value="card">بطاقة</SelectItem>
                        <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">سبب الإرجاع</label>
                    <Textarea
                      placeholder="عيب في المنتج / تغيير رأي..."
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      className="h-9 min-h-[36px]"
                      data-testid="input-return-reason"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewReturnOpen(false)}>إلغاء</Button>
            <Button
              variant="destructive"
              disabled={createReturnMutation.isPending || refundTotal <= 0}
              onClick={() => createReturnMutation.mutate()}
              data-testid="button-submit-return"
            >
              {createReturnMutation.isPending ? "جارِ المعالجة..." : `تأكيد المرتجع (${refundTotal.toFixed(3)} ر.ع)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              تفاصيل المرتجع: {selectedReturn?.return_number}
            </DialogTitle>
          </DialogHeader>
          {selectedReturn && (
            <div className="space-y-4">
              <div className="border rounded-lg overflow-hidden text-sm">
                <div className="bg-muted/30 px-4 py-2 font-bold border-b">معلومات المرتجع</div>
                <div className="divide-y">
                  <div className="flex justify-between px-4 py-2">
                    <span className="text-muted-foreground">رقم الفاتورة الأصلية</span>
                    <span className="font-medium text-primary">{selectedReturn.invoice_number}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2">
                    <span className="text-muted-foreground">المبلغ المسترد</span>
                    <span className="font-bold text-red-600">{fmt(selectedReturn.refund_amount)} ر.ع</span>
                  </div>
                  <div className="flex justify-between px-4 py-2">
                    <span className="text-muted-foreground">تكلفة البضاعة المرتجعة</span>
                    <span className="font-medium text-amber-600">{fmt(selectedReturn.cogs_returned)} ر.ع</span>
                  </div>
                  <div className="flex justify-between px-4 py-2">
                    <span className="text-muted-foreground">طريقة الاسترداد</span>
                    <span>{selectedReturn.refund_method === "cash" ? "نقد" : selectedReturn.refund_method === "card" ? "بطاقة" : "تحويل"}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2">
                    <span className="text-muted-foreground">السبب</span>
                    <span>{selectedReturn.reason || "لم يحدد"}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2">
                    <span className="text-muted-foreground">بواسطة</span>
                    <span>{selectedReturn.created_by_name || "—"}</span>
                  </div>
                </div>
              </div>

              {selectedReturn.items && selectedReturn.items.length > 0 && (
                <div className="border rounded-lg overflow-hidden text-sm">
                  <div className="bg-muted/30 px-4 py-2 font-bold border-b">العناصر المرتجعة</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>المنتج</TableHead>
                        <TableHead>الكمية</TableHead>
                        <TableHead>السعر</TableHead>
                        <TableHead>المبلغ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedReturn.items.map((item: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{fmt(item.unitPrice)}</TableCell>
                          <TableCell className="text-red-600 font-medium">{fmt(item.lineTotal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
