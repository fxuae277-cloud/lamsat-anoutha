/**
 * printer.ts — QZ Tray high-quality image printing for EPSON TM-T100
 *
 * Arabic is rendered by the browser as a high-res PNG (html2canvas scale:2),
 * then sent to QZ Tray as a pixel/image job.
 * No ESC/POS text encoding — no Arabic encoding issues possible.
 *
 * Flow:
 *   buildReceiptHtml()  → inline-CSS RTL HTML (576px, 24px font)
 *   receiptToBase64()   → off-screen DOM → html2canvas (scale 2) → PNG base64
 *   printReceiptAsImage() → QZ pixel print → separate raw cut command
 */

import html2canvas from 'html2canvas';

declare const qz: any;

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PRINTER = 'EPSON TM-T100 Receipt';

// HTML receipt render width in pixels (80mm paper ≈ 576px at ~183 DPI)
const RECEIPT_WIDTH = 576;

// GS V 65 16 — partial cut with 16-dot paper feed before cut
const CMD_CUT = '\x1D\x56\x41\x10';

// ESC p 0 25 250 — cash drawer pulse on pin 0
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
  parseFloat(String(v ?? 0)) || 0;

const fmtOMR = (v: number) =>
  v.toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' ر.ع';

const payLabel = (m: string) =>
  ({ cash: 'نقدي', card: 'بطاقة', bank_transfer: 'تحويل بنكي' } as Record<string, string>)[m] ?? m;

// ─── QZ connection ────────────────────────────────────────────────────────────

/** Connect to QZ Tray WebSocket. Safe to call repeatedly — reuses open socket. */
export async function ensureQzConnected(): Promise<void> {
  if (typeof qz === 'undefined') {
    throw new Error('QZ Tray غير محمّل — تأكد من تشغيل تطبيق QZ Tray وأعد تحميل الصفحة');
  }
  if (qz.websocket.isActive()) return;
  try {
    await qz.websocket.connect();
  } catch (e: any) {
    throw new Error(`تعذّر الاتصال بـ QZ Tray — (${e.message ?? e})`);
  }
}

// ─── Printer detection ────────────────────────────────────────────────────────

/** Resolve the Windows print queue name via QZ Tray. */
export async function getReceiptPrinter(printerName?: string): Promise<string> {
  const target = printerName || DEFAULT_PRINTER;
  try {
    const found: string[] = await qz.printers.find(target);
    if (!found?.length) {
      throw new Error(`الطابعة "${target}" غير موجودة — تحقق من اسم الطابعة في الإعدادات`);
    }
    return found[0];
  } catch (e: any) {
    if (String(e.message).includes('غير موجودة')) throw e;
    throw new Error(`فشل البحث عن الطابعة: ${e.message ?? e}`);
  }
}

// ─── Receipt HTML builder ─────────────────────────────────────────────────────

/**
 * Builds a self-contained HTML string for the receipt.
 * All styles are inline — html2canvas does not read external CSS.
 * Arabic is rendered entirely by the browser; no encoding is needed.
 *
 * Layout (RTL, 576px wide, 24px base font):
 *
 *   ┌───────────────────────────────────┐
 *   │          لمسة أنوثة               │  ← 30px bold, centered
 *   │          اسم الفرع                │  ← 20px, centered
 *   ├═══════════════════════════════════┤  ← solid 2px border
 *   │  رقم الفاتورة  :  INV-001         │  ← meta rows (label right, value left)
 *   │  التاريخ       :  …               │
 *   │  الكاشير       :  …               │
 *   │  العميل        :  …               │
 *   ├───────────────────────────────────┤  ← dashed 1px
 *   │  اسم المنتج   كمية   المبلغ       │  ← items header
 *   ├───────────────────────────────────┤
 *   │  حلق دائري    ×1    1.600 ر.ع    │
 *   ├───────────────────────────────────┤
 *   │               الإجمالي: 1.600 ر.ع │  ← bold, large
 *   │               المدفوع:  2.000 ر.ع │
 *   │               الباقي:   0.400 ر.ع │
 *   │             طريقة الدفع:  نقدي    │
 *   ├═══════════════════════════════════┤
 *   │         شكراً لتسوقكم معنا 💝     │
 *   └───────────────────────────────────┘
 */
