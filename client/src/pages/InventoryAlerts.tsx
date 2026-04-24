import { parseServerError } from "@/lib/queryClient";
import { AlertTriangle, Package, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useState } from "react";

interface Branch { id: number; name: string; }

export default function InventoryAlerts() {
  const { t } = useI18n();
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });


  const branchId = selectedBranch !== "all" ? Number(selectedBranch) : undefined;
  const queryParam = branchId ? `?branchId=${branchId}` : "";

  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/inventory/low-stock", branchId],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/low-stock${queryParam}`, { credentials: "include" });
      if (!res.ok) throw new Error(await parseServerError(res));
      return res.json();
    },
  });

  const outOfStock = items.filter((i) => i.totalQty <= 0);
  const lowStock   = items.filter((i) => i.totalQty > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-yellow-500" /> {t("nav.inventoryAlerts")}
        </h1>
        <p className="text-muted-foreground">مراقبة مستويات المخزون وتنبيهات النفاد</p>
      </div>

      {/* Branch filter */}
      <div>
        <Select value={selectedBranch} onValueChange={setSelectedBranch}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="اختر الفرع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الفروع</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-lg p-4 bg-red-50 dark:bg-red-950/20 flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-red-500 shrink-0" />
          <div>
            <p className="text-sm text-muted-foreground">نافد المخزون</p>
            <p className="text-2xl font-bold text-red-600">{outOfStock.length}</p>
          </div>
        </div>
        <div className="border rounded-lg p-4 bg-yellow-50 dark:bg-yellow-950/20 flex items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-yellow-500 shrink-0" />
          <div>
            <p className="text-sm text-muted-foreground">منخفض المخزون</p>
            <p className="text-2xl font-bold text-yellow-600">{lowStock.length}</p>
          </div>
        </div>
      </div>

      {/* Table */}
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
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                  جاري التحميل...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                  {t("common.no_data")}
                </TableCell>
              </TableRow>
            ) : items.map((item: any) => (
              <TableRow key={item.productId}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>
                  <Badge
                    variant={item.totalQty <= 0 ? "destructive" : "outline"}
                    className={item.totalQty > 0 ? "text-yellow-600 border-yellow-400" : ""}
                  >
                    {item.totalQty}
                  </Badge>
                </TableCell>
                <TableCell>{item.reorderLevel}</TableCell>
                <TableCell>
                  {item.totalQty <= 0 ? (
                    <Badge variant="destructive" className="gap-1">
                      <ShieldAlert className="w-3 h-3" />
                      نافد
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-400 gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {t("dashboard.low_stock_title")}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
