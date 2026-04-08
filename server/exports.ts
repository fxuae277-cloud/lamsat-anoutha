import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { pool } from "./db";
import XLSX from "xlsx";
// @ts-ignore
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";

const FONT_PATH = path.join(process.cwd(), "server", "fonts", "Cairo-Regular.ttf");
const hasArabicFont = fs.existsSync(FONT_PATH);

function requireAuth(req: Request, res: Response, next: () => void) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "غير مصرح" });
  }
  next();
}

async function requireOwnerOrAdmin(req: Request, res: Response, next: () => void) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "غير مصرح" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user || (user.role !== "owner" && user.role !== "admin")) {
    return res.status(403).json({ message: "غير مصرح - صلاحيات غير كافية" });
  }
  next();
}

async function enforceBranchScope(req: Request, res: Response, next: () => void) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "غير مصرح" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user) {
    return res.status(401).json({ message: "المستخدم غير موجود" });
  }
  if (user.role === "owner" || user.role === "admin") {
    const qb = (req.query.branchId || req.query.branch_id) as string | undefined;
    if (qb && !isNaN(Number(qb))) {
      req.branchScope = { mode: "branch", branchId: Number(qb) };
    } else {
      req.branchScope = { mode: "company", branchId: null };
    }
  } else {
    req.branchScope = { mode: "branch", branchId: user.branchId ?? 0 };
  }
  next();
}

function omr(val: string | number | null) {
  if (val === null || val === undefined) return "0.000";
  return parseFloat(String(val)).toFixed(3);
}

