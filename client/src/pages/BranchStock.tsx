import { useState } from "react";
import { Package, Search, MapPin, ArrowDownToLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { BarcodeScanButton } from "@/components/BarcodeScanButton";

export default function BranchStock() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const isOwner = user?.role === "owner" || user?.role === "admin";
  const [selectedBranchId, setSelectedBranchId] = useState<string>(user?.branchId ? String(user.branchId) : "");

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["/api/branches"],
    enabled: isOwner,
  });

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/categories"],
  });

  const branchId = isOwner ? selectedBranchId : String(user?.branchId || "");

  const { data: stock = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/branch-stock/${branchId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!branchId,
  });

  const filteredStock = stock.filter((item: any) => {
    const matchesSearch = !search ||
      (item.product_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (item.barcode || "").toLowerCase().includes(search.toLowerCase()) ||
      (item.sku || "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "all" || String(item.category_id) === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalVariants = filteredStock.length;
  const totalQty = filteredStock.reduce((s: number, item: any) => s + Number(item.transferred_qty), 0);

  const branchName = isOwner
    ? branches.find((b: any) => String(b.id) === branchId)?.name || ""
    : user?.branchName || "";

  const handleBarcodeScan = (code: string) => {
    setSearch(code);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB");
  };

  return (
    <div className="p-6 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-branch-stock-title">
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

      {isOwner && branches.length > 0 && (
        <div className="max-w-xs">
          <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
            <SelectTrigger data-testid="select-branch">
              <SelectValue placeholder={t("branch_stock.select_branch")} />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b: any) => (
                <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
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
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t("branch_stock.search_placeholder")}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pr-9"
                  data-testid="input-search-stock"
                />
              </div>
              <BarcodeScanButton onScan={handleBarcodeScan} />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-category-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("branch_stock.all_categories")}</SelectItem>
                {categories.map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600" data-testid="text-total-variants">{totalVariants}</div>
                <div className="text-xs text-muted-foreground">{t("branch_stock.total_variants")}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600" data-testid="text-total-qty">{totalQty}</div>
                <div className="text-xs text-muted-foreground">{t("branch_stock.total_qty")}</div>
              </CardContent>
            </Card>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">{t("app.loading")}</div>
          ) : filteredStock.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t("branch_stock.no_stock")}</p>
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <div className="max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("branch_stock.product")}</TableHead>
                      <TableHead>{t("branch_stock.color")}</TableHead>
                      <TableHead>{t("branch_stock.size")}</TableHead>
                      <TableHead>{t("branch_stock.barcode")}</TableHead>
                      <TableHead className="text-center">{t("branch_stock.qty")}</TableHead>
                      <TableHead className="text-center">{t("branch_stock.last_transfer")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStock.map((item: any) => {
                      const qty = Number(item.transferred_qty);
                      return (
                        <TableRow key={item.variant_id} data-testid={`row-stock-${item.variant_id}`}>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell>{item.color || "-"}</TableCell>
                          <TableCell>{item.size || "-"}</TableCell>
                          <TableCell className="font-mono text-xs">{item.barcode || "-"}</TableCell>
                          <TableCell className="text-center font-semibold">{qty}</TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">{formatDate(item.last_transfer_date)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
