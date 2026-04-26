/**
 * browserPrintInvoice.ts — print a sale receipt by literally rendering the
 * `<Invoice />` React component (client/src/components/Invoice.tsx) into a
 * popup window and triggering window.print().
 *
 * Why this exists (session 49):
 *   The previous receipt path went through the local ESC/POS service. Even
 *   after a layout rewrite there, cashier PCs running stale dist/ kept
 *   printing the old layout. This module bypasses the local service for the
 *   receipt path entirely — Invoice.tsx is the single source of truth for
 *   the design, and the OS prints whatever the React component renders.
 *
 * Browser → printer pipeline:
 *   renderToStaticMarkup(<Invoice .../>)  → HTML
 *   ↓
 *   window.open("", "_blank") → write HTML
 *   ↓
 *   window.print() → Windows driver → EPSON TM-T100
 *
 * The popup loads Tailwind via CDN + Google Fonts so the static HTML matches
 * what the cashier sees on screen. @page is set to 80mm so the browser
 * rasterises at thermal width.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Invoice, { type InvoiceItem } from "@/components/Invoice";

export interface BrowserPrintInvoiceData {
  invoiceNumber: string;
  /** ISO date or anything `new Date()` can parse. */
  createdAt?: string;
  cashier: string;
  branch: string;
  items: { name: string; qty: number; unitPrice: number; total: number }[];
  subtotal: number;
  discount: number;
  /** Already-computed VAT amount (not a rate). */
  vat: number;
}

export interface BrowserPrintResult {
  ok: boolean;
  error?: string;
  /** True when the same invoice was sent within the dedupe window. */
  ignoredDuplicate?: boolean;
}

// ─── Duplicate-print guard (mirrors localPrintClient.ts) ─────────────────
const DUPLICATE_WINDOW_MS = 3000;
const recentPrints = new Map<string, number>();
const inFlightPrints = new Set<string>();

function isRecentDuplicate(invoiceNo: string): boolean {
  if (!invoiceNo) return false;
  const last = recentPrints.get(invoiceNo);
  if (!last) return false;
  if (Date.now() - last < DUPLICATE_WINDOW_MS) return true;
  recentPrints.delete(invoiceNo);
  return false;
}

// ─── Helpers ─────────────────────────────────────────────────────────────
function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatTime(d: Date): string {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, "0")}:${m} ${ampm}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Render `<Invoice />` to a print popup and trigger window.print().
 * Never throws — always resolves to a `BrowserPrintResult`.
 */
export async function printInvoiceInBrowser(
  data: BrowserPrintInvoiceData
): Promise<BrowserPrintResult> {
  const invoiceNo = data.invoiceNumber || "";

  if (invoiceNo && inFlightPrints.has(invoiceNo)) {
    console.log(`[Print] duplicate ignored (in-flight) invoice=${invoiceNo}`);
    return { ok: true, ignoredDuplicate: true };
  }
  if (isRecentDuplicate(invoiceNo)) {
    console.log(`[Print] duplicate ignored (recent) invoice=${invoiceNo}`);
    return { ok: true, ignoredDuplicate: true };
  }
  if (invoiceNo) inFlightPrints.add(invoiceNo);

  try {
    const when = data.createdAt ? new Date(data.createdAt) : new Date();
    const safeWhen = Number.isNaN(when.getTime()) ? new Date() : when;

    const items: InvoiceItem[] = (data.items || []).map((i) => ({
      name: i.name,
      qty: i.qty,
      unitPrice: Number(i.unitPrice) || 0,
      total: Number(i.total) || 0,
    }));

    const subtotal = Number(data.subtotal) || 0;
    const vat = Number(data.vat) || 0;
    // Invoice.tsx recomputes vat as subtotal * vatRate. To make the
    // displayed vat match the actual sale, derive the implicit rate.
    const vatRate = subtotal > 0 ? vat / subtotal : 0;

    console.log(`[Print] invoice request sending invoice=${invoiceNo}`);

    const invoiceMarkup = renderToStaticMarkup(
      createElement(Invoice, {
        invoiceNumber: invoiceNo,
        date: formatDate(safeWhen),
        time: formatTime(safeWhen),
        cashier: data.cashier || "-",
        branch: data.branch || "-",
        items,
        subtotal,
        discount: Number(data.discount) || 0,
        vatRate,
      })
    );

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<base href="${window.location.origin}/">
<title>${escapeHtml(invoiceNo || "Invoice")}</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&family=Aref+Ruqaa:wght@700&family=Cairo:wght@400;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"><\/script>
<style>
  @page { size: 80mm auto; margin: 0; }
  html, body { margin: 0; padding: 0; background: white; }
  @media print {
    body { width: 80mm; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
${invoiceMarkup}
<script>
  // Wait for Tailwind CDN + Google Fonts to apply, then print.
  function waitFontsThenPrint() {
    var fire = function () {
      try { window.focus(); window.print(); } catch (e) {}
      setTimeout(function () { try { window.close(); } catch (e) {} }, 800);
    };
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { setTimeout(fire, 200); });
    } else {
      setTimeout(fire, 1200);
    }
  }
  if (document.readyState === "complete") {
    waitFontsThenPrint();
  } else {
    window.addEventListener("load", waitFontsThenPrint);
  }
<\/script>
</body>
</html>`;

    const w = window.open("", "_blank", "width=420,height=800");
    if (!w) {
      return {
        ok: false,
        error:
          "متصفّحك يحجب النوافذ المنبثقة. اسمح بالـ pop-ups لهذه الصفحة وأعد المحاولة.",
      };
    }
    w.document.open();
    w.document.write(html);
    w.document.close();

    if (invoiceNo) recentPrints.set(invoiceNo, Date.now());
    console.log(`[Print] invoice sent to printer invoice=${invoiceNo}`);
    return { ok: true };
  } catch (e: any) {
    console.error("[Print] browser print failed:", e);
    return {
      ok: false,
      error: "فشل تجهيز الفاتورة للطباعة",
    };
  } finally {
    if (invoiceNo) inFlightPrints.delete(invoiceNo);
  }
}
