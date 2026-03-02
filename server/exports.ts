import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import XLSX from "xlsx";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename2 = fileURLToPath(import.meta.url);
const __dirname2 = path.dirname(__filename2);
const FONT_PATH = path.join(__dirname2, "fonts", "Cairo-Regular.ttf");
const hasArabicFont = fs.existsSync(FONT_PATH);

function requireAuth(req: Request, res: Response, next: () => void) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "غير مصرح" });
  }
  next();
}

function omr(val: string | number | null) {
  if (val === null || val === undefined) return "0.000";
  return parseFloat(String(val)).toFixed(3);
}

export function registerExportRoutes(app: Express) {

  app.get("/api/exports/daily.xlsx", requireAuth, async (req, res) => {
    try {
      const dateStr = req.query.date as string;
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return res.status(400).json({ message: "التاريخ مطلوب بصيغة YYYY-MM-DD" });
      }
      const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
      const report = await storage.getDailyReport(dateStr, branchId);

      const branches = await storage.getBranches();
      const branchName = branchId ? branches.find(b => b.id === branchId)?.name || "" : "جميع الفروع";

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

  app.get("/api/exports/profit_all_branches.xlsx", requireAuth, async (req, res) => {
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

  app.get("/api/exports/profit_by_employee.xlsx", requireAuth, async (req, res) => {
    try {
      const from = req.query.from as string;
      const to = req.query.to as string;
      if (!from || !to) return res.status(400).json({ message: "from & to مطلوبان" });
      const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
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

  app.get("/api/exports/profit_by_product.xlsx", requireAuth, async (req, res) => {
    try {
      const from = req.query.from as string;
      const to = req.query.to as string;
      if (!from || !to) return res.status(400).json({ message: "from & to مطلوبان" });
      const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
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

  app.get("/api/exports/daily.pdf", requireAuth, async (req, res) => {
    try {
      const dateStr = req.query.date as string;
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return res.status(400).json({ message: "التاريخ مطلوب بصيغة YYYY-MM-DD" });
      }
      const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
      const report = await storage.getDailyReport(dateStr, branchId);

      const branches = await storage.getBranches();
      const branchName = branchId ? branches.find(b => b.id === branchId)?.name || "" : "جميع الفروع";

      const doc = new PDFDocument({ size: "A4", margin: 40, layout: "portrait" });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="daily-report-${dateStr}.pdf"`);
      doc.pipe(res);

      if (hasArabicFont) {
        doc.registerFont("Cairo", FONT_PATH);
        doc.font("Cairo");
      }

      const pageW = doc.page.width - 80;

      function drawRTLText(text: string, x: number, y: number, opts: any = {}) {
        const w = opts.width || pageW;
        doc.text(text, x, y, { ...opts, width: w, align: opts.align || "right", features: ["rtla", "arab"] });
      }

      function drawTableRow(cols: string[], y: number, isHeader = false) {
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
      }

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

  app.get("/api/exports/sales.xlsx", requireAuth, async (req, res) => {
    try {
      const from = req.query.from as string;
      const to = req.query.to as string;
      if (!from || !to) {
        return res.status(400).json({ message: "التاريخ مطلوب (from & to)" });
      }

      const user = await storage.getUser(req.session.userId!);
      const isBranchOnly = user?.role === "cashier" || user?.role === "employee" || user?.role === "manager";
      const filters: any = { from, to };
      if (req.query.paymentMethod) filters.paymentMethod = req.query.paymentMethod as string;
      if (req.query.employeeId) filters.employeeId = Number(req.query.employeeId);
      if (isBranchOnly) {
        filters.branchId = user!.branchId;
      } else if (req.query.branchId) {
        filters.branchId = Number(req.query.branchId);
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
}
