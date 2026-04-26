/**
 * printInvoice.ts — thermal 80mm receipt builder for Lamsat Anotha.
 *
 * Renders an invoice payload into ESC/POS bytes for EPSON TM-T100 (48 cols
 * at default font A). The layout mirrors the new visual design defined by
 * `client/src/components/Invoice.tsx` (commit 7109cd3) — translated into the
 * structural primitives an 80mm thermal printer can render in text mode:
 * brand header, dashed tagline, three-column meta strip, dashed divider,
 * date+invoice row, branch/cashier row, items table with a heavy "header
 * bar", subtotal/discount/VAT block, emphasised TOTAL bar, dashed thank-you
 * box, and a 3-segment footer.
 *
 * Encoding: CP1252 (Latin-1) is selected via `ESC t 16`, the same code page
 * used by the previously-working layout. Arabic glyphs in inbound data
 * still degrade to '?' at the byte level (see escpos.ts -> latin1()) — full
 * Arabic shaping is Phase-3 work and is intentionally out of scope here so
 * the working print pipeline is not destabilised.
 */

import { EscposBuilder } from "./escpos.js";

/** 80mm thermal at standard font A. */
const COLS = 48;

// Static brand info (matches Invoice.tsx defaults).
const BRAND = {
  cr: "1260008",
  ig: "lamst_anotha",
  tel: "94891122",
} as const;

export interface InvoiceItem {
  name: string;
  sku?: string;
  qty: number;
  price: number;
  total: number;
}

export interface Invoice {
  invoiceNo: string;
  date: string;
  cashier: string;
  branch: string;
  customerName?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paymentMethod: string;
}

// ─── Formatting helpers ──────────────────────────────────────────────────
const fmt3 = (n: number): string => (Number(n) || 0).toFixed(3);
const omr = (n: number): string => `${fmt3(n)} OMR`;

function repeat(ch: string, n: number): string {
  return n > 0 ? ch.repeat(n) : "";
}

function clip(s: string, max: number): string {
  if (max <= 0) return "";
  if (s.length <= max) return s;
  return s.slice(0, Math.max(1, max - 1)) + ".";
}

function leftAlign(s: string, width: number): string {
  if (s.length >= width) return s.slice(0, width);
  return s + repeat(" ", width - s.length);
}

function rightAlign(s: string, width: number): string {
  if (s.length >= width) return s.slice(0, width);
  return repeat(" ", width - s.length) + s;
}

function center(text: string, width: number = COLS): string {
  if (text.length >= width) return text;
  const left = Math.floor((width - text.length) / 2);
  return repeat(" ", left) + text + repeat(" ", width - text.length - left);
}

/** "Label............value" filling `width` columns. */
function pad(label: string, value: string, width: number = COLS): string {
  const sep = Math.max(1, width - label.length - value.length);
  return label + repeat(" ", sep) + value;
}

const SOLID = repeat("=", COLS);
const DASH = repeat("-", COLS);

/**
 * Compose the receipt as ESC/POS bytes. Caller pipes them to the printer
 * in RAW datatype (see rawPrint.ts). Layout mirrors Invoice.tsx.
 */
