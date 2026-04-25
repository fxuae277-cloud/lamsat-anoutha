/**
 * printer.ts — QZ Tray IMAGE printing for EPSON TM-T100
 *
 * Strategy: the browser renders the receipt to a PNG via html2canvas.
 * The PNG is sent to QZ Tray as a pixel/image job — no Arabic text is
 * ever sent as raw bytes, so encoding issues are eliminated completely.
 *
 * Flow:
 *  1. buildReceiptHtml()  → styled HTML string (RTL Arabic, inline CSS)
 *  2. receiptToBase64()   → off-screen DOM → html2canvas → Base64 PNG
 *  3. printReceiptAsImage() → QZ pixel print + raw cut command
 */

import html2canvas from 'html2canvas';

// QZ Tray global injected by the CDN script (async) in index.html
declare const qz: any;

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PRINTER = 'EPSON TM-T100 Receipt';

// 80mm paper: 576px is a reliable width for html2canvas rendering
const RECEIPT_WIDTH = 576;

// ESC/POS cut command — GS V 65 16 (partial cut with 16-dot feed)
const CMD_CUT = '\x1D\x56\x41\x10';

// ESC/POS cash drawer — ESC p 0 25 250 (pulse pin 0)
const CMD_DRAWER = '\x1B\x70\x00\x19\xFA';

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toNum = (v: string | number | null | undefined) =>
  parseFloat(String(v || '0')) || 0;

const omr = (v: number) =>
  v.toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' ر.ع';

const payLabel = (m: string) =>
  m === 'cash' ? 'نقدي' : m === 'card' ? 'بطاقة' : m === 'bank_transfer' ? 'تحويل بنكي' : m;

// ─── QZ connection ────────────────────────────────────────────────────────────

/**
 * Connect to QZ Tray WebSocket.
 * Reuses existing connection — safe to call before every print job.
 */
export async function ensureQzConnected(): Promise<void> {
  if (typeof qz === 'undefined') {
    throw new Error(
      'QZ Tray غير محمّل — تأكد من تشغيل تطبيق QZ Tray وأعد تحميل الصفحة'
    );
  }
  if (qz.websocket.isActive()) return;
  try {
    await qz.websocket.connect();
  } catch (e: any) {
    throw new Error(
      `تعذّر الاتصال بـ QZ Tray — تأكد من تشغيل التطبيق\n(${e.message ?? e})`
    );
  }
}

// ─── Printer detection ────────────────────────────────────────────────────────

/**
 * Find the printer by name in the Windows print queue.
 * Returns the resolved name as reported by QZ Tray.
 */
export async function getReceiptPrinter(printerName?: string): Promise<string> {
  const target = printerName || DEFAULT_PRINTER;
  try {
    const found: string[] = await qz.printers.find(target);
    if (!found || found.length === 0) {
      throw new Error(
        `الطابعة "${target}" غير موجودة — تحقق من اسم الطابعة في إعدادات الطباعة`
      );
    }
    return found[0];
  } catch (e: any) {
    if (String(e.message).includes('غير موجودة')) throw e;
    throw new Error(`فشل البحث عن الطابعة: ${e.message ?? e}`);
  }
}

// ─── Receipt HTML builder ─────────────────────────────────────────────────────

/**
 * Returns a self-contained HTML string for the receipt.
 *
 * All styles are inline so html2canvas renders them without needing
 * access to external stylesheets.  Arabic text is handled natively
 * by the browser — no ESC/POS encoding required.
 */
