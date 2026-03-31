import { PackageSearch, Boxes, TrendingDown, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import type { Branch } from "@shared/schema";

export default function InventoryOverview() {
  const { t } = useI18n();

  const { data: dashboard } = useQuery<any>({
    queryKey: ["/api/dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard", { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const lowStock: any[] = dashboard?.lowStock ?? [];
  const totalProducts = dashboard?.productCount ?? 0;
  const lowStockCount = dashboard?.lowStockCount ?? lowStock.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <PackageSearch className="w-6 h-6" /> {t("nav.inventoryOverview")}
        </h1>
        <p className="text-muted-foreground">{t("dashboard.subtitle") || "نظرة عامة على المخزون عبر الفروع"}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="border rounded-lg bg-card p-4 flex gap-3 items-center">
          <Boxes className="w-8 h-8 text-primary/70" />
          <div>
            <p className="text-2xl font-bold">{totalProducts}</p>
            <p className="text-sm text-muted-foreground">{t("dashboard.total_products") || "إجمالي المنتجات"}</p>
          </div>
        </div>
        <div className="border rounded-lg bg-card p-4 flex gap-3 items-center">
          <AlertTriangle className="w-8 h-8 text-yellow-500" />
          <div>
            <p className="text-2xl font-bold text-yellow-600">{lowStockCount}</p>
            <p className="text-sm text-muted-foreground">{t("dashboard.low_stock_title") || "مخزون منخفض"}</p>
          </div>
        </div>
        <div className="border rounded-lg bg-card p-4 flex gap-3 items-center">
          <PackageSearch className="w-8 h-8 text-blue-500" />
          <div>
            <p className="text-2xl font-bold">{branches.length}</p>
            <p className="text-sm text-muted-foreground">{t("nav.branches")}</p>
          </div>
        </div>
      </div>

      {/* Low stock table */}
      {lowStock.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-destructive" />
            {t("dashboard.low_stock_title")}
          </h2>
          <div className="border rounded-lg bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("products.table_name")}</TableHead>
                  <TableHead>{t("products.qty_on_hand")}</TableHead>
                  <TableHead>{t("products.reorder_level")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStock.map((item: any) => (
                  <TableRow key={item.productId}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell><Badge variant="destructive">{item.totalQty}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{item.reorderLevel}</TableCell>
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