export function registerExportRoutes(app: Express) {

  app.get("/api/exports/daily.xlsx", requireAuth, enforceBranchScope, async (req, res) => {
    try {
      const dateStr = req.query.date as string;
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return res.status(400).json({ message: "التاريخ مطلوب بصيغة YYYY-MM-DD" });
      }
      const scope = req.branchScope!;
      const branchId = scope.mode === "branch" ? scope.branchId! : undefined;
      const report = await storage.getDailyReport(dateStr, branchId);

      const branches = await storage.getBranches();
      const foundBranch = branchId ? branches.find(b => b.id === branchId) : null;
      const branchName = foundBranch ? (foundBranch.address ? `${foundBranch.name} - ${foundBranch.address}` : foundBranch.name) : "جميع الفروع";

      const wb = XLSX.utils.book_new();

      const summaryData = [
        ["التقرير اليومي - لمسة أنوثة"],
        ["التاريخ", report.date],
        ["الفرع", branchName],
        [],
        ["تفصيل المبيعات", "المبلغ (OMR)", "العدد"],
        ["مبيعات نقدي", report.salesCash.total, report.salesCash.count],
        ["مبيعات بطاقة", report.salesCard.total, report.salesCard.count],
        ["تحويل بنكي", report.salesBankTransfer.total, report.salesBankTransfer.count],
        ["إجمالي المبيعات", report.totalSales, ""],
        [],
        ["تحليل الربحية", "المبلغ (OMR)"],
        ["إجمالي المبيعات", report.totalSales],
        ["تكلفة البضاعة المباعة (COGS)", report.cogsTotal],
        ["إجمالي الربح", report.grossProfit],
        ["إجمالي المصروفات", report.totalExpenses],
        ["صافي الربح", report.netProfit],
        [],
        ["تفصيل المصروفات", "المبلغ (OMR)", "العدد"],
        ["مصروفات نقدي", report.expensesCash.total, report.expensesCash.count],
        ["مصروفات بنكي", report.expensesBank.total, report.expensesBank.count],
        [],
        ["الصندوق النقدي", "المبلغ (OMR)"],
        ["رصيد الافتتاح", report.openingCash],
        ["رصيد الإغلاق (تقديري)", report.cashClosingBalance],
        ["مجموع الفروقات", report.differencesSum],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
      ws1["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 10 }];
      ws1["!dir"] = "rtl";
      XLSX.utils.book_append_sheet(wb, ws1, "الملخص");

      if (report.shifts.length > 0) {
        const shiftRows = [
          ["#", "الفرع", "الجهاز", "البداية", "النهاية", "الحالة", "المبيعات", "رصيد الافتتاح"],
          ...report.shifts.map((s: any) => [
            s.id,
            branches.find(b => b.id === s.branchId)?.name || "",
            s.terminalName,
            s.startedAt ? new Date(s.startedAt).toLocaleTimeString("ar-OM") : "",
            s.endedAt ? new Date(s.endedAt).toLocaleTimeString("ar-OM") : "مفتوح",
            s.status === "open" ? "مفتوح" : "مغلق",
            omr(s.totalSales),
            omr(s.openingCash),
          ]),
        ];
        const ws2 = XLSX.utils.aoa_to_sheet(shiftRows);
        ws2["!cols"] = [{ wch: 6 }, { wch: 25 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 12 }];
        ws2["!dir"] = "rtl";
        XLSX.utils.book_append_sheet(wb, ws2, "الشفتات");
      }

      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="daily-report-${dateStr}.xlsx"`);
      res.send(buf);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "فشل التصدير" });
    }
  });

  app.get("/api/exports/profit_all_branches.xlsx", requireOwnerOrAdmin, async (req, res) => {
    try {
      const from = req.query.from as string;
      const to = req.query.to as string;
      if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return res.status(400).json({ message: "التاريخ مطلوب بصيغة YYYY-MM-DD (from & to)" });
      }

      const data = await storage.getProfitByBranches(from, to);
      const wb = XLSX.utils.book_new();

      const rows: any[][] = [
        [`تقرير أرباح الفروع - لمسة أنوثة`],
        [`الفترة`, `من ${from} إلى ${to}`],
        [],
        ["الفرع", "المبيعات", "التكلفة (COGS)", "إجمالي الربح", "المصروفات", "صافي الربح", "هامش الربح %"],
      ];

      let grandTotals = { sales: 0, cogs: 0, gross: 0, exp: 0, net: 0 };

      for (const b of data) {
        const sales = parseFloat(b.salesTotal);
        const cogs = parseFloat(b.cogsTotal);
        const gross = parseFloat(b.grossProfit);
        const exp = parseFloat(b.expensesTotal);
        const net = parseFloat(b.netProfit);

        rows.push([b.branchName, omr(sales), omr(cogs), omr(gross), omr(exp), omr(net), b.margin + "%"]);

        grandTotals.sales += sales;
        grandTotals.cogs += cogs;
        grandTotals.gross += gross;
        grandTotals.exp += exp;
        grandTotals.net += net;
      }

      rows.push([]);
      const totalMargin = grandTotals.sales > 0
        ? ((grandTotals.net / grandTotals.sales) * 100).toFixed(1) + "%"
        : "0.0%";
      rows.push([
        "المجموع الكلي",
        omr(grandTotals.sales), omr(grandTotals.cogs), omr(grandTotals.gross),
        omr(grandTotals.exp), omr(grandTotals.net), totalMargin,
      ]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [
        { wch: 25 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
        { wch: 14 }, { wch: 14 }, { wch: 12 },
      ];
      ws["!dir"] = "rtl";
      XLSX.utils.book_append_sheet(wb, ws, "أرباح الفروع");

      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="profit-all-branches-${from}-to-${to}.xlsx"`);
      res.send(buf);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "فشل التصدير" });
    }
  });

  app.get("/api/exports/profit_by_employee.xlsx", requireAuth, enforceBranchScope, async (req, res) => {
    try {
      const from = req.query.from as string;
      const to = req.query.to as string;
      if (!from || !to) return res.status(400).json({ message: "from & to مطلوبان" });
      const scope = req.branchScope!;
      const branchId = scope.mode === "branch" ? scope.branchId! : undefined;
      const data = await storage.getProfitByEmployees(from, to, branchId);

      const branches = await storage.getBranches();
      const branchLabel = branchId ? branches.find(b => b.id === branchId)?.name || "" : "جميع الفروع";

      const wb = XLSX.utils.book_new();
      const rows: any[][] = [
        ["تقرير أرباح الموظفين - لمسة أنوثة"],
        [`الفترة`, `من ${from} إلى ${to}`],
        [`الفرع`, branchLabel],
        [],
        ["الموظف", "عدد العمليات", "المبيعات", "التكلفة (COGS)", "إجمالي الربح", "هامش الربح %"],
      ];
      let totals = { orders: 0, sales: 0, cogs: 0, profit: 0 };
      for (const e of data) {
        rows.push([e.employeeName, e.ordersCount, omr(e.salesTotal), omr(e.cogsTotal), omr(e.grossProfit), e.margin + "%"]);
        totals.orders += e.ordersCount;
        totals.sales += parseFloat(e.salesTotal);
        totals.cogs += parseFloat(e.cogsTotal);
        totals.profit += parseFloat(e.grossProfit);
      }
      rows.push([]);
      const totalMargin = totals.sales > 0 ? ((totals.profit / totals.sales) * 100).toFixed(1) : "0.0";
      rows.push(["المجموع", totals.orders, omr(totals.sales), omr(totals.cogs), omr(totals.profit), totalMargin + "%"]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }];
      ws["!dir"] = "rtl";
      XLSX.utils.book_append_sheet(wb, ws, "أرباح الموظفين");

      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="profit-by-employee-${from}-to-${to}.xlsx"`);
      res.send(buf);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "فشل التصدير" });
    }
  });

  app.get("/api/exports/profit_by_product.xlsx", requireAuth, enforceBranchScope, async (req, res) => {
    try {
      const from = req.query.from as string;
      const to = req.query.to as string;
      if (!from || !to) return res.status(400).json({ message: "from & to مطلوبان" });
      const scope = req.branchScope!;
      const branchId = scope.mode === "branch" ? scope.branchId! : undefined;
      const data = await storage.getProfitByProducts(from, to, branchId);

      const branches = await storage.getBranches();
      const branchLabel = branchId ? branches.find(b => b.id === branchId)?.name || "" : "جميع الفروع";

      const wb = XLSX.utils.book_new();
      const rows: any[][] = [
        ["تقرير أرباح المنتجات - لمسة أنوثة"],
        [`الفترة`, `من ${from} إلى ${to}`],
        [`الفرع`, branchLabel],
        [],
        ["المنتج", "الكمية المباعة", "المبيعات", "التكلفة (COGS)", "إجمالي الربح", "هامش الربح %"],
      ];
      let totals = { qty: 0, sales: 0, cogs: 0, profit: 0 };
      for (const p of data) {
        rows.push([p.productName, p.qtySold, omr(p.salesTotal), omr(p.cogsTotal), omr(p.grossProfit), p.margin + "%"]);
        totals.qty += p.qtySold;
        totals.sales += parseFloat(p.salesTotal);
        totals.cogs += parseFloat(p.cogsTotal);
        totals.profit += parseFloat(p.grossProfit);
      }
      rows.push([]);
      const totalMargin = totals.sales > 0 ? ((totals.profit / totals.sales) * 100).toFixed(1) : "0.0";
      rows.push(["المجموع", totals.qty, omr(totals.sales), omr(totals.cogs), omr(totals.profit), totalMargin + "%"]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }];
      ws["!dir"] = "rtl";
      XLSX.utils.book_append_sheet(wb, ws, "أرباح المنتجات");

      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="profit-by-product-${from}-to-${to}.xlsx"`);
      res.send(buf);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "فشل التصدير" });
    }
  });

  app.get("/api/exports/daily.pdf", requireAuth, enforceBranchScope, async (req, res) => {
    try {
      const dateStr = req.query.date as string;
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return res.status(400).json({ message: "التاريخ مطلوب بصيغة YYYY-MM-DD" });
      }
      const scope = req.branchScope!;
      const branchId = scope.mode === "branch" ? scope.branchId! : undefined;
      const report = await storage.getDailyReport(dateStr, branchId);

      const branches = await storage.getBranches();
      const foundBranch2 = branchId ? branches.find(b => b.id === branchId) : null;
      const branchName = foundBranch2 ? (foundBranch2.address ? `${foundBranch2.name} - ${foundBranch2.address}` : foundBranch2.name) : "جميع الفروع";

      const doc = new PDFDocument({ size: "A4", margin: 40, layout: "portrait" });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="daily-report-${dateStr}.pdf"`);
      doc.pipe(res);

      if (hasArabicFont) {
        doc.registerFont("Cairo", FONT_PATH);
        doc.font("Cairo");
      }

      const pageW = doc.page.width - 80;

      const drawRTLText = (text: string, x: number, y: number, opts: any = {}) => {
        const w = opts.width || pageW;
        doc.text(text, x, y, { ...opts, width: w, align: opts.align || "right", features: ["rtla", "arab"] });
      };

      const drawTableRow = (cols: string[], y: number, isHeader = false) => {
        const colWidths = cols.length <= 3
          ? [pageW * 0.5, pageW * 0.25, pageW * 0.25]
          : Array(cols.length).fill(pageW / cols.length);

        if (isHeader) {
          doc.rect(40, y - 2, pageW, 20).fill("#f0e6ef").stroke();
          doc.fillColor("#333");
        }

        let xPos = 40 + pageW;
        for (let i = 0; i < cols.length; i++) {
          xPos -= colWidths[i];
          doc.fontSize(isHeader ? 10 : 9);
          if (isHeader) doc.font(hasArabicFont ? "Cairo" : "Helvetica-Bold");
          else doc.font(hasArabicFont ? "Cairo" : "Helvetica");
          doc.text(cols[i], xPos, y, { width: colWidths[i], align: "center" });
        }
        return y + 20;
      };

      doc.fontSize(18).fillColor("#8b5a7a");
      drawRTLText("لمسة أنوثة - التقرير اليومي", 40, 40);

      doc.fontSize(11).fillColor("#666");
      drawRTLText(`التاريخ: ${report.date}    |    الفرع: ${branchName}`, 40, 70);

      doc.moveTo(40, 90).lineTo(40 + pageW, 90).strokeColor("#ddd").stroke();

      let y = 100;

      doc.fontSize(13).fillColor("#8b5a7a");
      drawRTLText("تفصيل المبيعات", 40, y);
      y += 22;

      y = drawTableRow(["العدد", "المبلغ (OMR)", "البند"], y, true);
      y = drawTableRow([String(report.salesCash.count), report.salesCash.total, "مبيعات نقدي"], y);
      y = drawTableRow([String(report.salesCard.count), report.salesCard.total, "مبيعات بطاقة"], y);
      y = drawTableRow([String(report.salesBankTransfer.count), report.salesBankTransfer.total, "تحويل بنكي"], y);
      doc.moveTo(40, y).lineTo(40 + pageW, y).strokeColor("#ccc").stroke();
      y += 2;
      y = drawTableRow(["", report.totalSales, "إجمالي المبيعات"], y);
      y += 10;

      doc.fontSize(13).fillColor("#8b5a7a");
      drawRTLText("تحليل الربحية", 40, y);
      y += 22;

      y = drawTableRow(["المبلغ (OMR)", "البند"], y, true);
      y = drawTableRow([report.totalSales, "إجمالي المبيعات"], y);
      y = drawTableRow([report.cogsTotal, "تكلفة البضاعة المباعة (COGS)"], y);

      doc.fillColor(parseFloat(report.grossProfit) >= 0 ? "#1a7a3a" : "#c00");
      y = drawTableRow([report.grossProfit, "إجمالي الربح"], y);
      doc.fillColor("#333");

      y = drawTableRow([report.totalExpenses, "إجمالي المصروفات"], y);

      doc.fillColor(parseFloat(report.netProfit) >= 0 ? "#1a7a3a" : "#c00");
      doc.moveTo(40, y).lineTo(40 + pageW, y).strokeColor("#8b5a7a").lineWidth(1.5).stroke();
      y += 3;
      y = drawTableRow([report.netProfit, "صافي الربح"], y);
      doc.fillColor("#333").lineWidth(1);
      y += 10;

      doc.fontSize(13).fillColor("#8b5a7a");
      drawRTLText("المصروفات", 40, y);
      y += 22;
      y = drawTableRow(["العدد", "المبلغ (OMR)", "البند"], y, true);
      y = drawTableRow([String(report.expensesCash.count), report.expensesCash.total, "مصروفات نقدي"], y);
      y = drawTableRow([String(report.expensesBank.count), report.expensesBank.total, "مصروفات بنكي"], y);
      y += 10;

      doc.fontSize(13).fillColor("#8b5a7a");
      drawRTLText("الصندوق النقدي", 40, y);
      y += 22;
      y = drawTableRow(["المبلغ (OMR)", "البند"], y, true);
      y = drawTableRow([report.openingCash, "رصيد الافتتاح"], y);
      y = drawTableRow([report.cashClosingBalance, "رصيد الإغلاق (تقديري)"], y);
      y = drawTableRow([report.differencesSum, "مجموع الفروقات"], y);

      y += 20;
      doc.fontSize(8).fillColor("#999");
      drawRTLText(`تم إنشاء التقرير بتاريخ: ${new Date().toISOString().slice(0, 19).replace("T", " ")}`, 40, y);

      doc.end();
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ message: err?.message ?? "فشل التصدير" });
      }
    }
  });

  app.get("/api/exports/sales.xlsx", requireAuth, enforceBranchScope, async (req, res) => {
    try {
      const from = req.query.from as string;
      const to = req.query.to as string;
      if (!from || !to) {
        return res.status(400).json({ message: "التاريخ مطلوب (from & to)" });
      }

      const scope = req.branchScope!;
      const filters: any = { from, to };
      if (req.query.paymentMethod) filters.paymentMethod = req.query.paymentMethod as string;
      if (req.query.employeeId) filters.employeeId = Number(req.query.employeeId);
      if (scope.mode === "branch") {
        filters.branchId = scope.branchId;
      }

      const data = await storage.getSalesFiltered(filters);
      const wb = XLSX.utils.book_new();

      const pmLabel: Record<string, string> = { cash: "نقدي", card: "بطاقة", bank_transfer: "تحويل بنكي" };

      const rows: any[][] = [
        ["فواتير نقطة البيع - لمسة أنوثة"],
        ["الفترة", `من ${from} إلى ${to}`],
        [],
        ["رقم الفاتورة", "التاريخ", "الفرع", "الكاشير", "طريقة الدفع", "المجموع الفرعي", "الخصم", "الضريبة", "الإجمالي", "التكلفة", "الربح"],
      ];

      let totals = { subtotal: 0, discount: 0, vat: 0, total: 0, cogs: 0, profit: 0 };

      for (const s of data) {
        const sub = parseFloat(s.subtotal || "0");
        const disc = parseFloat(s.discount || "0");
        const vat = parseFloat(s.vat || "0");
        const tot = parseFloat(s.total || "0");
        const cogs = parseFloat(s.cogsTotal || "0");
        const profit = parseFloat(s.grossProfit || "0");

        rows.push([
          s.invoiceNumber || `#${s.id}`,
          s.createdAt ? new Date(s.createdAt).toLocaleDateString("ar-OM") + " " + new Date(s.createdAt).toLocaleTimeString("ar-OM", { hour: "2-digit", minute: "2-digit" }) : "",
          s.branchName || "",
          s.cashierName || "",
          pmLabel[s.paymentMethod] || s.paymentMethod || "",
          omr(sub), omr(disc), omr(vat), omr(tot), omr(cogs), omr(profit),
        ]);

        totals.subtotal += sub;
        totals.discount += disc;
        totals.vat += vat;
        totals.total += tot;
        totals.cogs += cogs;
        totals.profit += profit;
      }

      rows.push([]);
      rows.push([
        "المجموع", "", "", "", "",
        omr(totals.subtotal), omr(totals.discount), omr(totals.vat), omr(totals.total), omr(totals.cogs), omr(totals.profit),
      ]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [
        { wch: 16 }, { wch: 20 }, { wch: 25 }, { wch: 16 }, { wch: 14 },
        { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      ];
      ws["!dir"] = "rtl";
      XLSX.utils.book_append_sheet(wb, ws, "فواتير البيع");

      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="sales-invoices-${from}-to-${to}.xlsx"`);
      res.send(buf);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "فشل التصدير" });
    }
  });

  app.get("/api/exports/invoice.pdf", requireAuth, async (req, res) => {
    try {
      const saleId = Number(req.query.id);
      if (!saleId) return res.status(400).json({ message: "id مطلوب" });
      const detail = await storage.getSaleWithDetails(saleId);
      if (!detail) return res.status(404).json({ message: "الفاتورة غير موجودة" });

      const doc = new PDFDocument({ size: "A4", margin: 40 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="invoice-${detail.invoiceNumber || saleId}.pdf"`);
      doc.pipe(res);

      if (hasArabicFont) {
        doc.registerFont("Cairo", FONT_PATH);
        doc.font("Cairo");
      }
      const pageW = doc.page.width - 80;

      doc.fontSize(22).fillColor("#8b5a7a");
      doc.text("لمسة أنوثة", 40, 40, { width: pageW, align: "right", features: ["rtla", "arab"] });

      doc.fontSize(11).fillColor("#888");
      doc.text("فاتورة بيع", 40, 68, { width: pageW, align: "right", features: ["rtla", "arab"] });

      doc.moveTo(40, 88).lineTo(40 + pageW, 88).strokeColor("#e8d5e0").lineWidth(2).stroke();

      let y = 100;

      const pmLabels: Record<string, string> = { cash: "نقدي", card: "بطاقة", bank_transfer: "تحويل بنكي" };
      const dateStr = detail.createdAt
        ? new Date(detail.createdAt).toLocaleDateString("ar-OM") + " " + new Date(detail.createdAt).toLocaleTimeString("ar-OM", { hour: "2-digit", minute: "2-digit" })
        : "";

      const infoFields = [
        ["رقم الفاتورة", detail.invoiceNumber || `#${detail.id}`],
        ["التاريخ", dateStr],
        ["الفرع", detail.branchName || "—"],
        ["الكاشير", detail.cashierName || "—"],
        ["طريقة الدفع", pmLabels[detail.paymentMethod] || detail.paymentMethod || "—"],
      ];

      doc.rect(40, y, pageW, 60).fill("#faf5f8").stroke();
      doc.fillColor("#333");
      const infoColW = pageW / 5;
      for (let i = 0; i < infoFields.length; i++) {
        const xPos = 40 + pageW - (i + 1) * infoColW;
        doc.fontSize(8).fillColor("#999");
        doc.text(infoFields[i][0], xPos + 4, y + 8, { width: infoColW - 8, align: "right", features: ["rtla", "arab"] });
        doc.fontSize(11).fillColor("#333");
        doc.text(infoFields[i][1], xPos + 4, y + 24, { width: infoColW - 8, align: "right", features: ["rtla", "arab"] });
      }
      y += 72;

      const colWidths = [pageW * 0.08, pageW * 0.38, pageW * 0.14, pageW * 0.2, pageW * 0.2];
      const colHeaders = ["#", "المنتج", "الكمية", "السعر", "الإجمالي"];

      doc.rect(40, y, pageW, 22).fill("#f4e8f0");
      doc.fillColor("#555").fontSize(10);
      let xCursor = 40 + pageW;
      for (let i = 0; i < colHeaders.length; i++) {
        xCursor -= colWidths[i];
        doc.text(colHeaders[i], xCursor, y + 5, { width: colWidths[i], align: "center", features: ["rtla", "arab"] });
      }
      y += 24;

      doc.fillColor("#333").fontSize(9);
      const items = detail.items || [];
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        xCursor = 40 + pageW;
        const vals = [String(idx + 1), item.productName || "—", String(item.quantity), omr(item.unitPrice), omr(item.total)];
        for (let i = 0; i < vals.length; i++) {
          xCursor -= colWidths[i];
          doc.text(vals[i], xCursor, y + 3, { width: colWidths[i], align: "center", features: ["rtla", "arab"] });
        }
        doc.moveTo(40, y + 18).lineTo(40 + pageW, y + 18).strokeColor("#eee").lineWidth(0.5).stroke();
        y += 20;
        if (y > 700) { doc.addPage(); y = 40; }
      }
      y += 10;

      const totalsX = 40;
      const totalsW = 280;

      const drawTotalRow = (label: string, value: string, bold = false, color = "#333") => {
        doc.fontSize(bold ? 13 : 11).fillColor(color);
        if (bold) {
          doc.moveTo(totalsX, y).lineTo(totalsX + totalsW, y).strokeColor("#e8d5e0").lineWidth(1.5).stroke();
          y += 5;
        }
        doc.text(value + " OMR", totalsX, y, { width: totalsW / 2, align: "left", features: ["rtla", "arab"] });
        doc.text(label, totalsX + totalsW / 2, y, { width: totalsW / 2, align: "right", features: ["rtla", "arab"] });
        y += bold ? 22 : 18;
      };

      drawTotalRow("المجموع الفرعي", omr(detail.subtotal));
      if (parseFloat(detail.discount || "0") > 0) {
        drawTotalRow("الخصم", "-" + omr(detail.discount), false, "#c00");
      }
      if (parseFloat(detail.vat || "0") > 0) {
        drawTotalRow("الضريبة (VAT)", omr(detail.vat));
      }
      drawTotalRow("الإجمالي", omr(detail.total), true, "#8b5a7a");

      y += 20;
      doc.fontSize(10).fillColor("#aaa");
      doc.text("شكراً لتسوقكم معنا - لمسة أنوثة", 40, y, { width: pageW, align: "center", features: ["rtla", "arab"] });

      doc.end();
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ message: err?.message ?? "فشل التصدير" });
      }
    }
  });

  app.get("/api/exports/inventory.xlsx", requireAuth, enforceBranchScope, async (req, res) => {
    try {
      const scope = req.branchScope!;
      const branchId = scope.mode === "branch" ? scope.branchId! : undefined;
      const data = await storage.getLocationInventoryList(branchId);
      const branches = await storage.getBranches();
      const branchLabel = branchId ? branches.find(b => b.id === branchId)?.name || "" : "جميع الفروع";

      const wb = XLSX.utils.book_new();
      const rows: any[][] = [
        ["تقرير المخزون - لمسة أنوثة"],
        ["الفرع", branchLabel],
        ["تاريخ التقرير", new Date().toLocaleDateString("ar-OM")],
        [],
        ["المنتج", "الباركود", "الموقع", "الفرع", "الكمية", "حد إعادة الطلب", "متوسط التكلفة", "السعر", "قيمة المخزون"],
      ];
      let totalValue = 0;
      let totalQty = 0;
      for (const item of data) {
        const qty = item.qtyOnHand || 0;
        const cost = parseFloat(item.avgCost || "0");
        const value = qty * cost;
        totalValue += value;
        totalQty += qty;
        rows.push([
          item.productName || "", item.barcode || "",
          item.locationName || "", item.branchName || "",
          qty, item.reorderLevel || 0,
          omr(cost), omr(item.price),
          omr(value),
        ]);
      }
      rows.push([]);
      rows.push(["المجموع", "", "", "", totalQty, "", "", "", omr(totalValue)]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [
        { wch: 25 }, { wch: 16 }, { wch: 20 }, { wch: 20 },
        { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
      ];
      ws["!dir"] = "rtl";
      XLSX.utils.book_append_sheet(wb, ws, "المخزون");

      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="inventory-report.xlsx"`);
      res.send(buf);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "فشل التصدير" });
    }
  });

  app.get("/api/exports/purchases.xlsx", requireAuth, enforceBranchScope, async (req, res) => {
    try {
      const from = req.query.from as string;
      const to = req.query.to as string;

      const { pool: pgPool } = await import("./db");
      let query = `
        SELECT p.*, s.name as supplier_name, u.name as creator_name, (b.name || CASE WHEN b.address IS NOT NULL AND b.address <> '' THEN ' - ' || b.address ELSE '' END) as branch_name
        FROM purchases p
        LEFT JOIN suppliers s ON s.id = p.supplier_id
        LEFT JOIN users u ON u.id = p.created_by
        LEFT JOIN branches b ON b.id = p.branch_id
        WHERE 1=1
      `;
      const params: any[] = [];
      let idx = 1;
      if (from) { query += ` AND p.date >= $${idx++}`; params.push(from); }
      if (to) { query += ` AND p.date <= $${idx++}`; params.push(to); }
      const scope = req.branchScope!;
      if (scope.mode === "branch" && scope.branchId) {
        query += ` AND p.branch_id = $${idx++}`;
        params.push(scope.branchId);
      }
      query += ` ORDER BY p.date DESC`;
      const purchResult = await pgPool.query(query, params);

      const wb = XLSX.utils.book_new();
      const rows: any[][] = [
        ["تقرير المشتريات - لمسة أنوثة"],
        ["الفترة", from && to ? `من ${from} إلى ${to}` : "الكل"],
        [],
        ["رقم الأمر", "التاريخ", "المورد", "الفرع", "المبلغ", "الحالة", "أنشأ بواسطة", "ملاحظات"],
      ];
      let totalAmount = 0;
      for (const p of purchResult.rows) {
        const amt = parseFloat(p.total_amount || p.amount || "0");
        totalAmount += amt;
        const statusLabels: Record<string, string> = {
          draft: "مسودة", ordered: "تم الطلب", received: "مستلم",
          partially_received: "مستلم جزئياً", cancelled: "ملغي",
        };
        rows.push([
          p.order_number || `#${p.id}`, p.date || "",
          p.supplier_name || "—", p.branch_name || "—",
          omr(amt), statusLabels[p.status] || p.status || "—",
          p.creator_name || "—", p.notes || "",
        ]);
      }
      rows.push([]);
      rows.push(["المجموع", "", "", "", omr(totalAmount), "", "", ""]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [
        { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 20 },
        { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 25 },
      ];
      ws["!dir"] = "rtl";
      XLSX.utils.book_append_sheet(wb, ws, "المشتريات");

      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="purchases-report.xlsx"`);
      res.send(buf);
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "فشل التصدير" });
    }
  });

  app.get("/api/exports/backup.json", requireOwnerOrAdmin, async (_req, res) => {
    try {
      const tables = [
        "branches", "categories", "products", "users", "customers", "suppliers",
        "locations", "location_inventory", "inventory_transactions",
        "sales", "sale_items", "sale_returns", "sale_return_items",
        "orders", "order_items", "expenses", "shifts",
        "cash_ledger", "bank_ledger", "settings",
        "purchase_invoices", "purchase_items",
        "payroll_runs", "payroll_details", "employee_advances", "employee_deductions",
        "stocktakes", "stocktake_items", "inventory_adjustments",
        "audit_log", "cities"
      ];
      const backup: Record<string, any[]> = {};
      for (const table of tables) {
        try {
          const result = await pool.query(`SELECT * FROM "${table}" ORDER BY id`);
          backup[table] = result.rows;
        } catch {
          try {
            const result = await pool.query(`SELECT * FROM "${table}"`);
            backup[table] = result.rows;
          } catch { backup[table] = []; }
        }
      }
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const data = {
        exportDate: now.toISOString(),
        version: "1.0",
        system: "لمسة أنوثة ERP",
        tables: backup
      };
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="backup-${dateStr}.json"`);
      res.send(JSON.stringify(data, null, 2));
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "فشل النسخ الاحتياطي" });
    }
  });
}