export function buildReceiptHtml(data: ReceiptData): string {
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

  // Two-column label/value row — label on right, value on left (RTL)
  const row = (label: string, value: string) => `
    <div style="display:flex;justify-content:space-between;align-items:baseline;
                padding:3px 0;font-size:13px;line-height:1.4;">
      <span style="direction:ltr;text-align:left;">${value}</span>
      <span>${label}</span>
    </div>`;

  // Full-width separator
  const sep = (thick = false) =>
    `<div style="border-top:${thick ? '2px solid #000' : '1px dashed #888'};margin:6px 0;"></div>`;

  // Item rows
  const itemRows = items.map(item => {
    const lineTotal = toNum(item.unitPrice) * item.quantity;
    const name = item.color
      ? `${item.productName} (${item.color})`
      : item.productName;
    return `
      <div style="padding:5px 0;">
        <div style="font-size:13px;font-weight:bold;margin-bottom:2px;">${name}</div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:#333;">
          <span style="direction:ltr;">${omr(lineTotal)}</span>
          <span>× ${item.quantity} &nbsp;@&nbsp; ${omr(toNum(item.unitPrice))}</span>
        </div>
      </div>
      <div style="border-top:1px dashed #ccc;"></div>`;
  }).join('');

  const discountRow = discount && toNum(discount) > 0
    ? row('الخصم:', `- ${omr(toNum(discount))}`)
    : '';

  const paidRow = amountPaid !== undefined && toNum(amountPaid) > 0
    ? row('المدفوع:', omr(toNum(amountPaid)))
    : '';

  const changeRow = changeAmount !== undefined && toNum(changeAmount) > 0
    ? row('الباقي:', omr(toNum(changeAmount)))
    : '';

  return `
<div style="
  width: ${RECEIPT_WIDTH}px;
  background: #fff;
  color: #000;
  font-family: Tahoma, Arial, sans-serif;
  direction: rtl;
  text-align: right;
  padding: 14px 18px;
  box-sizing: border-box;
">

  <!-- ── Header ── -->
  <div style="text-align:center;font-size:22px;font-weight:bold;
              letter-spacing:1px;margin-bottom:2px;">
    لمسة أنوثة
  </div>
  ${branchName
    ? `<div style="text-align:center;font-size:13px;color:#555;margin-bottom:4px;">${branchName}</div>`
    : ''}
  ${sep(true)}

  <!-- ── Invoice meta ── -->
  ${row('رقم الفاتورة:', invoiceNumber || '---')}
  ${row('التاريخ:', dateStr)}
  ${cashierName ? row('الكاشير:', cashierName) : ''}
  ${customerName ? row('العميل:', customerName) : ''}
  ${sep()}

  <!-- ── Items ── -->
  <div style="display:flex;justify-content:space-between;
              font-size:12px;font-weight:bold;padding:3px 0;">
    <span>المبلغ</span>
    <span>المنتج</span>
  </div>
  ${sep(true)}
  ${itemRows}
  ${sep(true)}

  <!-- ── Totals ── -->
  ${discountRow}

  <!-- Grand total — large, right aligned -->
  <div style="display:flex;justify-content:space-between;align-items:baseline;
              font-size:17px;font-weight:bold;padding:5px 0;">
    <span style="direction:ltr;">${omr(total)}</span>
    <span>الإجمالي</span>
  </div>

  ${paidRow}
  ${changeRow}
  ${row('طريقة الدفع:', payLabel(paymentMethod))}
  ${sep(true)}

  <!-- ── Footer ── -->
  <div style="text-align:center;font-size:13px;padding:6px 0;color:#333;">
    شكراً لتسوقكم معنا 💝
  </div>
  <div style="height:20px;"></div>

</div>`;
}

// ─── Canvas rendering ─────────────────────────────────────────────────────────

/**
 * Injects the receipt HTML off-screen, renders it with html2canvas,
 * and returns a Base64-encoded PNG string (without the data: prefix).
 *
 * @param rotate180  Set true if the printer outputs the image upside-down.
 *                   Rotates the canvas 180° before encoding.
 */
async function receiptToBase64(htmlString: string, rotate180 = false): Promise<string> {
  // Off-screen container — visible to html2canvas but not to the user
  const wrapper = document.createElement('div');
  wrapper.style.cssText = [
    'position:fixed',
    'left:-9999px',
    'top:0',
    'z-index:-9999',
    'pointer-events:none',
    `width:${RECEIPT_WIDTH}px`,
  ].join(';');
  wrapper.innerHTML = htmlString;
  document.body.appendChild(wrapper);

  try {
    const el = wrapper.firstElementChild as HTMLElement;

    const canvas = await html2canvas(el, {
      scale: 1,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: RECEIPT_WIDTH,
      logging: false,
      // Give html2canvas the full element height, not the viewport height
      windowWidth: RECEIPT_WIDTH,
      windowHeight: el.scrollHeight,
    });

    let target = canvas;

    if (rotate180) {
      // Draw onto a new canvas rotated 180° to fix upside-down output
      const rotated = document.createElement('canvas');
      rotated.width = canvas.width;
      rotated.height = canvas.height;
      const ctx = rotated.getContext('2d')!;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI); // 180 degrees
      ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
      target = rotated;
    }

    // Strip the "data:image/png;base64," prefix — QZ Tray wants raw base64
    return target.toDataURL('image/png').replace(/^data:image\/[^;]+;base64,/, '');
  } finally {
    document.body.removeChild(wrapper);
  }
}

