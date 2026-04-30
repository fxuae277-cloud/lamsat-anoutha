import { useState } from "react";
import {
  Package, Search, MapPin, ArrowDownToLine, Truck,
  ChevronDown, ChevronUp, Box, Hash, Calendar, Layers,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { BarcodeScanButton } from "@/components/BarcodeScanButton";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const day   = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const day   = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hh    = String(d.getHours()).padStart(2, "0");
  const mm    = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()} ${hh}:${mm}`;
}

// ─── TransferRow ──────────────────────────────────────────────────────────────

function TransferRow({ tr }: { tr: any }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useI18n();
  const date = tr.approved_at || tr.created_at;

  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-start hover:bg-muted/30 transition-colors"
      >
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">{t("branch_stock.transfer_number")}</p>
            <p className="font-bold text-primary font-mono">TRF-{tr.transfer_number}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t("common.date")}</p>
            <p className="font-semibold">{formatDate(date)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t("branch_stock.source")}</p>
            <p className="font-semibold truncate">{tr.from_location_name}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t("branch_stock.total_qty_label")}</p>
            <p className="font-bold text-emerald-600">{tr.total_qty} {t("branch_stock.unit")}</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-xs">{t("branch_stock.items_count")}</p>
              <p className="font-semibold">{tr.lines_count}</p>
            </div>
            {expanded
              ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            }
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t bg-muted/20 px-4 py-4 space-y-3">
          {tr.notes && (
            <p className="text-xs text-muted-foreground bg-white border rounded px-3 py-2">
              <span className="font-semibold text-foreground">{t("common.note")}: </span>{tr.notes}
            </p>
          )}
          <div className="text-xs text-muted-foreground">
            {t("common.by")} {tr.created_by_name || "—"} • {formatDateTime(date)}
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{t("branch_stock.product")}</TableHead>
                  <TableHead>{t("branch_stock.category")}</TableHead>
                  <TableHead>{t("branch_stock.color")}</TableHead>
                  <TableHead>{t("branch_stock.size")}</TableHead>
                  <TableHead>{t("branch_stock.barcode")}</TableHead>
                  <TableHead className="text-center">{t("branch_stock.qty")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(tr.lines || []).map((line: any, i: number) => (
                  <TableRow key={line.line_id || i} className="hover:bg-muted/20">
                    <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{line.product_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{line.category_name || "—"}</TableCell>
                    <TableCell>{line.color || "—"}</TableCell>
                    <TableCell>{line.size || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{line.barcode || "—"}</TableCell>
                    <TableCell className="text-center font-bold text-emerald-600">{line.qty}</TableCell>
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BranchStock() {
  const { t } = useI18n();
  const { data } = useAuth();
  const user = data?.user;
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [transferSearch, setTransferSearch] = useState("");
  const isOwner = user?.role === "owner" || user?.role === "admin";
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    user?.branchId ? String(user.branchId) : ""
  );

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["/api/branches"],
    enabled: isOwner,
  });

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/categories"],
  });

  const branchId = isOwner ? selectedBranchId : String(user?.branchId || "");

  const { data: stock = [], isLoading: stockLoading } = useQuery<any[]>({
    queryKey: [`/api/branch-stock/${branchId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!branchId,
  });

  const { data: transfers = [], isLoading: transfersLoading } = useQuery<any[]>({
    queryKey: [`/api/branch-stock/${branchId}/transfers`],
    queryFn: async () => {
      const res = await fetch(`/api/branch-stock/${branchId}/transfers`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!branchId,
  });

  // عند اختيار فئة أم → تشمل الفئات الفرعية
  const childCatIds = (parentId: string): string[] =>
    categories.filter((c: any) => String(c.parentId) === parentId).map((c: any) => String(c.id));

  const filteredStock = stock.filter((item: any) => {
    const matchesSearch = !search ||
      (item.product_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (item.barcode || "").toLowerCase().includes(search.toLowerCase()) ||
      (item.sku || "").toLowerCase().includes(search.toLowerCase()) ||
      (item.category_name || "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "all" ||
      String(item.category_id) === categoryFilter ||
      childCatIds(categoryFilter).includes(String(item.category_id));
    return matchesSearch && matchesCategory;
  });

  const filteredTransfers = transfers.filter((tr: any) => {
    if (!transferSearch) return true;
    const q = transferSearch.toLowerCase();
    return (
      `TRF-${tr.transfer_number}`.toLowerCase().includes(q) ||
      (tr.from_location_name || "").toLowerCase().includes(q) ||
      (tr.notes || "").toLowerCase().includes(q) ||
      (tr.lines || []).some((l: any) =>
        (l.product_name || "").toLowerCase().includes(q) ||
        (l.barcode || "").toLowerCase().includes(q) ||
        (l.category_name || "").toLowerCase().includes(q)
      )
    );
  });

  const totalVariants  = filteredStock.length;
  const totalQty       = filteredStock.reduce((s: number, item: any) => s + Number(item.current_qty || 0), 0);
  const totalCategories = new Set(filteredStock.map((i: any) => i.category_id).filter(Boolean)).size;
  const totalProducts   = new Set(filteredStock.map((i: any) => i.product_id)).size;

  const totalTransferQty = transfers.reduce((s: number, tr: any) => s + Number(tr.total_qty || 0), 0);

  const branchName = isOwner
    ? branches.find((b: any) => String(b.id) === branchId)?.name || ""
    : (user as any)?.branchName || "";

  return (
    <div className="p-6 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowDownToLine className="w-6 h-6" />
            {t("branch_stock.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("branch_stock.subtitle")}</p>
          {branchName && (
            <p className="text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="w-4 h-4" />
              {branchName}
            </p>
          )}
        </div>
      </div>

      {/* Branch selector (owner only) */}
      {isOwner && branches.length > 0 && (
        <div className="max-w-xs">
          <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
            <SelectTrigger data-testid="select-branch">
              <SelectValue placeholder={t("branch_stock.select_branch")} />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b: any) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name}{b.address ? " - " + b.address : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!branchId ? (
        <div className="text-center py-16 text-muted-foreground">
          <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{t("branch_stock.select_branch")}</p>
        </div>
      ) : (
        <Tabs defaultValue="stock">
          <TabsList className="mb-4">
            <TabsTrigger value="stock" className="gap-2">
              <Box className="w-4 h-4" />
              {t("branch_stock.current_stock_tab")}
            </TabsTrigger>
            <TabsTrigger value="transfers" className="gap-2">
              <Truck className="w-4 h-4" />
              {t("branch_stock.transfers_tab")}
              {transfers.length > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5">{transfers.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── تبويب المخزون ── */}
          <TabsContent value="stock" className="space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <Hash className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                  <div className="text-2xl font-bold text-blue-600" data-testid="text-total-variants">{totalVariants}</div>
                  <div className="text-xs text-muted-foreground">{t("branch_stock.total_variants")}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Package className="w-5 h-5 mx-auto mb-1 text-green-500" />
                  <div className="text-2xl font-bold text-green-600" data-testid="text-total-qty">{totalQty}</div>
                  <div className="text-xs text-muted-foreground">{t("branch_stock.total_qty")}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Layers className="w-5 h-5 mx-auto mb-1 text-purple-500" />
                  <div className="text-2xl font-bold text-purple-600">{totalProducts}</div>
                  <div className="text-xs text-muted-foreground">{t("branch_stock.total_products")}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Layers className="w-5 h-5 mx-auto mb-1 text-orange-500" />
                  <div className="text-2xl font-bold text-orange-600">{totalCategories}</div>
                  <div className="text-xs text-muted-foreground">{t("branch_stock.categories_count")}</div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex gap-2 flex-1">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder={t("branch_stock.search_placeholder")}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pe-9"
                    data-testid="input-search-stock"
                  />
                </div>
                <BarcodeScanButton onScan={(code) => setSearch(code)} />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-category-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("branch_stock.all_categories")}</SelectItem>
                  {categories.filter((c: any) => !c.parentId).map((parent: any) => [
                    <SelectItem key={parent.id} value={String(parent.id)} className="font-semibold">
                      {parent.name}
                    </SelectItem>,
                    ...categories.filter((c: any) => c.parentId === parent.id).map((child: any) => (
                      <SelectItem key={child.id} value={String(child.id)} className="pe-6 text-muted-foreground">
                        ↳ {child.name}
                      </SelectItem>
                    )),
                  ])}
                  {categories
                    .filter((c: any) => c.parentId && !categories.some((p: any) => p.id === c.parentId))
                    .map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stock Table */}
            {stockLoading ? (
              <div className="text-center py-12 text-muted-foreground">{t("app.loading")}</div>
            ) : filteredStock.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{t("branch_stock.no_stock")}</p>
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <div className="max-h-[550px] overflow-auto">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead>{t("branch_stock.product")}</TableHead>
                        <TableHead>{t("branch_stock.category")}</TableHead>
                        <TableHead>{t("branch_stock.color")}</TableHead>
                        <TableHead>{t("branch_stock.size")}</TableHead>
                        <TableHead>{t("branch_stock.barcode")}</TableHead>
                        <TableHead className="text-center">{t("branch_stock.qty")}</TableHead>
                        <TableHead className="text-center">{t("branch_stock.last_transfer")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStock.map((item: any, idx: number) => {
                        const qty = Number(item.current_qty || 0);
                        const isLow = qty > 0 && qty <= 5;
                        return (
                          <TableRow
                            key={item.variant_id ?? `no-variant-${idx}`}
                            data-testid={`row-stock-${item.variant_id ?? idx}`}
                            className={isLow ? "bg-yellow-50/60" : ""}
                          >
                            <TableCell className="font-medium">{item.product_name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{item.category_name || "—"}</TableCell>
                            <TableCell>{item.color || "—"}</TableCell>
                            <TableCell>{item.size || "—"}</TableCell>
                            <TableCell className="font-mono text-xs">{item.barcode || "—"}</TableCell>
                            <TableCell className="text-center">
                              <span className={`font-bold ${qty === 0 ? "text-red-500" : isLow ? "text-yellow-600" : "text-emerald-600"}`}>
                                {qty}
                              </span>
                            </TableCell>
                            <TableCell className="text-center text-xs text-muted-foreground">
                              {formatDate(item.last_transfer_date)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="border-t px-4 py-2 bg-muted/30 flex gap-6 text-sm">
                  <span className="text-muted-foreground">{t("branch_stock.total_variants_summary")} <strong>{totalVariants}</strong></span>
                  <span className="text-muted-foreground">{t("branch_stock.total_qty_summary")} <strong className="text-emerald-600">{totalQty}</strong></span>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── تبويب التحويلات ── */}
          <TabsContent value="transfers" className="space-y-4">
            {/* KPI */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <Truck className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                  <div className="text-2xl font-bold text-blue-600">{transfers.length}</div>
                  <div className="text-xs text-muted-foreground">{t("branch_stock.total_transfers")}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Package className="w-5 h-5 mx-auto mb-1 text-green-500" />
                  <div className="text-2xl font-bold text-green-600">{totalTransferQty}</div>
                  <div className="text-xs text-muted-foreground">{t("branch_stock.total_received")}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Calendar className="w-5 h-5 mx-auto mb-1 text-purple-500" />
                  <div className="text-sm font-bold text-purple-600">
                    {transfers.length > 0
                      ? formatDate(transfers[0].approved_at || transfers[0].created_at)
                      : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">{t("branch_stock.last_transfer")}</div>
                </CardContent>
              </Card>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("branch_stock.transfer_search_placeholder")}
                value={transferSearch}
                onChange={e => setTransferSearch(e.target.value)}
                className="pe-9"
              />
            </div>

            {/* Transfers list */}
            {transfersLoading ? (
              <div className="text-center py-12 text-muted-foreground">{t("app.loading")}</div>
            ) : filteredTransfers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{t("branch_stock.no_transfers")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTransfers.map((tr: any) => (
                  <TransferRow key={tr.id} tr={tr} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
