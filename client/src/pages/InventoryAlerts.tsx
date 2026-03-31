import { AlertTriangle, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";

export default function InventoryAlerts() {
  const { t } = useI18n();

  const { data: dashboard } = useQuery<any>({
    queryKey: ["/api/dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard", { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const lowStock: any[] = dashboard?.lowStock ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-yellow-500" /> {t("nav.inventoryAlerts")}
        </h1>
        <p className="text-muted-foreground">{t("dashboard.low_stock_title")}</p>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><Package className="w-4 h-4 inline ml-1" />{t("products.table_name")}</TableHead>
              <TableHead>{t("products.qty_on_hand")}</TableHead>
              <TableHead>{t("products.reorder_level")}</TableHead>
              <TableHead>{t("products.table_status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lowStock.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                  {t("common.no_data")}
                </TableCell>
              </TableRow>
            ) : lowStock.map((item: any) => (
              <TableRow key={item.productId}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>
                  <Badge variant="destructive">{item.totalQty}</Badge>
                </TableCell>
                <TableCell>{item.reorderLevel}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-yellow-600 border-yellow-400">
                    <AlertTriangle className="w-3 h-3 ml-1" />
                    {t("dashboard.low_stock_title")}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