export function buildInvoiceBytes(invoice: Invoice): Buffer {
  const b = new EscposBuilder();

  b.init();
  b.codepage(16); // CP1252 (Latin-1) — see Phase-3 note above.

  // ─── 1. Brand header ────────────────────────────────────────────────
  // Big "LAMST ANOTHA" centered, then "TOUCH OF FEMININITY" between dashes.
  b.align(1);
  b.bold(true);
  b.size(1, 1); // 2× width × 2× height
  b.textln("LAMST ANOTHA");
  b.size(0, 0);
  b.bold(false);

  const tagline = "TOUCH OF FEMININITY";
  // Reserve 1 space on each side of the tagline.
  const sideDashes = Math.max(2, Math.floor((COLS - tagline.length - 2) / 2));
  b.textln(`${repeat("-", sideDashes)} ${tagline} ${repeat("-", sideDashes)}`);
  b.lf(1);

  // ─── 2. Three-column info strip (CR / IG / TEL) ─────────────────────
  // RTL design has Arabic labels; in CP1252 we use English equivalents so
  // they print legibly instead of as '?' placeholders.
  b.align(0);
  const colW = Math.floor(COLS / 3);
  const cr = `CR: ${BRAND.cr}`;
  const ig = `IG: ${BRAND.ig}`;
  const tel = `TEL: ${BRAND.tel}`;
  b.textln(
    leftAlign(cr, colW) +
      center(ig, colW) +
      rightAlign(tel, COLS - 2 * colW)
  );

  // ─── 3. Dashed divider ──────────────────────────────────────────────
  b.textln(DASH);

  // ─── 4. Invoice meta — Date+Time and Invoice No. ────────────────────
  // Mirrors the "date on right / black tag with invoice no. on left"
  // arrangement in the React design (collapsed to 48 cols).
  b.bold(true);
  b.textln(pad("DATE & TIME:", invoice.date));
  b.textln(pad("INVOICE NO.:", invoice.invoiceNo));
  b.bold(false);

  // ─── 5. Branch / Cashier row ────────────────────────────────────────
  // Same line if both fit, otherwise split.
  const branchLabel = "BRANCH:";
  const cashierLabel = "CASHIER:";
  const branchVal = clip(invoice.branch || "-", 18);
  const cashierVal = clip(invoice.cashier || "-", 14);
  const oneLine =
    `${branchLabel} ${branchVal}` + "    " + `${cashierLabel} ${cashierVal}`;
  if (oneLine.length <= COLS) {
    b.textln(
      pad(`${branchLabel} ${branchVal}`, `${cashierLabel} ${cashierVal}`)
    );
  } else {
    b.textln(`${branchLabel} ${branchVal}`);
    b.textln(`${cashierLabel} ${cashierVal}`);
  }
  if (invoice.customerName) {
    b.textln(`CUSTOMER: ${clip(invoice.customerName, COLS - 10)}`);
  }
  b.lf(1);

  // ─── 6. Items table ─────────────────────────────────────────────────
  // Heavy `=` lines around the bold header simulate the black-bg row in
  // the React design. Column widths sum to 48:
  //   #(2) + Item(26) + Qty(4) + Unit(7) + Total(9) = 48.
  const ITEM_COL = 26;
  const QTY_COL = 4;
  const UNIT_COL = 7;
  const TOTAL_COL = 9;

  b.textln(SOLID);
  b.bold(true);
  b.textln(
    leftAlign("#", 2) +
      leftAlign("Item", ITEM_COL) +
      rightAlign("Qty", QTY_COL) +
      rightAlign("Unit", UNIT_COL) +
      rightAlign("Total", TOTAL_COL)
  );
  b.bold(false);
  b.textln(SOLID);

  invoice.items.forEach((item, idx) => {
    const num = leftAlign(String(idx + 1), 2);
    const name = leftAlign(clip(item.name, ITEM_COL), ITEM_COL);
    const qty = rightAlign(String(item.qty), QTY_COL);
    const unit = rightAlign(fmt3(item.price), UNIT_COL);
    const total = rightAlign(fmt3(item.total), TOTAL_COL);
    b.textln(num + name + qty + unit + total);
    if (item.sku) {
      b.textln("   " + clip(`SKU: ${item.sku}`, COLS - 3));
    }
    if (idx < invoice.items.length - 1) {
      // Dashed inter-row divider as in Invoice.tsx (border-dashed).
      b.textln(repeat("- ", Math.floor(COLS / 2)));
    }
  });
  b.textln(SOLID);
  b.lf(1);

  // ─── 7. Summary block ───────────────────────────────────────────────
  b.textln(pad("Subtotal:", omr(invoice.subtotal)));
  b.textln(
    pad(
      "Discount:",
      invoice.discount > 0 ? `-${omr(invoice.discount)}` : omr(0)
    )
  );
  b.textln(pad("VAT (5%):", omr(invoice.tax)));
  b.lf(1);

  // ─── 8. TOTAL bar ───────────────────────────────────────────────────
  // Heavy `=` lines + 2× bold line mimic the black-bg total row.
  b.textln(SOLID);
  b.bold(true);
  b.size(1, 1);
  // Half COLS because size() doubles every glyph's width.
  b.textln(pad("TOTAL", omr(invoice.grandTotal), Math.floor(COLS / 2)));
  b.size(0, 0);
  b.bold(false);
  b.textln(SOLID);
  b.lf(1);

  b.textln(pad("Payment:", invoice.paymentMethod));
  b.lf(2);

  // ─── 9. Thank-you box (dashed border) ──────────────────────────────
  b.align(1);
  const boxTopBot = `+${repeat("-", COLS - 2)}+`;
  b.textln(boxTopBot);
  b.bold(true);
  b.textln(`|${center("<3   THANK YOU FOR YOUR TRUST   <3", COLS - 2)}|`);
  b.bold(false);
  b.textln(`|${center("We are happy to serve you", COLS - 2)}|`);
  b.textln(boxTopBot);
  b.lf(1);

  // ─── 10. Footer (3 segments, no QR — text-only fallback) ───────────
  b.textln("QUALITY & ELEGANCE   |   SHOP NOW WITH US");
  b.lf(2);

  // ─── 11. Partial cut ───────────────────────────────────────────────
  b.align(0);
  b.cutPartial(3);

  return b.build();
}
