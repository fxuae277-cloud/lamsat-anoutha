import { Search, Plus, Edit, Wallet, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { fmt } from "./helpers";

interface EmployeesTabProps {
  usersList: any[];
  branchMap: Record<string, string>;
  branchesList: any[];
  search: string;
  setSearch: (s: string) => void;
  onAdd: () => void;
  onEdit: (u: any) => void;
  onPerf: (u: any) => void;
  onFinProfile: (u: any) => void;
}

export function EmployeesTab({
  usersList,
  branchMap,
  branchesList,
  search,
  setSearch,
  onAdd,
  onEdit,
  onPerf,
  onFinProfile
}: EmployeesTabProps) {
  const { t } = useI18n();

  const ROLE_LABELS: Record<string, string> = {
    owner: t("hr.role_labels.owner"),
    admin: t("hr.role_labels.admin"),
    manager: t("hr.role_labels.manager"),
    cashier: t("hr.role_labels.cashier"),
    employee: t("hr.role_labels.employee"),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="ps-9" placeholder={t("hr.search_placeholder")} value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-emp" />
        </div>
        <Button className="gap-1" onClick={onAdd} data-testid="button-add-employee">
          <Plus className="w-4 h-4" />
          {t("hr.add_employee")}
        </Button>
      </div>
      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>{t("hr.full_name")}</TableHead>
              <TableHead>{t("settings.branch_label")}</TableHead>
              <TableHead>{t("settings.role_label")}</TableHead>
              <TableHead>{t("hr.base_salary")}</TableHead>
              <TableHead>{t("hr.phone")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead>{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersList.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("hr.no_employees")}</TableCell></TableRow>
            ) : usersList.map((u: any) => (
              <TableRow key={u.id} data-testid={`row-emp-${u.id}`}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="text-sm">{branchMap[u.branchId] || "-"}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{ROLE_LABELS[u.role] || u.role}</Badge></TableCell>
                <TableCell className="font-medium">{fmt(u.salary)} {t("common.omr")}</TableCell>
                <TableCell className="text-sm">{u.phone || "-"}</TableCell>
                <TableCell>
                  {u.isActive ? (
                    <Badge className="bg-green-100 text-green-700 text-xs">{t("status_labels.active")}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-red-500 text-xs">{t("status_labels.inactive")}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(u)} title={t("common.edit")} data-testid={`button-edit-emp-${u.id}`}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-600" onClick={() => onFinProfile(u)} title={t("hr.financial_profile")} data-testid={`button-fin-${u.id}`}>
                      <Wallet className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-primary" onClick={() => onPerf(u)} title={t("hr.performance_report")} data-testid={`button-perf-${u.id}`}>
                      <BarChart3 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
