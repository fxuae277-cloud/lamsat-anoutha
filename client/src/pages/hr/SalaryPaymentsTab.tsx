import { useState, useRef } from "react";
import { FileText, DollarSign, Clock, Receipt, CircleDollarSign, Printer } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { fmtDate } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useMonthNames, paymentStatusBadge, todayStr, fmt } from "./helpers";

export default function SalaryPaymentsTab({ usersList }: { usersList: any[] }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const MONTH_NAMES = useMonthNames();
  const now = new Date();
  const [selMonth, setSelMonth] = useState(String(now.getMonth() + 1));
  const [selYear, setSelYear] = useState(String(now.getFullYear()));
  const [filterEmp, setFilterEmp] = useState("__all__");
  const [filterStatus, setFilterStatus] = useState("__all__");
  const [payOpen, setPayOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [slipOpen, setSlipOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<any>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("bank_transfer");
  const [payDate, setPayDate] = useState(todayStr());
  const [payNote, setPayNote] = useState("");
  const [payRefNo, setPayRefNo] = useState("");

  const employees = usersList.filter(u => u.role !== "owner");

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

  const paymentHistoryKey = selectedDetail ? `/api/payroll-detail/\${selectedDetail.id}/payments` : null;
  const { data: paymentHistory = [] } = useQuery<any[]>({
    queryKey: [paymentHistoryKey],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!selectedDetail && historyOpen,
  });

  const filteredDetails = details.filter((d: any) => {
    if (filterEmp !== "__all__" && String(d.employee_id) !== filterEmp) return false;
    if (filterStatus === "paid" && d.payment_status !== "paid") return false;
    if (filterStatus === "partial" && d.payment_status !== "partial") return false;
    if (filterStatus === "unpaid" && d.payment_status !== "unpaid") return false;
    return true;
  });

  const totalNet = filteredDetails.reduce((s, d: any) => s + parseFloat(d.net_salary || "0"), 0);
  const totalPaid = filteredDetails.reduce((s, d: any) => s + parseFloat(d.total_paid || "0"), 0);
  const totalRemaining = filteredDetails.reduce((s, d: any) => s + parseFloat(d.remaining || "0"), 0);

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDetail || !currentRun) return;
      await apiRequest("POST", "/api/salary-payments", {
        payrollId: currentRun.id, payrollDetailId: selectedDetail.id,
        employeeId: selectedDetail.employee_id, amount: payAmount,
        paymentDate: payDate, paymentMethod: payMethod,
        referenceNo: payRefNo || undefined, branchId: selectedDetail.branch_id, note: payNote,
      });
    },
    onSuccess: () => {
      toast({ title: t("hr.payment_saved") });
      queryClient.invalidateQueries({ queryKey: [detailsKey] });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
      setPayOpen(false); setPayAmount(""); setPayNote(""); setPayRefNo("");
    },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const slipRef = useRef<HTMLDivElement>(null);
  const handleSlipPrint = () => {
    if (!slipRef.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html dir="\${lang === 'ar' ? 'rtl' : 'ltr'}"><head><title>\${t("hr.salary_slip")}</title><style>@font-face{font-family:'DigitsEN';font-weight:400;src:url(https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf) format('truetype');unicode-range:U+0020-007F}@font-face{font-family:'DigitsEN';font-weight:700;src:url(https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf) format('truetype');unicode-range:U+0020-007F}</style><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet"><style>body{font-family:'DigitsEN','Cairo',Arial,sans-serif;padding:30px;max-width:600px;margin:0 auto}table{width:100%;border-collapse:collapse;margin:15px 0}th,td{border:1px solid #ddd;padding:10px;text-align:\${lang === 'ar' ? 'right' : 'left'};font-size:13px}th{background:#f5f5f5;font-weight:bold;width:40%}</style></head><body>\${slipRef.current.innerHTML}</body></html>`);
    w.document.close(); w.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold">{t("hr.payments_title")}</h3>
          <p className="text-xs text-muted-foreground">{t("hr.payments_subtitle")}</p>
        </div>
        <div className="flex gap-2 flex-wrap items-end">
          <Select value={selMonth} onValueChange={setSelMonth}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="number" className="w-24" value={selYear} onChange={e => setSelYear(e.target.value)} />
          <Select value={filterEmp} onValueChange={setFilterEmp}>
            <SelectTrigger className="w-44"><SelectValue placeholder={t("hr.all_employees")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("hr.all_employees")}</SelectItem>
              {employees.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("common.all")}</SelectItem>
              <SelectItem value="paid">{t("hr.status_paid")}</SelectItem>
              <SelectItem value="partial">{t("hr.status_partial")}</SelectItem>
              <SelectItem value="unpaid">{t("hr.status_unpaid")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!currentRun ? (
        <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
          <p>{t("hr.no_payroll_for_month")}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-blue-600">{t("hr.total_net")}</p>
              <p className="text-sm font-bold text-blue-700">{totalNet.toFixed(3)}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-green-600">{t("hr.total_paid")}</p>
              <p className="text-sm font-bold text-green-700">{totalPaid.toFixed(3)}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-red-600">{t("hr.remaining_to_pay")}</p>
              <p className="text-sm font-bold text-red-700">{totalRemaining.toFixed(3)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-gray-600">{t("hr.payroll_count")}</p>
              <p className="text-sm font-bold text-gray-700">{filteredDetails.length}</p>
            </div>
          </div>

          <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>{t("common.employee")}</TableHead>
                  <TableHead>{t("common.branch")}</TableHead>
                  <TableHead>{t("hr.net_salary")}</TableHead>
                  <TableHead>{t("hr.total_paid")}</TableHead>
                  <TableHead>{t("hr.remaining_to_pay")}</TableHead>
                  <TableHead>{t("hr.payment_status")}</TableHead>
                  <TableHead className="w-[280px]">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDetails.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("hr.no_payment_data")}</TableCell></TableRow>
                ) : filteredDetails.map((d: any) => {
                  const remaining = parseFloat(d.remaining || "0");
                  const allowedStatuses = ["approved", "partial", "reviewed"];
                  const canPay = allowedStatuses.includes(currentRun.status) && d.payment_status !== "paid" && remaining > 0;
                  return (
                    <TableRow key={d.id} data-testid={`row-payment-\${d.id}`}>
                      <TableCell className="font-medium">{d.employee_name}</TableCell>
                      <TableCell className="text-sm">{d.branch_name || "-"}</TableCell>
                      <TableCell className="font-bold text-primary">{fmt(d.net_salary)}</TableCell>
                      <TableCell className="text-green-600 font-medium">{fmt(d.total_paid)}</TableCell>
                      <TableCell className="text-red-600 font-bold">{fmt(d.remaining)}</TableCell>
                      <TableCell>{paymentStatusBadge(d.payment_status, t)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Button
                            size="sm"
                            className={canPay ? "h-8 gap-1.5 bg-green-600 hover:bg-green-700 text-xs font-bold px-3" : "h-8 gap-1.5 text-xs font-bold px-3"}
                            variant={canPay ? "default" : "outline"}
                            disabled={!canPay}
                            onClick={() => { setSelectedDetail(d); setPayAmount(d.remaining); setPayDate(todayStr()); setPayMethod("bank_transfer"); setPayNote(""); setPayRefNo(""); setPayOpen(true); }}
                            data-testid={`button-pay-\${d.id}`}
                          >
                            <DollarSign className="w-3.5 h-3.5" /> {t("hr.register_payment")}
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => { setSelectedDetail(d); setHistoryOpen(true); }}>
                            <Clock className="w-3 h-3" /> {t("hr.payment_log")}
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => { setSelectedDetail(d); setSlipOpen(true); }}>
                            <Receipt className="w-3 h-3" /> {t("hr.salary_slip_view")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Record Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CircleDollarSign className="w-5 h-5 text-green-600" />
              {t("hr.record_payment_title")}
            </DialogTitle>
            <DialogDescription>{selectedDetail?.employee_name} - {MONTH_NAMES[parseInt(selMonth) - 1]} {selYear}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            <div className="bg-blue-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between"><span>{t("common.employee")}</span><span className="font-bold">{selectedDetail?.employee_name}</span></div>
              <div className="flex justify-between"><span>{t("hr.filter_month")}</span><span className="font-bold">{MONTH_NAMES[parseInt(selMonth) - 1]} {selYear}</span></div>
              <div className="flex justify-between"><span>{t("hr.net_salary")}</span><span className="font-bold">{fmt(selectedDetail?.net_salary)}</span></div>
              <div className="flex justify-between"><span>{t("hr.previously_paid")}</span><span className="font-bold text-green-600">{fmt(selectedDetail?.total_paid)}</span></div>
              <div className="flex justify-between border-t pt-1"><span className="font-bold">{t("hr.remaining_before_payment")}</span><span className="font-bold text-red-600">{fmt(selectedDetail?.remaining)}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("hr.current_payment_amount")} *</label>
                <Input type="number" step="0.001" value={payAmount} onChange={e => setPayAmount(e.target.value)} data-testid="input-salary-pay-amount" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("hr.payment_date")} *</label>
                <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} data-testid="input-salary-pay-date" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("hr.payment_method")}</label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t("hr.pay_cash")}</SelectItem>
                  <SelectItem value="bank_transfer">{t("hr.pay_bank")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("hr.transfer_reference")}</label>
              <Input placeholder={t("hr.reference_no_placeholder")} value={payRefNo} onChange={e => setPayRefNo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.notes")}</label>
              <Input placeholder={t("hr.notes_placeholder")} value={payNote} onChange={e => setPayNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayAmount(selectedDetail?.remaining || "0")}>{t("hr.pay_full")}</Button>
            <Button onClick={() => payMutation.mutate()} disabled={payMutation.isPending || !payAmount || parseFloat(payAmount) <= 0} className="bg-green-600 hover:bg-green-700" data-testid="button-confirm-payment">
              {payMutation.isPending ? t("common.saving") : t("hr.register_payment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Salary Slip Dialog */}
      <Dialog open={slipOpen} onOpenChange={setSlipOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Receipt className="w-5 h-5 text-primary" />{t("hr.salary_slip_title")}</DialogTitle>
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
            {selectedDetail && parseFloat(selectedDetail.remaining || "0") > 0 && ["approved", "partial", "reviewed"].includes(currentRun?.status) && (
              <Button className="gap-1 bg-green-600 hover:bg-green-700" onClick={() => { setSlipOpen(false); setPayAmount(selectedDetail.remaining); setPayDate(todayStr()); setPayMethod("bank_transfer"); setPayNote(""); setPayRefNo(""); setPayOpen(true); }}>
                <DollarSign className="w-3.5 h-3.5" /> {t("hr.register_payment")}
              </Button>
            )}
            <Button variant="outline" className="gap-1" onClick={handleSlipPrint}>
              <Printer className="w-3.5 h-3.5" /> {t("hr.print")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              {t("hr.payment_history")} - {selectedDetail?.employee_name}
            </DialogTitle>
            <DialogDescription>{MONTH_NAMES[parseInt(selMonth) - 1]} {selYear}</DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>{t("common.amount")}</TableHead>
                <TableHead>{t("hr.payment_date")}</TableHead>
                <TableHead>{t("hr.payment_method")}</TableHead>
                <TableHead>{t("hr.reference_no")}</TableHead>
                <TableHead>{t("common.notes")}</TableHead>
                <TableHead>{t("hr.created_by")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentHistory.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">{t("hr.no_payments")}</TableCell></TableRow>
              ) : paymentHistory.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-bold text-green-600">{fmt(p.amount)} {t("common.omr")}</TableCell>
                  <TableCell className="text-sm">{fmtDate(p.payment_date)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{p.payment_method === "cash" ? t("hr.pay_cash") : t("hr.pay_bank")}</Badge></TableCell>
                  <TableCell className="text-sm">{p.reference_no || "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.note || "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.paid_by_name || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {paymentHistory.length > 0 && (
            <div className="p-2 bg-green-50 rounded-lg text-center text-sm font-bold text-green-700">
              {t("hr.total_paid")}: {paymentHistory.reduce((s: number, p: any) => s + parseFloat(p.amount || "0"), 0).toFixed(3)} {t("common.omr")}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
