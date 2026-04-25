/**
 * printer.ts — QZ Tray image printing for EPSON TM-T100 (80mm thermal)
 *
 * HOW IT WORKS
 * ─────────────
 * 1. buildReceiptHtml()   → pure TABLE-based inline-CSS HTML (no flexbox)
 *                           html2canvas renders flexbox poorly in RTL —
 *                           <table> is the only reliable layout engine.
 * 2. receiptToBase64()    → off-screen DOM → html2canvas (scale:2) → PNG
 * 3. printReceiptAsImage() → QZ pixel/image print → separate raw cut
 *
 * WHY TABLE (not flex)
 * ─────────────────────
 * html2canvas v1.4.x has known rendering bugs with:
 *   • justify-content: space-between  (gaps are wrong in RTL)
 *   • flex-direction in RTL context   (order can reverse unexpectedly)
 * Tables give pixel-perfect two-column layout every time.
 *
 * SCALE MATH
 * ───────────
 * HTML width = 576px  ×  scale:2  =  1152px canvas
 * QZ Tray with units:'px', density:203 maps the image to the printer's
 * printable area (80mm paper ≈ 576 printable dots).  QZ automatically
 * downsamples 1152 → 576 dots, giving effectively 2× super-sampled output.
 * Result: sharp, dark, professional text.
 */

import html2canvas from 'html2canvas';

declare const qz: any;

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PRINTER = 'EPSON TM-T100 Receipt';
const RECEIPT_WIDTH   = 576;  // px — HTML element width before scale

// GS V 65 16 — partial cut with 16-dot paper feed
const CMD_CUT    = '\x1D\x56\x41\x10';
// ESC p 0 25 250 — cash drawer pulse on pin 0
const CMD_DRAWER = '\x1B\x70\x00\x19\xFA';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReceiptItem {
  productName: string;
  quantity:    number;
  unitPrice:   number | string;
  color?:      string;
}

export interface ReceiptData {
  invoiceNumber:  string;
  items:          ReceiptItem[];
  total:          number;
  amountPaid?:    number;
  changeAmount?:  number;
  discount?:      number;
  paymentMethod?: 'cash' | 'card' | 'bank_transfer' | string;
  customerName?:  string | null;
  cashierName?:   string;
  branchName?:    string;
  createdAt?:     string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toNum = (v: string | number | null | undefined) =>
  parseFloat(String(v ?? 0)) || 0;

const fmtOMR = (v: number) =>
  v.toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' ر.ع';

const payLabel = (m: string) =>
  ({ cash: 'نقدي', card: 'بطاقة', bank_transfer: 'تحويل بنكي' }
    as Record<string, string>)[m] ?? m;

// ─── QZ connection ────────────────────────────────────────────────────────────

/** Connect (or reuse existing WebSocket). Safe to call before every print. */
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
    throw new Error(`تعذّر الاتصال بـ QZ Tray — (${e.message ?? e})`);
  }
}

// ─── Printer detection ────────────────────────────────────────────────────────

