import { useState, useRef } from "react";
import { Plus, FileText, RefreshCw, ClipboardCheck, CheckCircle2, RotateCcw, XCircle, Printer, FileSpreadsheet, Receipt } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { fmtCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMonthNames, statusBadgePayroll, paymentStatusBadge, fmt } from "./helpers";

export default function PayrollSheetTab({ usersList }: { usersList: any[] }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const { data } = useAuth();
  const user = data?.user;
  const MONTH_NAMES = useMonthNames();
  const printRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const [selMonth, setSelMonth] = useState(String(now.getMonth() + 1));
  const [selYear, setSelYear] = useState(String(now.getFullYear()));
  const [createOpen, setCreateOpen] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [slipOpen, setSlipOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<any>(null);

  const { data: payrollRuns = [] } = useQuery<any[]>({
    queryKey: ["/api/payroll-runs"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const currentRun = payrollRuns.find((r: any) => String(r.month) === selMonth && String(r.year) === selYear && r.status !== "cancelled");

  const detailsKey = currentRun ? `/api/payroll-runs/${currentRun.id}/details-with-payments` : null;
  const { data: details = [] } = useQuery<any[]>({
    queryKey: [detailsKey],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!currentRun,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/payroll-runs", { month: selMonth, year: Number(selYear), note: newNote });
    },
    onSuccess: () => {
      toast({ title: t("hr.payroll_generated") });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
      setCreateOpen(false); setNewNote("");
    },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("POST", `/api/payroll-runs/${id}/approve`, {}); },
    onSuccess: () => { toast({ title: t("hr.payroll_approved") }); queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] }); queryClient.invalidateQueries({ queryKey: [detailsKey] }); },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const reviewMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("POST", `/api/payroll-runs/${id}/review`, {}); },
    onSuccess: () => { toast({ title: t("hr.payroll_reviewed") }); queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] }); },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("POST", `/api/payroll-runs/${id}/cancel`, {}); },
    onSuccess: () => { toast({ title: t("hr.payroll_cancelled") }); queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] }); },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const reopenMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("POST", `/api/payroll-runs/${id}/reopen`, {}); },
    onSuccess: () => { toast({ title: t("hr.payroll_reopened") }); queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] }); },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("POST", `/api/payroll-runs/${id}/regenerate`, {}); },
    onSuccess: () => {
      toast({ title: t("hr.payroll_recalculated") });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
      queryClient.invalidateQueries({ queryKey: [detailsKey] });
    },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const totalBasic = details.reduce((s, d: any) => s + parseFloat(d.basic_salary || "0"), 0);
  const totalCommissions = details.reduce((s, d: any) => s + parseFloat(d.commission || "0"), 0);
  const totalDeductions = details.reduce((s, d: any) => s + parseFloat(d.deductions || "0"), 0);
  const totalAdvances = details.reduce((s, d: any) => s + parseFloat(d.advances || "0"), 0);
  const totalNet = details.reduce((s, d: any) => s + parseFloat(d.net_salary || "0"), 0);
  const totalPaid = details.reduce((s, d: any) => s + parseFloat(d.total_paid || "0"), 0);
  const totalRemaining = totalNet - totalPaid;

  const slipRef = useRef<HTMLDivElement>(null);
  const handleSlipPrint = () => {
    if (!slipRef.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><title>\${t("hr.salary_slip")}</title><style>body{font-family:'DigitsEN','Cairo',Arial,sans-serif;padding:30px;max-width:600px;margin:0 auto}table{width:100%;border-collapse:collapse;margin:15px 0}th,td{border:1px solid #ddd;padding:10px;text-align:\${lang === 'ar' ? 'right' : 'left'};font-size:13px}th{background:#f5f5f5;font-weight:bold;width:40%}.net{font-size:16px;font-weight:bold;color:#2563eb;text-align:center;margin:15px 0;padding:10px;background:#eff6ff;border-radius:8px}</style><style>@font-face{font-family:'DigitsEN';font-weight:400;src:url(https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf) format('truetype');unicode-range:U+0020-007F}@font-face{font-family:'DigitsEN';font-weight:700;src:url(https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf) format('truetype');unicode-range:U+0020-007F}</style><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet"></head><body>\${slipRef.current.innerHTML}</body></html>`);
    w.document.close(); w.print();
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><title>\${t("hr.monthly_salaries_title")}</title><style>@font-face{font-family:'DigitsEN';font-weight:400;src:url(https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf) format('truetype');unicode-range:U+0020-007F}@font-face{font-family:'DigitsEN';font-weight:700;src:url(https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf) format('truetype');unicode-range:U+0020-007F}</style><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet"><style>body{font-family:'DigitsEN','Cairo',Arial,sans-serif;padding:30px}table{width:100%;border-collapse:collapse;margin:15px 0}th,td{border:1px solid #ddd;padding:8px;text-align:\${lang === 'ar' ? 'right' : 'left'};font-size:12px}th{background:#f5f5f5;font-weight:bold}.header{text-align:center;margin-bottom:20px}</style></head><body><div class="header"><h1>\${t("hr.monthly_salaries_title")} - \${MONTH_NAMES[parseInt(selMonth) - 1]} \${selYear}</h1></div>\${printRef.current.innerHTML}</body></html>`);
    w.document.close(); w.print();
  };

  const handleExport = () => {
    if (!details.length) return;
    let csv = "\uFEFF";
    csv += [t("common.employee"), t("common.branch"), t("hr.table_base_salary"), t("hr.table_commissions"), t("hr.table_deductions"), t("hr.table_advances"), t("hr.net_salary"), t("hr.total_paid"), t("hr.remaining_to_pay"), t("hr.payment_status")].join(",") + "\n";
    details.forEach((d: any) => {
      csv += [d.employee_name, d.branch_name || "-", fmt(d.basic_salary), fmt(d.commission), fmt(d.deductions), fmt(d.advances), fmt(d.net_salary), fmt(d.total_paid), fmt(d.remaining), d.payment_status === "paid" ? t("hr.status_paid") : d.payment_status === "partial" ? t("hr.status_partial") : t("hr.status_unpaid")].join(",") + "\n";
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `salaries_\${selMonth}_\${selYear}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold">{t("hr.monthly_salaries_title")}</h3>
          <p className="text-xs text-muted-foreground">{t("hr.monthly_salaries_subtitle")}</p>
        </div>
        <div className="flex gap-2 flex-wrap items-end">
          <Select value={selMonth} onValueChange={setSelMonth}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="number" className="w-24" value={selYear} onChange={e => setSelYear(e.target.value)} />
        </div>
      </div>

      {!currentRun ? (
        <div className="bg-card border rounded-xl p-8 text-center space-y-3">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground">{t("hr.no_salary_record")}</p>
          <Button className="gap-2" onClick={() => setCreateOpen(true)} data-testid="button-create-payroll">
            <Plus className="w-4 h-4" /> {t("hr.calculate_salaries")}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {statusBadgePayroll(currentRun.status, t)}
              <span className="text-sm text-muted-foreground">{MONTH_NAMES[parseInt(currentRun.month) - 1]} {currentRun.year}</span>
            </div>
            <div className="flex gap-1 flex-wrap">
              {currentRun.status === "draft" && (
                <>
                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => regenerateMutation.mutate(currentRun.id)}>
                    <RefreshCw className="w-3 h-3" /> {t("hr.payroll_recalculated")}
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1 text-xs text-blue-600" onClick={() => reviewMutation.mutate(currentRun.id)}>
                    <ClipboardCheck className="w-3 h-3" /> {t("hr.review")}
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1 text-xs text-green-600" onClick={() => approveMutation.mutate(currentRun.id)}>
                    <CheckCircle2 className="w-3 h-3" /> {t("hr.approve")}
                  </Button>
                </>
              )}
              {currentRun.status === "reviewed" && (
                <Button variant="outline" size="sm" className="gap-1 text-xs text-green-600" onClick={() => approveMutation.mutate(currentRun.id)}>
                  <CheckCircle2 className="w-3 h-3" /> {t("hr.approve")}
                </Button>
              )}
              {["approved", "partial", "paid"].includes(currentRun.status) && user?.role === "owner" && (
                <Button variant="outline" size="sm" className="gap-1 text-xs text-amber-600" onClick={() => reopenMutation.mutate(currentRun.id)}>
                  <RotateCcw className="w-3 h-3" /> {t("hr.reopen")}
                </Button>
              )}
              {["draft", "reviewed"].includes(currentRun.status) && user?.role === "owner" && (
                <Button variant="outline" size="sm" className="gap-1 text-xs text-red-500" onClick={() => cancelMutation.mutate(currentRun.id)}>
                  <XCircle className="w-3 h-3" /> {t("hr.cancel")}
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handlePrint}>
                <Printer className="w-3 h-3" /> {t("hr.print")}
              </Button>
              <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handleExport} data-testid="button-export-salaries">
                <FileSpreadsheet className="w-3 h-3" /> {t("hr.export_excel")}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            <div className="bg-indigo-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-indigo-600">{t("hr.total_basic_salary")}</p>
              <p className="text-sm font-bold text-indigo-700">{totalBasic.toFixed(3)}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-blue-600">{t("hr.total_commissions")}</p>
              <p className="text-sm font-bold text-blue-700">{totalCommissions.toFixed(3)}</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-orange-600">{t("hr.total_deductions")}</p>
              <p className="text-sm font-bold text-orange-700">{totalDeductions.toFixed(3)}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-red-600">{t("hr.total_advances")}</p>
              <p className="text-sm font-bold text-red-700">{totalAdvances.toFixed(3)}</p>
            </div>
            <div className="bg-primary/5 rounded-lg p-3 text-center">
              <p className="text-[10px] text-primary">{t("hr.total_net")}</p>
              <p className="text-sm font-bold text-primary">{totalNet.toFixed(3)}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-green-600">{t("hr.total_paid")}</p>
              <p className="text-sm font-bold text-green-700">{totalPaid.toFixed(3)}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-red-600">{t("hr.remaining_to_pay")}</p>
              <p className="text-sm font-bold text-red-700">{totalRemaining > 0 ? totalRemaining.toFixed(3) : "0.000"}</p>
            </div>
          </div>

          <div className="bg-card border shadow-sm rounded-xl overflow-hidden" ref={printRef}>
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>{t("common.employee")}</TableHead>
                  <TableHead>{t("common.branch")}</TableHead>
                  <TableHead>{t("hr.table_base_salary")}</TableHead>
                  <TableHead>{t("hr.table_commissions")}</TableHead>
                  <TableHead>{t("hr.table_deductions")}</TableHead>
                  <TableHead>{t("hr.table_advances")}</TableHead>
                  <TableHead>{t("hr.net_salary")}</TableHead>
                  <TableHead>{t("hr.total_paid")}</TableHead>
                  <TableHead>{t("hr.remaining_to_pay")}</TableHead>
                  <TableHead>{t("hr.payment_status")}</TableHead>
                  <TableHead>{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">{t("hr.no_salary_data")}</TableCell></TableRow>
                ) : details.map((d: any) => (
                  <TableRow key={d.id} data-testid={`row-salary-\${d.id}`}>
                    <TableCell className="font-medium">{d.employee_name}</TableCell>
                    <TableCell className="text-sm">{d.branch_name || "-"}</TableCell>
                    <TableCell>{fmt(d.basic_salary)}</TableCell>
                    <TableCell className="text-blue-600">{fmt(d.commission)}</TableCell>
                    <TableCell className="text-red-600">{fmt(d.deductions)}</TableCell>
                    <TableCell className="text-red-600">{fmt(d.advances)}</TableCell>
                    <TableCell className="font-bold text-primary">{fmt(d.net_salary)}</TableCell>
                    <TableCell className="text-green-600 font-medium">{fmt(d.total_paid)}</TableCell>
                    <TableCell className="text-red-600 font-bold">{fmt(d.remaining)}</TableCell>
                    <TableCell>{paymentStatusBadge(d.payment_status, t)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => { setSelectedDetail(d); setSlipOpen(true); }}>
                        <Receipt className="w-3.5 h-3.5" /> {t("hr.salary_slip_view")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Create Payroll Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t("hr.generate_payroll_title")}</DialogTitle>
            <DialogDescription>{t("hr.generate_payroll_desc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("hr.filter_month")}</p>
                <p className="font-bold">{MONTH_NAMES[parseInt(selMonth) - 1]}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("hr.filter_year")}</p>
                <p className="font-bold">{selYear}</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.notes")}</label>
              <Input placeholder={t("hr.notes_placeholder")} value={newNote} onChange={e => setNewNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} data-testid="button-save-payroll">
              {createMutation.isPending ? t("hr.generating") : t("hr.generate_btn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Salary Slip Dialog */}
      <Dialog open={slipOpen} onOpenChange={setSlipOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              {t("hr.salary_slip_title")}
            </DialogTitle>
            <DialogDescription>{selectedDetail?.employee_name} - {MONTH_NAMES[parseInt(selMonth) - 1]} {selYear}</DialogDescription>
          </DialogHeader>
          <div ref={slipRef}>
            <div style={{ textAlign: "center", borderBottom: "2px solid #333", paddingBottom: 10, marginBottom: 15 }}>
              <h1 style={{ fontSize: 16, margin: "3px 0" }}>{t("hr.company_name")}</h1>
              <h2 style={{ fontSize: 13, color: "#666", margin: "3px 0" }}>{t("hr.salary_slip")} - {MONTH_NAMES[parseInt(selMonth) - 1]} {selYear}</h2>
            </div>
            {selectedDetail && (
              <Table>
                <TableBody>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("common.employee")}</TableCell><TableCell>{selectedDetail.employee_name}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("common.branch")}</TableCell><TableCell>{selectedDetail.branch_name || "-"}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.table_base_salary")}</TableCell><TableCell>{fmt(selectedDetail.basic_salary)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.table_commissions")}</TableCell><TableCell className="text-blue-600">{fmt(selectedDetail.commission)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.table_deductions")}</TableCell><TableCell className="text-red-600">-{fmt(selectedDetail.deductions)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.table_advances")}</TableCell><TableCell className="text-red-600">-{fmt(selectedDetail.advances)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow className="bg-primary/5"><TableCell className="font-bold">{t("hr.net_salary")}</TableCell><TableCell className="font-bold text-primary text-lg">{fmt(selectedDetail.net_salary)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.total_paid")}</TableCell><TableCell className="text-green-600">{fmt(selectedDetail.total_paid)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.remaining_to_pay")}</TableCell><TableCell className="text-red-600 font-bold">{fmt(selectedDetail.remaining)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.payment_status")}</TableCell><TableCell>{paymentStatusBadge(selectedDetail.payment_status, t)}</TableCell></TableRow>
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="gap-1" onClick={handleSlipPrint} data-testid="button-print-slip">
              <Printer className="w-3.5 h-3.5" /> {t("hr.print")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
