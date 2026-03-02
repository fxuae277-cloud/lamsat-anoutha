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

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function monthAgoStr() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}
function omr(val: string | number | null) {
  if (val === null || val === undefined) return "0.000";
  return parseFloat(String(val)).toFixed(3);
}

const PM_LABELS: Record<string, string> = {
  cash: "نقدي",
  card: "بطاقة",
  bank_transfer: "تحويل بنكي",
};

const PM_ICONS: Record<string, any> = {
  cash: Banknote,
  card: CreditCard,
  bank_transfer: Building2,
};

const PM_COLORS: Record<string, string> = {
  cash: "bg-green-100 text-green-700 border-green-200",
  card: "bg-blue-100 text-blue-700 border-blue-200",
  bank_transfer: "bg-purple-100 text-purple-700 border-purple-200",
};

function InvoiceDetailModal({ saleId, open, onClose }: { saleId: number | null; open: boolean; onClose: () => void }) {
  const { data: detail, isLoading } = useQuery<any>({
    queryKey: ["/api/sales", saleId],
    queryFn: async () => {
      const res = await fetch(`/api/sales/${saleId}`, { credentials: "include" });
      if (!res.ok) throw new Error("فشل تحميل الفاتورة");
      return res.json();
    },
    enabled: !!saleId && open,
  });

  function handleThermalPrint() {
    if (!detail) return;
    const pmText = PM_LABELS[detail.paymentMethod] || detail.paymentMethod;
    const dateStr = detail.createdAt
      ? new Date(detail.createdAt).toLocaleDateString("ar-OM") + " " + new Date(detail.createdAt).toLocaleTimeString("ar-OM", { hour: "2-digit", minute: "2-digit" })
      : "";
    const itemsHtml = (detail.items || []).map((item: any) => `
      <tr>
        <td style="text-align:left;font-size:11px;padding:1px 0">${omr(item.total)}</td>
        <td style="text-align:center;font-size:11px;padding:1px 0">${omr(item.unitPrice)} x${item.quantity}</td>
        <td style="text-align:right;font-size:12px;padding:1px 0">${item.productName || "—"}</td>
      </tr>
    `).join("");
    const discountLine = parseFloat(detail.discount || "0") > 0
      ? `<div style="display:flex;justify-content:space-between"><span>الخصم</span><span>-${omr(detail.discount)} OMR</span></div>` : "";
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>إيصال</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
      <style>
        @page { size: 80mm auto; margin: 0; }
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Cairo',sans-serif; width:80mm; padding:6mm 4mm; color:#000; direction:rtl; font-size:12px; }
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
      <div class="center brand">لمسة أنوثة</div>
      <div class="center" style="font-size:10px;color:#888">إيصال بيع</div>
      <div class="sep"></div>
      <div class="row"><span>الفاتورة:</span><span>${detail.invoiceNumber || "#" + detail.id}</span></div>
      <div class="row"><span>التاريخ:</span><span>${dateStr}</span></div>
      <div class="row"><span>الفرع:</span><span>${detail.branchName || "—"}</span></div>
      <div class="row"><span>الكاشير:</span><span>${detail.cashierName || "—"}</span></div>
      <div class="row"><span>الدفع:</span><span>${pmText}</span></div>
      <div class="sep"></div>
      <table>${itemsHtml}</table>
      <div class="sep"></div>
      <div class="row"><span>المجموع الفرعي</span><span>${omr(detail.subtotal)} OMR</span></div>
      ${discountLine}
      ${parseFloat(detail.vat || "0") > 0 ? `<div class="row"><span>الضريبة</span><span>${omr(detail.vat)} OMR</span></div>` : ""}
      <div class="total-row"><span>الإجمالي</span><span>${omr(detail.total)} OMR</span></div>
      <div class="sep" style="margin-top:6px"></div>
      <div class="footer">شكراً لتسوقكم معنا</div>
      <div class="footer" style="margin-top:2px">لمسة أنوثة - سلطنة عمان</div>
      <script>window.onload=function(){window.print();}</script>
    </body></html>`;
    const w = window.open("", "_blank", "width=320,height=600");
    if (w) { w.document.write(html); w.document.close(); }
  }

  function handlePrint() {
    if (!detail) return;
    const pmText = PM_LABELS[detail.paymentMethod] || detail.paymentMethod;
    const dateStr = detail.createdAt
      ? new Date(detail.createdAt).toLocaleDateString("ar-OM") + " " + new Date(detail.createdAt).toLocaleTimeString("ar-OM", { hour: "2-digit", minute: "2-digit" })
      : "";

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
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>فاتورة ${detail.invoiceNumber || detail.id}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; padding: 30px; max-width: 800px; margin: 0 auto; color: #333; direction: rtl; }
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
    .totals { margin-top: 16px; text-align: left; }
    .totals div { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; max-width: 300px; margin-right: auto; }
    .totals .grand { font-size: 18px; font-weight: 700; color: #8b5a7a; border-top: 2px solid #e8d5e0; padding-top: 8px; margin-top: 8px; }
    .footer { text-align: center; margin-top: 30px; padding-top: 16px; border-top: 1px dashed #ddd; font-size: 12px; color: #aaa; }
    @media print { body { padding: 10px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>لمسة أنوثة</h1>
    <p>فاتورة بيع</p>
  </div>
  <div class="info">
    <div><label>رقم الفاتورة</label><span>${detail.invoiceNumber || "#" + detail.id}</span></div>
    <div><label>التاريخ</label><span>${dateStr}</span></div>
    <div><label>الفرع</label><span>${detail.branchName || "—"}</span></div>
    <div><label>الكاشير</label><span>${detail.cashierName || "—"}</span></div>
    <div><label>طريقة الدفع</label><span>${pmText}</span></div>
  </div>
  <table>
    <thead>
      <tr><th>#</th><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <div class="totals">
    <div><span>المجموع الفرعي</span><span>${omr(detail.subtotal)} OMR</span></div>
    ${parseFloat(detail.discount || "0") > 0 ? `<div><span>الخصم</span><span>-${omr(detail.discount)} OMR</span></div>` : ""}
    ${parseFloat(detail.vat || "0") > 0 ? `<div><span>الضريبة</span><span>${omr(detail.vat)} OMR</span></div>` : ""}
    <div class="grand"><span>الإجمالي</span><span>${omr(detail.total)} OMR</span></div>
  </div>
  <div class="footer">شكراً لتسوقكم معنا - لمسة أنوثة</div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>تفاصيل الفاتورة {detail?.invoiceNumber || ""}</span>
            <div className="flex gap-2">
              {detail && (
                <>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => window.open(`/api/exports/invoice.pdf?id=${detail.id}`, "_blank")} data-testid="button-pdf-invoice">
                    <FileText className="w-4 h-4" />
                    PDF
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1" onClick={handleThermalPrint} data-testid="button-thermal-invoice">
                    <Printer className="w-4 h-4" />
                    إيصال 80mm
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1" onClick={handlePrint} data-testid="button-print-invoice">
                    <Download className="w-4 h-4" />
                    طباعة A4
                  </Button>
                </>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {isLoading && <div className="py-8 text-center text-muted-foreground">جارٍ التحميل...</div>}

        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="p-3 bg-muted/30 rounded-lg border">
                <p className="text-xs text-muted-foreground">رقم الفاتورة</p>
                <p className="font-bold mt-1">{detail.invoiceNumber || `#${detail.id}`}</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg border">
                <p className="text-xs text-muted-foreground">التاريخ</p>
                <p className="font-bold mt-1">
                  {detail.createdAt ? new Date(detail.createdAt).toLocaleDateString("ar-OM") : "—"}
                  <span className="text-xs font-normal text-muted-foreground mr-1">
                    {detail.createdAt ? new Date(detail.createdAt).toLocaleTimeString("ar-OM", { hour: "2-digit", minute: "2-digit" }) : ""}
                  </span>
                </p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg border">
                <p className="text-xs text-muted-foreground">الفرع</p>
                <p className="font-bold mt-1">{detail.branchName || "—"}</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg border">
                <p className="text-xs text-muted-foreground">الكاشير</p>
                <p className="font-bold mt-1">{detail.cashierName || "—"}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">طريقة الدفع:</span>
              <Badge className={PM_COLORS[detail.paymentMethod] || ""}>
                {PM_LABELS[detail.paymentMethod] || detail.paymentMethod}
              </Badge>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">المنتجات</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-center w-12">#</TableHead>
                      <TableHead>المنتج</TableHead>
                      <TableHead className="text-center">الكمية</TableHead>
                      <TableHead className="text-center">السعر</TableHead>
                      <TableHead className="text-center">الإجمالي</TableHead>
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
                  <span className="text-muted-foreground">المجموع الفرعي</span>
                  <span className="font-mono">{omr(detail.subtotal)} OMR</span>
                </div>
                {parseFloat(detail.discount || "0") > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>الخصم</span>
                    <span className="font-mono">-{omr(detail.discount)} OMR</span>
                  </div>
                )}
                {parseFloat(detail.vat || "0") > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الضريبة</span>
                    <span className="font-mono">{omr(detail.vat)} OMR</span>
                  </div>
                )}
                <div className="flex justify-between border-t-2 pt-2 font-bold text-base text-primary">
                  <span>الإجمالي</span>
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
  const { user } = useAuth();
  const isOwnerOrAdmin = user?.role === "owner" || user?.role === "admin";

  const [fromDate, setFromDate] = useState(monthAgoStr());
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
      if (!res.ok) throw new Error("فشل تحميل الفواتير");
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

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-invoices-title">فواتير نقطة البيع</h1>
          <p className="text-muted-foreground mt-1">استعراض وطباعة وتصدير فواتير المبيعات</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={exportExcel} data-testid="button-export-sales-xlsx">
          <FileSpreadsheet className="w-4 h-4" />
          تصدير Excel
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">من</label>
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40" data-testid="input-invoices-from" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">إلى</label>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40" data-testid="input-invoices-to" />
            </div>
            <div className="space-y-1 min-w-[160px]">
              <label className="text-sm font-medium">طريقة الدفع</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger data-testid="select-invoices-payment"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="cash">نقدي</SelectItem>
                  <SelectItem value="card">بطاقة</SelectItem>
                  <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 min-w-[160px]">
              <label className="text-sm font-medium">الموظف</label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger data-testid="select-invoices-employee"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {allUsers.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isOwnerOrAdmin && (
              <div className="space-y-1 min-w-[180px]">
                <label className="text-sm font-medium">الفرع</label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger data-testid="select-invoices-branch"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الفروع</SelectItem>
                    {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
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
            <p className="text-xs text-muted-foreground">عدد الفواتير</p>
            <p className="text-2xl font-bold text-primary mt-1" data-testid="stat-invoices-count">{totals.count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">إجمالي المبيعات</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1" data-testid="stat-invoices-total">{omr(totals.total)}</p>
            <p className="text-[10px] text-muted-foreground">OMR</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">التكلفة (COGS)</p>
            <p className="text-2xl font-bold text-orange-600 mt-1" data-testid="stat-invoices-cogs">{omr(totals.cogs)}</p>
            <p className="text-[10px] text-muted-foreground">OMR</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">إجمالي الربح</p>
            <p className={`text-2xl font-bold mt-1 ${totals.profit >= 0 ? "text-blue-600" : "text-red-600"}`} data-testid="stat-invoices-profit">{omr(totals.profit)}</p>
            <p className="text-[10px] text-muted-foreground">OMR</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">جارٍ التحميل...</div>
          ) : salesData.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">لا توجد فواتير في الفترة المحددة</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>رقم الفاتورة</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الفرع</TableHead>
                    <TableHead>الكاشير</TableHead>
                    <TableHead className="text-center">طريقة الدفع</TableHead>
                    <TableHead className="text-center">الإجمالي</TableHead>
                    <TableHead className="text-center">الربح</TableHead>
                    <TableHead className="text-center w-20">عرض</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesData.map((s: any) => {
                    const PmIcon = PM_ICONS[s.paymentMethod] || Banknote;
                    return (
                      <TableRow
                        key={s.id}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => { setDetailSaleId(s.id); setDetailOpen(true); }}
                        data-testid={`row-invoice-${s.id}`}
                      >
                        <TableCell className="font-mono font-medium">{s.invoiceNumber || `#${s.id}`}</TableCell>
                        <TableCell className="text-sm">
                          {s.createdAt ? new Date(s.createdAt).toLocaleDateString("ar-OM") : "—"}
                          <span className="text-xs text-muted-foreground mr-1">
                            {s.createdAt ? new Date(s.createdAt).toLocaleTimeString("ar-OM", { hour: "2-digit", minute: "2-digit" }) : ""}
                          </span>
                        </TableCell>
                        <TableCell>{s.branchName || "—"}</TableCell>
                        <TableCell>{s.cashierName || "—"}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={`gap-1 ${PM_COLORS[s.paymentMethod] || ""}`}>
                            <PmIcon className="w-3 h-3" />
                            {PM_LABELS[s.paymentMethod] || s.paymentMethod}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold text-emerald-600">{omr(s.total)}</TableCell>
                        <TableCell className={`text-center font-mono ${parseFloat(s.grossProfit || "0") >= 0 ? "text-blue-600" : "text-red-600"}`}>
                          {omr(s.grossProfit)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-8 h-8 p-0"
                            onClick={e => { e.stopPropagation(); setDetailSaleId(s.id); setDetailOpen(true); }}
                            data-testid={`button-view-invoice-${s.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <InvoiceDetailModal saleId={detailSaleId} open={detailOpen} onClose={() => setDetailOpen(false)} />
    </div>
  );
}
