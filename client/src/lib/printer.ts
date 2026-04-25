/**
 * printer.ts — QZ Tray ESC/POS integration for EPSON TM-T100
 * Direct thermal printing without browser dialog.
 * Requires QZ Tray desktop app running on the cashier machine.
 */

// QZ Tray global injected by the CDN script (async) in index.html
declare const qz: any;

// ─── ESC/POS command bytes ─────────────────────────────────────────────────────

const ESC = '\x1B';
const GS  = '\x1D';
const LF  = '\x0A';

const CMD = {
  // ESC @ — reset printer to factory defaults (must be first command)
  INIT:         ESC + '@',

  // ESC { 0 — disable upside-down printing mode (fixes inverted receipt bug)
  NO_INVERT:    ESC + '\x7B\x00',

  // ESC t 22 (0x16) — select Windows-1256 Arabic code page
  // This page maps Arabic Unicode characters to the correct printer bytes
  ARABIC_PAGE:  ESC + '\x74\x16',

  // ESC a n — text alignment
  ALIGN_LEFT:   ESC + 'a\x00',
  ALIGN_CENTER: ESC + 'a\x01',
  ALIGN_RIGHT:  ESC + 'a\x02',

  // ESC E n — bold text
  BOLD_ON:      ESC + 'E\x01',
  BOLD_OFF:     ESC + 'E\x00',

  // ESC ! n — character size (0x30 = double height + double width, 0x00 = normal)
  DOUBLE_ON:    ESC + '!\x30',
  DOUBLE_OFF:   ESC + '!\x00',

  // GS V 65 16 — partial cut with 16-dot paper feed before cut
  CUT:          GS  + '\x56\x41\x10',
};

// Default Windows print queue name for the receipt printer
const DEFAULT_PRINTER = 'EPSON TM-T100 Receipt';

// 80mm paper at standard density = 42 characters per line
const PAPER_WIDTH = 42;

// ─── Connection management ────────────────────────────────────────────────────

/**
 * Connect to QZ Tray WebSocket.
 * Safe to call multiple times — reuses the active connection to avoid
 * redundant reconnects on every print job.
 */
export async function connectQZ(): Promise<void> {
  if (typeof qz === 'undefined') {
    throw new Error(
      'QZ Tray script غير محمّل — تأكد من تشغيل تطبيق QZ Tray وأعد تحميل الصفحة'
    );
  }

  if (qz.websocket.isActive()) return; // already open — reuse

  try {
    await qz.websocket.connect();
  } catch (e: any) {
    throw new Error(
      `تعذّر الاتصال بـ QZ Tray — تأكد من تشغيل التطبيق على هذا الجهاز\n(${e.message ?? e})`
    );
  }
}

