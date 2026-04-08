import { useState } from "react";
import { FileSpreadsheet, Search, Eye, Printer, Download, X, Banknote, CreditCard, Building2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { Branch, User } from "@shared/schema";
import { useI18n } from "@/lib/i18n";
import { fmtDate, fmtDateTime, fmtTime } from "@/lib/formatters";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function startOfMonthStr() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}
function omr(val: string | number | null) {
  if (val === null || val === undefined) return "0.000";
  return parseFloat(String(val)).toFixed(3);
}

function InvoiceDetailModal({ saleId, open, onClose }: { saleId: number | null; open: boolean; onClose: () => void }) {
  const { t, lang } = useI18n();
  const PM_LABELS: Record<string, string> = {
    cash: t("payment_methods.cash"),
    card: t("payment_methods.card"),
    bank_transfer: t("payment_methods.bank_transfer"),
  };

  const { data: detail, isLoading } = useQuery<any>({
    queryKey: ["/api/sales", saleId],
    queryFn: async () => {
      const res = await fetch(`/api/sales/${saleId}`, { credentials: "include" });
      if (!res.ok) throw new Error(t("common.error"));
      return res.json();
    },
    enabled: !!saleId && open,
  });

  const locale = "en-US";

  function handleThermalPrint() {
    if (!detail) return;
    const pmText = PM_LABELS[detail.paymentMethod] || detail.paymentMethod;
    const dateStr = detail.createdAt ? fmtDateTime(detail.createdAt) : "";
    const itemsHtml = (detail.items || []).map((item: any) => `
      <tr>
        <td style="text-align:left;font-size:11px;padding:1px 0">${omr(item.total)}</td>
        <td style="text-align:center;font-size:11px;padding:1px 0">${omr(item.unitPrice)} x${item.quantity}</td>
        <td style="text-align:right;font-size:12px;padding:1px 0">${item.productName || "—"}</td>
      </tr>
    `).join("");
    const discountLine = parseFloat(detail.discount || "0") > 0
      ? `<div style="display:flex;justify-content:space-between"><span>${t("invoices.table_discount")}</span><span>-${omr(detail.discount)} OMR</span></div>` : "";
    const html = `<!DOCTYPE html><html dir="${lang === "ar" ? "rtl" : "ltr"}" lang="${lang}"><head><meta charset="utf-8">
      <title>${t("invoices.print_thermal")}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&family=Inter:wght@400;700&display=swap" rel="stylesheet">
      <style>@font-face{font-family:'DigitsEN';font-style:normal;font-weight:400;src:url(https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf) format('truetype');unicode-range:U+0020-007F}@font-face{font-family:'DigitsEN';font-style:normal;font-weight:700;src:url(https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf) format('truetype');unicode-range:U+0020-007F}</style>
      <style>
        @page { size: 80mm auto; margin: 0; }
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'DigitsEN','Cairo',sans-serif; width:80mm; padding:6mm 4mm; color:#000; direction:${lang === "ar" ? "rtl" : "ltr"}; font-size:12px; }
        .center { text-align:center; }
        .brand { font-size:18px; font-weight:700; color:#8b5a7a; }
        .sep { border-bottom:1px dashed #999; margin:4px 0; }
        .row { display:flex; justify-content:space-between; font-size:11px; padding:1px 0; }
        .total-row { display:flex; justify-content:space-between; font-size:14px; font-weight:700; padding:3px 0; border-top:2px solid #333; margin-top:4px; }
        table { width:100%; border-collapse:collapse; }
        .footer { text-align:center; font-size:10px; color:#666; margin-top:8px; }
        @media print { body { width:80mm; } }
      </style>
    </head><body>
      <div class="center brand">${t("app.name")}</div>
      <div class="center" style="font-size:10px;color:#888">${t("pos.receipt_title")}</div>
      <div class="sep"></div>
      <div class="row"><span>${t("invoices.table_invoice_no")}:</span><span>${detail.invoiceNumber || "#" + detail.id}</span></div>
      <div class="row"><span>${t("common.date")}:</span><span>${dateStr}</span></div>
      <div class="row"><span>${t("common.branch")}:</span><span>${detail.branchName || "—"}</span></div>
      <div class="row"><span>${t("invoices.table_cashier")}:</span><span>${detail.cashierName || "—"}</span></div>
      <div class="row"><span>${t("invoices.table_payment")}:</span><span>${pmText}</span></div>
      <div class="sep"></div>
      <table>${itemsHtml}</table>
      <div class="sep"></div>
      <div class="row"><span>${t("invoices.table_subtotal")}</span><span>${omr(detail.subtotal)} OMR</span></div>
      ${discountLine}
      ${parseFloat(detail.vat || "0") > 0 ? `<div class="row"><span>${t("invoices.table_vat")}</span><span>${omr(detail.vat)} OMR</span></div>` : ""}
      <div class="total-row"><span>${t("invoices.table_total")}</span><span>${omr(detail.total)} OMR</span></div>
      <div class="sep" style="margin-top:6px"></div>
      <div class="footer">${t("pos.receipt_thanks")}</div>
      <div class="footer" style="margin-top:2px">${t("pos.receipt_brand")}</div>
      <script>window.onload=function(){window.print();}</script>
    </body></html>`;
    const w = window.open("", "_blank", "width=320,height=600");
    if (w) { w.document.write(html); w.document.close(); }
  }

  function handlePrint() {
    if (!detail) return;
    const pmText = PM_LABELS[detail.paymentMethod] || detail.paymentMethod;
    const dateStr = detail.createdAt ? fmtDateTime(detail.createdAt) : "";

    const itemsHtml = (detail.items || []).map((item: any, i: number) =>
      `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center">${i + 1}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${item.productName || "—"}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center">${omr(item.unitPrice)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center">${omr(item.total)}</td>
      </tr>`
    ).join("");

    const html = `<!DOCTYPE html>
<html dir="${lang === "ar" ? "rtl" : "ltr"}" lang="${lang}">
<head>
  <meta charset="utf-8">
  <title>${t("invoices.a4_title")} ${detail.invoiceNumber || detail.id}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&family=Inter:wght@400;700&display=swap" rel="stylesheet">
  <style>@font-face{font-family:'DigitsEN';font-style:normal;font-weight:400;src:url(https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf) format('truetype');unicode-range:U+0020-007F}@font-face{font-family:'DigitsEN';font-style:normal;font-weight:700;src:url(https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf) format('truetype');unicode-range:U+0020-007F}</style>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'DigitsEN', 'Cairo', sans-serif; padding: 30px; max-width: 800px; margin: 0 auto; color: #333; direction: ${lang === "ar" ? "rtl" : "ltr"}; }
    .header { text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #e8d5e0; }
    .header h1 { color: #8b5a7a; font-size: 22px; margin-bottom: 4px; }
    .header p { color: #888; font-size: 13px; }
    .info { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; padding: 12px; background: #faf5f8; border-radius: 8px; }
    .info div { flex: 1; min-width: 150px; }
    .info label { display: block; font-size: 11px; color: #999; margin-bottom: 2px; }
    .info span { font-size: 14px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead { background: #f4e8f0; }
    th { padding: 8px 10px; text-align: center; font-size: 13px; color: #666; }
    .totals { margin-top: 16px; text-align: ${lang === "ar" ? "left" : "right"}; }
    .totals div { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; max-width: 300px; ${lang === "ar" ? "margin-right: auto" : "margin-left: auto"}; }
    .totals .grand { font-size: 18px; font-weight: 700; color: #8b5a7a; border-top: 2px solid #e8d5e0; padding-top: 8px; margin-top: 8px; }
    .footer { text-align: center; margin-top: 30px; padding-top: 16px; border-top: 1px dashed #ddd; font-size: 12px; color: #aaa; }
    @media print { body { padding: 10px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${t("app.name")}</h1>
    <p>${t("invoices.a4_title")}</p>
  </div>
  <div class="info">
    <div><label>${t("invoices.table_invoice_no")}</label><span>${detail.invoiceNumber || "#" + detail.id}</span></div>
    <div><label>${t("common.date")}</label><span>${dateStr}</span></div>
    <div><label>${t("common.branch")}</label><span>${detail.branchName || "—"}</span></div>
    <div><label>${t("invoices.table_cashier")}</label><span>${detail.cashierName || "—"}</span></div>
    <div><label>${t("invoices.table_payment")}</label><span>${pmText}</span></div>
  </div>
  <table>
    <thead>
      <tr><th>#</th><th>${t("invoices.a4_table_item")}</th><th>${t("invoices.a4_table_qty")}</th><th>${t("invoices.a4_table_price")}</th><th>${t("invoices.a4_table_total")}</th></tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <div class="totals">
    <div><span>${t("invoices.table_subtotal")}</span><span>${omr(detail.subtotal)} OMR</span></div>
    ${parseFloat(detail.discount || "0") > 0 ? `<div><span>${t("invoices.table_discount")}</span><span>-${omr(detail.discount)} OMR</span></div>` : ""}
    ${parseFloat(detail.vat || "0") > 0 ? `<div><span>${t("invoices.table_vat")}</span><span>${omr(detail.vat)} OMR</span></div>` : ""}
    <div class="grand"><span>${t("invoices.table_total")}</span><span>${omr(detail.total)} OMR</span></div>
  </div>
  <div class="footer">${t("pos.receipt_thanks")} - ${t("app.name")}</div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  const PM_COLORS: Record<string, string> = {
    cash: "bg-green-100 text-green-700 border-green-200",
    card: "bg-blue-100 text-blue-700 border-blue-200",
    bank_transfer: "bg-purple-100 text-purple-700 border-purple-200",
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={lang === "ar" ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{t("invoices.invoice_label")} {detail?.invoiceNumber || ""}</span>
            <div className="flex gap-2">
              {detail && (
                <>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => window.open(`/api/exports/invoice.pdf?id=${detail.id}`, "_blank")} data-testid="button-pdf-invoice">
                    <FileText className="w-4 h-4" />
                    PDF
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1" onClick={handleThermalPrint} data-testid="button-thermal-invoice">
                    <Printer className="w-4 h-4" />
                    {t("invoices.print_thermal")} 80mm
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1" onClick={handlePrint} data-testid="button-print-invoice">
                    <Download className="w-4 h-4" />
                    {t("invoices.print_a4")}
                  </Button>
                </>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {isLoading && <div className="py-8 text-center text-muted-foreground">{t("app.loading")}</div>}

        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="p-3 bg-muted/30 rounded-lg border">
                <p className="text-xs text-muted-foreground">{t("invoices.table_invoice_no")}</p>
                <p className="font-bold mt-1">{detail.invoiceNumber || `#${detail.id}`}</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg border">
                <p className="text-xs text-muted-foreground">{t("common.date")}</p>
                <p className="font-bold mt-1">
                  {detail.createdAt ? fmtDate(detail.createdAt) : "—"}
                  <span className="text-xs font-normal text-muted-foreground mr-1">
                    {detail.createdAt ? fmtTime(detail.createdAt) : ""}
                  </span>
                </p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg border">
                <p className="text-xs text-muted-foreground">{t("common.branch")}</p>
                <p className="font-bold mt-1">{detail.branchName || "—"}</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg border">
                <p className="text-xs text-muted-foreground">{t("invoices.table_cashier")}</p>
                <p className="font-bold mt-1">{detail.cashierName || "—"}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t("invoices.table_payment")}:</span>
              <Badge className={PM_COLORS[detail.paymentMethod] || ""}>
                {PM_LABELS[detail.paymentMethod] || detail.paymentMethod}
              </Badge>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t("common.items")}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-center w-12">#</TableHead>
                      <TableHead>{t("invoices.a4_table_item")}</TableHead>
                      <TableHead className="text-center">{t("invoices.a4_table_qty")}</TableHead>
                      <TableHead className="text-center">{t("invoices.a4_table_price")}</TableHead>
                      <TableHead className="text-center">{t("invoices.a4_table_total")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detail.items || []).map((item: any, i: number) => (
                      <TableRow key={item.id} data-testid={`row-invoice-item-${item.id}`}>
                        <TableCell className="text-center text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{item.productName || "—"}</TableCell>
                        <TableCell className="text-center font-mono">{item.quantity}</TableCell>
                        <TableCell className="text-center font-mono">{omr(item.unitPrice)}</TableCell>
                        <TableCell className="text-center font-mono font-bold">{omr(item.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <div className="w-72 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("invoices.table_subtotal")}</span>
                  <span className="font-mono">{omr(detail.subtotal)} OMR</span>
                </div>
                {parseFloat(detail.discount || "0") > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>{t("invoices.table_discount")}</span>
                    <span className="font-mono">-{omr(detail.discount)} OMR</span>
                  </div>
                )}
                {parseFloat(detail.vat || "0") > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("invoices.table_vat")}</span>
                    <span className="font-mono">{omr(detail.vat)} OMR</span>
                  </div>
                )}
                <div className="flex justify-between border-t-2 pt-2 font-bold text-base text-primary">
                  <span>{t("invoices.table_total")}</span>
                  <span className="font-mono">{omr(detail.total)} OMR</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Invoices() {
  const { t, lang } = useI18n();
  const { data } = useAuth();
  const user = data?.user;
  const isOwnerOrAdmin = user?.role === "owner" || user?.role === "admin";

  const [fromDate, setFromDate] = useState(startOfMonthStr());
  const [toDate, setToDate] = useState(todayStr());
  const [paymentMethod, setPaymentMethod] = useState<string>("all");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [detailSaleId, setDetailSaleId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  let queryUrl = `/api/sales?from=${fromDate}&to=${toDate}`;
  if (paymentMethod !== "all") queryUrl += `&paymentMethod=${paymentMethod}`;
  if (selectedBranch !== "all" && isOwnerOrAdmin) queryUrl += `&branchId=${selectedBranch}`;
  if (selectedEmployee !== "all") queryUrl += `&employeeId=${selectedEmployee}`;

  const { data: salesData = [], isLoading } = useQuery<any[]>({
    queryKey: ["sales-invoices", fromDate, toDate, paymentMethod, selectedBranch, selectedEmployee],
    queryFn: async () => {
      const res = await fetch(queryUrl, { credentials: "include" });
      if (!res.ok) throw new Error(t("common.error"));
      return res.json();
    },
    enabled: !!fromDate && !!toDate,
  });

  const totals = salesData.reduce((acc, s) => ({
    subtotal: acc.subtotal + parseFloat(s.subtotal || "0"),
    total: acc.total + parseFloat(s.total || "0"),
    cogs: acc.cogs + parseFloat(s.cogsTotal || "0"),
    profit: acc.profit + parseFloat(s.grossProfit || "0"),
    count: acc.count + 1,
  }), { subtotal: 0, total: 0, cogs: 0, profit: 0, count: 0 });

  function exportExcel() {
    let url = `/api/exports/sales.xlsx?from=${fromDate}&to=${toDate}`;
    if (paymentMethod !== "all") url += `&paymentMethod=${paymentMethod}`;
    if (selectedBranch !== "all" && isOwnerOrAdmin) url += `&branchId=${selectedBranch}`;
    if (selectedEmployee !== "all") url += `&employeeId=${selectedEmployee}`;
    window.open(url, "_blank");
  }

  const PM_COLORS: Record<string, string> = {
    cash: "bg-green-100 text-green-700 border-green-200",
    card: "bg-blue-100 text-blue-700 border-blue-200",
    bank_transfer: "bg-purple-100 text-purple-700 border-purple-200",
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-invoices-title">{t("invoices.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("invoices.subtitle")}</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={exportExcel} data-testid="button-export-sales-xlsx">
          <FileSpreadsheet className="w-4 h-4" />
          {t("common.export")} Excel
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("common.from")}</label>
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40" data-testid="input-invoices-from" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("common.to")}</label>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40" data-testid="input-invoices-to" />
            </div>
            <div className="space-y-1 min-w-[160px]">
              <label className="text-sm font-medium">{t("invoices.table_payment")}</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger data-testid="select-invoices-payment"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  <SelectItem value="cash">{t("payment_methods.cash")}</SelectItem>
                  <SelectItem value="card">{t("payment_methods.card")}</SelectItem>
                  <SelectItem value="bank_transfer">{t("payment_methods.bank_transfer")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 min-w-[160px]">
              <label className="text-sm font-medium">{t("common.employee")}</label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger data-testid="select-invoices-employee"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  {allUsers.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isOwnerOrAdmin && (
              <div className="space-y-1 min-w-[180px]">
                <label className="text-sm font-medium">{t("common.branch")}</label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger data-testid="select-invoices-branch"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("common.all_branches")}</SelectItem>
                    {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}{b.address ? " - " + b.address : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t("invoices.total_invoices")}</p>
            <p className="text-2xl font-bold text-primary mt-1" data-testid="stat-invoices-count">{totals.count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t("invoices.total_sales")}</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1" data-testid="stat-invoices-total">{omr(totals.total)}</p>
            <p className="text-[10px] text-muted-foreground">OMR</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t("reports.product_cost")} (COGS)</p>
            <p className="text-2xl font-bold text-orange-600 mt-1" data-testid="stat-invoices-cogs">{omr(totals.cogs)}</p>
            <p className="text-[10px] text-muted-foreground">OMR</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t("reports.total_profit")}</p>
            <p className={`text-2xl font-bold mt-1 ${totals.profit >= 0 ? "text-blue-600" : "text-red-600"}`} data-testid="stat-invoices-profit">{omr(totals.profit)}</p>
            <p className="text-[10px] text-muted-foreground">OMR</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">{t("app.loading")}</div>
          ) : salesData.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-3">
              <FileSpreadsheet className="w-10 h-10 mx-auto opacity-30" />
              <p>{t("invoices.no_invoices")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[120px]">{t("invoices.table_invoice_no")}</TableHead>
                    {isOwnerOrAdmin && <TableHead>{t("invoices.table_branch")}</TableHead>}
                    <TableHead>{t("invoices.table_cashier")}</TableHead>
                    <TableHead className="text-center">{t("invoices.table_payment")}</TableHead>
                    <TableHead className="text-center font-mono">{t("invoices.table_total")}</TableHead>
                    <TableHead className="text-center">{t("invoices.table_date")}</TableHead>
                    <TableHead className="w-[100px] text-center">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesData.map((s: any) => (
                    <TableRow key={s.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-invoice-${s.id}`}>
                      <TableCell className="font-mono font-bold">{s.invoiceNumber || `#${s.id}`}</TableCell>
                      {isOwnerOrAdmin && <TableCell>{s.branchName || "—"}</TableCell>}
                      <TableCell>{s.cashierName || "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={PM_COLORS[s.paymentMethod] || ""}>
                          {t(`payment_methods.${s.paymentMethod}`) || s.paymentMethod}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold">{omr(s.total)}</TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {fmtDate(s.createdAt)}
                        <br />
                        {s.createdAt ? fmtTime(s.createdAt) : ""}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => { setDetailSaleId(s.id); setDetailOpen(true); }}
                          data-testid={`button-view-invoice-${s.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <InvoiceDetailModal
        saleId={detailSaleId}
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailSaleId(null); }}
      />
    </div>
  );
}