export function buildReceiptHtml(data: ReceiptData): string {
  const {
    invoiceNumber, items, total,
    amountPaid, changeAmount, discount,
    paymentMethod = 'cash',
    customerName, cashierName, branchName, createdAt,
  } = data;

  const dateStr = createdAt
    ? new Date(createdAt).toLocaleString('ar-OM')
    : new Date().toLocaleString('ar-OM');

  // ── Shared style snippets ──────────────────────────────────────────────────
  const FONT       = 'font-family:Tahoma,Arial,sans-serif;';
  const BORDER_S   = 'border-top:2px solid #000;margin:10px 0;';   // thick solid
  const BORDER_D   = 'border-top:1px dashed #555;margin:8px 0;';   // thin dashed
  const ROW_BASE   = `display:flex;justify-content:space-between;align-items:baseline;
                      padding:3px 0;${FONT}font-size:22px;line-height:1.5;`;

  // Label-value row: label on right (RTL start), value on left
  const metaRow = (label: string, value: string) => `
    <div style="${ROW_BASE}">
      <span style="direction:ltr;text-align:left;color:#111;">${value}</span>
      <span style="color:#333;">${label}</span>
    </div>`;

  // ── Item rows ──────────────────────────────────────────────────────────────
  const itemRows = items.map(item => {
    const lineTotal = toNum(item.unitPrice) * item.quantity;
    const name = item.color
      ? `${item.productName} (${item.color})`
      : item.productName;
    return `
      <div style="padding:6px 0;">
        <!-- product name — full width, right aligned -->
        <div style="${FONT}font-size:22px;font-weight:bold;
                    color:#000;line-height:1.4;text-align:right;">
          ${name}
        </div>
        <!-- qty + price row -->
        <div style="display:flex;justify-content:space-between;
                    ${FONT}font-size:20px;color:#333;padding-top:2px;">
          <span style="direction:ltr;font-weight:bold;color:#000;">
            ${fmtOMR(lineTotal)}
          </span>
          <span>× ${item.quantity} &nbsp;@&nbsp; ${fmtOMR(toNum(item.unitPrice))}</span>
        </div>
      </div>
      <div style="${BORDER_D}"></div>`;
  }).join('');

  // ── Conditional rows ───────────────────────────────────────────────────────
  const discountRow = discount && toNum(discount) > 0
    ? metaRow('الخصم:', `- ${fmtOMR(toNum(discount))}`) : '';

  const paidRow = amountPaid !== undefined && toNum(amountPaid) > 0
    ? metaRow('المدفوع:', fmtOMR(toNum(amountPaid))) : '';

  const changeRow = changeAmount !== undefined && toNum(changeAmount) > 0
    ? metaRow('الباقي:', fmtOMR(toNum(changeAmount))) : '';

  const branchLine = branchName
    ? `<div style="${FONT}font-size:20px;text-align:center;color:#444;
                   margin-bottom:6px;">${branchName}</div>` : '';

  // ── Full receipt HTML ──────────────────────────────────────────────────────
  return `
<div style="
  width:${RECEIPT_WIDTH}px;
  background:#ffffff;
  color:#000000;
  ${FONT}
  font-size:24px;
  line-height:1.5;
  direction:rtl;
  text-align:right;
  padding:20px;
  box-sizing:border-box;
">

  <!-- ══ Header ══ -->
  <div style="${FONT}font-size:30px;font-weight:bold;text-align:center;
              letter-spacing:1px;color:#000;margin-bottom:4px;">
    لمسة أنوثة
  </div>
  ${branchLine}
  <div style="${BORDER_S}"></div>

  <!-- ══ Invoice meta ══ -->
  ${metaRow('رقم الفاتورة:', invoiceNumber || '---')}
  ${metaRow('التاريخ:', dateStr)}
  ${cashierName  ? metaRow('الكاشير:', cashierName)  : ''}
  ${customerName ? metaRow('العميل:',  customerName) : ''}
  <div style="${BORDER_D}"></div>

  <!-- ══ Items header ══ -->
  <div style="display:flex;justify-content:space-between;
              ${FONT}font-size:20px;font-weight:bold;
              color:#000;padding:4px 0;">
    <span>المبلغ</span>
    <span>المنتج</span>
  </div>
  <div style="${BORDER_S}"></div>

  <!-- ══ Line items ══ -->
  ${itemRows}

  <!-- ══ Totals ══ -->
  ${discountRow}

  <!-- Grand total — prominent -->
  <div style="display:flex;justify-content:space-between;align-items:baseline;
              ${FONT}font-size:26px;font-weight:bold;
              color:#000;padding:6px 0;">
    <span style="direction:ltr;">${fmtOMR(total)}</span>
    <span>الإجمالي</span>
  </div>

  ${paidRow}
  ${changeRow}
  ${metaRow('طريقة الدفع:', payLabel(paymentMethod))}

  <div style="${BORDER_S}"></div>

  <!-- ══ Footer ══ -->
  <div style="${FONT}font-size:22px;text-align:center;
              color:#222;padding:8px 0 4px;">
    شكراً لتسوقكم معنا 💝
  </div>

  <!-- blank feed space before cut -->
  <div style="height:24px;"></div>

</div>`;
}

// ─── Canvas rendering ─────────────────────────────────────────────────────────

/**
 * Renders the receipt HTML off-screen with html2canvas (scale: 2 for sharpness),
 * returns a raw Base64 PNG string (no "data:image/png;base64," prefix).
 *
 * @param rotate180  Rotate 180° before encoding — fixes upside-down output.
 */
