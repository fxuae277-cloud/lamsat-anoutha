/**
 * printInvoice.ts — thermal 80mm receipt builder for Lamsat Anotha.
 *
 * Renders an invoice payload into ESC/POS bytes targeting EPSON TM-T100
 * (48 columns at standard size). The byte stream is what gets piped to
 * the Windows print queue via RAW datatype (see rawPrint.ts).
 */

import { EscposBuilder } from "./escpos.js";

/** Standard column count for 80mm thermal at default font A. */
const COLS = 48;

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

const fmt3 = (n: number): string => (Number(n) || 0).toFixed(3);

function padLine(label: string, value: string, width: number = COLS): string {
  const sep = Math.max(1, width - label.length - value.length);
  return label + " ".repeat(sep) + value;
}

function divider(ch: string = "-", width: number = COLS): string {
  return ch.repeat(width);
}

/** Hard-truncate to fit a column count; appends '…' when shortened. */
function clip(s: string, max: number): string {
  if (max <= 0) return "";
  if (s.length <= max) return s;
  return s.slice(0, Math.max(1, max - 1)) + "…";
}

/**
 * Compose the receipt as a single Buffer of ESC/POS bytes.
 * Caller is responsible for sending the bytes to the printer (RAW datatype).
 */
export function buildInvoiceBytes(invoice: Invoice): Buffer {
  const b = new EscposBuilder();

  b.init();
  b.codepage(16); // WPC1252 (Latin-1) — see README for Arabic note.

  // ── Brand header ─────────────────────────────────────────────────
  b.align(1); // center
  b.bold(true);
  b.size(1, 1); // 2× width × 2× height
  b.textln("LAMST ANOTHA");
  b.size(0, 0);
  b.bold(false);

  b.textln("CR: 1260008");
  b.textln("Instagram: lamst_anotha");
  b.textln("Admin Contact: 94891122");
  b.lf(1);

  // ── Invoice meta ─────────────────────────────────────────────────
  b.align(0); // left
  b.textln(divider("=", COLS));
  b.textln(padLine("Invoice:", invoice.invoiceNo));
  b.textln(padLine("Date:", invoice.date));
  b.textln(padLine("Branch:", clip(invoice.branch, COLS - "Branch:".length - 1)));
  b.textln(padLine("Cashier:", clip(invoice.cashier, COLS - "Cashier:".length - 1)));
  if (invoice.customerName) {
    b.textln(
      padLine(
        "Customer:",
        clip(invoice.customerName, COLS - "Customer:".length - 1)
      )
    );
  }
  b.textln(divider("=", COLS));

  // ── Items ────────────────────────────────────────────────────────
  for (const item of invoice.items) {
    b.textln(clip(item.name, COLS));
    if (item.sku) {
      b.textln("  SKU: " + clip(item.sku, COLS - 7));
    }
    const left = `  ${item.qty} x ${fmt3(item.price)}`;
    const right = fmt3(item.total);
    b.textln(padLine(left, right));
    b.textln(divider("-", COLS));
  }

  // ── Totals ───────────────────────────────────────────────────────
  b.textln(padLine("Subtotal:", fmt3(invoice.subtotal)));
  b.textln(
    padLine(
      "Discount:",
      invoice.discount > 0 ? "-" + fmt3(invoice.discount) : fmt3(0)
    )
  );
  b.textln(padLine("Tax:", fmt3(invoice.tax)));
  b.textln(divider("=", COLS));

  // GRAND TOTAL — emphasized: 2× width + bold. Width halves to 24 cols.
  b.bold(true);
  b.size(1, 1);
  b.textln(padLine("TOTAL:", fmt3(invoice.grandTotal), Math.floor(COLS / 2)));
  b.size(0, 0);
  b.bold(false);

  b.textln(padLine("Payment:", invoice.paymentMethod));
  b.textln(divider("=", COLS));

  // ── Footer ───────────────────────────────────────────────────────
  b.lf(1);
  b.align(1);
  b.textln("Thank you for shopping with us");
  b.lf(2);

  // ── Cut ──────────────────────────────────────────────────────────
  b.cutPartial(3);

  return b.build();
}