/** Resolve Windows print-queue name via QZ Tray. */
export async function getReceiptPrinter(printerName?: string): Promise<string> {
  const target = printerName || DEFAULT_PRINTER;
  try {
    const found: string[] = await qz.printers.find(target);
    if (!found?.length) {
      throw new Error(
        `الطابعة "${target}" غير موجودة — تحقق من اسم الطابعة في الإعدادات`
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
 * Builds a self-contained HTML string using ONLY <table> for two-column
 * layouts and <div> borders for separators.
 *
 * Rules for html2canvas compatibility:
 *  ✓ All styles are inline (no external CSS)
 *  ✓ <table> for every label/value pair and item row
 *  ✓ <div style="border-top:..."> for separators (not <hr>)
 *  ✓ No flexbox, no grid, no CSS gap
 *  ✓ Explicit width on every table / cell
 *  ✓ direction:rtl on outer wrapper
 *  ✓ direction:ltr wrapping numbers so they read left-to-right
 *
 * Visual structure (80mm paper, RTL):
 *
 *  ┌─────────────────────────────────────┐
 *  │          لمسة أنوثة (30px bold)      │
 *  │           اسم الفرع (20px)           │
 *  ╞═════════════════════════════════════╡ 3px solid
 *  │ رقم الفاتورة:          INV-001       │
 *  │ التاريخ:               …             │
 *  │ الكاشير:               …             │
 *  │ العميل:                …             │
 *  ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤ 1px dashed
 *  │     المنتج         الكمية    المبلغ  │ (header)
 *  ╞═════════════════════════════════════╡ 2px solid
 *  │ حلق دائري ذهبي     ×1      1.600 ر.ع│
 *  │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │ 1px dashed
 *  │ قلادة لؤلؤ صغيرة   ×2      7.000 ر.ع│
 *  ╞═════════════════════════════════════╡ 2px solid
 *  │ الخصم:                  - 0.350 ر.ع │
 *  │ الإجمالي:               14.000 ر.ع  │ (26px bold)
 *  │ المدفوع:                15.000 ر.ع  │
 *  │ الباقي:                  1.000 ر.ع  │
 *  │ طريقة الدفع:            نقدي        │
 *  ╞═════════════════════════════════════╡ 3px solid
 *  │       شكراً لتسوقكم معنا 💝          │
 *  └─────────────────────────────────────┘
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

  // ── Reusable style strings ─────────────────────────────────────────────────
  const F = 'font-family:Tahoma,Arial,sans-serif;';  // font stack
  const W = `width:${RECEIPT_WIDTH - 40}px;`;        // inner table width

  const SEP_THICK = `<div style="border-top:3px solid #000;margin:12px 0;"></div>`;
  const SEP_MED   = `<div style="border-top:2px solid #000;margin:10px 0;"></div>`;
  const SEP_DASH  = `<div style="border-top:1px dashed #666;margin:8px 0;"></div>`;

  // Two-column table row (RIGHT = label, LEFT = value, Arabic)
  // RTL table: first column appears on the RIGHT of the page
  const metaRow = (label: string, value: string, bold = false) => `
    <tr>
      <td style="${F}font-size:22px;text-align:right;color:#222;padding:3px 0;
                  ${bold ? 'font-weight:bold;' : ''}vertical-align:middle;">
        ${label}
      </td>
      <td style="${F}font-size:22px;text-align:left;direction:ltr;color:#000;
                  padding:3px 0;${bold ? 'font-weight:bold;' : ''}
                  vertical-align:middle;">
        ${value}
      </td>
    </tr>`;

  // ── Items ─────────────────────────────────────────────────────────────────
  const itemRows = items.map((item, idx) => {
    const lineTotal = toNum(item.unitPrice) * item.quantity;
    const name      = item.color
      ? `${item.productName} (${item.color})`
      : item.productName;
    const isLast    = idx === items.length - 1;
    return `
      <tr>
        <td style="${F}font-size:22px;font-weight:bold;text-align:right;
                    color:#000;padding:7px 0 3px;vertical-align:top;width:55%;">
          ${name}
        </td>
        <td style="${F}font-size:20px;text-align:center;color:#444;
                    padding:7px 0 3px;vertical-align:top;width:20%;">
          ×${item.quantity}
        </td>
        <td style="${F}font-size:22px;font-weight:bold;text-align:left;
                    direction:ltr;color:#000;padding:7px 0 3px;
                    vertical-align:top;width:25%;">
          ${fmtOMR(lineTotal)}
        </td>
      </tr>
      <tr>
        <td colspan="2" style="${F}font-size:18px;color:#555;
                                  text-align:right;padding:0 0 6px;">
          @ ${fmtOMR(toNum(item.unitPrice))} للوحدة
        </td>
        <td></td>
      </tr>
      ${!isLast ? `<tr><td colspan="3" style="padding:0;">
        <div style="border-top:1px dashed #999;margin:2px 0;"></div>
      </td></tr>` : ''}`;
  }).join('');

  // ── Conditional totals rows ────────────────────────────────────────────────
  const discountRow = (discount && toNum(discount) > 0)
    ? metaRow('الخصم:', `- ${fmtOMR(toNum(discount))}`) : '';

  const paidRow = (amountPaid !== undefined && toNum(amountPaid) > 0)
    ? metaRow('المدفوع:', fmtOMR(toNum(amountPaid))) : '';

  const changeRow = (changeAmount !== undefined && toNum(changeAmount) > 0)
    ? metaRow('الباقي:', fmtOMR(toNum(changeAmount))) : '';

  // Grand total row gets its own larger styling
  const totalRow = `
    <tr>
      <td style="${F}font-size:26px;font-weight:bold;text-align:right;
                  color:#000;padding:6px 0;border-top:1px solid #ccc;
                  border-bottom:1px solid #ccc;">
        الإجمالي:
      </td>
      <td style="${F}font-size:26px;font-weight:bold;text-align:left;
                  direction:ltr;color:#000;padding:6px 0;
                  border-top:1px solid #ccc;border-bottom:1px solid #ccc;">
        ${fmtOMR(total)}
      </td>
    </tr>`;

  // ── Full HTML ──────────────────────────────────────────────────────────────
  return `
<div style="
  width:${RECEIPT_WIDTH}px;
  background:#ffffff;
  color:#000000;
  ${F}
  font-size:24px;
  line-height:1.5;
  direction:rtl;
  text-align:right;
  padding:20px;
  box-sizing:border-box;
">

  <!-- ══ STORE HEADER ══ -->
  <div style="${F}font-size:30px;font-weight:bold;text-align:center;
              color:#000;letter-spacing:1px;margin-bottom:2px;">
    لمسة أنوثة
  </div>

  ${branchName ? `
  <div style="${F}font-size:20px;text-align:center;color:#444;margin-bottom:6px;">
    ${branchName}
  </div>` : ''}

  ${SEP_THICK}

  <!-- ══ INVOICE META ══ -->
  <table style="${W}border-collapse:collapse;" cellpadding="0" cellspacing="0">
    <tbody>
      ${metaRow('رقم الفاتورة:', invoiceNumber || '---')}
      ${metaRow('التاريخ:', dateStr)}
      ${cashierName  ? metaRow('الكاشير:', cashierName)  : ''}
      ${customerName ? metaRow('العميل:',  customerName) : ''}
    </tbody>
  </table>

  ${SEP_DASH}

  <!-- ══ ITEMS HEADER ══ -->
  <table style="${W}border-collapse:collapse;" cellpadding="0" cellspacing="0">
    <thead>
      <tr>
        <th style="${F}font-size:20px;font-weight:bold;text-align:right;
                    color:#000;padding:4px 0;width:55%;">المنتج</th>
        <th style="${F}font-size:20px;font-weight:bold;text-align:center;
                    color:#000;padding:4px 0;width:20%;">الكمية</th>
        <th style="${F}font-size:20px;font-weight:bold;text-align:left;
                    direction:ltr;color:#000;padding:4px 0;width:25%;">المبلغ</th>
      </tr>
    </thead>
  </table>

  ${SEP_MED}

  <!-- ══ ITEMS ══ -->
  <table style="${W}border-collapse:collapse;" cellpadding="0" cellspacing="0">
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  ${SEP_MED}

  <!-- ══ TOTALS ══ -->
  <table style="${W}border-collapse:collapse;" cellpadding="0" cellspacing="0">
    <tbody>
      ${discountRow}
      ${totalRow}
      ${paidRow}
      ${changeRow}
      ${metaRow('طريقة الدفع:', payLabel(paymentMethod))}
    </tbody>
  </table>

  ${SEP_THICK}

  <!-- ══ FOOTER ══ -->
  <div style="${F}font-size:22px;text-align:center;color:#222;padding:8px 0 2px;">
    شكراً لتسوقكم معنا 💝
  </div>

  <!-- feed gap before cutter -->
  <div style="height:24px;"></div>

</div>`;
}

// ─── Canvas rendering ─────────────────────────────────────────────────────────

/**
 * Renders the receipt HTML in a hidden off-screen container,
 * captures it with html2canvas at scale:2, and returns a raw Base64
 * PNG string (no "data:image/png;base64," prefix).
 *
 * @param rotate180  Rotate canvas 180° before encoding — fixes upside-down output.
 */
async function receiptToBase64(htmlString: string, rotate180 = false): Promise<string> {
  // Container positioned off-screen — visible to html2canvas, hidden from user
  const wrapper = document.createElement('div');
  wrapper.style.cssText = [
    'position:fixed',
    'left:-9999px',
    'top:0',
    'z-index:-9999',
    'pointer-events:none',
    `width:${RECEIPT_WIDTH}px`,
    'background:#ffffff',
  ].join(';');
  wrapper.innerHTML = htmlString.trim();
  document.body.appendChild(wrapper);

  try {
    const el = wrapper.firstElementChild as HTMLElement;

    // scale:2 → canvas is 1152×H px → QZ downsamples to printer's ~576 dots
    // Result: 2× super-sampled text — sharp and professional
    const canvas = await html2canvas(el, {
      scale:           2,
      useCORS:         false,          // no external resources
      backgroundColor: '#ffffff',
      width:           RECEIPT_WIDTH,
      height:          el.scrollHeight,
      logging:         false,
    });

    let target = canvas;

    if (rotate180) {
      // Rotate 180° on a fresh canvas — fixes printers that feed paper upside-down
      const rotated = document.createElement('canvas');
      rotated.width  = canvas.width;
      rotated.height = canvas.height;
      const ctx = rotated.getContext('2d')!;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI);
      ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
      target = rotated;
    }

    // QZ Tray needs raw base64 — strip the data URI prefix
    return target.toDataURL('image/png').replace(/^data:image\/[^;]+;base64,/, '');

  } finally {
    document.body.removeChild(wrapper);
  }
}

// ─── Paper cut ────────────────────────────────────────────────────────────────

/** Send a partial-cut command to the printer (separate raw job). */
export async function cutPaper(printerName?: string): Promise<void> {
  await ensureQzConnected();
  const printer = await getReceiptPrinter(printerName);
  await qz.print(
    qz.configs.create(printer),
    [{ type: 'raw', format: 'plain', data: CMD_CUT }]
  );
}

// ─── Cash drawer ──────────────────────────────────────────────────────────────

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
 * Render the receipt to a high-quality PNG and print via QZ Tray.
 *
 * @param data         Receipt data (items, totals, customer, cashier…)
 * @param printerName  Windows print queue name — defaults to DEFAULT_PRINTER
 * @param rotate180    Set true if the receipt prints upside-down
 *
 * Throws an Arabic error string on failure — pass directly to a toast.
 */
export async function printReceiptAsImage(
  data:         ReceiptData,
  printerName?: string,
  rotate180 =   false,
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

  // 3. Build HTML → render with html2canvas (scale:2) → Base64 PNG
  const html   = buildReceiptHtml(data);
  const base64 = await receiptToBase64(html, rotate180);

  // 4. Send PNG via QZ pixel/image job
  //    units:'px' + density:203 → QZ maps the 1152px canvas to the
  //    printer's physical dots (80mm × 203 DPI ≈ 640 dots printable width)
  const imageConfig = qz.configs.create(printer, {
    units:         'px',
    density:       203,
    margins:       0,
    interpolation: 'nearest-neighbor',
  });

  await qz.print(imageConfig, [{
    type:   'pixel',
    format: 'image',
    flavor: 'base64',
    data:   base64,          // raw base64, no "data:image/png;base64," prefix
  }]);

  // 5. Cut paper — must be a separate raw job sent AFTER the image job
  await qz.print(
    qz.configs.create(printer),
    [{ type: 'raw', format: 'plain', data: CMD_CUT }]
  );
}

// ─── Test print ───────────────────────────────────────────────────────────────

/**
 * Print a full Arabic test receipt to verify the visual output.
 * Call from console: printTestReceiptAsImage()
 * Or wire to a "طباعة تجريبية" button in Settings.
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
        { productName: 'حلق دائري ذهبي',   quantity: 1, unitPrice: 1.600 },
        { productName: 'قلادة لؤلؤ صغيرة', quantity: 2, unitPrice: 3.500 },
        { productName: 'إسورة فضية ناعمة', quantity: 1, unitPrice: 5.750 },
      ],
      discount:      0.350,
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

/** Drop-in alias — existing call sites require no changes. */
export const printReceipt = printReceiptAsImage;