// ─── Paper cut ────────────────────────────────────────────────────────────────

/** Send a partial-cut ESC/POS command to the printer. */
export async function cutPaper(printerName?: string): Promise<void> {
  await ensureQzConnected();
  const printer = await getReceiptPrinter(printerName);
  const cfg = qz.configs.create(printer);
  await qz.print(cfg, [{ type: 'raw', format: 'plain', data: CMD_CUT }]);
}

// ─── Cash drawer ──────────────────────────────────────────────────────────────

/** Pulse the cash drawer connected to the receipt printer. */
export async function openCashDrawer(printerName?: string): Promise<void> {
  await ensureQzConnected();
  const printer = await getReceiptPrinter(printerName);
  const cfg = qz.configs.create(printer);
  await qz.print(cfg, [{ type: 'raw', format: 'plain', data: CMD_DRAWER }]);
}

// ─── Main print function ──────────────────────────────────────────────────────

/**
 * Print a receipt as a PNG image via QZ Tray.
 *
 * @param data         Receipt data (items, totals, customer, cashier…)
 * @param printerName  Windows print queue name — falls back to DEFAULT_PRINTER
 * @param rotate180    Rotate the image 180° before printing (upside-down fix)
 *
 * Throws an Arabic error string on failure — pass it directly to a toast.
 */
export async function printReceiptAsImage(
  data: ReceiptData,
  printerName?: string,
  rotate180 = false,
): Promise<void> {
  if (typeof qz === 'undefined') {
    throw new Error(
      'QZ Tray غير محمّل — تحقق من تشغيل تطبيق QZ Tray وأعد تحميل الصفحة'
    );
  }

  // 1. Connect (reuses existing WebSocket)
  await ensureQzConnected();

  // 2. Resolve printer name
  const printer = await getReceiptPrinter(printerName);

  // 3. Render HTML → Base64 PNG (browser handles all Arabic rendering)
  const html   = buildReceiptHtml(data);
  const base64 = await receiptToBase64(html, rotate180);

  // 4. Print the image using QZ pixel/image mode
  const imageConfig = qz.configs.create(printer, {
    units: 'px',
    density: 203,                    // EPSON TM-T100 print density (DPI)
    margins: 0,                      // no margins — receipt starts at top
    interpolation: 'nearest-neighbor',
  });

  await qz.print(imageConfig, [{
    type:   'pixel',
    format: 'image',
    flavor: 'base64',
    data:   base64,                  // PNG without "data:image/png;base64," prefix
  }]);

  // 5. Cut paper — sent as a separate raw job after the image
  const rawConfig = qz.configs.create(printer);
  await qz.print(rawConfig, [{ type: 'raw', format: 'plain', data: CMD_CUT }]);
}

// ─── Test print ───────────────────────────────────────────────────────────────

/**
 * Print a test receipt with Arabic content to verify the setup.
 * Call from the browser console or a "طباعة تجريبية" button in Settings.
 */
export async function printTestReceiptAsImage(
  printerName?: string,
  rotate180 = false,
): Promise<void> {
  await printReceiptAsImage(
    {
      invoiceNumber: 'INV-TEST',
      branchName:    'لمسة أنوثة',
      cashierName:   'الكاشير',
      createdAt:     new Date().toISOString(),
      items: [
        { productName: 'حلق دائري ذهبي',   quantity: 1, unitPrice: 1.6 },
        { productName: 'قلادة لؤلؤ صغيرة', quantity: 2, unitPrice: 3.5 },
      ],
      total:         8.600,
      amountPaid:    10.000,
      changeAmount:  1.400,
      paymentMethod: 'cash',
    },
    printerName,
    rotate180,
  );
}

// ─── Backward-compatible alias ────────────────────────────────────────────────

/**
 * Drop-in replacement for the old printReceipt() — delegates to
 * printReceiptAsImage() so existing call sites need no changes.
 */
export const printReceipt = printReceiptAsImage;
