import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { FileSpreadsheet, TrendingUp, Users, Wallet } from "lucide-react";

export default function ReportsTab({ usersList, branchesList }: { usersList: any[], branchesList: any[] }) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary">
          <CardHeader className="p-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">{t("hr.employee_performance")}</CardTitle>
            <TrendingUp className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">{t("hr.performance_report_desc")}</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
          <CardHeader className="p-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">{t("hr.salary_expenditure")}</CardTitle>
            <Wallet className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">{t("hr.salary_report_desc")}</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500">
          <CardHeader className="p-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">{t("hr.active_employees")}</CardTitle>
            <Users className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">{t("hr.employee_list_desc")}</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-purple-500">
          <CardHeader className="p-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">{t("hr.attendance_summary")}</CardTitle>
            <FileSpreadsheet className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">{t("hr.attendance_report_desc")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg bg-muted/30">
        <div className="text-center">
          <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-lg font-medium text-muted-foreground">{t("hr.reports_placeholder")}</p>
          <p className="text-sm text-muted-foreground/70">{t("hr.reports_coming_soon")}</p>
        </div>
      </div>
    </div>
  );
}
