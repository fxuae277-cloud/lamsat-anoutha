import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getQueryFn } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { fmtCurrency } from "@/lib/formatters";
import { AlertCircle, User } from "lucide-react";

export default function RemainingTab({ usersList }: { usersList: any[] }) {
  const { t } = useI18n();
  const { data: remaining = [] } = useQuery<any[]>({
    queryKey: ["/api/payroll/remaining-by-employee"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const totalRemaining = remaining.reduce((sum, r) => sum + parseFloat(r.balance || r.remaining || "0"), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-red-50 border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {t("hr.total_remaining")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-700" data-testid="text-total-remaining">
              {fmtCurrency(totalRemaining)} <span className="text-xs font-normal">{t("common.omr")}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("hr.tab_remaining")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("hr.table_employee")}</TableHead>
                <TableHead>{t("hr.remaining_balance")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {remaining.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                    {t("common.no_data")}
                  </TableCell>
                </TableRow>
              ) : (
                remaining.map((r: any) => {
                  return (
                    <TableRow key={r.employee_id} data-testid={`row-remaining-${r.employee_id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          {r.employee_name || `#${r.employee_id}`}
                        </div>
                      </TableCell>
                      <TableCell className="text-red-600 font-bold">
                        {fmtCurrency(r.balance || r.remaining)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
