import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getQueryFn } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { fmtCurrency, fmtDate } from "@/lib/formatters";
import { User, Wallet, ArrowRightLeft, CreditCard, FileText, MinusCircle, Percent, PlusCircle, History } from "lucide-react";
import { statusBadgePayroll } from "./helpers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: number | null;
  usersList: any[];
}

export default function FinancialProfileDialog({ open, onOpenChange, employeeId, usersList }: Props) {
  const { t, lang } = useI18n();
  const employee = usersList.find(u => u.id === employeeId);

  const { data: advances = [] } = useQuery<any[]>({
    queryKey: [`/api/employee-advances?userId=${employeeId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!employeeId && open,
  });

  const { data: deductions = [] } = useQuery<any[]>({
    queryKey: [`/api/employee-deductions?userId=${employeeId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!employeeId && open,
  });

  const { data: commissions = [] } = useQuery<any[]>({
    queryKey: [`/api/employee-commissions?userId=${employeeId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!employeeId && open,
  });

  const { data: entitlements = [] } = useQuery<any[]>({
    queryKey: [`/api/employee-entitlements?userId=${employeeId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!employeeId && open,
  });

  const { data: payrolls = [] } = useQuery<any[]>({
    queryKey: [`/api/payroll-items?userId=${employeeId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!employeeId && open,
  });

  const { data: payments = [] } = useQuery<any[]>({
    queryKey: [`/api/payroll-payments?userId=${employeeId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!employeeId && open,
  });

  const totalAdvances = advances.reduce((s, a) => s + parseFloat(a.amount || "0"), 0);
  const totalDeductions = deductions.reduce((s, d) => s + parseFloat(d.amount || "0"), 0);
  const totalCommissions = commissions.reduce((s, c) => s + parseFloat(c.amount || "0"), 0);
  const totalEntitlements = entitlements.reduce((s, e) => s + parseFloat(e.amount || "0"), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <DialogTitle>{employee?.name || t("hr.financial_profile")}</DialogTitle>
              <DialogDescription>{t("hr.financial_profile_desc")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="summary" className="flex-1 overflow-hidden flex flex-col" dir={lang === "ar" ? "rtl" : "ltr"}>
          <TabsList className="grid grid-cols-4 md:grid-cols-7 h-auto p-1 bg-muted/50">
            <TabsTrigger value="summary" className="text-[10px] md:text-xs py-2">{t("hr.profile_tab_summary")}</TabsTrigger>
            <TabsTrigger value="advances" className="text-[10px] md:text-xs py-2">{t("hr.profile_tab_advances")}</TabsTrigger>
            <TabsTrigger value="deductions" className="text-[10px] md:text-xs py-2">{t("hr.profile_tab_deductions")}</TabsTrigger>
            <TabsTrigger value="commissions" className="text-[10px] md:text-xs py-2">{t("hr.profile_tab_commissions")}</TabsTrigger>
            <TabsTrigger value="payroll" className="text-[10px] md:text-xs py-2">{t("hr.profile_tab_payroll")}</TabsTrigger>
            <TabsTrigger value="payments" className="text-[10px] md:text-xs py-2">{t("hr.profile_tab_payments")}</TabsTrigger>
            <TabsTrigger value="statement" className="text-[10px] md:text-xs py-2">{t("hr.profile_tab_statement")}</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4 pr-1">
            <TabsContent value="summary" className="m-0 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase">{t("hr.base_salary")}</p>
                    <p className="text-lg font-bold">{fmtCurrency(employee?.salary)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-red-600">
                    <p className="text-[10px] text-muted-foreground uppercase">{t("hr.tab_advances")}</p>
                    <p className="text-lg font-bold">{fmtCurrency(totalAdvances)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-green-600">
                    <p className="text-[10px] text-muted-foreground uppercase">{t("hr.tab_commissions")}</p>
                    <p className="text-lg font-bold">{fmtCurrency(totalCommissions)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 bg-primary/5">
                    <p className="text-[10px] text-muted-foreground uppercase">{t("hr.remaining_balance")}</p>
                    <p className="text-lg font-bold text-primary">{fmtCurrency(employee?.openingPayableBalance)}</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="advances" className="m-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.date")}</TableHead>
                    <TableHead>{t("common.amount")}</TableHead>
                    <TableHead>{t("common.note")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {advances.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell>{fmtDate(a.date)}</TableCell>
                      <TableCell>{fmtCurrency(a.amount)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{a.reason}</TableCell>
                      <TableCell>
                        <Badge variant={a.isDeducted ? "secondary" : "outline"}>
                          {a.isDeducted ? t("hr.deducted_yes") : t("hr.deducted_no")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="deductions" className="m-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.date")}</TableHead>
                    <TableHead>{t("common.amount")}</TableHead>
                    <TableHead>{t("common.type")}</TableHead>
                    <TableHead>{t("common.note")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deductions.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell>{fmtDate(d.date)}</TableCell>
                      <TableCell className="text-red-600">-{fmtCurrency(d.amount)}</TableCell>
                      <TableCell>{d.type}</TableCell>
                      <TableCell>{d.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="commissions" className="m-0">
               <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.date")}</TableHead>
                    <TableHead>{t("common.amount")}</TableHead>
                    <TableHead>{t("common.type")}</TableHead>
                    <TableHead>{t("common.note")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell>{fmtDate(c.date)}</TableCell>
                      <TableCell className="text-green-600">+{fmtCurrency(c.amount)}</TableCell>
                      <TableCell>{c.type}</TableCell>
                      <TableCell>{c.reason}</TableCell>
                    </TableRow>
                  ))}
                  {entitlements.map((e: any) => (
                    <TableRow key={`e-${e.id}`} className="bg-blue-50/30">
                      <TableCell>{fmtDate(e.date)}</TableCell>
                      <TableCell className="text-blue-600 font-medium">+{fmtCurrency(e.amount)}</TableCell>
                      <TableCell>{e.type}</TableCell>
                      <TableCell>{e.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="payroll" className="m-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("hr.table_month")}</TableHead>
                    <TableHead>{t("hr.table_net")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrolls.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.month}/{p.year}</TableCell>
                      <TableCell className="font-bold">{fmtCurrency(p.netSalary)}</TableCell>
                      <TableCell>{statusBadgePayroll(p.status, t)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="payments" className="m-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.date")}</TableHead>
                    <TableHead>{t("common.amount")}</TableHead>
                    <TableHead>{t("common.method")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((pm: any) => (
                    <TableRow key={pm.id}>
                      <TableCell>{fmtDate(pm.paymentDate)}</TableCell>
                      <TableCell className="font-bold text-green-600">{fmtCurrency(pm.amount)}</TableCell>
                      <TableCell>{t(`payment_methods.${pm.method}`)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="statement" className="m-0 py-8 text-center text-muted-foreground">
              <History className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>{t("common.no_data")}</p>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
