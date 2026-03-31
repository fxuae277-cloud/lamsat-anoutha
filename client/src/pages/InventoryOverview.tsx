import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PackageSearch, Boxes, TrendingDown, AlertTriangle, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getQueryFn } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import type { Branch } from "@shared/schema";

export default function InventoryOverview() {
  const { t } = useI18n();

  // Stock tab state
  const [stockSearch, setStockSearch] = useState("");
  const [filterBranch, setFilterBranch] = useState("all");
  const [filterType, setFilterType] = useState("all");

  // Movements tab state
  const [movType, setMovType] = useState("all");
  const [movFrom, setMovFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [movTo, setMovTo] = useState(new Date().toISOString().slice(0, 10));
  const [movBranch, setMovBranch] = useState("all");

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: stockRaw = [], isLoading: stockLoading } = useQuery<any[]>({
    queryKey: ["/api/inventory-balances"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: movements = [], isLoading: movLoading } = useQuery<any[]>({
    queryKey: ["/api/inventory/transactions", { type: movType, from: movFrom, to: movTo }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (movType !== "all") params.set("type", movType);
      if (movFrom) params.set("from", movFrom);
      if (movTo) params.set("to", movTo);
      const res = await fetch(`/api/inventory/transactions?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  // Client-side filtering for stock
  const filtered = stockRaw.filter(row => {
    if (filterBranch !== "all" && String(row.branch_id) !== filterBranch) return false;
    if (filterType !== "all" && row.product_type !== filterType) return false;
    if (stockSearch) {
      const q = stockSearch.toLowerCase();
      const name = (row.product_name || "").toLowerCase();
      const barcode = (row.barcode || "").toLowerCase();
      const sku = (row.sku || "").toLowerCase();
      if (!name.includes(q) && !barcode.includes(q) && !sku.includes(q)) return false;
    }
    return true;
  });

  // KPIs
  const totalRows = stockRaw.length;
  const lowStockRows = stockRaw.filter(r => r.qty_on_hand <= r.reorder_level).length;

  // Movement type label
  function typeLabel(type: string) {
    const key = `inv_overview.type_${type}`;
    const label = t(key);
    return label.startsWith("inv_overview.") ? type : label;
  }

  // Movement type badge color
  function typeBadgeClass(type: string) {
    if (type === "sale") return "bg-blue-100 text-blue-700 border-blue-300";
    if (type === "purchase" || type === "receive") return "bg-green-100 text-green-700 border-green-300";
    if (type.includes("transfer")) return "bg-purple-100 text-purple-700 border-purple-300";
    if (type.includes("adjust") || type.includes("stocktake")) return "bg-amber-100 text-amber-700 border-amber-300";
    return "bg-gray-100 text-gray-600 border-gray-300";
  }

  // Filter movements client-side by branch
  const filteredMovements = movements.filter(m => {
    if (movBranch !== "all" && String(m.branchId) !== movBranch) return false;
    return true;
  });

  return (
    <div className="container mx-auto p-4 lg:p-6 pb-20">
      <div className="mb-6 text-right">
        <h1 className="text-3xl font-bold tracking-tight">{t("inv_overview.title")}</h1>
        <p className="text-muted-foreground">{t("inv_overview.subtitle")}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="border rounded-lg bg-card p-4 flex gap-3 items-center">
          <Boxes className="w-8 h-8 text-primary/70 shrink-0" />
          <div>
            <p className="text-2xl font-bold">{totalRows}</p>
            <p className="text-sm text-muted-foreground">{t("dashboard.total_products") || "إجمالي الأصناف"}</p>
          </div>
        </div>
        <div className="border rounded-lg bg-card p-4 flex gap-3 items-center">
          <AlertTriangle className="w-8 h-8 text-yellow-500 shrink-0" />
          <div>
            <p className="text-2xl font-bold text-yellow-600">{lowStockRows}</p>
            <p className="text-sm text-muted-foreground">{t("inv_overview.status_low")}</p>
          </div>
        </div>
        <div className="border rounded-lg bg-card p-4 flex gap-3 items-center">
          <PackageSearch className="w-8 h-8 text-blue-500 shrink-0" />
          <div>
            <p className="text-2xl font-bold">{branches.length}</p>
            <p className="text-sm text-muted-foreground">{t("nav.branches")}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stock" className="gap-2">
            <Boxes className="w-4 h-4" /> {t("inv_overview.tab_stock")}
          </TabsTrigger>
          <TabsTrigger value="movements" className="gap-2">
            <TrendingDown className="w-4 h-4" /> {t("inv_overview.tab_movements")}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Current Stock ── */}
        <TabsContent value="stock" className="space-y-4 border-none p-0 outline-none">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pr-9"
                placeholder={t("inv_overview.search_placeholder")}
                value={stockSearch}
                onChange={e => setStockSearch(e.target.value)}
              />
            </div>
            <Select value={filterBranch} onValueChange={setFilterBranch}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("inv_overview.all_branches")}</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("inv_overview.all_types")}</SelectItem>
                <SelectItem value="simple">بسيط</SelectItem>
                <SelectItem value="variable">متعدد</SelectItem>
                <SelectItem value="composite">مركب</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stock Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>{t("inv_overview.col_product")}</TableHead>
                    <TableHead>{t("inv_overview.col_variant")}</TableHead>
                    <TableHead>{t("inv_overview.col_size")}</TableHead>
                    <TableHead>{t("inv_overview.col_branch")}</TableHead>
                    <TableHead className="text-center">{t("inv_overview.col_qty")}</TableHead>
                    <TableHead className="text-center">{t("inv_overview.col_reorder")}</TableHead>
                    <TableHead>{t("inv_overview.col_status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {t("common.loading")}
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {t("inv_overview.no_stock")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((row: any) => {
                      const isLow = row.qty_on_hand <= row.reorder_level;
                      return (
                        <TableRow key={`${row.variant_id}-${row.location_id}`}>
                          <TableCell className="font-medium">{row.product_name}</TableCell>
                          <TableCell className="text-muted-foreground">{row.color || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{row.size || "—"}</TableCell>
                          <TableCell>{row.full_location_name || row.branch_name || "—"}</TableCell>
                          <TableCell className="text-center">
                            <span className={`font-bold ${isLow ? "text-destructive" : "text-foreground"}`}>
                              {row.qty_on_hand}
                            </span>
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">{row.reorder_level}</TableCell>
                          <TableCell>
                            {isLow ? (
                              <Badge variant="destructive" className="text-xs gap-1">
                                <AlertTriangle className="w-3 h-3" /> {t("inv_overview.status_low")}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs border-green-400 text-green-700 bg-green-50">
                                {t("inv_overview.status_ok")}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: Inventory Movements ── */}
        <TabsContent value="movements" className="space-y-4 border-none p-0 outline-none">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={movType} onValueChange={setMovType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={t("inv_overview.filter_type")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("inv_overview.all_types")}</SelectItem>
                <SelectItem value="sale">{t("inv_overview.type_sale")}</SelectItem>
                <SelectItem value="purchase">{t("inv_overview.type_purchase")}</SelectItem>
                <SelectItem value="transfer">{t("inv_overview.type_transfer")}</SelectItem>
                <SelectItem value="adjustment">{t("inv_overview.type_adjustment")}</SelectItem>
                <SelectItem value="stocktake_adjustment">{t("inv_overview.type_stocktake_adjustment")}</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground shrink-0">{t("inv_overview.filter_from")}</label>
              <Input type="date" value={movFrom} onChange={e => setMovFrom(e.target.value)} className="w-40" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground shrink-0">{t("inv_overview.filter_to")}</label>
              <Input type="date" value={movTo} onChange={e => setMovTo(e.target.value)} className="w-40" />
            </div>
            <Select value={movBranch} onValueChange={setMovBranch}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("inv_overview.all_branches")}</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Movements Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>{t("inv_overview.col_date")}</TableHead>
                    <TableHead>{t("inv_overview.col_product")}</TableHead>
                    <TableHead>{t("inv_overview.col_type")}</TableHead>
                    <TableHead className="text-center">{t("inv_overview.col_qty_change")}</TableHead>
                    <TableHead>{t("inv_overview.col_ref")}</TableHead>
                    <TableHead>{t("inv_overview.col_user")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {t("common.loading")}
                      </TableCell>
                    </TableRow>
                  ) : filteredMovements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {t("inv_overview.no_movements")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMovements.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-sm">{m.date || new Date(m.createdAt).toLocaleDateString("en-US")}</TableCell>
                        <TableCell className="font-medium">{m.productName}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${typeBadgeClass(m.type)}`}>
                            {typeLabel(m.type)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-bold ${m.qty >= 0 ? "text-green-600" : "text-destructive"}`}>
                            {m.qty >= 0 ? "+" : ""}{m.qty}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {m.refTable && m.refId ? `${m.refTable}#${m.refId}` : (m.note || "—")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.createdByName || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