/** Disconnect from QZ Tray. Call on app teardown if needed. */
export async function disconnectQZ(): Promise<void> {
  if (typeof qz !== 'undefined' && qz.websocket.isActive()) {
    await qz.websocket.disconnect();
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReceiptItem {
  productName: string;
  quantity: number;
  unitPrice: number | string;
  color?: string;
}

export interface ReceiptData {
  invoiceNumber: string;
  items: ReceiptItem[];
  total: number;
  amountPaid?: number;
  changeAmount?: number;
  discount?: number;
  paymentMethod?: 'cash' | 'card' | 'bank_transfer' | string;
  customerName?: string | null;
  cashierName?: string;
  branchName?: string;
  createdAt?: string;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

const toNum = (v: string | number | null | undefined) =>
  parseFloat(String(v || '0')) || 0;

// OMR: 3 decimal places with thousands separator
const omr = (v: number) =>
  v.toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' OMR';

const SEPARATOR = '-'.repeat(PAPER_WIDTH) + LF;
const THICK_SEP = '='.repeat(PAPER_WIDTH) + LF;

/**
 * Two-column row.
 * Left text is left-padded; right text is right-aligned.
 * Total width = PAPER_WIDTH characters.
 * Works correctly with Arabic because windows-1256 is single-byte
 * (1 Arabic char = 1 printer column = 1 JS string char for padding math).
 */
function twoCol(left: string, right: string): string {
  const r = String(right);
  const maxLeft = PAPER_WIDTH - r.length - 1;
  const l = String(left).slice(0, Math.max(1, maxLeft)).padEnd(maxLeft);
  return l + ' ' + r + LF;
}

function payLabel(method: string): string {
  if (method === 'cash')          return 'نقدي';
  if (method === 'card')          return 'بطاقة';
  if (method === 'bank_transfer') return 'تحويل بنكي';
  return method;
}

// ─── Receipt builder ──────────────────────────────────────────────────────────

/**
 * Assembles the full ESC/POS byte sequence for one receipt.
 *
 * Encoding note: this is a JavaScript UTF-16 string containing both
 * control bytes (ESC/POS commands) and Arabic Unicode text. QZ Tray
 * converts the entire string to windows-1256 before sending raw bytes
 * to the printer. ASCII control bytes (< 0x80) survive the conversion
 * unchanged; Arabic chars are mapped to their windows-1256 equivalents.
 */
function buildReceipt(data: ReceiptData): string {
  const {
    invoiceNumber,
    items,
    total,
    amountPaid,
    changeAmount,
    discount,
    paymentMethod = 'cash',
    customerName,
    cashierName,
    branchName,
    createdAt,
  } = data;

  const dateStr = createdAt
    ? new Date(createdAt).toLocaleString('ar-OM')
    : new Date().toLocaleString('ar-OM');

  let r = '';

  // ── Boot sequence ─────────────────────────────────────────────────────
  r += CMD.INIT;         // ESC @ — full reset
  r += CMD.NO_INVERT;    // ESC { 0 — ensure normal (non-inverted) orientation
  r += CMD.ARABIC_PAGE;  // ESC t 22 — activate Windows-1256 Arabic code page

  // ── Store header (centered) ───────────────────────────────────────────
  r += CMD.ALIGN_CENTER;
  r += CMD.DOUBLE_ON + CMD.BOLD_ON;
  r += 'لمسة أنوثة' + LF;   // double-size bold title
  r += CMD.DOUBLE_OFF + CMD.BOLD_OFF;

  if (branchName) r += branchName + LF;
  r += LF;

  // ── Invoice metadata (left aligned) ───────────────────────────────────
  r += CMD.ALIGN_LEFT;
  r += SEPARATOR;
  r += twoCol('رقم الفاتورة:', invoiceNumber || '---');
  r += twoCol('التاريخ:', dateStr);
  if (cashierName) r += twoCol('الكاشير:', cashierName);
  if (customerName) r += twoCol('العميل:', customerName);
  r += SEPARATOR;

  // ── Items header ──────────────────────────────────────────────────────
  r += CMD.BOLD_ON;
  r += twoCol('المنتج', 'المبلغ');
  r += CMD.BOLD_OFF;
  r += SEPARATOR;

  // ── Line items (left aligned, price right-justified) ──────────────────
  for (const item of items) {
    const lineTotal = toNum(item.unitPrice) * item.quantity;
    const nameStr = item.color
      ? `${item.productName} (${item.color})`
      : item.productName;

    // Product name — truncated to paper width
    r += CMD.ALIGN_LEFT;
    r += nameStr.slice(0, PAPER_WIDTH) + LF;

    // Qty × unit price on left → line total right-justified
    r += twoCol(
      `  x${item.quantity}  @${omr(toNum(item.unitPrice))}`,
      omr(lineTotal)
    );
  }

  r += SEPARATOR;

  // ── Totals ────────────────────────────────────────────────────────────
  if (discount && toNum(discount) > 0) {
    r += twoCol('الخصم:', `- ${omr(toNum(discount))}`);
  }

  // Grand total — bold + right aligned
  r += CMD.ALIGN_RIGHT;
  r += CMD.BOLD_ON;
  r += 'الإجمالي: ' + omr(total) + LF;
  r += CMD.BOLD_OFF;
  r += CMD.ALIGN_LEFT;

  if (amountPaid !== undefined && toNum(amountPaid) > 0) {
    r += twoCol('المدفوع:', omr(toNum(amountPaid)));
  }
  if (changeAmount !== undefined && toNum(changeAmount) > 0) {
    r += twoCol('الباقي:', omr(toNum(changeAmount)));
  }
  r += twoCol('طريقة الدفع:', payLabel(paymentMethod));

  r += THICK_SEP;

  // ── Footer (centered) ─────────────────────────────────────────────────
  r += CMD.ALIGN_CENTER;
  r += 'شكراً لتسوقكم معنا' + LF;
  r += LF + LF; // extra feed before cut

  // GS V 65 16 — partial cut with paper feed
  r += CMD.CUT;

  return r;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Print a receipt directly to the thermal printer via QZ Tray.
 *
 * @param data        Receipt content (items, totals, customer, cashier…)
 * @param printerName Windows print queue name — falls back to DEFAULT_PRINTER
 *
 * Throws an Arabic error string on any failure so the caller can show it
 * directly in a toast or alert without extra formatting.
 */
export async function printReceipt(
  data: ReceiptData,
  printerName?: string
): Promise<void> {
  // Guard: ensure QZ Tray script finished loading
  if (typeof qz === 'undefined') {
    throw new Error(
      'QZ Tray غير محمّل — تحقق من تشغيل تطبيق QZ Tray وأعد تحميل الصفحة'
    );
  }

  // 1. Connect (reuses existing WebSocket if already active)
  await connectQZ();

  // 2. Locate the printer by name
  const targetName = printerName || DEFAULT_PRINTER;
  let resolvedName: string;
  try {
    const found: string[] = await qz.printers.find(targetName);
    if (!found || found.length === 0) {
      throw new Error(
        `الطابعة "${targetName}" غير موجودة — تحقق من اسم الطابعة في إعدادات الطباعة`
      );
    }
    resolvedName = found[0];
  } catch (e: any) {
    if (String(e.message).includes('غير موجودة')) throw e;
    throw new Error(`فشل البحث عن الطابعة: ${e.message ?? e}`);
  }

  // 3. Build and send the ESC/POS payload
  const config  = qz.configs.create(resolvedName);
  const payload = buildReceipt(data);

  await qz.print(config, [
    {
      type:   'raw',
      format: 'plain',
      data:   payload,
      options: {
        language: 'ESCPOS',
        // windows-1256: QZ Tray converts JS UTF-16 → windows-1256 bytes
        // before sending to the printer, enabling correct Arabic rendering
        encoding: 'windows-1256',
      },
    },
  ]);
}
