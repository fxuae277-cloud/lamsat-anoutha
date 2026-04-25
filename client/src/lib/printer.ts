/**
 * printer.ts — QZ Tray ESC/POS integration for EPSON TM-T100
 * Direct thermal printing without browser dialog.
 * Requires QZ Tray desktop app running on the cashier machine.
 */

// QZ Tray global injected by the CDN script in index.html
declare const qz: any;

// ─── ESC/POS command constants ────────────────────────────────────────────────

const ESC = '\x1B';
const GS  = '\x1D';
const LF  = '\x0A';

const CMD = {
  INIT:         ESC + '@',        // reset printer to defaults
  ALIGN_LEFT:   ESC + 'a\x00',   // left-align text
  ALIGN_CENTER: ESC + 'a\x01',   // center-align text
  ALIGN_RIGHT:  ESC + 'a\x02',   // right-align text
  BOLD_ON:      ESC + 'E\x01',   // bold on
  BOLD_OFF:     ESC + 'E\x00',   // bold off
  DOUBLE_ON:    ESC + '!\x30',   // double height + double width
  DOUBLE_OFF:   ESC + '!\x00',   // normal character size
  // ESC t 28 (0x1C) = code page CP864 (Arabic) on EPSON TM series
  CP864:        ESC + 't\x1C',
  // GS V 65 0 = partial cut with one-dot paper feed
  CUT:          GS  + 'V\x41\x00',
};

// Default printer name — matches the Windows print queue name
const DEFAULT_PRINTER = 'EPSON TM-T100 Receipt';

// 80mm paper at normal density = 42 printable characters per line
const PAPER_WIDTH = 42;

// ─── Connection management ────────────────────────────────────────────────────

/**
 * Connect to QZ Tray.  Safe to call multiple times — reuses the active
 * WebSocket if already open, avoiding redundant reconnects.
 */
export async function connectQZ(): Promise<void> {
  if (typeof qz === 'undefined') {
    throw new Error(
      'QZ Tray script غير محمّل — تأكد من إضافة السكريبت في index.html وإعادة تحميل الصفحة'
    );
  }

  if (qz.websocket.isActive()) return; // already connected — reuse

  try {
    await qz.websocket.connect();
  } catch (e: any) {
    throw new Error(
      `تعذّر الاتصال بـ QZ Tray — تأكد من تشغيل تطبيق QZ Tray على هذا الجهاز\n(${e.message ?? e})`
    );
  }
}

/** Disconnect from QZ Tray.  Call during app teardown if needed. */
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

const omr = (v: number) =>
  v.toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' ر.ع';

const SEPARATOR  = '-'.repeat(PAPER_WIDTH) + LF;
const THICK_SEP  = '='.repeat(PAPER_WIDTH) + LF;

/**
 * Two-column row: left text left-justified, right text right-justified.
 * Total width = PAPER_WIDTH.
 */
function twoCol(left: string, right: string): string {
  const r = String(right);
  const maxLeft = PAPER_WIDTH - r.length - 1;
  const l = String(left).slice(0, maxLeft).padEnd(maxLeft);
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
 * Produces a single ESC/POS string for the entire receipt.
 * QZ Tray encodes the Unicode string to CP864 before sending
 * to the printer, so Arabic characters print correctly.
 *
 * NOTE: Arabic RTL rendering depends on the printer firmware.
 * EPSON printers with Arabic firmware (CP864 support) handle
 * the bidirectional display automatically.
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

  // ── Initialization ────────────────────────────────────────────────────
  r += CMD.INIT;    // reset
  r += CMD.CP864;   // switch to Arabic code page CP864

  // ── Store header ──────────────────────────────────────────────────────
  r += CMD.ALIGN_CENTER;
  r += CMD.DOUBLE_ON + CMD.BOLD_ON;
  r += 'لمسة أنوثة' + LF;        // store title — double-size bold
  r += CMD.DOUBLE_OFF + CMD.BOLD_OFF;

  if (branchName) {
    r += branchName + LF;
  }
  r += LF;

  // ── Invoice meta ──────────────────────────────────────────────────────
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

  // ── Line items ────────────────────────────────────────────────────────
  for (const item of items) {
    const lineTotal = toNum(item.unitPrice) * item.quantity;
    const nameStr   = item.color
      ? `${item.productName} (${item.color})`
      : item.productName;

    // Product name on its own line, truncated to paper width
    r += CMD.ALIGN_LEFT;
    r += nameStr.slice(0, PAPER_WIDTH) + LF;

    // Qty × unit price  →  line total right-justified
    r += twoCol(`  x${item.quantity}  @${omr(toNum(item.unitPrice))}`, omr(lineTotal));
  }

  r += SEPARATOR;

  // ── Totals ────────────────────────────────────────────────────────────
  if (discount && toNum(discount) > 0) {
    r += twoCol('الخصم:', `- ${omr(toNum(discount))}`);
  }

  r += CMD.BOLD_ON;
  r += twoCol('الإجمالي:', omr(total));   // grand total in bold
  r += CMD.BOLD_OFF;

  if (amountPaid !== undefined && toNum(amountPaid) > 0) {
    r += twoCol('المدفوع:', omr(toNum(amountPaid)));
  }
  if (changeAmount !== undefined && toNum(changeAmount) > 0) {
    r += twoCol('الباقي:', omr(toNum(changeAmount)));
  }
  r += twoCol('طريقة الدفع:', payLabel(paymentMethod));

  r += THICK_SEP;

  // ── Footer ────────────────────────────────────────────────────────────
  r += CMD.ALIGN_CENTER;
  r += 'شكراً لتسوقكم معنا' + LF;
  r += LF + LF;

  // Cut paper (partial cut with one-dot feed)
  r += CMD.CUT;

  return r;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Print a receipt directly to the thermal printer via QZ Tray.
 *
 * @param data        Receipt content (items, totals, customer info, etc.)
 * @param printerName Windows print queue name — defaults to DEFAULT_PRINTER
 *
 * Throws a descriptive Arabic error string on any failure so the caller
 * can display it directly in a toast/alert.
 */
export async function printReceipt(
  data: ReceiptData,
  printerName?: string
): Promise<void> {
  // Guard: QZ Tray script must be loaded
  if (typeof qz === 'undefined') {
    throw new Error('QZ Tray غير محمّل — تحقق من تشغيل تطبيق QZ Tray وأعد تحميل الصفحة');
  }

  // Step 1: connect (reuses existing connection if active)
  await connectQZ();

  // Step 2: find the printer by name
  const targetName = printerName || DEFAULT_PRINTER;
  let resolvedName: string;
  try {
    const found: string[] = await qz.printers.find(targetName);
    if (!found || found.length === 0) {
      throw new Error(`الطابعة "${targetName}" غير موجودة — تحقق من اسم الطابعة في إعدادات الطباعة`);
    }
    resolvedName = found[0];
  } catch (e: any) {
    // Re-throw descriptive errors unchanged; wrap QZ internal errors
    if (String(e.message).includes('غير موجودة')) throw e;
    throw new Error(`فشل البحث عن الطابعة: ${e.message ?? e}`);
  }

  // Step 3: build and send the ESC/POS receipt
  const config  = qz.configs.create(resolvedName);
  const payload = buildReceipt(data);

  await qz.print(config, [
    {
      type:   'raw',
      format: 'plain',
      data:   payload,
      options: {
        language: 'ESCPOS',
        // QZ Tray converts the JavaScript UTF-16 string to CP864
        // before sending raw bytes to the printer (Arabic support)
        encoding: 'CP864',
      },
    },
  ]);
}
