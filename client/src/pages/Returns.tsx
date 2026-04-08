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
import { useI18n } from "@/lib/i18n";
import type { Branch } from "@shared/schema";
import { fmtDate } from "@/lib/formatters";

function fmt(v: string | number | null | undefined) {
  return parseFloat(String(v || "0")).toFixed(3);
}

export default function Returns() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const { data } = useAuth();
  const user = data?.user;
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
      if (!listRes.ok) throw new Error(t("returns.error_invoice_not_found"));
      const list = await listRes.json();
      if (Array.isArray(list) && list.length > 0) {
        const match = list.find((s: any) => (s.invoiceNumber || s.invoice_number) === searchVal) || list[0];
        const detailRes = await fetch(`/api/sales/${match.id}`, { credentials: "include" });
        if (detailRes.ok) return detailRes.json();
      }
      throw new Error(t("returns.error_invoice_not_found"));
    },
    onSuccess: (data) => {
      setFoundSale(data);
      setSaleItems(data.items || []);
      setReturnItems({});
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
      setFoundSale(null);
      setSaleItems([]);
    },
  });

  const createReturnMutation = useMutation({
    mutationFn: async () => {
      if (!foundSale) throw new Error(t("returns.error_no_invoice_selected"));
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
      if (items.length === 0) throw new Error(t("returns.error_min_one_item"));

      await apiRequest("POST", `/api/sales/${foundSale.id}/return`, {
        items,
        reason,
        refundMethod,
      });
    },
    onSuccess: () => {
      toast({ title: t("returns.success_created") });
      queryClient.invalidateQueries({ queryKey: ["/api/sale-returns"] });
      resetForm();
      setNewReturnOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
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
          <h1 className="text-2xl font-bold" data-testid="text-returns-title">{t("returns.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("returns.subtitle")}</p>
        </div>
        {isManagerPlus && (
          <Button className="gap-2" onClick={() => { resetForm(); setNewReturnOpen(true); }} data-testid="button-new-return">
            <Plus className="w-4 h-4" />
            {t("returns.new_return")}
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
              <p className="text-xs text-muted-foreground">{t("returns.returns_count")}</p>
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
              <p className="text-xs text-muted-foreground">{t("returns.total_refunds")}</p>
              <p className="text-lg font-bold text-red-600">{totalRefunds.toFixed(3)} <span className="text-xs font-normal">{t("common.omr")}</span></p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("returns.restored_stock")}</p>
              <p className="text-xl font-bold text-blue-600">
                {filteredReturns.reduce((s: number, r: any) => s + (r.items?.length || 0), 0)} {t("returns.items_suffix")}
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
                <SelectValue placeholder={t("returns.all_branches")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("returns.all_branches")}</SelectItem>
                {branchesList.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}{b.address ? " - " + b.address : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>{t("returns.table_return_no")}</TableHead>
              <TableHead>{t("returns.table_invoice_no")}</TableHead>
              <TableHead>{t("returns.table_branch")}</TableHead>
              <TableHead>{t("returns.table_refund_amount")}</TableHead>
              <TableHead>{t("returns.table_return_cost")}</TableHead>
              <TableHead>{t("returns.table_refund_method")}</TableHead>
              <TableHead>{t("returns.table_reason")}</TableHead>
              <TableHead>{t("returns.table_by")}</TableHead>
              <TableHead>{t("returns.table_date")}</TableHead>
              <TableHead className="w-[60px]">{t("returns.table_view")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReturns.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">{t("returns.no_returns")}</TableCell></TableRow>
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
                    {ret.refund_method === "cash" ? t("payment_methods.cash") : ret.refund_method === "card" ? t("payment_methods.card") : t("payment_methods.bank_transfer")}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{ret.reason || "—"}</TableCell>
                <TableCell className="text-sm">{ret.created_by_name || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {fmtDate(ret.created_at)}
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
            <span className="text-muted-foreground">{filteredReturns.length} {t("returns.items_suffix")}</span>
            <span className="font-bold text-red-600">{t("returns.total_label")} {totalRefunds.toFixed(3)} {t("common.omr")}</span>
          </div>
        )}
      </div>

      <Dialog open={newReturnOpen} onOpenChange={setNewReturnOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-red-600" />
              {t("returns.new_return_title")}
            </DialogTitle>
            <DialogDescription>{t("returns.new_return_desc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-1">
                <label className="text-sm font-medium">{t("returns.invoice_search_label")}</label>
                <div className="flex gap-2">
                  <Input
                    placeholder={t("returns.invoice_search_placeholder")}
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
                    <span className="font-medium">{t("returns.invoice_label")} {foundSale.invoice_number || foundSale.invoiceNumber}</span>
                    <span className="text-muted-foreground">{fmtDate(foundSale.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("returns.invoice_total")} <span className="font-bold text-primary">{fmt(foundSale.total)} {t("common.omr")}</span></span>
                    <span>{t("returns.payment_label")} {foundSale.payment_method === "cash" || foundSale.paymentMethod === "cash" ? t("payment_methods.cash") : t("payment_methods.card")}</span>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/30 px-4 py-2 font-bold border-b text-sm flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    {t("returns.invoice_items")}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("returns.table_product")}</TableHead>
                        <TableHead>{t("returns.table_sold_qty")}</TableHead>
                        <TableHead>{t("returns.table_unit_price")}</TableHead>
                        <TableHead>{t("returns.table_return_qty")}</TableHead>
                        <TableHead>{t("returns.table_amount")}</TableHead>
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
                      <span className="font-bold">{t("returns.total_refund_label")}</span>
                    </div>
                    <span className="text-xl font-bold text-red-700">{refundTotal.toFixed(3)} {t("common.omr")}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">{t("returns.refund_method_label")}</label>
                    <Select value={refundMethod} onValueChange={setRefundMethod}>
                      <SelectTrigger data-testid="select-refund-method"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">{t("payment_methods.cash")}</SelectItem>
                        <SelectItem value="card">{t("payment_methods.card")}</SelectItem>
                        <SelectItem value="bank_transfer">{t("payment_methods.bank_transfer")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">{t("returns.return_reason_label")}</label>
                    <Textarea
                      placeholder={t("returns.return_reason_placeholder")}
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
            <Button variant="outline" onClick={() => setNewReturnOpen(false)}>{t("returns.cancel_btn")}</Button>
            <Button
              variant="destructive"
              disabled={createReturnMutation.isPending || refundTotal <= 0}
              onClick={() => createReturnMutation.mutate()}
              data-testid="button-submit-return"
            >
              {createReturnMutation.isPending ? t("returns.processing") : t("returns.confirm_return_btn").replace("{0}", refundTotal.toFixed(3))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {t("returns.detail_title").replace("{0}", selectedReturn?.return_number)}
            </DialogTitle>
          </DialogHeader>
          {selectedReturn && (
            <div className="space-y-4">
              <div className="border rounded-lg overflow-hidden text-sm">
                <div className="bg-muted/30 px-4 py-2 font-bold border-b">{t("returns.return_info")}</div>
                <div className="divide-y">
                  <div className="flex justify-between px-4 py-2">
                    <span className="text-muted-foreground">{t("returns.original_invoice")}</span>
                    <span className="font-medium text-primary">{selectedReturn.invoice_number}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2">
                    <span className="text-muted-foreground">{t("returns.refund_amount")}</span>
                    <span className="font-bold text-red-600">{fmt(selectedReturn.refund_amount)} {t("common.omr")}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2">
                    <span className="text-muted-foreground">{t("returns.cogs_returned")}</span>
                    <span className="font-medium text-amber-600">{fmt(selectedReturn.cogs_returned)} {t("common.omr")}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2">
                    <span className="text-muted-foreground">{t("returns.refund_method")}</span>
                    <span>{selectedReturn.refund_method === "cash" ? t("payment_methods.cash") : selectedReturn.refund_method === "card" ? t("payment_methods.card") : t("payment_methods.bank_transfer")}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2">
                    <span className="text-muted-foreground">{t("returns.reason")}</span>
                    <span>{selectedReturn.reason || t("returns.not_specified")}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2">
                    <span className="text-muted-foreground">{t("returns.by_user")}</span>
                    <span>{selectedReturn.created_by_name || "—"}</span>
                  </div>
                </div>
              </div>

              {selectedReturn.items && selectedReturn.items.length > 0 && (
                <div className="border rounded-lg overflow-hidden text-sm">
                  <div className="bg-muted/30 px-4 py-2 font-bold border-b">{t("returns.returned_items")}</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("returns.table_product")}</TableHead>
                        <TableHead>{t("returns.table_qty")}</TableHead>
                        <TableHead>{t("returns.table_price")}</TableHead>
                        <TableHead>{t("returns.table_amount")}</TableHead>
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