async function receiptToBase64(htmlString: string, rotate180 = false): Promise<string> {
  // Off-screen container — in the DOM but out of view
  const wrapper = document.createElement('div');
  wrapper.style.cssText = [
    'position:fixed',
    'left:-9999px',
    'top:0',
    'z-index:-9999',
    'pointer-events:none',
    `width:${RECEIPT_WIDTH}px`,
  ].join(';');
  wrapper.innerHTML = htmlString.trim();
  document.body.appendChild(wrapper);

  try {
    const el = wrapper.firstElementChild as HTMLElement;

    // scale: 2 → 2× pixel density → sharp text on thermal printer
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: RECEIPT_WIDTH,
      logging: false,
      // Prevent html2canvas from using the visible viewport size
      windowWidth: RECEIPT_WIDTH,
      windowHeight: el.scrollHeight,
    });

    let target = canvas;

    if (rotate180) {
      // Draw onto a new canvas rotated 180° to correct upside-down output
      const rotated = document.createElement('canvas');
      rotated.width  = canvas.width;
      rotated.height = canvas.height;
      const ctx = rotated.getContext('2d')!;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI);
      ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
      target = rotated;
    }

    // Strip the data URI prefix — QZ Tray needs raw base64 only
    return target.toDataURL('image/png').replace(/^data:image\/[^;]+;base64,/, '');

  } finally {
    document.body.removeChild(wrapper);
  }
}

// ─── Individual ESC/POS commands ─────────────────────────────────────────────

/** Partial-cut the paper (sent as a separate raw job after the image). */
export async function cutPaper(printerName?: string): Promise<void> {
  await ensureQzConnected();
  const printer = await getReceiptPrinter(printerName);
  await qz.print(
    qz.configs.create(printer),
    [{ type: 'raw', format: 'plain', data: CMD_CUT }]
  );
}

/** Pulse the cash drawer connected to the receipt printer. */
export async function openCashDrawer(printerName?: string): Promise<void> {
  await ensureQzConnected();
  const printer = await getReceiptPrinter(printerName);
  await qz.print(
    qz.configs.create(printer),
    [{ type: 'raw', format: 'plain', data: CMD_DRAWER }]
  );
}

// ─── Main print function ──────────────────────────────────────────────────────

/**
 * Render the receipt to a high-quality PNG and print it via QZ Tray.
 *
 * @param data         Receipt data (items, totals, customer, cashier…)
 * @param printerName  Windows print queue name — defaults to DEFAULT_PRINTER
 * @param rotate180    Rotate image 180° before printing (upside-down fix)
 *
 * On any failure throws an Arabic error string suitable for direct toast display.
 */
export async function printReceiptAsImage(
  data: ReceiptData,
  printerName?: string,
  rotate180 = false,
): Promise<void> {
  if (typeof qz === 'undefined') {
    throw new Error('QZ Tray غير محمّل — تحقق من تشغيل تطبيق QZ Tray وأعد تحميل الصفحة');
  }

  // 1. Connect (reuses existing WebSocket if already active)
  await ensureQzConnected();

  // 2. Resolve printer name in the Windows print queue
  const printer = await getReceiptPrinter(printerName);

  // 3. Render HTML → high-res PNG via html2canvas (browser handles Arabic)
  const html   = buildReceiptHtml(data);
  const base64 = await receiptToBase64(html, rotate180);

  // 4. Print the PNG via QZ pixel/image mode
  const imageConfig = qz.configs.create(printer, {
    units: 'px',
    density: 203,                     // EPSON TM-T100 print resolution (DPI)
    margins: 0,                       // no margins — receipt starts at paper edge
    interpolation: 'nearest-neighbor',
  });

  await qz.print(imageConfig, [{
    type:   'pixel',
    format: 'image',
    flavor: 'base64',
    data:   base64,                   // raw base64 PNG, no data: prefix
  }]);

  // 5. Send cut command as a separate raw job (after image finishes)
  await qz.print(
    qz.configs.create(printer),
    [{ type: 'raw', format: 'plain', data: CMD_CUT }]
  );
}

// ─── Test print ───────────────────────────────────────────────────────────────

/**
 * Print a test receipt with Arabic content to verify the full pipeline.
 * Call from the browser console or a "طباعة تجريبية" button in Settings.
 *
 * Example:
 *   import { printTestReceiptAsImage } from '@/lib/printer';
 *   printTestReceiptAsImage();
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
        { productName: 'حلق دائري ذهبي',   quantity: 1, unitPrice: 1.6  },
        { productName: 'قلادة لؤلؤ صغيرة', quantity: 2, unitPrice: 3.5  },
        { productName: 'إسورة فضية ناعمة', quantity: 1, unitPrice: 5.75 },
      ],
      discount:      0.35,
      total:         14.000,
      amountPaid:    15.000,
      changeAmount:   1.000,
      paymentMethod: 'cash',
    },
    printerName,
    rotate180,
  );
}

// ─── Backward-compatible alias ────────────────────────────────────────────────

/**
 * Alias kept so existing import sites don't need updating.
 * Delegates directly to printReceiptAsImage().
 */
export const printReceipt = printReceiptAsImage;
