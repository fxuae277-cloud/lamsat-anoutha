import { useState } from "react";
import { Plus, Search, Filter, ArrowRightLeft, TrendingUp, MinusCircle, Wallet, CreditCard, User, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { fmtDate, fmtCurrency } from "@/lib/formatters";
import { todayStr, useMonthNames, fmt } from "./helpers";
import type { Branch } from "@shared/schema";

interface MonthlyMovementsTabProps {
  usersList: any[];
  branchesList: Branch[];
}

export default function MonthlyMovementsTab({ usersList, branchesList }: MonthlyMovementsTabProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const MONTH_NAMES = useMonthNames();
  const now = new Date();

  // Filters
  const [filterType, setFilterType] = useState("__all__");
  const [filterEmp, setFilterEmp] = useState("__all__");
  const [filterMonth, setFilterMonth] = useState(String(now.getMonth() + 1));
  const [filterYear, setFilterYear] = useState(String(now.getFullYear()));

  // Recording Dialogs State
  const [addAdvanceOpen, setAddAdvanceOpen] = useState(false);
  const [addDeductionOpen, setAddDeductionOpen] = useState(false);
  const [addCommissionOpen, setAddCommissionOpen] = useState(false);
  const [addEntitlementOpen, setAddEntitlementOpen] = useState(false);

  // Forms State
  const [advForm, setAdvForm] = useState({ employeeId: "", amount: "", date: todayStr(), note: "" });
  const [dedForm, setDedForm] = useState({ employeeId: "", amount: "", date: todayStr(), reason: "", month: String(now.getMonth() + 1) });
  const [comForm, setComForm] = useState({ employeeId: "", amount: "", date: todayStr(), type: "sales", note: "" });
  const [entForm, setEntForm] = useState({ employeeId: "", amount: "", date: todayStr(), type: "housing", note: "" });

  const employees = usersList.filter(u => u.role !== "owner");

  // Queries
  const { data: advances = [] } = useQuery<any[]>({
    queryKey: ["/api/employee-advances"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const { data: deductions = [] } = useQuery<any[]>({
    queryKey: ["/api/employee-deductions"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const { data: commissions = [] } = useQuery<any[]>({
    queryKey: ["/api/employee-commissions"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const { data: entitlements = [] } = useQuery<any[]>({
    queryKey: ["/api/employee-entitlements"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Mutations
  const advanceMutation = useMutation({
    mutationFn: async (data: typeof advForm) => {
      await apiRequest("POST", "/api/employee-advances", {
        employeeId: Number(data.employeeId), amount: data.amount, date: data.date, note: data.note,
        deductionMode: "full_next_payroll",
      });
    },
    onSuccess: () => {
      toast({ title: t("hr.advance_recorded") });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-advances"] });
      setAddAdvanceOpen(false); setAdvForm({ employeeId: "", amount: "", date: todayStr(), note: "" });
    },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const deductionMutation = useMutation({
    mutationFn: async (data: typeof dedForm) => {
      await apiRequest("POST", "/api/employee-deductions", {
        employeeId: Number(data.employeeId), amount: data.amount, date: data.date, reason: data.reason,
        deductionType: "one_time", monthReference: `${filterYear}-${data.month.padStart(2, "0")}`,
      });
    },
    onSuccess: () => {
      toast({ title: t("hr.deduction_recorded") });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-deductions"] });
      setAddDeductionOpen(false); setDedForm({ employeeId: "", amount: "", date: todayStr(), reason: "", month: String(now.getMonth() + 1) });
    },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const commissionMutation = useMutation({
    mutationFn: async (data: typeof comForm) => {
      const d = new Date(data.date);
      await apiRequest("POST", "/api/employee-commissions", {
        employeeId: Number(data.employeeId), amount: data.amount, date: data.date,
        type: data.type, note: data.note,
        month: String(d.getMonth() + 1), year: d.getFullYear()
      });
    },
    onSuccess: () => {
      toast({ title: t("hr.commission_recorded") });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-commissions"] });
      setAddCommissionOpen(false); setComForm({ employeeId: "", amount: "", date: todayStr(), type: "sales", note: "" });
    },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const entitlementMutation = useMutation({
    mutationFn: async (data: typeof entForm) => {
      const d = new Date(data.date);
      await apiRequest("POST", "/api/employee-entitlements", {
        employeeId: Number(data.employeeId), amount: data.amount, date: data.date,
        type: data.type, note: data.note,
        month: String(d.getMonth() + 1), year: d.getFullYear()
      });
    },
    onSuccess: () => {
      toast({ title: t("hr.entitlement_recorded") });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-entitlements"] });
      setAddEntitlementOpen(false); setEntForm({ employeeId: "", amount: "", date: todayStr(), type: "housing", note: "" });
    },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const empMap = Object.fromEntries(usersList.map(u => [u.id, u.name]));

  const allMovements: any[] = [];
  advances.forEach((a: any) => {
    const d = new Date(a.date);
    allMovements.push({
      id: `adv-${a.id}`, type: "advance", employeeId: a.employee_id,
      employeeName: a.employee_name || empMap[a.employee_id] || "-",
      amount: a.amount, date: a.date, month: String(d.getMonth() + 1), year: String(d.getFullYear()),
      note: a.note, status: a.settled ? t("hr.settled") : t("hr.unsettled"),
      createdBy: a.created_by_name || "-", raw: a,
    });
  });
  deductions.forEach((d: any) => {
    const dt = new Date(d.date);
    const mr = d.month_reference || "";
    const mParts = mr.split("-");
    allMovements.push({
      id: `ded-${d.id}`, type: "deduction", employeeId: d.employee_id,
      employeeName: d.employee_name || empMap[d.employee_id] || "-",
      amount: d.amount, date: d.date,
      month: mParts.length === 2 ? String(parseInt(mParts[1])) : String(dt.getMonth() + 1),
      year: mParts.length === 2 ? mParts[0] : String(dt.getFullYear()),
      note: d.reason, status: d.applied_in_payroll_id ? t("hr.applied") : t("hr.not_applied"),
      createdBy: d.created_by_name || "-", raw: d,
    });
  });
  commissions.forEach((c: any) => {
    allMovements.push({
      id: `com-${c.id}`, type: "commission", employeeId: c.employeeId,
      employeeName: empMap[c.employeeId] || "-",
      amount: c.amount, date: c.date, month: String(c.month), year: String(c.year),
      note: c.note, status: c.status === "paid" ? t("hr.status_paid") : t("hr.status_pending"),
      createdBy: "-", raw: c,
    });
  });
  entitlements.forEach((e: any) => {
    allMovements.push({
      id: `ent-${e.id}`, type: "entitlement", employeeId: e.employeeId,
      employeeName: empMap[e.employeeId] || "-",
      amount: e.amount, date: e.date, month: String(e.month), year: String(e.year),
      note: e.note, status: e.status === "paid" ? t("hr.status_paid") : t("hr.status_pending"),
      createdBy: "-", raw: e,
    });
  });

  allMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filtered = allMovements.filter(m => {
    if (filterType !== "__all__" && m.type !== filterType) return false;
    if (filterEmp !== "__all__" && String(m.employeeId) !== filterEmp) return false;
    if (m.month !== filterMonth || m.year !== filterYear) return false;
    return true;
  });

  const totalAdvances = filtered.filter(m => m.type === "advance").reduce((s, m) => s + parseFloat(m.amount || "0"), 0);
  const totalDeductions = filtered.filter(m => m.type === "deduction").reduce((s, m) => s + parseFloat(m.amount || "0"), 0);
  const totalCommissions = filtered.filter(m => m.type === "commission").reduce((s, m) => s + parseFloat(m.amount || "0"), 0);
  const totalEntitlements = filtered.filter(m => m.type === "entitlement").reduce((s, m) => s + parseFloat(m.amount || "0"), 0);

  const typeLabel = (type: string) => {
    if (type === "advance") return t("hr.movement_type_advance");
    if (type === "deduction") return t("hr.movement_type_deduction");
    if (type === "commission") return t("hr.movement_type_commission");
    if (type === "entitlement") return t("hr.movement_type_entitlement");
    return type;
  };

  const typeBadge = (type: string) => {
    if (type === "advance") return <Badge className="bg-red-100 text-red-700 text-xs">{typeLabel(type)}</Badge>;
    if (type === "deduction") return <Badge className="bg-orange-100 text-orange-700 text-xs">{typeLabel(type)}</Badge>;
    if (type === "commission") return <Badge className="bg-blue-100 text-blue-700 text-xs">{typeLabel(type)}</Badge>;
    return <Badge className="bg-green-100 text-green-700 text-xs">{typeLabel(type)}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold">{t("hr.financial_movements_title")}</h3>
          <p className="text-xs text-muted-foreground">{t("hr.financial_movements_subtitle")}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" className="gap-1 bg-red-600 hover:bg-red-700" onClick={() => setAddAdvanceOpen(true)} data-testid="button-add-advance">
            <Plus className="w-3.5 h-3.5" /> {t("hr.record_advance")}
          </Button>
          <Button size="sm" className="gap-1 bg-orange-600 hover:bg-orange-700" onClick={() => setAddDeductionOpen(true)} data-testid="button-add-deduction">
            <Plus className="w-3.5 h-3.5" /> {t("hr.record_deduction")}
          </Button>
          <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700" onClick={() => setAddCommissionOpen(true)} data-testid="button-add-commission">
            <Plus className="w-3.5 h-3.5" /> {t("hr.record_commission")}
          </Button>
          <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700" onClick={() => setAddEntitlementOpen(true)} data-testid="button-add-entitlement">
            <Plus className="w-3.5 h-3.5" /> {t("hr.record_entitlement")}
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-end">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("hr.all_types")}</SelectItem>
            <SelectItem value="advance">{t("hr.movement_type_advance")}</SelectItem>
            <SelectItem value="deduction">{t("hr.movement_type_deduction")}</SelectItem>
            <SelectItem value="commission">{t("hr.movement_type_commission")}</SelectItem>
            <SelectItem value="entitlement">{t("hr.movement_type_entitlement")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEmp} onValueChange={setFilterEmp}>
          <SelectTrigger className="w-44"><SelectValue placeholder={t("hr.all_employees")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("hr.all_employees")}</SelectItem>
            {employees.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="number" className="w-24" value={filterYear} onChange={e => setFilterYear(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-red-50 border-red-100">
          <CardContent className="p-3">
            <p className="text-[10px] text-red-600 font-medium">{t("hr.total_advances")}</p>
            <p className="text-lg font-bold text-red-700">{fmt(totalAdvances)}</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-100">
          <CardContent className="p-3">
            <p className="text-[10px] text-orange-600 font-medium">{t("hr.total_deductions")}</p>
            <p className="text-lg font-bold text-orange-700">{fmt(totalDeductions)}</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-3">
            <p className="text-[10px] text-blue-600 font-medium">{t("hr.total_commissions")}</p>
            <p className="text-lg font-bold text-blue-700">{fmt(totalCommissions)}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100">
          <CardContent className="p-3">
            <p className="text-[10px] text-green-600 font-medium">{t("hr.total_entitlements")}</p>
            <p className="text-lg font-bold text-green-700">{fmt(totalEntitlements)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[150px]">{t("common.employee")}</TableHead>
              <TableHead>{t("hr.movement_type")}</TableHead>
              <TableHead>{t("common.amount")}</TableHead>
              <TableHead>{t("hr.month_reference")}</TableHead>
              <TableHead>{t("common.date")}</TableHead>
              <TableHead className="max-w-[200px]">{t("hr.reason")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("hr.no_ledger_entries")}</TableCell></TableRow>
            ) : filtered.map((m: any) => (
              <TableRow key={m.id} data-testid={`row-movement-${m.id}`}>
                <TableCell className="font-medium">{m.employeeName}</TableCell>
                <TableCell>{typeBadge(m.type)}</TableCell>
                <TableCell className="font-bold">{fmt(m.amount)}</TableCell>
                <TableCell>{MONTH_NAMES[parseInt(m.month) - 1]} {m.year}</TableCell>
                <TableCell>{fmtDate(m.date)}</TableCell>
                <TableCell className="text-sm truncate">{m.note || "-"}</TableCell>
                <TableCell><Badge variant="outline" className="text-[10px] h-5">{m.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add Advance Dialog */}
      <Dialog open={addAdvanceOpen} onOpenChange={setAddAdvanceOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t("hr.record_advance")}</DialogTitle>
            <DialogDescription>{t("hr.record_advance_desc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.employee")} *</label>
              <Select value={advForm.employeeId} onValueChange={v => setAdvForm({...advForm, employeeId: v})}>
                <SelectTrigger><SelectValue placeholder={t("hr.select_employee_prompt")} /></SelectTrigger>
                <SelectContent>{employees.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("common.amount")} *</label>
                <Input type="number" step="0.001" value={advForm.amount} onChange={e => setAdvForm({...advForm, amount: e.target.value})} data-testid="input-advance-amount" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("common.date")} *</label>
                <DateInput value={advForm.date} onChange={e => setAdvForm({...advForm, date: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.notes")}</label>
              <Input placeholder={t("hr.advance_note_placeholder")} value={advForm.note} onChange={e => setAdvForm({...advForm, note: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => advanceMutation.mutate(advForm)} disabled={advanceMutation.isPending || !advForm.employeeId || !advForm.amount} data-testid="button-save-advance">
              {advanceMutation.isPending ? t("common.saving") : t("hr.record_advance")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Deduction Dialog */}
      <Dialog open={addDeductionOpen} onOpenChange={setAddDeductionOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t("hr.record_deduction")}</DialogTitle>
            <DialogDescription>{t("hr.record_deduction_desc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.employee")} *</label>
              <Select value={dedForm.employeeId} onValueChange={v => setDedForm({...dedForm, employeeId: v})}>
                <SelectTrigger><SelectValue placeholder={t("hr.select_employee_prompt")} /></SelectTrigger>
                <SelectContent>{employees.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("common.amount")} *</label>
                <Input type="number" step="0.001" value={dedForm.amount} onChange={e => setDedForm({...dedForm, amount: e.target.value})} data-testid="input-deduction-amount" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("hr.month_reference")}</label>
                <Select value={dedForm.month} onValueChange={v => setDedForm({...dedForm, month: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("common.date")} *</label>
                <DateInput value={dedForm.date} onChange={e => setDedForm({...dedForm, date: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("hr.reason")} *</label>
              <Input placeholder={t("hr.notes_placeholder")} value={dedForm.reason} onChange={e => setDedForm({...dedForm, reason: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => deductionMutation.mutate(dedForm)} disabled={deductionMutation.isPending || !dedForm.employeeId || !dedForm.amount || !dedForm.reason} data-testid="button-save-deduction">
              {deductionMutation.isPending ? t("common.saving") : t("hr.record_deduction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Commission Dialog */}
      <Dialog open={addCommissionOpen} onOpenChange={setAddCommissionOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t("hr.record_commission")}</DialogTitle>
            <DialogDescription>{t("hr.record_commission_desc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.employee")} *</label>
              <Select value={comForm.employeeId} onValueChange={v => setComForm({...comForm, employeeId: v})}>
                <SelectTrigger><SelectValue placeholder={t("hr.select_employee_prompt")} /></SelectTrigger>
                <SelectContent>{employees.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("common.amount")} *</label>
                <Input type="number" step="0.001" value={comForm.amount} onChange={e => setComForm({...comForm, amount: e.target.value})} data-testid="input-commission-amount" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("common.date")} *</label>
                <DateInput value={comForm.date} onChange={e => setComForm({...comForm, date: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.type")}</label>
              <Select value={comForm.type} onValueChange={v => setComForm({...comForm, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">{t("hr.commission_type_sales")}</SelectItem>
                  <SelectItem value="fixed">{t("hr.commission_type_fixed")}</SelectItem>
                  <SelectItem value="other">{t("hr.commission_type_other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.notes")}</label>
              <Input placeholder={t("hr.notes_placeholder")} value={comForm.note} onChange={e => setComForm({...comForm, note: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => commissionMutation.mutate(comForm)} disabled={commissionMutation.isPending || !comForm.employeeId || !comForm.amount} data-testid="button-save-commission">
              {commissionMutation.isPending ? t("common.saving") : t("hr.record_commission")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Entitlement Dialog */}
      <Dialog open={addEntitlementOpen} onOpenChange={setAddEntitlementOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t("hr.record_entitlement")}</DialogTitle>
            <DialogDescription>{t("hr.record_entitlement_desc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.employee")} *</label>
              <Select value={entForm.employeeId} onValueChange={v => setEntForm({...entForm, employeeId: v})}>
                <SelectTrigger><SelectValue placeholder={t("hr.select_employee_prompt")} /></SelectTrigger>
                <SelectContent>{employees.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("common.amount")} *</label>
                <Input type="number" step="0.001" value={entForm.amount} onChange={e => setEntForm({...entForm, amount: e.target.value})} data-testid="input-entitlement-amount" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("common.date")} *</label>
                <DateInput value={entForm.date} onChange={e => setEntForm({...entForm, date: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.type")}</label>
              <Select value={entForm.type} onValueChange={v => setEntForm({...entForm, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="housing">{t("hr.entitlement_type_housing")}</SelectItem>
                  <SelectItem value="transport">{t("hr.entitlement_type_transport")}</SelectItem>
                  <SelectItem value="other">{t("hr.entitlement_type_other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.notes")}</label>
              <Input placeholder={t("hr.notes_placeholder")} value={entForm.note} onChange={e => setEntForm({...entForm, note: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => entitlementMutation.mutate(entForm)} disabled={entitlementMutation.isPending || !entForm.employeeId || !entForm.amount} data-testid="button-save-entitlement">
              {entitlementMutation.isPending ? t("common.saving") : t("hr.record_entitlement")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
